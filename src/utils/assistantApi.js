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
    // Fetch flat or categorized news (independent of LLM)
    getNews: (params = {}) => request(`${API_BASE}/news?${new URLSearchParams(params).toString()}`),

    // Fetch live weather independently (independent of LLM)
    getWeather: (params = {}) => {
        const queryParams = new URLSearchParams(params).toString();
        return request(`${API_BASE}/weather${queryParams ? `?${queryParams}` : ''}`);
    },

    // Fetch Outlook Calendar events
    getCalendar: (timeframe = 'upcoming', options = {}) => {
        const queryParams = new URLSearchParams({
            timeframe,
            fresh: options.fresh !== false ? 'true' : 'false',
            _t: Date.now().toString(),
        });
        return request(`${API_BASE}/calendar?${queryParams.toString()}`);
    },

    // Live data sources settings
    getSettings: (params = {}) => {
        const queryParams = new URLSearchParams(params).toString();
        return request(`${API_BASE}/settings${queryParams ? `?${queryParams}` : ''}`);
    },
    updateSettings: (settings) =>
        request(`${API_BASE}/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings),
        }),
    testCalendarFeed: (icsUrl) =>
        request(`${API_BASE}/settings/test-calendar`, {
            method: 'POST',
            body: JSON.stringify({ icsUrl }),
        }),
    testLocation: (location) =>
        request(`${API_BASE}/settings/test-location`, {
            method: 'POST',
            body: JSON.stringify({ location }),
        }),

    // Database & Storage Management
    getDatabaseStats: () => request(`${API_BASE}/data/stats`),
    downloadDatabaseBackup: async (includeSensitive = true) => {
        const url = `${API_BASE}/data/backup?includeSensitive=${includeSensitive ? 'true' : 'false'}`;
        const res = await fetch(url, {
            credentials: 'include',
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Backup download failed (${res.status})`);
        }
        const blob = await res.blob();
        let filename = 'personal-dashboard-backup.json';
        const disposition = res.headers.get('content-disposition');
        if (disposition && disposition.includes('filename=')) {
            const match = disposition.match(/filename="?([^";]+)"?/);
            if (match && match[1]) filename = match[1];
        }
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        return { success: true, filename, sizeBytes: blob.size };
    },
    restoreDatabase: ({ backup, mode = 'merge', selectedCollections = null }) =>
        request(`${API_BASE}/data/restore`, {
            method: 'POST',
            body: JSON.stringify({ backup, mode, selectedCollections }),
        }),
};
