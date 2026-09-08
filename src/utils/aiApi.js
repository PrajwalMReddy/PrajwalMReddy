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

    // 1. Tasks
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

    // 2. Goals
    const goalRegex = /```(?:action:create_goal|json:create_goal)\s*([\s\S]*?)\s*```/g;
    while ((match = goalRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.title) {
                actions.push({
                    type: 'CREATE_GOAL',
                    payload: {
                        title: String(parsed.title).trim(),
                        description: parsed.description ? String(parsed.description).trim() : '',
                        targetDate: parsed.targetDate ? String(parsed.targetDate).slice(0, 10) : null,
                        category: parsed.category || 'General',
                    },
                });
            }
        } catch {}
    }

    // 3. Projects
    const projectRegex = /```(?:action:create_project|json:create_project)\s*([\s\S]*?)\s*```/g;
    while ((match = projectRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.name) {
                actions.push({
                    type: 'CREATE_PROJECT',
                    payload: {
                        name: String(parsed.name).trim(),
                        description: parsed.description ? String(parsed.description).trim() : '',
                        targetDate: parsed.targetDate ? String(parsed.targetDate).slice(0, 10) : null,
                        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    },
                });
            }
        } catch {}
    }

    // 4. Remember fact
    const rememberRegex = /```(?:action:remember_fact|json:remember_fact)\s*([\s\S]*?)\s*```/g;
    while ((match = rememberRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.fact) {
                actions.push({
                    type: 'REMEMBER_FACT',
                    payload: {
                        fact: String(parsed.fact).trim(),
                        category: parsed.category || 'general',
                        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    },
                });
            }
        } catch {}
    }

    // 5. Forget memory
    const forgetRegex = /```(?:action:forget_memory|json:forget_memory)\s*([\s\S]*?)\s*```/g;
    while ((match = forgetRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.query || parsed.id) {
                actions.push({
                    type: 'FORGET_MEMORY',
                    payload: {
                        query: parsed.query ? String(parsed.query).trim() : null,
                        id: parsed.id ? String(parsed.id).trim() : null,
                    },
                });
            }
        } catch {}
    }

    return actions;
}

/**
 * Extract client tool calls from raw model text if model generated JSON or syntax
 */
