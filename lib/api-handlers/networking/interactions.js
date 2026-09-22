const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../db');
const { requireAuth } = require('../../auth');

const PEOPLE_COLLECTION = 'networking_people';
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

    try {
        const db = await connectToDatabase();
        const interactionsColl = db.collection(INTERACTIONS_COLLECTION);
        const peopleColl = db.collection(PEOPLE_COLLECTION);

        if (req.method === 'GET') {
            const { personId, limit } = req.query || {};
            const filter = {};
            if (personId) {
                filter.personId = String(personId);
            }

            const queryLimit = Math.min(Number(limit || 50), 100);
            const docs = await interactionsColl
                .find(filter)
                .sort({ date: -1, createdAt: -1 })
                .limit(queryLimit)
                .toArray();

            return res.status(200).json(docs.map(normalizeInteraction));
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const personId = String(body.personId || '').trim();
            const summary = String(body.summary || '').trim();
            const date = body.date ? String(body.date).trim() : new Date().toISOString().slice(0, 10);
            const type = String(body.type || 'meeting').trim();
            const notes = String(body.notes || '').trim();
            const followUpNotes = String(body.followUpNotes || '').trim();
            const nextFollowUpAt = body.nextFollowUpAt ? String(body.nextFollowUpAt).trim() : null;

            if (!personId) {
                return res.status(400).json({ error: 'Person ID is required' });
            }
            if (!summary) {
                return res.status(400).json({ error: 'Interaction summary is required' });
            }

            const now = new Date();
            const doc = {
                personId,
                date,
                type,
                summary,
                notes,
                followUpNotes,
                createdAt: now,
                updatedAt: now,
            };

            const result = await interactionsColl.insertOne(doc);

            // Update person's lastInteractionAt and optionally nextFollowUpAt
            if (ObjectId.isValid(personId)) {
                const personUpdate = {
                    lastInteractionAt: new Date(date),
                    updatedAt: now,
                };
                if (nextFollowUpAt) {
                    personUpdate.nextFollowUpAt = nextFollowUpAt;
                    personUpdate.followUpStatus = 'pending';
                    if (followUpNotes) {
                        personUpdate.followUpNotes = followUpNotes;
                    }
                }
                await peopleColl.updateOne({ _id: new ObjectId(personId) }, { $set: personUpdate });
            }

            return res.status(201).json(normalizeInteraction({ _id: result.insertedId, ...doc }));
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Networking Interactions API error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
