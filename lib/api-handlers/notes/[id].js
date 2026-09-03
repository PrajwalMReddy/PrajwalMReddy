const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../lib/db');
const { requireAuth } = require('../../../lib/auth');

const COLLECTION = 'notes';

function normalizeNote(doc) {
    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        content: String(doc.content || ''),
        blocks: Array.isArray(doc.blocks) ? doc.blocks : null,
        folder: doc.folder ? String(doc.folder).trim() : '',
        archived: doc.archived === true,
        linkedNote: doc.linkedNote ? String(doc.linkedNote) : '',
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid note id' });
    }

    try {
        const db = await connectToDatabase();
        const collection = db.collection(COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'PUT') {
            const { title, content, blocks, archived, folder, linkedNote } = req.body || {};
            const update = { updatedAt: new Date() };

            if (title !== undefined) {
                const trimmedTitle = String(title || '').trim();
                if (!trimmedTitle) {
                    return res.status(400).json({ error: 'Note title is required' });
                }
                update.title = trimmedTitle;
            }

            if (content !== undefined) {
                update.content = String(content || '');
            }

            if (blocks !== undefined) {
                update.blocks = Array.isArray(blocks) ? blocks : null;
            }

            if (folder !== undefined) {
                update.folder = folder ? String(folder).trim() : '';
            }

            if (archived !== undefined) {
                if (typeof archived !== 'boolean') {
                    return res.status(400).json({ error: 'Archived must be a boolean' });
                }
                update.archived = archived;
            }

            if (linkedNote !== undefined) {
                update.linkedNote = linkedNote ? String(linkedNote) : '';
            }

            const result = await collection.updateOne(
                { _id },
                { $set: update }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Note not found' });
            }

            const updatedDoc = await collection.findOne({ _id });

            if (!updatedDoc) {
                return res.status(404).json({ error: 'Note not found' });
            }

            return res.status(200).json(normalizeNote(updatedDoc));
        }

        if (req.method === 'DELETE') {
            const result = await collection.deleteOne({ _id });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Note not found' });
            }

            return res.status(200).json({ id });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Note item API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
