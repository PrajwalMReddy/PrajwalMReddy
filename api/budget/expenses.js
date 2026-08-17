const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const COLLECTION = 'expenses';

async function getNextSerialNumber(db) {
    const latest = await db
        .collection(COLLECTION)
        .find()
        .sort({ serialNumber: -1 })
        .limit(1)
        .toArray();
    return latest.length > 0 ? latest[0].serialNumber + 1 : 1;
}

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
            const { date, item, category, cost, serialNumber } = req.body || {};
            if (!date || !item || !category || cost === undefined) {
                return res.status(400).json({ error: 'date, item, category, and cost are required' });
            }

            const doc = {
                serialNumber: serialNumber ?? (await getNextSerialNumber(db)),
                date: new Date(date),
                item,
                category,
                cost: Number(cost),
            };

            const result = await collection.insertOne(doc);
            return res.status(201).json({
                id: result.insertedId.toString(),
                ...doc,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Expenses API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
