const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../db');
const { requireAuth } = require('../auth');

const PEOPLE_COLLECTION = 'networking_people';
const INTERACTIONS_COLLECTION = 'networking_interactions';

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
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString(),
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const peopleColl = db.collection(PEOPLE_COLLECTION);
        const interactionsColl = db.collection(INTERACTIONS_COLLECTION);

        if (req.method === 'GET') {
            const { search, tag, category, followUp, sort } = req.query || {};

            const filter = {};

            if (tag) {
                filter.tags = { $regex: new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
            }

            if (category) {
                filter.category = { $regex: new RegExp(`^${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
            }

            if (search) {
                const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { name: searchRegex },
                    { company: searchRegex },
                    { role: searchRegex },
                    { notes: searchRegex },
                    { location: searchRegex },
                    { tags: searchRegex },
                    { howMet: searchRegex },
                    { whereMet: searchRegex },
                ];
            }

            const todayStr = new Date().toISOString().slice(0, 10);

            if (followUp === 'overdue') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $lt: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            } else if (followUp === 'upcoming' || followUp === 'pending') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $gte: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            } else if (followUp === 'none') {
                filter.$or = [
                    { nextFollowUpAt: null },
                    { nextFollowUpAt: '' },
                    { nextFollowUpAt: { $exists: false } },
                ];
            }

            // Determine sorting
            let sortOptions = { createdAt: -1 };
            if (sort === 'name') {
                sortOptions = { name: 1 };
            } else if (sort === 'lastInteraction') {
                sortOptions = { lastInteractionAt: -1, createdAt: -1 };
            } else if (sort === 'nextFollowUp') {
                sortOptions = { nextFollowUpAt: 1, createdAt: -1 };
            } else if (sort === 'updated') {
                sortOptions = { updatedAt: -1 };
            } else if (sort === 'oldest') {
                sortOptions = { createdAt: 1 };
            }

            const docs = await peopleColl.find(filter).sort(sortOptions).toArray();

            // Calculate overview stats
            const allDocs = await peopleColl.find({}).toArray();
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            let recentlyAddedCount = 0;
            let overdueFollowUpsCount = 0;
            let upcomingFollowUpsCount = 0;
            const categoryCounts = {};
            const tagCounts = {};

            allDocs.forEach((doc) => {
                if (doc.createdAt && new Date(doc.createdAt) >= sevenDaysAgo) {
                    recentlyAddedCount += 1;
                }
                if (doc.nextFollowUpAt && doc.followUpStatus !== 'completed') {
                    if (doc.nextFollowUpAt < todayStr) {
                        overdueFollowUpsCount += 1;
                    } else {
                        upcomingFollowUpsCount += 1;
                    }
                }
                if (doc.category) {
                    categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
                }
                if (Array.isArray(doc.tags)) {
                    doc.tags.forEach((t) => {
                        const trimmed = String(t).trim();
                        if (trimmed) tagCounts[trimmed] = (tagCounts[trimmed] || 0) + 1;
                    });
                }
            });

            return res.status(200).json({
                people: docs.map(normalizePerson),
                stats: {
                    total: allDocs.length,
                    recentlyAdded: recentlyAddedCount,
                    overdueFollowUps: overdueFollowUpsCount,
                    upcomingFollowUps: upcomingFollowUpsCount,
                    totalFollowUpsDue: overdueFollowUpsCount + upcomingFollowUpsCount,
                    categories: categoryCounts,
                    tags: tagCounts,
                },
            });
        }

        if (req.method === 'POST') {
            const body = req.body || {};
            const name = String(body.name || '').trim();

            if (!name) {
                return res.status(400).json({ error: 'Person name is required' });
            }

            const now = new Date();
            const doc = {
                name,
                avatar: String(body.avatar || '').trim(),
                role: String(body.role || '').trim(),
                company: String(body.company || '').trim(),
                email: String(body.email || '').trim(),
                phone: String(body.phone || '').trim(),
                location: String(body.location || '').trim(),
                website: String(body.website || '').trim(),
                linkedin: String(body.linkedin || '').trim(),
                howMet: String(body.howMet || '').trim(),
                whereMet: String(body.whereMet || '').trim(),
                mutualConnections: String(body.mutualConnections || '').trim(),
                category: String(body.category || '').trim(),
                tags: Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : [],
                notes: String(body.notes || '').trim(),
                nextFollowUpAt: body.nextFollowUpAt ? String(body.nextFollowUpAt).trim() : (body.followUpDueDate ? String(body.followUpDueDate).trim() : null),
                followUpDueDate: body.followUpDueDate ? String(body.followUpDueDate).trim() : (body.nextFollowUpAt ? String(body.nextFollowUpAt).trim() : null),
                followUpScheduledDate: body.followUpScheduledDate ? String(body.followUpScheduledDate).trim() : null,
                followUpStatus: body.followUpStatus || (body.nextFollowUpAt || body.followUpDueDate ? 'pending' : 'none'),
                followUpNotes: String(body.followUpNotes || '').trim(),
                lastInteractionAt: body.lastInteractionAt ? new Date(body.lastInteractionAt) : null,
                createdAt: now,
                updatedAt: now,
            };

            const result = await peopleColl.insertOne(doc);
            return res.status(201).json(normalizePerson({ _id: result.insertedId, ...doc }));
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Networking People API error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
