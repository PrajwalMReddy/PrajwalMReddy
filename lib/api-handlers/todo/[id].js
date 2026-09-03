const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

const COLLECTION = 'todos';
const VALID_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const normalizeDateOnly = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toISOString() : null;
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
        scheduledAt: doc.scheduledAt ? new Date(doc.scheduledAt).toISOString().slice(0, 10) : null,
        recurrenceDays: Array.isArray(doc.recurrenceDays) ? doc.recurrenceDays : [],
        recurrenceUntil: doc.recurrenceUntil ? new Date(doc.recurrenceUntil).toISOString().slice(0, 10) : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid todo id' });
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'PUT') {
            const { title, completed, dueDate, order, serialNumber, priority, description, subtasks, estimatedTime, recurrence, recurrenceDays, recurrenceUntil, scheduledAt } = req.body || {};
            const existingTodo = await collection.findOne({_id});
            const update = {
                updatedAt: new Date(),
            };

            if (title !== undefined) {
                const trimmedTitle = String(title || '').trim();
                if (!trimmedTitle) {
                    return res.status(400).json({ error: 'Task title is required' });
                }
                update.title = trimmedTitle;
            }

            if (completed !== undefined) {
                update.completed = Boolean(completed);
            }

            if (dueDate !== undefined) {
                const normalizedDate = dueDate ? new Date(dueDate) : null;
                update.dueDate = normalizedDate && !Number.isNaN(normalizedDate.getTime()) ? normalizedDate.toISOString() : null;
            }

            if (priority !== undefined) {
                const normalizedPriority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
                update.priority = normalizedPriority;
            }

            if (order !== undefined) {
                const normalizedOrder = Number(order);
                if (!Number.isFinite(normalizedOrder)) {
                    return res.status(400).json({ error: 'Invalid todo order' });
                }
                update.order = normalizedOrder;
            }

            if (serialNumber !== undefined) {
                const normalizedSerialNumber = Number(serialNumber);
                if (!Number.isFinite(normalizedSerialNumber)) {
                    return res.status(400).json({ error: 'Invalid todo serial number' });
                }
                update.serialNumber = normalizedSerialNumber;
            }

            if (description !== undefined) {
                update.description = String(description || '').trim();
            }

            if (subtasks !== undefined) {
                update.subtasks = Array.isArray(subtasks) ? subtasks : [];
            }

            if (estimatedTime !== undefined) {
                const estTime = Number(estimatedTime);
                if (!Number.isFinite(estTime)) {
                    return res.status(400).json({ error: 'Invalid estimated time' });
                }
                update.estimatedTime = estTime;
            }

            if (recurrence !== undefined) {
                update.recurrence = ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
                if (update.recurrence === 'none') {
                    update.recurrenceDays = [];
                    update.recurrenceLastDate = null;
                    update.recurrenceMonthDay = null;
                }
            }

            if (recurrenceDays !== undefined) {
                update.recurrenceDays = update.recurrence === 'weekly' || recurrence === undefined
                    ? (Array.isArray(recurrenceDays) ? recurrenceDays.filter((day) => VALID_WEEKDAYS.includes(day)) : [])
                    : [];
            }

            if (recurrenceUntil !== undefined) {
                const normalizedRecurrenceUntil = recurrenceUntil ? new Date(recurrenceUntil) : null;
                update.recurrenceUntil = normalizedRecurrenceUntil && !Number.isNaN(normalizedRecurrenceUntil.getTime()) ? normalizedRecurrenceUntil.toISOString() : null;
            }

            if (scheduledAt !== undefined) {
                update.scheduledAt = normalizeDateOnly(scheduledAt);
            }

            if ((dueDate !== undefined || recurrence !== undefined) && update.recurrence !== 'none') {
                const anchorDate = dueDate !== undefined ? update.dueDate : existingTodo?.dueDate;
                if (anchorDate) {
                    update.recurrenceLastDate = anchorDate.slice(0, 10);
                    if (update.recurrence === 'monthly') {
                        update.recurrenceMonthDay = Number(anchorDate.slice(8, 10));
                    }
                }
            }

            const result = await collection.findOneAndUpdate(
                { _id },
                { $set: update },
                { returnDocument: 'after' }
            );

            // Handle both direct document return and result.value structure
            const updatedDoc = (result && result.value) || result;
            if (!updatedDoc) {
                return res.status(404).json({ error: 'Todo not found' });
            }

            return res.status(200).json(normalizeTodo(updatedDoc));
        }

        if (req.method === 'DELETE') {
            const todo = await collection.findOne({ _id });
            const seriesId = todo?.recurrenceSeriesId || _id;
            const result = await collection.deleteMany({
                $or: [
                    {_id: seriesId},
                    {recurrenceSeriesId: seriesId},
                ],
            });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Todo not found' });
            }

            return res.status(200).json({ id });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Todo item API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