export function extractClientToolCallsFromText(content) {
    if (!content || typeof content !== 'string') return null;
    const knownNames = [
        'get_weather', 'search_expenses', 'get_spending_summary', 'search_web', 'get_tasks',
        'get_notes', 'search_memory', 'remember_fact', 'forget_memory',
        'get_goals', 'get_projects', 'get_live_news'
    ];

    const toolCalls = [];

    // 1. Array format: [{"name": "...", "arguments": ...}] or [TOOL_CALLS] [...]
    const jsonArrayMatch = content.match(/(?:\[TOOL_CALLS\]\s*)?(\[\s*\{[\s\S]*?"name"[\s\S]*?\}\s*\])/i);
    if (jsonArrayMatch) {
        try {
            const parsed = JSON.parse(jsonArrayMatch[1]);
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    if (item.name && knownNames.includes(item.name)) {
                        toolCalls.push({
                            function: {
                                name: item.name,
                                arguments: typeof item.arguments === 'string' ? JSON.parse(item.arguments) : (item.arguments || {}),
                            },
                        });
                    }
                }
            }
        } catch {}
    }

    if (toolCalls.length > 0) return toolCalls;

    // 2. Single object format: {"name": "...", "arguments": {...}}
    const singleObjMatch = content.match(/\{\s*"name"\s*:\s*"(\w+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/i);
    if (singleObjMatch) {
        try {
            const fnName = singleObjMatch[1];
            if (knownNames.includes(fnName)) {
                toolCalls.push({
                    function: {
                        name: fnName,
                        arguments: JSON.parse(singleObjMatch[2]),
                    },
                });
            }
        } catch {}
    }

    if (toolCalls.length > 0) return toolCalls;

    // 3. [tool_name(...)], `tool_name(...)`, or bare tool_name(...)
    for (const name of knownNames) {
        const fnRegex = new RegExp(`(?:\\[|\`|\\b)(${name})\\s*\\(([^)]*)\\)(?:\\]|\`|\\b)?`, 'gi');
        let match;
        while ((match = fnRegex.exec(content)) !== null) {
            const rawArgs = match[2].trim();
            // 3a. JSON object: {"key": "val"}
            try {
                if (rawArgs.startsWith('{') && rawArgs.endsWith('}')) {
                    toolCalls.push({
                        function: {
                            name: match[1],
                            arguments: JSON.parse(rawArgs),
                        },
                    });
                    break;
                }
            } catch {}

            // 3b. Single quoted string: "Panama" or 'Krispy Kreme'
            const quotedStrMatch = rawArgs.match(/^["']([^"']+)["']$/);
            if (quotedStrMatch) {
                const defaultParam = (match[1].toLowerCase() === 'get_weather') ? 'location' : 'query';
                toolCalls.push({
                    function: {
                        name: match[1],
                        arguments: { [defaultParam]: quotedStrMatch[1] },
                    },
                });
                break;
            }

            // 3c. Kwargs style: key="value" or key='value' or key=value or key=123
            const kwargRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s)]+))/g;
            let km;
            const parsedArgs = {};
            while ((km = kwargRegex.exec(rawArgs)) !== null) {
                const val = km[2] !== undefined ? km[2] : (km[3] !== undefined ? km[3] : km[4]);
                parsedArgs[km[1]] = val === 'true' ? true : (val === 'false' ? false : (!isNaN(Number(val)) && val.trim() !== '' ? Number(val) : val));
            }
            if (Object.keys(parsedArgs).length > 0) {
                toolCalls.push({
                    function: {
                        name: match[1],
                        arguments: parsedArgs,
                    },
                });
                break;
            }

            // 3d. Plain/unquoted single string: e.g. Krispy Kreme or Panama
            const cleanArg = rawArgs.replace(/^["']|["']$/g, '').trim();
            if (cleanArg && !cleanArg.includes('=') && !cleanArg.startsWith('{')) {
                if (!['query', 'location', 'status', 'fact', 'category'].includes(cleanArg.toLowerCase())) {
                    const defaultParam = (match[1].toLowerCase() === 'get_weather') ? 'location' : 'query';
                    toolCalls.push({
                        function: {
                            name: match[1],
                            arguments: { [defaultParam]: cleanArg },
                        },
                    });
                    break;
                }
            }
        }
    }

    return toolCalls.length > 0 ? toolCalls : null;
}

/**
 * Execute tool call on server via /api/ai/tools
 */
