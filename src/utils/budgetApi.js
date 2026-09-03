const API_BASE = '/api/budget';

// Tracking start date is fixed — no longer user-editable via a Settings page.
export const AYANA_START_DATE = '2024-07-01';

async function request(url, options = {}) {
    // Only attach a JSON Content-Type when we're actually sending a body.
    // Setting it on bodyless requests (e.g. DELETE) makes Next.js's
    // built-in API body parser try to JSON.parse an empty string, which
    // throws and rejects the request with a 400 before it ever reaches
    // the route handler.
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

    // Budget planner:
    //  - one plan per Ayana
    //  - ayanaBudgeted: total budget for the entire Ayana
    //  - monthlyBudgeted: allocation of that total across six months
    //  - monthlyItems: every planned expense, assigned to a month
    getBudgetPlans: () => request(`${API_BASE}/planner`),
    createBudgetPlan: (plan) =>
        request(`${API_BASE}/planner`, { method: 'POST', body: JSON.stringify(plan) }),
    updateBudgetPlan: (id, plan) =>
        request(`${API_BASE}/planner/${id}`, { method: 'PUT', body: JSON.stringify(plan) }),
    deleteBudgetPlan: (id) =>
        request(`${API_BASE}/planner/${id}`, { method: 'DELETE' }),
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

// --- Ayana (6-month period) helpers, used by the budget planner ---
// All take a startDateStr — pass AYANA_START_DATE for the app's fixed start.

// IMPORTANT: `new Date('2024-07-01')` parses a date-only string as UTC
// midnight, which then renders as the *previous* day in any timezone behind
// UTC (e.g. all of the US) — shifting every ayana boundary back by a day.
// Parsing the y/m/d parts manually and building the Date in local time
// avoids that entirely.
const parseLocalDate = (dateStr) => {
    if (typeof dateStr !== 'string') return new Date(dateStr);
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const getAyanaRange = (startDateStr, ayanaNumber) => {
    const rangeStart = parseLocalDate(startDateStr);
    rangeStart.setMonth(rangeStart.getMonth() + (ayanaNumber - 1) * 6);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setMonth(rangeEnd.getMonth() + 6);
    rangeEnd.setDate(rangeEnd.getDate() - 1);
    return { start: rangeStart, end: rangeEnd };
};

export const getAyanaMonths = (startDateStr, ayanaNumber) => {
    const { start } = getAyanaRange(startDateStr, ayanaNumber);
    const months = [];
    for (let i = 0; i < 6; i += 1) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + i);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
};

export const getCurrentAyanaNumber = (startDateStr) => {
    if (!startDateStr) return 1;
    const start = parseLocalDate(startDateStr);
    const now = new Date();
    const monthsDiff =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(1, Math.floor(monthsDiff / 6) + 1);
};

export const formatAyanaLabel = (startDateStr, ayanaNumber) => {
    if (!startDateStr) return `Ayana ${ayanaNumber}`;
    const { start, end } = getAyanaRange(startDateStr, ayanaNumber);
    const opts = { year: 'numeric', month: 'short' };
    return `Ayana ${ayanaNumber} (${start.toLocaleDateString('en-US', opts)} \u2013 ${end.toLocaleDateString('en-US', opts)})`;
};

export const formatMonthLabel = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};
