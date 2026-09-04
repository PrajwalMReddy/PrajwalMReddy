const DEFAULT_LOCAL_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'mistral';

export const getStoredOllamaSettings = () => {
    try {
        const storedUrl = localStorage.getItem('admin_ollama_url');
        const storedModel = localStorage.getItem('admin_ollama_model');
        return {
            ollamaUrl: storedUrl || DEFAULT_LOCAL_OLLAMA_URL,
            model: storedModel || DEFAULT_MODEL,
        };
    } catch {
        return {
            ollamaUrl: DEFAULT_LOCAL_OLLAMA_URL,
            model: DEFAULT_MODEL,
        };
    }
};

export const saveStoredOllamaSettings = (settings) => {
    try {
        if (settings.ollamaUrl) localStorage.setItem('admin_ollama_url', settings.ollamaUrl);
        if (settings.model) localStorage.setItem('admin_ollama_model', settings.model);
    } catch (e) {
        console.warn('Could not save Ollama settings to localStorage:', e);
    }
};

/**
 * Extract structured action proposals from model output
 */
export function extractClientActionProposals(content) {
    const actions = [];
    if (!content) return actions;

    const taskRegex = /```(?:action:create_task|json:create_task)\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.title) {
                actions.push({
                    type: 'CREATE_TASK',
                    payload: {
                        title: String(parsed.title).trim(),
                        priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
                        dueDate: parsed.dueDate ? String(parsed.dueDate).slice(0, 10) : null,
                    },
                });
            }
        } catch {
            // Ignore parse errors from LLM output
        }
    }

    return actions;
}

/**
 * Check Ollama health via server proxy or direct fallback
 */
export const checkAIHealth = async () => {
    try {
        const res = await fetch('/api/ai/chat', {
            method: 'GET',
            credentials: 'include',
            signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ok') {
                return {
                    status: 'connected',
                    mode: 'server_proxy',
                    model: data.configuredModel || data.model || 'mistral',
                    models: data.availableModels || [],
                };
            }
        }
    } catch (e) {
        console.warn('Server proxy health check failed:', e);
    }

    // Direct local Ollama check fallback (e.g. for prajwalmreddy.com on Vercel)
    const { ollamaUrl, model } = getStoredOllamaSettings();
    try {
        const localRes = await fetch(`${ollamaUrl}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3500),
        });
        if (localRes.ok) {
            const data = await localRes.json();
            const models = (data.models || []).map((m) => m.name || m.model);
            return {
                status: 'connected',
                mode: 'local_direct',
                model,
                models,
            };
        }
    } catch (e) {
        return {
            status: 'offline',
            error: 'Local Ollama is unreachable. Ensure Ollama is running (`ollama serve`).',
        };
    }

    return {
        status: 'offline',
        error: 'Unable to connect to Ollama.',
    };
};

/**
 * Main AI request function
 * Accepts either:
 * - requestAI(messagesArray, options)
 * - requestAI({ message, action, history, noteId, query, model })
 * - requestAI(queryString, options)
 */