export async function executeClientToolCall(name, args = {}) {
    try {
        const res = await fetch('/api/ai/tools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, arguments: args }),
        });
        if (res.ok) {
            const data = await res.json();
            return data.result || data;
        }
        return { error: `Tool execution HTTP ${res.status}` };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Check Ollama health via server proxy or direct fallback
 */
export const checkAIHealth = async () => {
    try {
        const res = await fetch('/api/ai/chat', {
            method: 'GET',
            credentials: 'include',
            signal: AbortSignal.timeout(3000),
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
            // If server reports cloud_fallback or offline, proceed to direct local Ollama check
        }
    } catch (e) {
        console.warn('Server proxy health check failed:', e);
    }

    // Direct local Ollama check fallback (e.g. for prajwalmreddy.com on Vercel)
    const { ollamaUrl, model } = getStoredOllamaSettings();
    const candidateUrls = [ollamaUrl];
    if (ollamaUrl.includes('localhost')) {
        candidateUrls.push(ollamaUrl.replace('localhost', '127.0.0.1'));
    } else if (ollamaUrl.includes('127.0.0.1')) {
        candidateUrls.push(ollamaUrl.replace('127.0.0.1', 'localhost'));
    }

    for (const testUrl of candidateUrls) {
        try {
            const localRes = await fetch(`${testUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000),
            });
            if (localRes.ok) {
                const data = await localRes.json();
                const models = (data.models || []).map((m) => m.name || m.model);
                return {
                    status: 'connected',
                    mode: 'local_direct',
                    model,
                    models,
                    url: testUrl,
                };
            }
        } catch {
            // try next candidate URL
        }
    }

    return {
        status: 'offline',
        error: 'Local Ollama is unreachable. Ensure Ollama is running and CORS is configured (set OLLAMA_ORIGINS=*).',
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

    const { action, noteId, query, model, onToken, conversationId } = opts;
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
                conversationId,
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
    if (serverOk && serverData?.success && serverData.content) {
        const content = serverData.content || '';
        return {
            content,
            reply: content, // alias for backwards compatibility
            proposedActions: serverData.proposedActions || [],
            model: serverData.model,
            conversationId: serverData.conversationId || conversationId,
            memoryAction: serverData.memoryAction,
            mode: 'server_proxy',
        };
    }

    // Case 2: Server indicated fallback or server proxy failed (e.g. running on Vercel cloud and connecting to laptop)
    if (serverData?.fallbackAvailable || serverData?.systemPrompt || serverData?.context || !serverOk) {
        const { ollamaUrl, model: storedModel } = getStoredOllamaSettings();
        const activeModel = model || serverData?.model || storedModel;

        const candidateUrls = [ollamaUrl];
        if (ollamaUrl.includes('localhost')) {
            candidateUrls.push(ollamaUrl.replace('localhost', '127.0.0.1'));
        } else if (ollamaUrl.includes('127.0.0.1')) {
            candidateUrls.push(ollamaUrl.replace('127.0.0.1', 'localhost'));
        }

        const localMessages = [];
        const systemPrompt =
            serverData?.systemPrompt ||
            'You are a helpful, responsive personal AI assistant. Interpret user intent naturally as a modern LLM. When greeted, reply warmly and concisely (1-2 sentences) and ask how you can help. Do not launch into unprompted briefings or data dumps. Strictly report real data from context or tools. NEVER fabricate or hallucinate numbers, categories, or facts.';
        localMessages.push({ role: 'system', content: systemPrompt });

        if (Array.isArray(messages) && messages.length > 0) {
            localMessages.push(...messages);
        } else if (action) {
            let promptContent = action;
            if (Array.isArray(serverData?.quickActions)) {
                const matched = serverData.quickActions.find((qa) => qa.id === action);
                if (matched?.prompt) promptContent = matched.prompt;
            }
            localMessages.push({
                role: 'user',
                content: promptContent,
            });
        }

        let lastDirectErr = null;
        for (const targetUrl of candidateUrls) {
            try {
                let currentMessages = [...localMessages];
                let turns = 0;
                let finalContent = '';
                let finalModel = activeModel;
                const MAX_TURNS = 3;

                while (turns < MAX_TURNS) {
                    turns++;

                    // If tools executed and onToken is provided, stream the final synthesis turn
                    const isFinalStreamTurn = Boolean(onToken) && turns > 1;

                    const payload = {
                        model: activeModel,
                        messages: currentMessages,
                        stream: isFinalStreamTurn,
                        keep_alive: '60m',
                        options: {
                            temperature: 0.1,
                            num_predict: 2048,
                            num_ctx: 2048,
                        },
                    };
                    if (Array.isArray(serverData?.tools) && serverData.tools.length > 0 && turns === 1) {
                        payload.tools = serverData.tools;
                    }

                    const directRes = await fetch(`${targetUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                        signal: AbortSignal.timeout(90000),
                    });

                    if (!directRes.ok) {
                        const directErrData = await directRes.json().catch(() => ({}));
                        throw new Error(directErrData.error || `Local Ollama error: HTTP ${directRes.status}`);
                    }

                    if (isFinalStreamTurn && directRes.body) {
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
                    finalModel = directData.model || activeModel;

                    let toolCalls = directData.message?.tool_calls || null;
                    if ((!toolCalls || toolCalls.length === 0) && content) {
                        toolCalls = extractClientToolCallsFromText(content);
                    }

                    if (toolCalls && toolCalls.length > 0) {
                        currentMessages.push({
                            role: 'assistant',
                            content: '',
                            tool_calls: toolCalls,
                        });

                        for (const tc of toolCalls) {
                            const fnName = tc.function?.name;
                            const fnArgs = tc.function?.arguments || {};
                            const toolResult = await executeClientToolCall(fnName, fnArgs);
                            currentMessages.push({
                                role: 'tool',
                                name: fnName,
                                content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                            });
                        }

                        continue;
                    }

                    finalContent = content;
                    if (onToken) {
                        onToken(finalContent, finalContent);
                    }
                    break;
                }

                return {
                    content: finalContent,
                    reply: finalContent, // alias for backwards compatibility
                    proposedActions: extractClientActionProposals(finalContent),
                    model: finalModel,
                    mode: 'local_direct',
                };
            } catch (directErr) {
                lastDirectErr = directErr;
                console.warn(`Direct fetch to ${targetUrl}/api/chat failed:`, directErr.message);
            }
        }

        console.error('All direct local Ollama requests failed:', lastDirectErr);
        if (lastDirectErr?.message?.includes('Failed to fetch') || lastDirectErr?.name === 'TypeError') {
            throw new Error(
                'Cannot connect to local Ollama from browser. Ensure Ollama is running and CORS is configured (setx OLLAMA_ORIGINS "*" and restart Ollama).'
            );
        }
        throw new Error(lastDirectErr?.message || 'Failed to generate AI response from local Ollama.');
    }

    // Case 3: Error from server
    if (serverData?.error) {
        throw new Error(serverData.error);
    }

    throw new Error('Unable to communicate with AI assistant.');
};

/**
 * ============================================================
 * Persistent Memory, Goals, Projects, Conversations & News APIs
 * ============================================================
 */

// Conversations
export const fetchConversations = async () => {
    const res = await fetch('/api/ai/conversations', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return await res.json();
};

export const fetchConversation = async (id) => {
    const res = await fetch(`/api/ai/conversations/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return await res.json();
};

export const saveConversation = async (payload) => {
    const res = await fetch('/api/ai/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to save conversation');
    return await res.json();
};

export const deleteConversation = async (id) => {
    const res = await fetch(`/api/ai/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete conversation');
    return await res.json();
};

// Memories
export const fetchMemories = async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`/api/ai/memory${query ? `?${query}` : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch memories');
    return await res.json();
};

export const createMemory = async ({ fact, category = 'general', tags = [], importance = 3 }) => {
    const res = await fetch('/api/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fact, category, tags, importance }),
    });
    if (!res.ok) throw new Error('Failed to save memory');
    return await res.json();
};

export const deleteMemory = async ({ id, query }) => {
    const res = await fetch('/api/ai/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, query }),
    });
    if (!res.ok) throw new Error('Failed to delete memory');
    return await res.json();
};

// Goals
export const fetchGoals = async (status = 'active') => {
    const res = await fetch(`/api/ai/goals?status=${encodeURIComponent(status)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch goals');
    return await res.json();
};

export const createGoal = async (goal) => {
    const res = await fetch('/api/ai/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(goal),
    });
    if (!res.ok) throw new Error('Failed to create goal');
    return await res.json();
};

export const updateGoal = async (id, updates) => {
    const res = await fetch(`/api/ai/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update goal');
    return await res.json();
};

export const deleteGoal = async (id) => {
    const res = await fetch(`/api/ai/goals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete goal');
    return await res.json();
};

// Projects
export const fetchProjects = async (status = 'active') => {
    const res = await fetch(`/api/ai/projects?status=${encodeURIComponent(status)}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return await res.json();
};

export const createProject = async (project) => {
    const res = await fetch('/api/ai/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error('Failed to create project');
    return await res.json();
};

export const updateProject = async (id, updates) => {
    const res = await fetch(`/api/ai/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return await res.json();
};

export const deleteProject = async (id) => {
    const res = await fetch(`/api/ai/projects/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to delete project');
    return await res.json();
};

// Daily Briefing
export const fetchDailyBriefing = async (forceRefresh = false) => {
    const res = await fetch(`/api/ai/briefing${forceRefresh ? '?refresh=true' : ''}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch daily briefing');
    return await res.json();
};

export const dismissBriefingObservation = async (observationId) => {
    const res = await fetch('/api/ai/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ observationId, action: 'dismiss' }),
    });
    if (!res.ok) throw new Error('Failed to dismiss observation');
    return await res.json();
};

// News
export const fetchNewsBriefing = async (topic = null) => {
    const url = `/api/ai/news${topic ? `?topic=${encodeURIComponent(topic)}` : ''}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch news');
    return await res.json();
};

// Preferences
export const fetchAIPreferences = async () => {
    const res = await fetch('/api/ai/preferences', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch preferences');
    return await res.json();
};

export const saveAIPreferences = async (prefs) => {
    const res = await fetch('/api/ai/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(prefs),
    });
    if (!res.ok) throw new Error('Failed to save preferences');
    return await res.json();
};

