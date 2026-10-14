const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');
const { resequenceIncome } = require('../../../lib/budgetResequence');

const COLLECTION = 'income';

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);

        if (req.method === 'GET') {
            const income = await collection
                .find()
                .sort({ date: -1, no: -1 })
                .toArray();
            return res.status(200).json(
                income.map((doc) => ({
                    id: doc._id.toString(),
                    no: doc.no,
                    date: doc.date,
                    item: doc.item,
                    value: doc.value,
                    type: doc.type || 'other',
                }))
            );
        }

        if (req.method === 'POST') {
            const { date, item, value, type } = req.body || {};
            if (!date || !item || value === undefined) {
                return res.status(400).json({ error: 'date, item, and value are required' });
            }

            const parsedDate = new Date(date);
            const numValue = Number(value);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ error: 'A valid date is required' });
            }
            if (!Number.isFinite(numValue) || numValue < 0) {
                return res.status(400).json({ error: 'A valid non-negative value is required' });
            }

            const doc = {
                date: parsedDate,
                item: String(item).trim(),
                value: numValue,
                type: type === 'injection' ? 'injection' : 'other',
                createdAt: new Date(),
            };

            const result = await collection.insertOne(doc);
            await resequenceIncome(db);

            const savedDoc = await collection.findOne({ _id: result.insertedId });

            return res.status(201).json({
                id: result.insertedId.toString(),
                no: savedDoc ? savedDoc.no : 1,
                date: doc.date,
                item: doc.item,
                value: doc.value,
                type: doc.type,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Income API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
