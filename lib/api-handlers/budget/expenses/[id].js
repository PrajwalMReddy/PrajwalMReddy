const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../../lib/db');
const { requireAuth } = require('../../../../lib/auth');
const { resequenceExpenses } = require('../../../../lib/budgetResequence');

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
            const { date, item, category, cost } = req.body || {};
            const update = {};
            if (date !== undefined) {
                const parsedDate = new Date(date);
                if (isNaN(parsedDate.getTime())) {
                    return res.status(400).json({ error: 'A valid date is required' });
                }
                update.date = parsedDate;
            }
            if (item !== undefined) update.item = String(item).trim();
            if (category !== undefined) update.category = String(category).trim();
            if (cost !== undefined) {
                const numCost = Number(cost);
                if (!Number.isFinite(numCost) || numCost < 0) {
                    return res.status(400).json({ error: 'A valid non-negative cost is required' });
                }
                update.cost = numCost;
            }

            const result = await collection.findOneAndUpdate(
                { _id: objectId },
                { $set: update },
                { returnDocument: 'after' }
            );

            const doc = result?.value ?? result;
            if (!doc) {
                return res.status(404).json({ error: 'Expense not found' });
            }

            await resequenceExpenses(db);
            const freshDoc = await collection.findOne({ _id: objectId });

            return res.status(200).json({
                id: freshDoc._id.toString(),
                serialNumber: freshDoc.serialNumber,
                date: freshDoc.date,
                item: freshDoc.item,
                category: freshDoc.category,
                cost: freshDoc.cost,
            });
        }

        if (req.method === 'DELETE') {
            const result = await collection.deleteOne({ _id: objectId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }
            await resequenceExpenses(db);
            return res.status(200).json({ deleted: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Expense item API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
