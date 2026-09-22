const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../../db');
const { requireAuth } = require('../../../auth');

const PEOPLE_COLLECTION = 'networking_people';
const INTERACTIONS_COLLECTION = 'networking_interactions';
const TODO_COLLECTION = 'todos';

function parseDateKey(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    if (!str) return null;
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return null;
}

function normalizePerson(doc) {
    if (!doc) return null;
    const scheduledDate = parseDateKey(doc.followUpScheduledDate);
    const dueDate = parseDateKey(doc.followUpDueDate || doc.nextFollowUpAt);
    const nextFollowUpAt = parseDateKey(doc.nextFollowUpAt || doc.followUpDueDate || doc.followUpScheduledDate);

    return {
        id: doc._id.toString(),
        name: String(doc.name || '').trim(),
        avatar: String(doc.avatar || '').trim(),
        role: String(doc.role || '').trim(),
        company: String(doc.company || '').trim(),
        email: String(doc.email || '').trim(),
        phone: String(doc.phone || '').trim(),
        location: String(doc.location || '').trim(),
        website: String(doc.website || '').trim(),
        linkedin: String(doc.linkedin || '').trim(),
        howMet: String(doc.howMet || '').trim(),
        whereMet: String(doc.whereMet || '').trim(),
        mutualConnections: String(doc.mutualConnections || '').trim(),
        category: String(doc.category || '').trim(),
        tags: Array.isArray(doc.tags) ? doc.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        notes: String(doc.notes || '').trim(),
        nextFollowUpAt,
        followUpDueDate: dueDate,
        followUpScheduledDate: scheduledDate,
        followUpStatus: doc.followUpStatus || (nextFollowUpAt || scheduledDate ? 'pending' : 'none'),
        followUpNotes: String(doc.followUpNotes || '').trim(),
        syncTodo: doc.syncTodo !== undefined ? Boolean(doc.syncTodo) : Boolean(doc.todoId),
        todoId: doc.todoId ? doc.todoId.toString() : null,
        lastInteractionAt: doc.lastInteractionAt ? new Date(doc.lastInteractionAt).toISOString() : null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

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
        return res.status(400).json({ error: 'Invalid person id' });
    }

    try {
        const db = await connectToDatabase();
        const peopleColl = db.collection(PEOPLE_COLLECTION);
        const interactionsColl = db.collection(INTERACTIONS_COLLECTION);
        const todoColl = db.collection(TODO_COLLECTION);
        const _id = new ObjectId(id);

        if (req.method === 'GET') {
            const personDoc = await peopleColl.findOne({ _id });
            if (!personDoc) {
                return res.status(404).json({ error: 'Person not found' });
            }

            // Fetch all interactions for this person, sorted newest first
            const interactions = await interactionsColl
                .find({ personId: id })
                .sort({ date: -1, createdAt: -1 })
                .toArray();

            return res.status(200).json({
                person: normalizePerson(personDoc),
                interactions: interactions.map(normalizeInteraction),
            });
        }

        if (req.method === 'PUT') {
            const body = req.body || {};
            const existingDoc = await peopleColl.findOne({ _id });
            if (!existingDoc) {
                return res.status(404).json({ error: 'Person not found' });
            }

            const update = { updatedAt: new Date() };

            const allowedFields = [
                'name', 'avatar', 'role', 'company', 'email', 'phone', 'location',
                'website', 'linkedin', 'howMet', 'whereMet', 'mutualConnections',
                'category', 'notes', 'nextFollowUpAt', 'followUpDueDate', 'followUpScheduledDate', 'followUpStatus', 'followUpNotes', 'syncTodo', 'todoId'
            ];

            allowedFields.forEach((field) => {
                if (body[field] !== undefined) {
                    update[field] = body[field];
                }
            });

            if (body.tags !== undefined) {
                update.tags = Array.isArray(body.tags)
                    ? body.tags.map((t) => String(t).trim()).filter(Boolean)
                    : [];
            }

            if (body.lastInteractionAt !== undefined) {
                update.lastInteractionAt = body.lastInteractionAt ? new Date(body.lastInteractionAt) : null;
            }

            // Sync with Todos collection
            const personName = update.name || existingDoc.name;
            const followUpTitle = update.followUpNotes || existingDoc.followUpNotes || `Follow up with ${personName}`;
            const schedDate = update.followUpScheduledDate !== undefined ? update.followUpScheduledDate : existingDoc.followUpScheduledDate;
            const dueDateVal = update.followUpDueDate !== undefined ? update.followUpDueDate : existingDoc.followUpDueDate;
            const statusVal = update.followUpStatus !== undefined ? update.followUpStatus : existingDoc.followUpStatus;
            const shouldSyncTodo = body.syncTodo !== undefined ? Boolean(body.syncTodo) : Boolean(existingDoc.syncTodo || existingDoc.todoId);
            const hasFollowUpInfo = Boolean(schedDate || dueDateVal || (update.followUpNotes && update.followUpNotes.trim()));

            if (shouldSyncTodo && hasFollowUpInfo) {
                // Find existing linked todo
                let linkedTodo = null;
                const existingTodoId = update.todoId || existingDoc.todoId;
                if (existingTodoId && ObjectId.isValid(existingTodoId)) {
                    linkedTodo = await todoColl.findOne({ _id: new ObjectId(existingTodoId) });
                }
                if (!linkedTodo) {
                    linkedTodo = await todoColl.findOne({ personId: id });
                }
                if (!linkedTodo && personName) {
                    // Fallback search by tag or title
                    linkedTodo = await todoColl.findOne({
                        $or: [
                            { tags: { $in: ['Networking', personName] }, title: new RegExp(personName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                        ]
                    });
                }

                const schedIso = schedDate ? new Date(Date.UTC(Number(schedDate.slice(0, 4)), Number(schedDate.slice(5, 7)) - 1, Number(schedDate.slice(8, 10)))).toISOString() : null;
                const dueIso = dueDateVal ? new Date(Date.UTC(Number(dueDateVal.slice(0, 4)), Number(dueDateVal.slice(5, 7)) - 1, Number(dueDateVal.slice(8, 10)))).toISOString() : null;

                if (linkedTodo) {
                    const existingTags = Array.isArray(linkedTodo.tags)
                        ? linkedTodo.tags.filter((t) => t !== personName && t !== existingDoc.name && t !== (update.name || ''))
                        : [];
                    const nextTags = Array.from(new Set(['Networking', ...existingTags]));

                    await todoColl.updateOne(
                        { _id: linkedTodo._id },
                        {
                            $set: {
                                title: followUpTitle,
                                completed: statusVal === 'completed',
                                scheduledAt: schedIso,
                                dueDate: dueIso,
                                personId: id,
                                personName,
                                tags: nextTags,
                                description: (update.whereMet || existingDoc.whereMet) ? `Met at: ${update.whereMet || existingDoc.whereMet}` : (linkedTodo.description || ''),
                                updatedAt: new Date(),
                            }
                        }
                    );
                    update.todoId = linkedTodo._id.toString();
                    update.syncTodo = true;
                } else {
                    const latestTodo = await todoColl.find().sort({ order: -1, serialNumber: -1, createdAt: -1 }).limit(1).next();
                    const order = latestTodo ? Number(latestTodo.order ?? latestTodo.serialNumber ?? 0) + 1 : 1;
                    const newTodoDoc = {
                        title: followUpTitle,
                        completed: statusVal === 'completed',
                        scheduledAt: schedIso,
                        dueDate: dueIso,
                        priority: 'medium',
                        order,
                        serialNumber: order,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        description: (update.whereMet || existingDoc.whereMet) ? `Met at: ${update.whereMet || existingDoc.whereMet}` : '',
                        subtasks: [],
                        estimatedTime: null,
                        recurrence: 'none',
                        recurrenceDays: [],
                        tags: ['Networking'],
                        personId: id,
                        personName,
                    };
                    const insertRes = await todoColl.insertOne(newTodoDoc);
                    update.todoId = insertRes.insertedId.toString();
                    update.syncTodo = true;
                }
            } else {
                // If syncTodo is unchecked or follow-up was cleared, remove linked todo
                const existingTodoId = existingDoc.todoId || update.todoId;
                if (existingTodoId && ObjectId.isValid(existingTodoId)) {
                    await todoColl.deleteOne({ _id: new ObjectId(existingTodoId) });
                }
                await todoColl.deleteMany({ personId: id });
                update.todoId = null;
                update.syncTodo = false;
            }

            const result = await peopleColl.updateOne({ _id }, { $set: update });
            if (result.matchedCount === 0) {
                return res.status(404).json({ error: 'Person not found' });
            }

            const updatedDoc = await peopleColl.findOne({ _id });
            const interactions = await interactionsColl
                .find({ personId: id })
                .sort({ date: -1, createdAt: -1 })
                .toArray();

            return res.status(200).json({
                person: normalizePerson(updatedDoc),
                interactions: interactions.map(normalizeInteraction),
            });
        }

        if (req.method === 'DELETE') {
            const personDoc = await peopleColl.findOne({ _id });
            if (!personDoc) {
                return res.status(404).json({ error: 'Person not found' });
            }

            // Delete associated todo items
            if (personDoc.todoId && ObjectId.isValid(personDoc.todoId)) {
                await todoColl.deleteOne({ _id: new ObjectId(personDoc.todoId) });
            }
            await todoColl.deleteMany({ personId: id });

            // Delete associated interactions as well
            await interactionsColl.deleteMany({ personId: id });

            const result = await peopleColl.deleteOne({ _id });
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Person not found' });
            }

            return res.status(200).json({ success: true, id });
        }


        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Person Item API error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
