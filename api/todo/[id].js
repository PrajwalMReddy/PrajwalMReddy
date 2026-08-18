const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const COLLECTION = 'todos';

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
            const { title, completed, dueDate, order, serialNumber, priority } = req.body || {};
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
            const result = await collection.deleteOne({ _id });
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
