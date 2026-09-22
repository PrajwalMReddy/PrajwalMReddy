/**
 * Assistant API Client for Admin UI
 * Communicates with /api/assistant/* endpoints using session cookies.
 */

const API_BASE = '/api/assistant';

async function request(url, options = {}) {
    const hasBody = options.body !== undefined;
    const res = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
        },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || `Request failed (${res.status})`);
    }
    return data;
}

export const assistantApi = {
    // Get latest daily digest
    getLatestDigest: () => request(`${API_BASE}/digest`),

    // Trigger on-demand digest synthesis
    generateDigest: () => request(`${API_BASE}/digest`, { method: 'POST' }),

    // Fetch active proactive alerts
    getAlerts: () => request(`${API_BASE}/alerts`),

    // Dismiss a proactive alert
    dismissAlert: (alertId) =>
        request(`${API_BASE}/alerts/dismiss`, {
            method: 'POST',
            body: JSON.stringify({ alertId }),
        }),

    // Send on-demand chat message (standard JSON fallback)
    sendChatMessage: (message, sessionId = 'admin_session', resetHistory = false) =>
        request(`${API_BASE}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message, sessionId, resetHistory }),
        }),

    // Stream on-demand chat message token-by-token in real-time via Server-Sent Events
    streamChatMessage: async (
        message,
        sessionId = 'admin_session',
        { onToken, onTool, onDone, onError, resetHistory = false } = {}
    ) => {
        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ message, sessionId, resetHistory, stream: true }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            if (!response.body) {
                throw new Error('Streaming not supported by browser response');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            let currentEvent = 'message';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    if (line.startsWith('event:')) {
                        currentEvent = line.slice(6).trim();
                    } else if (line.startsWith('data:')) {
                        const dataStr = line.slice(5).trim();
                        try {
                            const parsed = JSON.parse(dataStr);
                            if (currentEvent === 'token' && onToken) {
                                onToken(parsed.text);
                            } else if (currentEvent === 'tool' && onTool) {
                                onTool(parsed);
                            } else if (currentEvent === 'done' && onDone) {
                                onDone(parsed);
                            } else if (currentEvent === 'error' && onError) {
                                onError(new Error(parsed.error || 'Stream error'));
                            }
                        } catch (_) {}
                    }
                }
            }
        } catch (err) {
            if (onError) onError(err);
            else throw err;
        }
    },

    // Confirm or cancel sensitive action (Requirement 5)
    confirmAction: (confirmationId, confirmed = true) =>
        request(`${API_BASE}/confirm`, {
            method: 'POST',
            body: JSON.stringify({ confirmationId, confirmed }),
        }),

    // Inspect aggregated context snapshot
    getContext: () => request(`${API_BASE}/context`),

    // Fetch flat or categorized news (independent of LLM)
    getNews: (params = {}) => request(`${API_BASE}/news?${new URLSearchParams(params).toString()}`),

    // Fetch live weather independently (independent of LLM)
    getWeather: () => request(`${API_BASE}/weather`),

    // Update / complete todo item directly from briefing
    completeTodo: (id) =>
        fetch(`/api/todo/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
        }).then((r) => r.json()),

    // Fetch Outlook Calendar events
    getCalendar: (timeframe = 'upcoming', options = {}) => {
        const queryParams = new URLSearchParams({
            timeframe,
            fresh: options.fresh !== false ? 'true' : 'false',
            _t: Date.now().toString(),
        });
        return request(`${API_BASE}/calendar?${queryParams.toString()}`);
    },

    // Outlook profile and authentication helpers (Microsoft Graph)
    getOutlookProfile: () => request(`${API_BASE}/outlook/profile`),
    startOutlookDeviceCode: (clientId) =>
        request(`${API_BASE}/outlook/device-code`, {
            method: 'POST',
            body: JSON.stringify({ clientId }),
        }),
    pollOutlookDeviceCode: (deviceCode, clientId) =>
        request(`${API_BASE}/outlook/device-poll`, {
            method: 'POST',
            body: JSON.stringify({ deviceCode, clientId }),
        }),

    // Prompt cache prewarm helper
    prewarmCache: () => request(`${API_BASE}/prewarm`, { method: 'POST' }),

    // Assistant service status
    getStatus: () => request(`${API_BASE}`),
};
