const { requireAuth } = require('../../auth');
const { connectToDatabase } = require('../../db');

module.exports = async (req, res) => {
    if (req.method === 'GET') {
        try {
            const db = await connectToDatabase();
            const doc = await db.collection('cms_konami').findOne({ $or: [{ _id: 'levels' }, { _id: 'current' }] });
            if (doc) {
                const list = Array.isArray(doc.levels) ? doc.levels : (Array.isArray(doc.data) ? doc.data : null);
                if (list !== null) {
                    return res.status(200).json(list);
                }
            }
        } catch (dbErr) {
            console.warn('[Konami Levels GET] MongoDB fetch error:', dbErr.message);
        }

        return res.status(200).json([]);
    }

    if (req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        const { levels } = req.body || {};
        if (!Array.isArray(levels)) {
            return res.status(400).json({ error: 'Payload must include an array of levels' });
        }

        try {
            const db = await connectToDatabase();
            await Promise.all([
                db.collection('cms_konami').updateOne(
                    { _id: 'levels' },
                    { $set: { levels, updatedAt: new Date() } },
                    { upsert: true }
                ),
                db.collection('cms_konami').updateOne(
                    { _id: 'current' },
                    { $set: { data: levels, updatedAt: new Date() } },
                    { upsert: true }
                )
            ]);

            return res.status(200).json({
                success: true,
                count: levels.length,
                storage: { database: true }
            });
        } catch (dbErr) {
            console.error('[Konami Levels POST] MongoDB save error:', dbErr.message);
            return res.status(500).json({ error: `Failed to save levels to database: ${dbErr.message}` });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};