export const requestAI = async (messagesOrPayload, options = {}) => {
    let messages = [];
    let opts = { ...options };

    if (Array.isArray(messagesOrPayload)) {
        messages = [...messagesOrPayload];
    } else if (typeof messagesOrPayload === 'string') {
        messages = [{ role: 'user', content: messagesOrPayload }];
    } else if (messagesOrPayload && typeof messagesOrPayload === 'object') {
        opts = { ...messagesOrPayload, ...options };
        if (Array.isArray(messagesOrPayload.messages)) {
            messages = [...messagesOrPayload.messages];
        } else {
            messages = Array.isArray(messagesOrPayload.history) ? [...messagesOrPayload.history] : [];
            if (messagesOrPayload.message) {
                messages.push({ role: 'user', content: String(messagesOrPayload.message) });
            }
        }
    }

    const { action, noteId, query, model, onToken } = opts;
    const resolvedQuery = query || (messages.length > 0 ? [...messages].reverse().find((m) => m.role === 'user')?.content : '');

    let serverData;
    let serverOk = false;

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(onToken ? { Accept: 'text/event-stream' } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({
                messages,
                action,
                noteId,
                query: resolvedQuery,
                model,
                stream: Boolean(onToken),
            }),
        });

        serverOk = response.ok;
        const contentType = response.headers.get('content-type') || '';

        // Handle SSE streaming from server proxy
        if (serverOk && contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';
            let streamResult = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop(); // keep last chunk

                for (const chunk of lines) {
                    const line = chunk.trim();
                    if (!line.startsWith('data:')) continue;
                    try {
                        const parsed = JSON.parse(line.slice(5).trim());
                        if (parsed.token) {
                            fullContent = parsed.content || fullContent + parsed.token;
                            if (onToken) onToken(parsed.token, fullContent);
                        }
                        if (parsed.done) {
                            streamResult = parsed;
                        }
                        if (parsed.error && parsed.fallbackAvailable) {
                            serverData = parsed;
                        }
                    } catch {
                        // ignore parse errors on chunk boundaries
                    }
                }
            }

            if (streamResult) {
                return {
                    content: streamResult.content || fullContent,
                    reply: streamResult.content || fullContent,
                    proposedActions: streamResult.proposedActions || extractClientActionProposals(fullContent),
                    model: streamResult.model,
                    mode: 'server_proxy_stream',
                };
            }
        }

        if (!serverData) {
            serverData = await response.json().catch(() => ({}));
        }
    } catch (err) {
        console.warn('Fetch to /api/ai/chat failed:', err);
    }

    // Case 1: Server successfully proxied the request to Ollama (non-streaming)
    if (serverOk && serverData?.success) {
        const content = serverData.content || '';
        return {
            content,
            reply: content, // alias for backwards compatibility
            proposedActions: serverData.proposedActions || [],
            model: serverData.model,
            mode: 'server_proxy',
        };
    }

    // Case 2: Server received the request and prepared context, but server cannot reach Ollama
    // (e.g. running on Vercel cloud and trying to reach the user's laptop at localhost)
    if (serverData?.systemPrompt || serverData?.context) {
        const { ollamaUrl, model: storedModel } = getStoredOllamaSettings();
        const activeModel = model || serverData.model || storedModel;
        try {
            const localMessages = [];
            if (serverData.systemPrompt) {
                localMessages.push({ role: 'system', content: serverData.systemPrompt });
            }
            if (Array.isArray(messages) && messages.length > 0) {
                localMessages.push(...messages);
            } else if (action) {
                const actionPrompts = {
                    focus_today: 'What should I focus on today? Summarize my top priorities.',
                    summarize_overdue: 'Summarize all my overdue tasks and suggest what to tackle first.',
                    summarize_notes: 'Summarize my recent notes and highlight key action items.',
                    analyze_spending: 'Analyze my spending this month, top categories, and cash flow.',
                    unusual_spending: 'Identify any unusual or high spending this month.',
                    note_to_tasks: 'Turn the selected note into actionable tasks.',
                };
                localMessages.push({
                    role: 'user',
                    content: actionPrompts[action] || 'Summarize my dashboard status.',
                });
            }

            const directRes = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: activeModel,
                    messages: localMessages,
                    stream: Boolean(onToken),
                    keep_alive: '60m',
                    options: {
                        temperature: 0.7,
                        num_predict: 250,
                        num_ctx: 2048,
                    },
                }),
                signal: AbortSignal.timeout(90000),
            });

            if (!directRes.ok) {
                const directErrData = await directRes.json().catch(() => ({}));
                throw new Error(directErrData.error || `Local Ollama error: HTTP ${directRes.status}`);
            }

            if (onToken && directRes.body) {
                const reader = directRes.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullContent = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const parsed = JSON.parse(trimmed);
                            const token = parsed.message?.content || '';
                            if (token) {
                                fullContent += token;
                                onToken(token, fullContent);
                            }
                        } catch {}
                    }
                }

                return {
                    content: fullContent,
                    reply: fullContent,
                    proposedActions: extractClientActionProposals(fullContent),
                    model: activeModel,
                    mode: 'local_direct_stream',
                };
            }

            const directData = await directRes.json();
            const content = directData.message?.content || '';
            const proposedActions = extractClientActionProposals(content);

            return {
                content,
                reply: content, // alias for backwards compatibility
                proposedActions,
                model: directData.model || activeModel,
                mode: 'local_direct',
            };
        } catch (directErr) {
            console.error('Direct local Ollama request failed:', directErr);
            if (directErr.message?.includes('Failed to fetch') || directErr.name === 'TypeError') {
                throw new Error(
                    'Cannot connect to local Ollama from browser. If on prajwalmreddy.com, ensure Ollama has OLLAMA_ORIGINS configured (e.g. setx OLLAMA_ORIGINS "https://prajwalmreddy.com,*") and Ollama is restarted.'
                );
            }
            throw new Error(directErr.message || 'Failed to generate AI response.');
        }
    }

    // Case 3: Error from server
    if (serverData?.error) {
        throw new Error(serverData.error);
    }

    throw new Error('Unable to communicate with AI assistant.');
};
