const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

const COLLECTION = 'income';

async function getNextNo(db) {
    const latest = await db
        .collection(COLLECTION)
        .find()
        .sort({ no: -1 })
        .limit(1)
        .toArray();
    return latest.length > 0 ? latest[0].no + 1 : 1;
}

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
            const { date, item, value, type, no } = req.body || {};
            if (!date || !item || value === undefined) {
                return res.status(400).json({ error: 'date, item, and value are required' });
            }

            const doc = {
                no: no ?? (await getNextNo(db)),
                date: new Date(date),
                item,
                value: Number(value),
                type: type === 'injection' ? 'injection' : 'other',
            };

            const result = await collection.insertOne(doc);
            return res.status(201).json({
                id: result.insertedId.toString(),
                ...doc,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Income API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
