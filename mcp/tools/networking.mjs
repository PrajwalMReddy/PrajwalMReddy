import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { connectToDatabase } from '../db.mjs';

const PEOPLE_COLLECTION = 'networking_people';
const INTERACTIONS_COLLECTION = 'networking_interactions';

function normalizePerson(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        name: String(doc.name || '').trim(),
        role: String(doc.role || '').trim(),
        company: String(doc.company || '').trim(),
        email: String(doc.email || '').trim(),
        phone: String(doc.phone || '').trim(),
        location: String(doc.location || '').trim(),
        linkedin: String(doc.linkedin || '').trim(),
        category: String(doc.category || '').trim(),
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        notes: String(doc.notes || '').trim(),
        nextFollowUpAt: doc.nextFollowUpAt ? String(doc.nextFollowUpAt).slice(0, 10) : null,
        followUpStatus: doc.followUpStatus || 'none',
        followUpNotes: String(doc.followUpNotes || '').trim(),
        lastInteractionAt: doc.lastInteractionAt ? new Date(doc.lastInteractionAt).toISOString() : null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

export function registerNetworkingTools(server) {
    // 1. Search Contacts
    server.tool(
        'search_contacts',
        'Search networking contacts by name, company, role, tags, or follow-up status (overdue, upcoming, pending)',
        {
            search: z.string().optional().describe('Keyword match across name, company, role, or notes'),
            tag: z.string().optional().describe('Tag filter (e.g. AI, Founder, Investor, Alumni)'),
            followUp: z.enum(['all', 'overdue', 'upcoming', 'pending', 'none']).optional().default('all').describe('Filter by follow-up status'),
            limit: z.number().int().min(1).max(50).optional().default(20).describe('Maximum contacts to return')
        },
        async ({ search, tag, followUp, limit }) => {
            const db = await connectToDatabase();
            const filter = {};

            if (tag) {
                filter.tags = new RegExp(`^${tag.trim()}$`, 'i');
            }

            if (search && search.trim()) {
                const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [
                    { name: regex },
                    { company: regex },
                    { role: regex },
                    { notes: regex },
                    { location: regex },
                    { tags: regex }
                ];
            }

            const todayStr = new Date().toISOString().slice(0, 10);
            if (followUp === 'overdue') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $lt: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            } else if (followUp === 'upcoming' || followUp === 'pending') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $gte: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            }

            const docs = await db.collection(PEOPLE_COLLECTION)
                .find(filter)
                .sort({ nextFollowUpAt: 1, lastInteractionAt: -1, createdAt: -1 })
                .limit(limit)
                .toArray();

            return {
                content: [{ type: 'text', text: JSON.stringify(docs.map(normalizePerson), null, 2) }]
            };
        }
    );

    // 2. Get Contact Profile with History
    server.tool(
        'get_contact',
        'Get full details of a contact including their complete interaction history and follow-up timeline',
        {
            id: z.string().optional().describe('MongoDB ObjectId of the contact'),
            name: z.string().optional().describe('Exact or partial name of the contact')
        },
        async ({ id, name }) => {
            if (!id && !name) {
                throw new Error('Either contact id or name must be provided');
            }

            const db = await connectToDatabase();
            let filter = {};

            if (id) {
                if (!ObjectId.isValid(id)) throw new Error(`Invalid contact ID: ${id}`);
                filter._id = new ObjectId(id);
            } else {
                filter.name = new RegExp(name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }

            const person = await db.collection(PEOPLE_COLLECTION).findOne(filter);
            if (!person) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Contact not found.` }]
                };
            }

            const personId = person._id.toString();
            const interactions = await db.collection(INTERACTIONS_COLLECTION)
                .find({ personId })
                .sort({ date: -1, createdAt: -1 })
                .toArray();

            const profile = {
                ...normalizePerson(person),
                interactions: interactions.map(i => ({
                    id: i._id.toString(),
                    date: i.date ? new Date(i.date).toISOString().slice(0, 10) : null,
                    type: i.type,
                    notes: i.notes,
                    createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : null
                }))
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }]
            };
        }
    );

    // 3. Create Contact
    server.tool(
        'create_contact',
        'Add a new person to the networking CRM',
        {
            name: z.string().min(1).describe('Full name of the contact'),
            company: z.string().optional().describe('Company or organization'),
            role: z.string().optional().describe('Title / Role'),
            email: z.string().optional().describe('Email address'),
            phone: z.string().optional().describe('Phone number'),
            location: z.string().optional().describe('Location or city'),
            linkedin: z.string().optional().describe('LinkedIn URL or handle'),
            tags: z.array(z.string()).optional().describe('Tags/categories (e.g. AI, Mentor, Engineer)'),
            notes: z.string().optional().describe('General notes, context, or mutual connections'),
            nextFollowUpAt: z.string().optional().describe('Date for next follow-up (YYYY-MM-DD)'),
            followUpNotes: z.string().optional().describe('Action items for next follow-up')
        },
        async ({ name, company, role, email, phone, location, linkedin, tags, notes, nextFollowUpAt, followUpNotes }) => {
            const db = await connectToDatabase();
            const now = new Date();

            const doc = {
                name: name.trim(),
                company: (company || '').trim(),
                role: (role || '').trim(),
                email: (email || '').trim(),
                phone: (phone || '').trim(),
                location: (location || '').trim(),
                linkedin: (linkedin || '').trim(),
                avatar: '',
                howMet: '',
                whereMet: '',
                mutualConnections: '',
                category: '',
                tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
                notes: (notes || '').trim(),
                nextFollowUpAt: nextFollowUpAt ? String(nextFollowUpAt).trim() : null,
                followUpDueDate: nextFollowUpAt ? String(nextFollowUpAt).trim() : null,
                followUpScheduledDate: null,
                followUpStatus: nextFollowUpAt ? 'pending' : 'none',
                followUpNotes: (followUpNotes || '').trim(),
                lastInteractionAt: null,
                createdAt: now,
                updatedAt: now,
            };

            const result = await db.collection(PEOPLE_COLLECTION).insertOne(doc);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Contact "${doc.name}" created with ID: ${result.insertedId.toString()}`
                    }
                ]
            };
        }
    );

    // 4. Log Interaction
    server.tool(
        'log_interaction',
        'Log a conversation, call, email, coffee chat, or meeting with a contact and optionally update the next follow-up date',
        {
            personId: z.string().describe('MongoDB ObjectId of the contact'),
            type: z.enum(['meeting', 'call', 'email', 'coffee', 'message', 'event', 'other']).describe('Type of interaction'),
            notes: z.string().min(1).describe('Summary of the discussion, context, or action items'),
            date: z.string().optional().describe('Date of interaction (YYYY-MM-DD, defaults to today)'),
            nextFollowUpAt: z.string().optional().describe('Updated next follow-up date (YYYY-MM-DD)'),
            nextFollowUpNotes: z.string().optional().describe('Updated next follow-up topic or goal')
        },
        async ({ personId, type, notes, date, nextFollowUpAt, nextFollowUpNotes }) => {
            if (!ObjectId.isValid(personId)) {
                throw new Error(`Invalid contact ID: ${personId}`);
            }

            const db = await connectToDatabase();
            const person = await db.collection(PEOPLE_COLLECTION).findOne({ _id: new ObjectId(personId) });
            if (!person) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Contact with ID ${personId} not found.` }]
                };
            }

            const interactionDate = date ? new Date(date) : new Date();
            const now = new Date();

            const interactionDoc = {
                personId,
                personName: person.name,
                type,
                notes: notes.trim(),
                date: interactionDate,
                createdAt: now,
                updatedAt: now
            };

            const interactionResult = await db.collection(INTERACTIONS_COLLECTION).insertOne(interactionDoc);

            // Update person with lastInteractionAt and new followUp details if supplied
            const personUpdate = {
                lastInteractionAt: interactionDate,
                updatedAt: now
            };

            if (nextFollowUpAt !== undefined) {
                personUpdate.nextFollowUpAt = nextFollowUpAt ? String(nextFollowUpAt).trim() : null;
                personUpdate.followUpDueDate = personUpdate.nextFollowUpAt;
                personUpdate.followUpStatus = nextFollowUpAt ? 'pending' : 'none';
            }

            if (nextFollowUpNotes !== undefined) {
                personUpdate.followUpNotes = nextFollowUpNotes.trim();
            }

            await db.collection(PEOPLE_COLLECTION).updateOne(
                { _id: new ObjectId(personId) },
                { $set: personUpdate }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Interaction logged successfully for ${person.name} (Interaction ID: ${interactionResult.insertedId.toString()})`
                    }
                ]
            };
        }
    );
}
