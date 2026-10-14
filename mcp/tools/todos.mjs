import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { connectToDatabase } from '../db.mjs';

const COLLECTION = 'todos';

function normalizeTodo(doc) {
    if (!doc) return null;
    return {
        id: doc._id.toString(),
        title: String(doc.title || '').trim(),
        completed: Boolean(doc.completed),
        dueDate: doc.dueDate ? new Date(doc.dueDate).toISOString().slice(0, 10) : null,
        priority: ['high', 'medium', 'low'].includes(doc.priority) ? doc.priority : 'medium',
        description: doc.description || '',
        subtasks: Array.isArray(doc.subtasks) ? doc.subtasks : [],
        estimatedTime: doc.estimatedTime ? Number(doc.estimatedTime) : null,
        recurrence: doc.recurrence || 'none',
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        personName: doc.personName || null,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    };
}

export function registerTodoTools(server) {
    // 1. List Todos
    server.tool(
        'list_todos',
        'List todo tasks with optional filters for completion status, priority, or tags',
        {
            completed: z.boolean().optional().describe('Filter by completed status (true for done, false for pending)'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority level'),
            tag: z.string().optional().describe('Filter by specific tag'),
            search: z.string().optional().describe('Keyword search in title or description'),
            limit: z.number().int().min(1).max(100).optional().default(30).describe('Maximum items to return')
        },
        async ({ completed, priority, tag, search, limit }) => {
            const db = await connectToDatabase();
            const filter = {};

            if (completed !== undefined) {
                filter.completed = completed;
            }

            if (priority) {
                filter.priority = priority;
            }

            if (tag) {
                filter.tags = tag;
            }

            if (search && search.trim()) {
                const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ title: regex }, { description: regex }];
            }

            const docs = await db.collection(COLLECTION)
                .find(filter)
                .sort({ completed: 1, dueDate: 1, order: 1, createdAt: -1 })
                .limit(limit)
                .toArray();

            const todos = docs.map(normalizeTodo);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(todos, null, 2)
                    }
                ]
            };
        }
    );

    // 2. Create Todo
    server.tool(
        'create_todo',
        'Add a new todo task to the personal dashboard',
        {
            title: z.string().min(1).describe('Title of the task'),
            description: z.string().optional().describe('Detailed description or notes'),
            priority: z.enum(['low', 'medium', 'high']).optional().default('medium').describe('Priority level'),
            dueDate: z.string().optional().describe('Due date formatted as YYYY-MM-DD or ISO string'),
            estimatedTime: z.number().optional().describe('Estimated duration in minutes'),
            recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional().default('none').describe('Recurrence frequency'),
            tags: z.array(z.string()).optional().describe('Tags or category labels')
        },
        async ({ title, description, priority, dueDate, estimatedTime, recurrence, tags }) => {
            const db = await connectToDatabase();
            const now = new Date();

            const latestTodo = await db.collection(COLLECTION)
                .find()
                .sort({ order: -1, serialNumber: -1, createdAt: -1 })
                .limit(1)
                .next();

            const order = latestTodo ? Number(latestTodo.order ?? latestTodo.serialNumber ?? 0) + 1 : 1;
            const normalizedDueDate = dueDate ? new Date(dueDate) : null;

            const doc = {
                title: title.trim(),
                description: description || '',
                completed: false,
                priority: priority || 'medium',
                dueDate: normalizedDueDate && !Number.isNaN(normalizedDueDate.getTime()) ? normalizedDueDate.toISOString().slice(0, 10) : null,
                estimatedTime: estimatedTime || null,
                recurrence: recurrence || 'none',
                recurrenceDays: [],
                tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
                order,
                serialNumber: order,
                subtasks: [],
                createdAt: now,
                updatedAt: now,
            };

            const result = await db.collection(COLLECTION).insertOne(doc);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Task "${doc.title}" created with ID: ${result.insertedId.toString()}`
                    }
                ]
            };
        }
    );

    // 3. Update Todo
    server.tool(
        'update_todo',
        'Update a todo task status, title, priority, due date, or description',
        {
            id: z.string().describe('MongoDB ObjectId of the task'),
            completed: z.boolean().optional().describe('Mark as completed (true) or uncompleted (false)'),
            title: z.string().optional().describe('Updated title'),
            description: z.string().optional().describe('Updated description'),
            priority: z.enum(['low', 'medium', 'high']).optional().describe('Updated priority level'),
            dueDate: z.string().nullable().optional().describe('Updated due date (YYYY-MM-DD or null to remove)'),
            tags: z.array(z.string()).optional().describe('Updated tags')
        },
        async ({ id, completed, title, description, priority, dueDate, tags }) => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`Invalid todo ID: ${id}`);
            }

            const db = await connectToDatabase();
            const updateDoc = { updatedAt: new Date() };

            if (completed !== undefined) updateDoc.completed = Boolean(completed);
            if (title !== undefined) updateDoc.title = title.trim();
            if (description !== undefined) updateDoc.description = description;
            if (priority !== undefined) updateDoc.priority = priority;
            if (dueDate !== undefined) updateDoc.dueDate = dueDate ? new Date(dueDate).toISOString().slice(0, 10) : null;
            if (tags !== undefined) updateDoc.tags = tags.map(t => String(t).trim()).filter(Boolean);

            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(id) },
                { $set: updateDoc }
            );

            if (result.matchedCount === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Todo item ${id} was not found.` }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Todo item ${id} updated successfully.`
                    }
                ]
            };
        }
    );

    // 4. Delete Todo
    server.tool(
        'delete_todo',
        'Permanently delete a todo task by ID',
        {
            id: z.string().describe('MongoDB ObjectId of the task to delete')
        },
        async ({ id }) => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`Invalid todo ID: ${id}`);
            }

            const db = await connectToDatabase();
            const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });

            if (result.deletedCount === 0) {
                return {
                    isError: true,
                    content: [{ type: 'text', text: `Todo with ID ${id} was not found.` }]
                };
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: `Todo ${id} deleted successfully.`
                    }
                ]
            };
        }
    );
}
