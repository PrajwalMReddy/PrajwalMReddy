const API_BASE = '/api/budget';

async function request(url, options = {}) {
    const res = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
}

export const budgetApi = {
    getExpenses: () => request(`${API_BASE}/expenses`),
    createExpense: (expense) =>
        request(`${API_BASE}/expenses`, { method: 'POST', body: JSON.stringify(expense) }),
    updateExpense: (id, expense) =>
        request(`${API_BASE}/expenses/${id}`, { method: 'PUT', body: JSON.stringify(expense) }),
    deleteExpense: (id) =>
        request(`${API_BASE}/expenses/${id}`, { method: 'DELETE' }),

    getIncome: () => request(`${API_BASE}/income`),
    createIncome: (entry) =>
        request(`${API_BASE}/income`, { method: 'POST', body: JSON.stringify(entry) }),
    updateIncome: (id, entry) =>
        request(`${API_BASE}/income/${id}`, { method: 'PUT', body: JSON.stringify(entry) }),
    deleteIncome: (id) =>
        request(`${API_BASE}/income/${id}`, { method: 'DELETE' }),

    getStats: () => request(`${API_BASE}/stats`),
    getSettings: () => request(`${API_BASE}/settings`),
    updateSettings: (settings) =>
        request(`${API_BASE}/settings`, { method: 'PUT', body: JSON.stringify(settings) }),
};

export const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);

export const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const toInputDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
};

export const DEFAULT_CATEGORIES = [
    'Miscellaneous',
    'Utilities',
    'Food Social',
    'Transport Travel',
    'Food Travel',
    'Shopping',
    'Entertainment Travel',
    'Food',
    'Entertainment',
    'Lodging Travel',
    'Travel',
    'Social',
    'Transport',
];
