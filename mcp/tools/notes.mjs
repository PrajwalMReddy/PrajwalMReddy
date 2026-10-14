import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { connectToDatabase } from '../db.mjs';

const COLLECTION = 'notes';

function normalizeNote(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        content: String(doc.content || ''),
        folder: doc.folder ? String(doc.folder).trim() : '',
        archived: doc.archived === true,
        pinned: doc.pinned === true,
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

export function registerNotesTools(server) {
    // 1. Search Notes
    server.tool(
        'search_notes',
        'Search notes by keyword in title/content, folder name, or pinned status',
        {
            query: z.string().optional().describe('Search keyword to match in title or content'),
            folder: z.string().optional().describe('Folder name filter'),
            pinnedOnly: z.boolean().optional().describe('Only return pinned notes if true'),
            includeArchived: z.boolean().optional().default(false).describe('Include archived notes'),
            limit: z.number().int().min(1).max(50).optional().default(15).describe('Maximum number of notes to return')
        },
        async ({ query, folder, pinnedOnly, includeArchived, limit }) => {
            const db = await connectToDatabase();
            const filter = {};

            if (!includeArchived) {
                filter.archived = { $ne: true };
            }

            if (pinnedOnly) {
                filter.pinned = true;
            }

            if (folder) {
                filter.folder = folder;
            }

            if (query && query.trim()) {
                const regex = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ title: regex }, { content: regex }];
            }

            const docs = await db.collection(COLLECTION)
                .find(filter)
                .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
                .limit(limit)
                .toArray();

            const notes = docs.map(normalizeNote);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(notes, null, 2)
                    }
                ]
            };
        }
    );

    // 2. Get Note
    server.tool(
        'get_note',
        'Retrieve full contents of a specific note by ID or exact title',
        {
            id: z.string().optional().describe('MongoDB ObjectId string of the note'),
            title: z.string().optional().describe('Exact title of the note')
        },
        async ({ id, title }) => {
            if (!id && !title) {
                throw new Error('Either id or title must be provided');
            }

            const db = await connectToDatabase();
            let filter = {};

            if (id) {
                if (!ObjectId.isValid(id)) {
                    throw new Error(`Invalid note ID: ${id}`);
                }
                filter._id = new ObjectId(id);
            } else if (title) {
                filter.title = new RegExp(`^${title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            }

            const doc = await db.collection(COLLECTION).findOne(filter);
            if (!doc) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Note not found matching ${id ? `id: ${id}` : `title: ${title}`}` }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(normalizeNote(doc), null, 2)
                    }
                ]
            };
        }
    );

    // 3. Create Note
    server.tool(
        'create_note',
        'Create a new markdown note in the notes repository',
        {
            title: z.string().min(1).describe('Title of the note'),
            content: z.string().describe('Markdown or plain text content of the note'),
            folder: z.string().optional().describe('Optional folder/category name'),
            pinned: z.boolean().optional().default(false).describe('Whether to pin the note to the dashboard'),
            tags: z.array(z.string()).optional().describe('List of tags/labels')
        },
        async ({ title, content, folder, pinned, tags }) => {
            const db = await connectToDatabase();
            const now = new Date();
            const doc = {
                title: title.trim(),
                content: content || '',
                folder: folder ? folder.trim() : '',
                archived: false,
                pinned: pinned === true,
                tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
                linkedNote: '',
                createdAt: now,
                updatedAt: now,
            };

            const result = await db.collection(COLLECTION).insertOne(doc);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Note "${doc.title}" created successfully with ID: ${result.insertedId.toString()}`
                    }
                ]
            };
        }
    );

    // 4. Update Note
    server.tool(
        'update_note',
        'Update an existing note (title, content, folder, pinned, or archived status)',
        {
            id: z.string().describe('MongoDB ObjectId of the note to update'),
            title: z.string().optional().describe('New title for the note'),
            content: z.string().optional().describe('New content (replaces existing content)'),
            folder: z.string().optional().describe('New folder'),
            pinned: z.boolean().optional().describe('Pin or unpin the note'),
            archived: z.boolean().optional().describe('Archive or unarchive the note'),
            tags: z.array(z.string()).optional().describe('Updated list of tags')
        },
        async ({ id, title, content, folder, pinned, archived, tags }) => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`Invalid note ID: ${id}`);
            }

            const db = await connectToDatabase();
            const updateDoc = { updatedAt: new Date() };

            if (title !== undefined) updateDoc.title = title.trim();
            if (content !== undefined) updateDoc.content = content;
            if (folder !== undefined) updateDoc.folder = folder.trim();
            if (pinned !== undefined) updateDoc.pinned = Boolean(pinned);
            if (archived !== undefined) updateDoc.archived = Boolean(archived);
            if (tags !== undefined) updateDoc.tags = tags.map(t => String(t).trim()).filter(Boolean);

            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );

            if (result.matchedCount === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Note with ID ${id} was not found.` }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Note ${id} updated successfully.`
                    }
                ]
            };
        }
    );

    // 5. Delete Note
    server.tool(
        'delete_note',
        'Permanently delete a note by ID',
        {
            id: z.string().describe('MongoDB ObjectId of the note to delete')
        },
        async ({ id }) => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`Invalid note ID: ${id}`);
            }

            const db = await connectToDatabase();
            const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Note with ID ${id} was not found.` }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Note ${id} deleted successfully.`
                    }
                ]
            };
        }
    );
}
