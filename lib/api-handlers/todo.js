const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const COLLECTION = 'todos';

const VALID_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const toDateKey = (date) => date.toISOString().slice(0, 10);

const parseDateKey = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

const normalizeDateOnly = (value) => {
    const date = parseDateKey(value);
    return date ? date.toISOString() : null;
};

const getNextOccurrence = (date, recurrence, recurrenceDays, monthDay) => {
    const next = new Date(date);

    if (recurrence === 'daily') {
        next.setUTCDate(next.getUTCDate() + 1);
        return next;
    }

    if (recurrence === 'monthly') {
        const day = monthDay || next.getUTCDate();
        next.setUTCDate(1);
        next.setUTCMonth(next.getUTCMonth() + 1);
        const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
        next.setUTCDate(Math.min(day, lastDay));
        return next;
    }

    const selectedDays = (Array.isArray(recurrenceDays) ? recurrenceDays : [])
        .map((day) => VALID_WEEKDAYS.indexOf(day))
        .filter((day) => day >= 0)
        .sort((a, b) => a - b);
    const days = selectedDays.length > 0 ? selectedDays : [next.getUTCDay()];

    for (let offset = 1; offset <= 7; offset += 1) {
        const candidateDay = (next.getUTCDay() + offset) % 7;
        if (days.includes(candidateDay)) {
            next.setUTCDate(next.getUTCDate() + offset);
            return next;
        }
    }

    return next;
};

const createDueInstances = async (collection, source) => {
    if (!source.recurrence || source.recurrence === 'none' || !source.dueDate) return;

    const startDate = parseDateKey(source.recurrenceLastDate || source.dueDate);
    const endDate = source.recurrenceUntil ? parseDateKey(source.recurrenceUntil) : null;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!startDate) return;

    const instances = [];
    let nextDate = getNextOccurrence(startDate, source.recurrence, source.recurrenceDays, source.recurrenceMonthDay);
    while (nextDate <= today && (!endDate || nextDate <= endDate)) {
        instances.push({
            title: source.title,
            completed: false,
            dueDate: toDateKey(nextDate),
            priority: source.priority,
            order: Number(source.order || 0) + instances.length + 1,
            serialNumber: Number(source.serialNumber || 0) + instances.length + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: source.description || '',
            subtasks: Array.isArray(source.subtasks) ? source.subtasks.map((subtask) => ({...subtask, completed: false})) : [],
            estimatedTime: source.estimatedTime || null,
            recurrence: 'none',
            scheduledAt: null,
            recurrenceSeriesId: source._id,
        });
        nextDate = getNextOccurrence(nextDate, source.recurrence, source.recurrenceDays, source.recurrenceMonthDay);
    }

    // Keep the next occurrence ready in the board once this schedule is due.
    // The stored cursor prevents this future instance from being duplicated.
    if (startDate <= today && (!endDate || nextDate <= endDate)) {
        instances.push({
            title: source.title,
            completed: false,
            dueDate: toDateKey(nextDate),
            priority: source.priority,
            order: Number(source.order || 0) + instances.length + 1,
            serialNumber: Number(source.serialNumber || 0) + instances.length + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: source.description || '',
            subtasks: Array.isArray(source.subtasks) ? source.subtasks.map((subtask) => ({...subtask, completed: false})) : [],
            estimatedTime: source.estimatedTime || null,
            recurrence: 'none',
            scheduledAt: null,
            recurrenceSeriesId: source._id,
        });
    }

    if (instances.length > 0) {
        await collection.insertMany(instances);
        await collection.updateOne(
            {_id: source._id},
            {$set: {recurrenceLastDate: instances[instances.length - 1].dueDate, updatedAt: new Date()}}
        );
    }
};

function normalizeTodo(doc) {
    const serialNumber = Number(doc.serialNumber ?? doc.order ?? 1);
    const order = Number(doc.order ?? serialNumber ?? 1);
    const priority = ['high', 'medium', 'low'].includes(doc.priority) ? doc.priority : 'medium';

    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        completed: Boolean(doc.completed),
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : null,
        priority,
        serialNumber: Number.isFinite(serialNumber) ? serialNumber : 1,
        order: Number.isFinite(order) ? order : 1,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
        description: doc.description || '',
        subtasks: Array.isArray(doc.subtasks) ? doc.subtasks : [],
        estimatedTime: doc.estimatedTime ? Number(doc.estimatedTime) : null,
        recurrence: doc.recurrence || 'none',
        recurrenceDays: Array.isArray(doc.recurrenceDays) ? doc.recurrenceDays : [],
        recurrenceUntil: doc.recurrenceUntil ? new Date(doc.recurrenceUntil).toISOString().slice(0, 10) : null,
        scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString().slice(0, 10) : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);

        if (req.method === 'GET') {
            const sources = await collection
                .find()
                .toArray();

            await Promise.all(sources
                .filter((todo) => todo.recurrence && todo.recurrence !== 'none')
                .map((todo) => createDueInstances(collection, todo)));

            const todos = await collection
                .find()
                .sort({ order: 1, createdAt: 1, _id: 1 })
                .toArray();

            return res.status(200).json(todos.map(normalizeTodo));
        }

        if (req.method === 'POST') {
            const { title, completed, dueDate, priority, description, subtasks, estimatedTime, recurrence, recurrenceDays, recurrenceUntil, scheduledAt } = req.body || {};
            const trimmedTitle = String(title || '').trim();

            if (!trimmedTitle) {
                return res.status(400).json({ error: 'Task title is required' });
            }

            const latestTodo = await collection
                .find()
                .sort({ order: -1, serialNumber: -1, createdAt: -1 })
                .limit(1)
                .next();

            const order = latestTodo ? Number(latestTodo.order ?? latestTodo.serialNumber ?? 0) + 1 : 1;
            const serialNumber = order;
            const normalizedDueDate = dueDate ? new Date(dueDate) : null;
            const normalizedPriority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
            const normalizedRecurrenceUntil = recurrenceUntil ? new Date(recurrenceUntil) : null;

            const normalizedRecurrence = ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
            const normalizedRecurrenceDays = normalizedRecurrence === 'weekly' && Array.isArray(recurrenceDays)
                ? recurrenceDays.filter((day) => VALID_WEEKDAYS.includes(day))
                : [];

            const doc = {
                title: trimmedTitle,
                completed: Boolean(completed),
                dueDate: normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? normalizedDueDate.toISOString() : null,
                priority: normalizedPriority,
                order,
                serialNumber,
                createdAt: new Date(),
                updatedAt: new Date(),
                description: description || '',
                subtasks: Array.isArray(subtasks) ? subtasks : [],
                estimatedTime: estimatedTime ? Number(estimatedTime) : null,
                recurrence: normalizedRecurrence,
                recurrenceDays: normalizedRecurrenceDays,
                recurrenceUntil: normalizedRecurrenceUntil && !Number.isNaN(normalizedRecurrenceUntil.getTime()) ? normalizedRecurrenceUntil.toISOString() : null,
                recurrenceLastDate: normalizedRecurrence !== 'none' && normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? toDateKey(normalizedDueDate) : null,
                recurrenceMonthDay: normalizedRecurrence === 'monthly' && normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? normalizedDueDate.getUTCDate() : null,
                scheduledAt: normalizeDateOnly(scheduledAt),
            };

            const result = await collection.insertOne(doc);
            return res.status(201).json(normalizeTodo({ _id: result.insertedId, ...doc }));
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Todos API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
