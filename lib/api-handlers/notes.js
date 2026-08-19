const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const COLLECTION = 'notes';

function normalizeNote(doc) {
    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        content: String(doc.content || ''),
        blocks: Array.isArray(doc.blocks) ? doc.blocks : null,
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
            const notes = await collection
                .find()
                .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
                .toArray();

            return res.status(200).json(notes.map(normalizeNote));
        }

        if (req.method === 'POST') {
            const { title, content, blocks } = req.body || {};
            const trimmedTitle = String(title || '').trim();

            if (!trimmedTitle) {
                return res.status(400).json({ error: 'Note title is required' });
            }

            const now = new Date();
            const doc = {
                title: trimmedTitle,
                content: String(content || ''),
                blocks: Array.isArray(blocks) ? blocks : null,
                createdAt: now,
                updatedAt: now,
            };

            const result = await collection.insertOne(doc);
            return res.status(201).json(normalizeNote({ _id: result.insertedId, ...doc }));
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Notes API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
