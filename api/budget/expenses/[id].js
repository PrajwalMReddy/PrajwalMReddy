const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

const COLLECTION = 'expenses';

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'id is required' });
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);
        const objectId = new ObjectId(id);

        if (req.method === 'PUT') {
            const { date, item, category, cost, serialNumber } = req.body || {};
            const update = {};
            if (date !== undefined) update.date = new Date(date);
            if (item !== undefined) update.item = item;
            if (category !== undefined) update.category = category;
            if (cost !== undefined) update.cost = Number(cost);
            if (serialNumber !== undefined) update.serialNumber = Number(serialNumber);

            const result = await collection.findOneAndUpdate(
                { _id: objectId },
                { $set: update },
                { returnDocument: 'after' }
            );

            const doc = result?.value ?? result;
            if (!doc) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            return res.status(200).json({
                id: doc._id.toString(),
                serialNumber: doc.serialNumber,
                date: doc.date,
                item: doc.item,
                category: doc.category,
                cost: doc.cost,
            });
        }

        if (req.method === 'DELETE') {
            const result = await collection.deleteOne({ _id: objectId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }
            return res.status(200).json({ deleted: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Expense item API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
