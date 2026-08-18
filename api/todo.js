const { connectToDatabase } = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const COLLECTION = 'todos';

function normalizeTodo(doc) {
    const serialNumber = Number(doc.serialNumber ?? doc.order ?? 1);
    const order = Number(doc.order ?? serialNumber ?? 1);

    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        completed: Boolean(doc.completed),
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : null,
        serialNumber: Number.isFinite(serialNumber) ? serialNumber : 1,
        order: Number.isFinite(order) ? order : 1,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);

        if (req.method === 'GET') {
            const todos = await collection
                .find()
                .sort({ order: 1, createdAt: 1, _id: 1 })
                .toArray();

            return res.status(200).json(todos.map(normalizeTodo));
        }

        if (req.method === 'POST') {
            const { title, completed, dueDate } = req.body || {};
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

            const doc = {
                title: trimmedTitle,
                completed: Boolean(completed),
                dueDate: normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? normalizedDueDate.toISOString() : null,
                order,
                serialNumber,
                createdAt: new Date(),
                updatedAt: new Date(),
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
