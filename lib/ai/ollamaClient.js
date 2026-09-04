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
    const timeoutMs = options.timeoutMs || 45000;

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
    temperature = 0.7,
    numPredict = 250,
    keepAlive = '60m',
    stream = false,
    onToken,
    timeoutMs = 90000,
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
            num_ctx: 2048,
        },
    };

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
                    if (parsed.done) {
                        finalData = parsed;
                    }
                } catch {
                    // ignore JSON chunk boundary parse errors
                }
            }
        }

        return {
            model: finalData.model || selectedModel,
            content: fullContent,
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

    return {
        model: response.model || selectedModel,
        content: response.message?.content || '',
        done: response.done,
        totalDuration: response.total_duration,
        loadDuration: response.load_duration,
    };
}

module.exports = {
    getBaseUrl,
    getModel,
    checkHealth,
    chat,
};
