const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../db');
const { requireAuth } = require('../../../auth');

const INTERACTIONS_COLLECTION = 'networking_interactions';

function normalizeInteraction(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        personId: String(doc.personId || ''),
        date: doc.date ? String(doc.date).trim() : new Date().toISOString().slice(0, 10),
        type: String(doc.type || 'meeting').trim(),
        summary: String(doc.summary || '').trim(),
        notes: String(doc.notes || '').trim(),
        followUpNotes: String(doc.followUpNotes || '').trim(),
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid interaction id' });
    }

    try {
        const db = await connectToDatabase();
        const interactionsColl = db.collection(INTERACTIONS_COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'PUT') {
            const body = req.body || {};
            const update = { updatedAt: new Date() };

            ['date', 'type', 'summary', 'notes', 'followUpNotes'].forEach((field) => {
                if (body[field] !== undefined) {
                    update[field] = String(body[field]).trim();
                }
            });

            const result = await interactionsColl.updateOne({ _id }, { $set: update });
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Interaction not found' });
            }

            const updatedDoc = await interactionsColl.findOne({ _id });
            return res.status(200).json(normalizeInteraction(updatedDoc));
        }

        if (req.method === 'DELETE') {
            const result = await interactionsColl.deleteOne({ _id });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Interaction not found' });
            }

            return res.status(200).json({ success: true, id });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Networking Interaction Item API error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
