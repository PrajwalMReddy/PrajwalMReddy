export const TODO_API = '/api/todo';

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a YYYY-MM-DD value as a LOCAL calendar date.
 *
 * Do NOT use new Date('2026-08-18') because ISO date-only strings
 * are interpreted as UTC by JavaScript.
 */
export const parseDateOnly = (value) => {
    if (!value) return null;

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
        const fallback = new Date(value);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day)
    ) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    return date;
};

export const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

/**
 * Convert a local calendar date to a stable integer day key.
 */
export const getDayKey = (date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;

export const getTodayKey = () => getDayKey(getToday());

export const getDueDayKey = (todo) => {
    const due = parseDateOnly(todo?.dueDate);
    return due ? getDayKey(due) : null;
};

export const isScheduledForFuture = (todo) => {
    const scheduled = parseDateOnly(todo?.scheduledAt);
    return scheduled && getDayKey(scheduled) > getTodayKey();
};

export const getDueDifference = (todo) => {
    const dueKey = getDueDayKey(todo);
    if (dueKey === null) return null;
    return dueKey - getTodayKey();
};

export const getDueState = (todo) => {
    if (!todo?.dueDate) return 'none';
    if (todo.completed) return 'done';

    const diffDays = getDueDifference(todo);
    if (diffDays === null) return 'none';
    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'soon';

    return 'upcoming';
};

export const getDueDateLabel = (todo) => {
    const date = parseDateOnly(todo?.dueDate);
    if (!date) return '';

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

/**
 * Returns the next 3 calendar days after TODAY.
 */
export const getNextThreeDaysRange = () => {
    const today = getToday();
    const end = new Date(today);
    end.setDate(end.getDate() + 3);
    end.setHours(0, 0, 0, 0);

    return {
        startKey: getDayKey(today),
        endKey: getDayKey(end),
    };
};

export const PRIORITY_LABEL = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export const RECURRENCE_DAYS = [
    ['sun', 'Sun'],
    ['mon', 'Mon'],
    ['tue', 'Tue'],
    ['wed', 'Wed'],
    ['thu', 'Thu'],
    ['fri', 'Fri'],
    ['sat', 'Sat'],
];

export const formatRecurrence = (todo) => {
    if (!todo.recurrence || todo.recurrence === 'none') return '';
    if (todo.recurrence === 'weekly') {
        const days = RECURRENCE_DAYS
            .filter(([value]) => (todo.recurrenceDays || []).includes(value))
            .map(([, label]) => label);
        return days.length > 0 ? `Weekly: ${days.join(', ')}` : 'Weekly';
    }
    return todo.recurrence === 'daily' ? 'Every day' : 'Every month';
};
