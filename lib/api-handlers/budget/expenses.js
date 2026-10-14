const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');
const { resequenceExpenses } = require('../../../lib/budgetResequence');

const COLLECTION = 'expenses';

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);

        if (req.method === 'GET') {
            const expenses = await collection
                .find()
                .sort({ date: -1, serialNumber: -1 })
                .toArray();
            return res.status(200).json(
                expenses.map((doc) => ({
                    id: doc._id.toString(),
                    serialNumber: doc.serialNumber,
                    date: doc.date,
                    item: doc.item,
                    category: doc.category,
                    cost: doc.cost,
                }))
            );
        }

        if (req.method === 'POST') {
            const { date, item, category, cost } = req.body || {};
            if (!date || !item || !category || cost === undefined) {
                return res.status(400).json({ error: 'date, item, category, and cost are required' });
            }

            const parsedDate = new Date(date);
            const numCost = Number(cost);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ error: 'A valid date is required' });
            }
            if (!Number.isFinite(numCost) || numCost < 0) {
                return res.status(400).json({ error: 'A valid non-negative cost is required' });
            }

            const doc = {
                date: parsedDate,
                item: String(item).trim(),
                category: String(category).trim(),
                cost: numCost,
                createdAt: new Date(),
            };

            const result = await collection.insertOne(doc);
            await resequenceExpenses(db);

            const savedDoc = await collection.findOne({ _id: result.insertedId });

            return res.status(201).json({
                id: result.insertedId.toString(),
                serialNumber: savedDoc ? savedDoc.serialNumber : 1,
                date: doc.date,
                item: doc.item,
                category: doc.category,
                cost: doc.cost,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Expenses API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
