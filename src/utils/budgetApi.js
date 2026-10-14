import { formatDate as formatDateGlobal } from './ContentContext';

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

// IMPORTANT: Parsing date-only strings (e.g. 'YYYY-MM-DD') with `new Date(...)` parses them
// as UTC midnight, which renders as the previous day in any timezone behind UTC (e.g. all of the US).
// Parsing the y/m/d parts manually and building the Date in local time avoids that entirely,
// ensuring budget items consistently reflect the user's computer timezone.
export const parseLocalDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) {
        return new Date(dateVal.getFullYear(), dateVal.getMonth(), dateVal.getDate());
    }
    const str = String(dateVal);
    const datePart = str.split('T')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    if (parts.length === 2 && !parts.some(isNaN)) {
        return new Date(parts[0], parts[1] - 1, 1);
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? new Date() : d;
};

export const getTodayInputDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value ?? 0);

export const formatDate = (dateStr, lang = 'en') => {
    return formatDateGlobal(dateStr, lang, { month: 'short' });
};

export const toInputDate = (dateStr) => {
    if (!dateStr) return '';
    const date = parseLocalDate(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

export const getAyanaRange = (startDateStr, ayanaNumber) => {
    const rangeStart = parseLocalDate(startDateStr || AYANA_START_DATE);
    rangeStart.setDate(1);
    rangeStart.setMonth(rangeStart.getMonth() + (Number(ayanaNumber || 1) - 1) * 6);
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
    const start = parseLocalDate(startDateStr || AYANA_START_DATE);
    const now = new Date();
    const monthsDiff =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(1, Math.floor(monthsDiff / 6) + 1);
};

export const formatAyanaLabel = (startDateStr, ayanaNumber, lang = 'en', formatNum = (v) => v) => {
    const prefix = lang === 'kn' ? 'ಆಯನ' : 'Ayana';
    const effectiveStart = startDateStr || AYANA_START_DATE;
    const { start, end } = getAyanaRange(effectiveStart, ayanaNumber);
    const startStr = formatDateGlobal(start, lang, { month: 'short', day: false });
    const endStr = formatDateGlobal(end, lang, { month: 'short', day: false });
    return `${prefix} ${formatNum(ayanaNumber)} (${startStr} \u2013 ${endStr})`;
};

export const formatMonthLabel = (monthStr, lang = 'en', formatNum = (v) => v) => {
    return formatDateGlobal(monthStr, lang, { month: 'long', day: false });
};
