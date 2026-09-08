function getBaseUrl() {
    return process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
}

function getModel() {
    return process.env.OLLAMA_MODEL || 'mistral';
}

/**
 * Perform an HTTP request to the Ollama server using native fetch and AbortSignal.timeout
 */
async function ollamaRequest(path, options = {}) {
    const baseUrl = getBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${baseUrl.replace(/\/+$/, '')}${cleanPath}`;
    const timeoutMs = options.timeoutMs || 120000;

    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };

    const fetchOptions = {
        method: options.method || 'GET',
        headers,
        signal: AbortSignal.timeout(timeoutMs),
    };

    if (options.body) {
        fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    try {
        const res = await fetch(url, fetchOptions);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const err = new Error(data.error || `Ollama returned HTTP ${res.status}`);
            err.status = res.status;
            if (res.status === 404) {
                err.code = 'MODEL_NOT_FOUND';
            }
            throw err;
        }

        return data;
    } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 23) {
            const timeoutErr = new Error(`Ollama request timed out after ${timeoutMs}ms`);
            timeoutErr.code = 'TIMEOUT';
            throw timeoutErr;
        }

        if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
            const offlineErr = new Error(`Cannot connect to Ollama at ${baseUrl}. Ensure Ollama is running locally.`);
            offlineErr.code = 'OLLAMA_OFFLINE';
            offlineErr.original = err;
            throw offlineErr;
        }

        throw err;
    }
}

/**
 * Check if Ollama is running and list available models
 */
async function checkHealth() {
    try {
        const data = await ollamaRequest('/api/tags', { timeoutMs: 5000 });
        const models = (data.models || []).map((m) => m.name || m.model);
        const configuredModel = getModel();
        const modelFound = models.some(
            (m) => m === configuredModel || m.startsWith(`${configuredModel}:`)
        );

        return {
            status: 'ok',
            baseUrl: getBaseUrl(),
            configuredModel,
            modelFound,
            availableModels: models,
        };
    } catch (err) {
        return {
            status: 'error',
            baseUrl: getBaseUrl(),
            configuredModel: getModel(),
            error: err.message,
            code: err.code || 'UNKNOWN',
        };
    }
}

/**
 * Send a chat completion request to Ollama with streaming support
 */
async function chat({
    messages,
    model,
    system,
    tools,
    temperature = 0.7,
    numPredict = 2048,
    numCtx = 4096,
    format,
    keepAlive = '60m',
    stream = false,
    onToken,
    timeoutMs = 120000,
}) {
    const selectedModel = model || getModel();
    const isStreaming = Boolean(stream && onToken);

    const payload = {
        model: selectedModel,
        messages: [],
        stream: isStreaming,
        keep_alive: keepAlive,
        options: {
            temperature,
            num_predict: numPredict,
            num_ctx: numCtx,
        },
    };

    if (Array.isArray(tools) && tools.length > 0) {
        payload.tools = tools;
    }

    if (format) {
        payload.format = format;
    }

    if (system) {
        payload.messages.push({ role: 'system', content: system });
    }

    if (Array.isArray(messages)) {
        payload.messages.push(...messages);
    }

    if (isStreaming) {
        const baseUrl = getBaseUrl();
        const url = `${baseUrl.replace(/\/+$/, '')}/api/chat`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Ollama returned HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let finalData = {};
        let collectedToolCalls = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep trailing incomplete chunk

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
                    if (Array.isArray(parsed.message?.tool_calls)) {
                        collectedToolCalls.push(...parsed.message.tool_calls);
                    }
                    if (parsed.done) {
                        finalData = parsed;
                    }
                } catch {
                    // ignore JSON chunk boundary parse errors
                }
            }
        }

        let resolvedToolCalls = collectedToolCalls.length > 0 ? collectedToolCalls : (finalData.message?.tool_calls || null);
        if ((!resolvedToolCalls || resolvedToolCalls.length === 0) && fullContent) {
            resolvedToolCalls = extractToolCallsFromText(fullContent, tools);
        }

        return {
            model: finalData.model || selectedModel,
            content: fullContent,
            tool_calls: resolvedToolCalls && resolvedToolCalls.length > 0 ? resolvedToolCalls : null,
            done: true,
            totalDuration: finalData.total_duration,
            loadDuration: finalData.load_duration,
        };
    }

    const response = await ollamaRequest('/api/chat', {
        method: 'POST',
        body: payload,
        timeoutMs,
    });

    let resolvedToolCalls = response.message?.tool_calls || null;
    const responseContent = response.message?.content || '';
    if ((!resolvedToolCalls || resolvedToolCalls.length === 0) && responseContent) {
        resolvedToolCalls = extractToolCallsFromText(responseContent, tools);
    }

    return {
        model: response.model || selectedModel,
        content: responseContent,
        tool_calls: resolvedToolCalls && resolvedToolCalls.length > 0 ? resolvedToolCalls : null,
        done: response.done,
        totalDuration: response.total_duration,
        loadDuration: response.load_duration,
    };
}

/**
 * Fallback extractor when a model writes tool invocations directly in text content
 */
function extractToolCallsFromText(content, tools = []) {
    if (!content || typeof content !== 'string') return null;
    const knownNames = Array.isArray(tools) && tools.length > 0
        ? tools.map((t) => t.function?.name || t.name).filter(Boolean)
        : [
            'get_weather', 'search_expenses', 'get_spending_summary', 'search_web', 'get_tasks',
            'get_notes', 'search_memory', 'remember_fact', 'forget_memory',
            'get_goals', 'get_projects', 'get_live_news'
        ];

    const toolCalls = [];

    // 1. Check for [TOOL_CALLS] [...] format or bare JSON array: [{"name": "...", "arguments": ...}]
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

    // 2. Check for single JSON object in text: {"name": "...", "arguments": {...}}
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

    // 2. Check for [tool_name(...)], `tool_name(...)`, or bare tool_name(...)
    for (const name of knownNames) {
        const fnRegex = new RegExp(`(?:\\[|\`|\\b)(${name})\\s*\\(([^)]*)\\)(?:\\]|\`|\\b)?`, 'gi');
        let match;
        while ((match = fnRegex.exec(content)) !== null) {
            const rawArgs = match[2].trim();
            // 2a. JSON object: {"key": "val"}
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

            // 2b. Single quoted string: "Panama" or 'Krispy Kreme'
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

            // 2c. Kwargs style: key="value" or key='value' or key=value or key=123
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

            // 2d. Plain/unquoted single string: e.g. Krispy Kreme or Panama
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

    if (toolCalls.length > 0) return toolCalls;

    // 3. Check for ```action:tool_name or ```json:tool_name or ```tool_name blocks
    for (const name of knownNames) {
        const codeBlockRegex = new RegExp(`\`\`\`(?:action:|json:)?${name}\\s*(\\{[\\s\\S]*?\\})\\s*\`\`\``, 'i');
        const match = content.match(codeBlockRegex);
        if (match) {
            try {
                const args = JSON.parse(match[1]);
                toolCalls.push({
                    function: {
                        name,
                        arguments: args,
                    },
                });
            } catch {}
        }
    }

    // 4. Check if the entire content is a single JSON object with name & arguments
    try {
        const trimmed = content.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const parsed = JSON.parse(trimmed);
            if (parsed.name && knownNames.includes(parsed.name)) {
                toolCalls.push({
                    function: {
                        name: parsed.name,
                        arguments: parsed.arguments || {},
                    },
                });
            }
        }
    } catch {}

    return toolCalls.length > 0 ? toolCalls : null;
}

module.exports = {
    getBaseUrl,
    getModel,
    checkHealth,
    chat,
    extractToolCallsFromText,
};
