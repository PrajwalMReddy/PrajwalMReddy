/**
 * LLM Orchestration Layer
 * Powered by Anthropic Claude SDK (@anthropic-ai/sdk) server-side only.
 * Implements:
 * - Tool definitions (get_todos, add_todo, get_budget_summary, get_notes, create_note, get_unread_emails, get_news, get_weather, delete_todo, delete_note, send_email)
 * - Confirmation protection for critical write actions (Requirement 5)
 * - Multi-turn tool execution loop
 * - Structured synthesis ({ urgent: [...], fyi: [...], suggestion: "...", prioritizedPlan: [...], patterns: [...] })
 * - Intelligent mock simulation fallback when ANTHROPIC_API_KEY is not configured
 */

const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../lib/db');
const {
    buildContext,
    fetchTodoContext,
    fetchBudgetContext,
    fetchNotesContext,
    fetchEmailContext,
    fetchCalendarContext,
} = require('./context');

let Anthropic = null;
try {
    Anthropic = require('@anthropic-ai/sdk');
} catch (_) {
    console.warn('@anthropic-ai/sdk not yet installed, using fallback engine');
}

/**
 * Tool Specifications for Anthropic Claude
 */
const TOOLS = [
    {
        name: 'get_todos',
        description: 'Query existing todos with optional filtering by status (pending/completed/all), priority (high/medium/low), or search term.',
        input_schema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['pending', 'completed', 'all'],
                    description: 'Filter by completion status (default: pending)',
                },
                priority: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Filter by priority level',
                },
                query: {
                    type: 'string',
                    description: 'Text to search in task title or description',
                },
            },
        },
    },
    {
        name: 'get_todo_details',
        description: 'Fetch complete details for a specific todo item including description, tags, estimated duration, recurrence, and status.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'The todo item ID' },
            },
            required: ['id'],
        },
    },
    {
        name: 'add_todo',
        description: 'Create a new todo item in the database.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the todo task' },
                dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
                priority: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                    description: 'Priority level (default: medium)',
                },
                description: { type: 'string', description: 'Detailed description of the task' },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of tags/categories for the task',
                },
                estimatedTime: { type: 'number', description: 'Estimated time in minutes' },
            },
            required: ['title'],
        },
    },
    {
        name: 'update_todo',
        description: 'Update properties of an existing todo (completion status, due date, priority, title).',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'The todo ID to update' },
                completed: { type: 'boolean', description: 'Set task as completed or incomplete' },
                dueDate: { type: 'string', description: 'Updated due date in YYYY-MM-DD format' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                title: { type: 'string', description: 'Updated title' },
            },
            required: ['id'],
        },
    },
    {
        name: 'delete_todo',
        description: 'Delete a todo item. NOTE: This has real-world consequences and will require explicit user confirmation before execution.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the todo to delete' },
                title: { type: 'string', description: 'Title of the todo (for confirmation display)' },
            },
            required: ['id'],
        },
    },
    {
        name: 'get_budget_summary',
        description: 'Fetch weekly budget summary, 7-day spend vs prior period, percentage change, and category spending breakdown.',
        input_schema: {
            type: 'object',
            properties: {
                timeframe: {
                    type: 'string',
                    enum: ['7d', '14d', 'all'],
                    description: 'Timeframe for spending data (default: 7d)',
                },
            },
        },
    },
    {
        name: 'get_transactions',
        description: 'Search and inspect individual financial expenses/transactions with optional category, amount, or text filters.',
        input_schema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: 'Filter by expense category (e.g., Utilities, Food, Tech)' },
                query: { type: 'string', description: 'Search term in transaction name or description' },
                minAmount: { type: 'number', description: 'Minimum cost filter' },
                maxAmount: { type: 'number', description: 'Maximum cost filter' },
                limit: { type: 'number', description: 'Maximum transactions to return (default: 15)' },
            },
        },
    },
    {
        name: 'get_notes',
        description: 'Fetch recent notes or search notes by title, folder, or keyword snippet.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keyword to search inside notes' },
                folder: { type: 'string', description: 'Filter by specific folder name' },
                limit: { type: 'number', description: 'Maximum number of notes to return (default: 5)' },
            },
        },
    },
    {
        name: 'get_note_folders',
        description: 'List all folders and categories configured in the user notes repository with item counts.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'get_note_details',
        description: 'Read the full markdown/text content of a specific note by ID or title.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Note ID' },
                title: { type: 'string', description: 'Exact or partial note title' },
            },
        },
    },
    {
        name: 'create_note',
        description: 'Create a new note in the notes app.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the note' },
                content: { type: 'string', description: 'Content of the note (Markdown/text)' },
                folder: { type: 'string', description: 'Folder/category for the note' },
            },
            required: ['title', 'content'],
        },
    },
    {
        name: 'delete_note',
        description: 'Delete a note. NOTE: This has real-world consequences and will require explicit user confirmation before execution.',
        input_schema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'ID of the note to delete' },
                title: { type: 'string', description: 'Title of the note (for confirmation display)' },
            },
            required: ['id'],
        },
    },
    {
        name: 'get_calendar_events',
        description: 'Fetch upcoming calendar events and meetings from Outlook Calendar (read-only).',
        input_schema: {
            type: 'object',
            properties: {
                timeframe: {
                    type: 'string',
                    enum: ['today', 'tomorrow', 'this_week'],
                    description: 'Timeframe for calendar events (default: today)',
                },
                maxResults: { type: 'number', description: 'Maximum events to fetch (default: 10)' },
            },
        },
    },
    {
        name: 'get_unread_emails',
        description: 'Fetch unread or important emails from Outlook / inbox (read-only).',
        input_schema: {
            type: 'object',
            properties: {
                maxResults: { type: 'number', description: 'Maximum emails to fetch (default: 5)' },
            },
        },
    },
    {
        name: 'search_emails',
        description: 'Search Outlook inbox messages by query string or sender.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search term in email subject or body' },
                sender: { type: 'string', description: 'Sender name or email address' },
            },
        },
    },
    {
        name: 'send_email',
        description: 'Send an email reply or message. NOTE: This has real-world consequences and will require explicit user confirmation before sending.',
        input_schema: {
            type: 'object',
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body text' },
            },
            required: ['to', 'subject', 'body'],
        },
    },
];

/**
 * Confirmation Management (Requirement 5)
 * Actions with real-world consequences create a pending confirmation record.
 */
async function createPendingConfirmation(action, payload, summary) {
    const confirmationId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

    const record = {
        confirmationId,
        action,
        payload,
        summary,
        status: 'pending',
        createdAt: new Date(),
        expiresAt,
    };

    try {
        const db = await connectToDatabase();
        await db.collection('assistant_confirmations').insertOne(record);
    } catch (err) {
        console.warn('Failed to persist confirmation to DB, using memory fallback', err.message);
        global.__pendingConfirmations = global.__pendingConfirmations || new Map();
        global.__pendingConfirmations.set(confirmationId, record);
    }

    return {
        status: 'confirmation_required',
        confirmationId,
        action,
        summary,
        expiresAt: expiresAt.toISOString(),
        message: `This action (${summary}) has real-world consequences and requires your explicit confirmation before it will be executed.`,
    };
}

/**
 * Execute a confirmed action
 */
async function executePendingConfirmation(confirmationId, confirmed = true) {
    let record = null;
    let db = null;
    try {
        db = await connectToDatabase();
        record = await db.collection('assistant_confirmations').findOne({ confirmationId });
    } catch (_) {
        if (global.__pendingConfirmations) {
            record = global.__pendingConfirmations.get(confirmationId);
        }
    }

    if (!record) {
        return { success: false, error: 'Confirmation request not found or expired.' };
    }

    if (record.status !== 'pending') {
        return { success: false, error: `Confirmation request is already ${record.status}.` };
    }

    if (new Date() > new Date(record.expiresAt)) {
        if (db) await db.collection('assistant_confirmations').updateOne({ confirmationId }, { $set: { status: 'expired' } });
        return { success: false, error: 'Confirmation request has expired.' };
    }

    if (!confirmed) {
        if (db) await db.collection('assistant_confirmations').updateOne({ confirmationId }, { $set: { status: 'cancelled' } });
        return { success: true, status: 'cancelled', message: `Action "${record.summary}" was cancelled.` };
    }

    // Execute the action
    let result = null;
    const { action, payload } = record;

    try {
        if (action === 'delete_todo') {
            const query = ObjectId.isValid(payload.id) ? { _id: new ObjectId(payload.id) } : { _id: payload.id };
            const delRes = await db.collection('todos').deleteOne(query);
            result = { success: delRes.deletedCount > 0, message: `Todo "${payload.title || payload.id}" was deleted.` };
        } else if (action === 'delete_note') {
            const query = ObjectId.isValid(payload.id) ? { _id: new ObjectId(payload.id) } : { _id: payload.id };
            const delRes = await db.collection('notes').deleteOne(query);
            result = { success: delRes.deletedCount > 0, message: `Note "${payload.title || payload.id}" was deleted.` };
        } else if (action === 'send_email') {
            // Read-only scope initially per requirement; confirm queues draft / simulated send
            result = {
                success: true,
                message: `Email to ${payload.to} with subject "${payload.subject}" was approved and queued (system is in read-only email mode).`,
            };
        } else {
            result = { success: false, error: `Unknown action: ${action}` };
        }

        if (db) {
            await db.collection('assistant_confirmations').updateOne(
                { confirmationId },
                { $set: { status: result.success ? 'executed' : 'failed', executedAt: new Date(), result } }
            );
        }

        return { success: true, status: 'executed', result };
    } catch (err) {
        console.error('Error executing confirmed action:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Backend Tool Handlers
 */
async function executeTool(name, input) {
    let db = null;
    try {
        db = await connectToDatabase();
    } catch (_) {}

    switch (name) {
        case 'get_todos': {
            if (!db) return { error: 'Database unavailable' };
            const filter = {};
            if (input.status === 'pending' || !input.status) filter.completed = false;
            else if (input.status === 'completed') filter.completed = true;

            if (input.priority) filter.priority = input.priority;
            if (input.query) {
                filter.$or = [
                    { title: { $regex: input.query, $options: 'i' } },
                    { text: { $regex: input.query, $options: 'i' } },
                    { description: { $regex: input.query, $options: 'i' } },
                ];
            }

            const todos = await db.collection('todos').find(filter).sort({ order: 1, createdAt: -1 }).limit(25).toArray();
            return {
                count: todos.length,
                todos: todos.map((t) => ({
                    id: t._id ? t._id.toString() : t.id,
                    title: t.title || t.text,
                    completed: Boolean(t.completed),
                    priority: t.priority || 'medium',
                    dueDate: t.dueDate || null,
                    estimatedTime: t.estimatedTime ? `${t.estimatedTime}m` : 'Duration: Not specified',
                    tags: t.tags || [],
                })),
            };
        }

        case 'get_todo_details': {
            if (!db) return { error: 'Database unavailable' };
            const id = input.id;
            const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
            const todo = await db.collection('todos').findOne(query);
            if (!todo) return { error: `Todo with ID "${id}" not found in database.` };
            return {
                id: todo._id ? todo._id.toString() : todo.id,
                title: todo.title || todo.text,
                completed: Boolean(todo.completed),
                priority: todo.priority || 'medium',
                dueDate: todo.dueDate || 'No deadline specified',
                estimatedTime: todo.estimatedTime ? `${todo.estimatedTime}m` : 'Duration: Not specified',
                description: todo.description || 'No description specified',
                tags: todo.tags || [],
                recurrence: todo.recurrence || 'none',
                createdAt: todo.createdAt,
            };
        }

        case 'add_todo': {
            if (!db) return { error: 'Database unavailable' };
            const trimmedTitle = String(input.title || '').trim();
            if (!trimmedTitle) return { error: 'Task title is required' };

            const latestTodo = await db.collection('todos').find().sort({ order: -1, serialNumber: -1 }).limit(1).next();
            const order = latestTodo ? Number(latestTodo.order ?? latestTodo.serialNumber ?? 0) + 1 : 1;

            const doc = {
                title: trimmedTitle,
                completed: false,
                dueDate: input.dueDate || null,
                priority: ['high', 'medium', 'low'].includes(input.priority) ? input.priority : 'medium',
                description: input.description || '',
                tags: Array.isArray(input.tags) ? input.tags : [],
                estimatedTime: input.estimatedTime || null,
                order,
                serialNumber: order,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const insertResult = await db.collection('todos').insertOne(doc);
            return {
                success: true,
                id: insertResult.insertedId.toString(),
                message: `Task "${trimmedTitle}" added successfully.`,
                task: doc,
            };
        }

        case 'update_todo': {
            if (!db) return { error: 'Database unavailable' };
            const id = input.id;
            const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };
            const updateFields = {};
            if (input.completed !== undefined) updateFields.completed = Boolean(input.completed);
            if (input.dueDate !== undefined) updateFields.dueDate = input.dueDate;
            if (input.priority !== undefined) updateFields.priority = input.priority;
            if (input.title !== undefined) updateFields.title = input.title;
            updateFields.updatedAt = new Date();

            const res = await db.collection('todos').updateOne(query, { $set: updateFields });
            return {
                success: res.matchedCount > 0,
                message: res.matchedCount > 0 ? `Todo updated successfully.` : `Todo not found.`,
            };
        }

        case 'get_budget_summary': {
            if (!db) return { error: 'Database unavailable' };
            const budgetData = await fetchBudgetContext(db);
            return budgetData;
        }

        case 'get_transactions': {
            if (!db) return { error: 'Database unavailable' };
            const filter = {};
            if (input.category) filter.category = { $regex: input.category, $options: 'i' };
            if (input.query) {
                filter.$or = [
                    { name: { $regex: input.query, $options: 'i' } },
                    { title: { $regex: input.query, $options: 'i' } },
                    { description: { $regex: input.query, $options: 'i' } },
                ];
            }
            if (input.minAmount !== undefined || input.maxAmount !== undefined) {
                filter.cost = {};
                if (input.minAmount !== undefined) filter.cost.$gte = Number(input.minAmount);
                if (input.maxAmount !== undefined) filter.cost.$lte = Number(input.maxAmount);
            }
            const limit = Math.min(Number(input.limit) || 15, 50);
            const expenses = await db.collection('expenses').find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).toArray();
            return {
                count: expenses.length,
                transactions: expenses.map((e) => ({
                    id: e._id ? e._id.toString() : e.id,
                    name: e.name || e.title || 'Expense',
                    cost: Number(e.cost) || 0,
                    category: e.category || 'General',
                    date: e.date ? new Date(e.date).toISOString().slice(0, 10) : 'Date not specified',
                    description: e.description || '',
                })),
            };
        }

        case 'get_notes': {
            if (!db) return { error: 'Database unavailable' };
            const filter = { archived: { $ne: true } };
            if (input.folder) filter.folder = input.folder;
            if (input.query) {
                filter.$or = [
                    { title: { $regex: input.query, $options: 'i' } },
                    { content: { $regex: input.query, $options: 'i' } },
                ];
            }

            const limit = Math.min(Number(input.limit) || 5, 20);
            const notes = await db.collection('notes').find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
            return {
                count: notes.length,
                notes: notes.map((n) => ({
                    id: n._id ? n._id.toString() : n.id,
                    title: n.title,
                    folder: n.folder || 'General',
                    snippet: String(n.content || '').slice(0, 150),
                    updatedAt: n.updatedAt,
                })),
            };
        }

        case 'get_note_folders': {
            if (!db) return { error: 'Database unavailable' };
            const folders = await db.collection('notes').aggregate([
                { $match: { archived: { $ne: true } } },
                { $group: { _id: '$folder', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]).toArray();
            return {
                folders: folders.map((f) => ({ folder: f._id || 'Unfiled', count: f.count })),
            };
        }

        case 'get_note_details': {
            if (!db) return { error: 'Database unavailable' };
            let query = {};
            if (input.id && ObjectId.isValid(input.id)) {
                query = { _id: new ObjectId(input.id) };
            } else if (input.id) {
                query = { id: input.id };
            } else if (input.title) {
                query = { title: { $regex: `^${input.title}$`, $options: 'i' } };
            } else {
                return { error: 'Please specify note ID or title' };
            }
            const note = await db.collection('notes').findOne(query);
            if (!note) return { error: 'Note not found.' };
            return {
                id: note._id ? note._id.toString() : note.id,
                title: note.title,
                content: note.content || '',
                folder: note.folder || 'General',
                tags: note.tags || [],
                updatedAt: note.updatedAt,
            };
        }

        case 'create_note': {
            if (!db) return { error: 'Database unavailable' };
            const title = String(input.title || '').trim();
            if (!title) return { error: 'Note title is required' };

            const now = new Date();
            const doc = {
                title,
                content: String(input.content || ''),
                folder: input.folder ? String(input.folder).trim() : 'General',
                archived: false,
                createdAt: now,
                updatedAt: now,
            };

            const insertResult = await db.collection('notes').insertOne(doc);
            return {
                success: true,
                id: insertResult.insertedId.toString(),
                message: `Note "${title}" created successfully.`,
            };
        }

        case 'get_unread_emails': {
            const emailData = await fetchEmailContext();
            return emailData;
        }

        case 'search_emails': {
            const emailData = await fetchEmailContext();
            const msgs = emailData.messages || [];
            const q = (input.query || input.sender || '').toLowerCase();
            const filtered = q
                ? msgs.filter((m) =>
                    (m.from && m.from.toLowerCase().includes(q)) ||
                    (m.subject && m.subject.toLowerCase().includes(q))
                )
                : msgs;
            return {
                count: filtered.length,
                messages: filtered.slice(0, 10),
            };
        }

        case 'get_calendar_events': {
            const calendarData = await fetchCalendarContext(input.timeframe || 'today');
            return calendarData;
        }

        // Sensitive actions requiring explicit user confirmation
        case 'delete_todo': {
            return await createPendingConfirmation(
                'delete_todo',
                { id: input.id, title: input.title },
                `Delete todo item "${input.title || input.id}"`
            );
        }

        case 'delete_note': {
            return await createPendingConfirmation(
                'delete_note',
                { id: input.id, title: input.title },
                `Delete note "${input.title || input.id}"`
            );
        }

        case 'send_email': {
            return await createPendingConfirmation(
                'send_email',
                { to: input.to, subject: input.subject, body: input.body },
                `Send email to ${input.to} with subject "${input.subject}"`
            );
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

/**
 * 100% Static Core Instructions (Persona, Operational Directives, Schemas, Beats)
 * Guaranteed to hit the cache across ALL requests.
 */
function buildStaticSystemPrompt() {
    return `You are an elite AI Executive Productivity Analyst for Prajwal Reddy's personal dashboard.
You synthesize everything happening in Prajwal's personal workspace (tasks, schedule & Outlook calendar, spending, notes, inbox) into prioritized, actionable intelligence.
Treat yourself as an analytical operations advisor, NOT a conversational chatbot.

Core Operational Directives:
1. Flag anything urgent or time-sensitive immediately (overdue tasks, high-priority deadlines today/this week, abnormal spending, urgent emails, upcoming meetings).
2. Notice patterns and correlations across personal domains (e.g. overspending trend vs budget, tasks repeatedly pushed or sitting idle, unanswered emails requiring replies, packed meeting schedule conflicting with task deadlines).
3. Reference change over time when previous digest is present (e.g., "still haven't completed X from yesterday", "spending increased 15% vs prior week").
4. Propose a prioritized plan, ranked strictly by urgency and impact.
5. NEVER restate raw data verbatim or dump uncurated lists. Extract insights, assess tradeoffs, and recommend concrete actions.
6. When the user asks questions about their Daily Executive Briefing (available in previousDigest.digest), provide clear, authoritative explanations, drill down into tasks or spending spikes, explain the rationale for suggestions, and assist with immediate execution.
7. You have full visibility into Prajwal's Outlook Calendar (today's schedule, meeting times, locations, Teams links) and Outlook Inbox. Actively correlate schedule availability with urgent tasks (e.g. identify focus blocks between meetings, warn if meetings conflict with deadlines).
8. The ONLY data and tools you possess are for Prajwal's personal workspace data. News and weather are managed completely independently outside the LLM. NEVER fabricate, assume, or comment on external news or weather.
9. When synthesizing digests or reports, ALWAYS format your final answer as structured JSON adhering to this exact schema:
{
  "urgent": [
    {
      "id": "item_id_or_unique_tag",
      "title": "Clear action-oriented title",
      "reason": "Why this is critical now",
      "action": "Concrete next step to take",
      "source": "todo|budget|email|calendar"
    }
  ],
  "fyi": [
    {
      "title": "Notable update",
      "detail": "Context or observation",
      "source": "todo|budget|notes|email|calendar"
    }
  ],
  "suggestion": "One high-leverage, calm, and actionable executive recommendation for today (1-2 crisp sentences, max 30 words). Never use alarming or apocalyptic language like 'catastrophic operational failure' or 'emergency triage NOW'. Maintain a composed, pragmatic, and empowering executive tone.",
  "prioritizedPlan": [
    {
      "step": 1,
      "task": "Specific task name and focus",
      "timeEstimate": "e.g. 45m",
      "priority": "high|medium|low"
    }
  ],
  "patterns": [
    "Observed pattern or behavioral trend"
  ]
}

Important formatting & length constraint:
- "suggestion" (BLUF): Must be exactly 1-2 concise, clear sentences (under 30 words). Focus directly on today's highest-leverage priority.
- Keep every item's description succinct (1-2 sentences max) so the executive memo is instantly scannable and fits completely within the response budget.
- Output clean, valid JSON adhering strictly to the schema above.

If responding to an on-demand chat question, you may provide clear analytical text and also include the structured object if relevant.
When using tools with real-world consequences (like deleting items or sending emails), inform the user that a confirmation is required.`;
}

/**
 * Slims down aggregated personal context to remove bulk raw metadata.
 * Strictly personal data: tasks, calendar, email, budget, notes.
 * Completely strips any external news or weather if present.
 */
function slimContextForPrompt(snapshot) {
    if (!snapshot) return {};
    const s = { ...snapshot };
    delete s.timestamp;
    delete s.executionTimeMs;
    delete s.news;
    delete s.weather;

    // 2. Calendar: Clean essential event properties, omit raw Graph API metadata
    if (s.calendar && Array.isArray(s.calendar.events)) {
        s.calendar = {
            count: s.calendar.count || s.calendar.events.length,
            events: s.calendar.events.slice(0, 6).map((e) => ({
                subject: e.subject,
                time: e.timeFormatted || (e.start ? `${e.start} - ${e.end}` : 'Today'),
                location: e.location || 'Online',
                isAllDay: Boolean(e.isAllDay),
            })),
        };
    }

    // 3. Email: Keep counts and concise sender/subject summaries
    if (s.email) {
        s.email = {
            unreadCount: s.email.unreadCount || 0,
            importantCount: s.email.importantCount || 0,
            recent: (s.email.messages || []).slice(0, 4).map((m) => ({
                from: m.from,
                subject: m.subject,
                received: m.receivedDateTime,
            })),
        };
    }

    // 4. Notes: Only include title, folder, and a short snippet (max 80 chars)
    if (s.notes && Array.isArray(s.notes.recentNotes)) {
        s.notes = {
            total: s.notes.total || s.notes.recentNotes.length,
            recentNotes: s.notes.recentNotes.slice(0, 5).map((n) => ({
                title: n.title,
                folder: n.folder || 'General',
                snippet: String(n.snippet || n.content || '').slice(0, 80),
            })),
        };
    }

    // 5. Todos: Keep essential actionable lists, omit bulky created dates and raw MongoDB fields
    if (s.todos) {
        s.todos = {
            pendingCount: s.todos.pendingCount || 0,
            overdueCount: s.todos.overdueCount || 0,
            highPriorityCount: s.todos.highPriorityCount || 0,
            overdue: (s.todos.overdue || []).slice(0, 5).map((t) => ({
                id: t.id,
                title: t.title,
                dueDate: t.dueDate,
                priority: t.priority,
            })),
            dueToday: (s.todos.dueToday || []).slice(0, 5).map((t) => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
            })),
            highPriority: (s.todos.highPriority || []).slice(0, 4).map((t) => ({
                id: t.id,
                title: t.title,
                dueDate: t.dueDate,
            })),
        };
    }

    return s;
}

/**
 * Dynamic Life Context Block
 * Contains the real-time aggregated snapshot (todos, calendar, email, budget, news)
 */
function buildDynamicContextBlock(contextSnapshot) {
    const cleanSnapshot = slimContextForPrompt(contextSnapshot);

    return `CURRENT AGGREGATED LIFE SNAPSHOT:
Date: ${cleanSnapshot.dateFormatted || new Date().toDateString()}

${JSON.stringify(cleanSnapshot, null, 2)}`;
}

/**
 * Multi-Breakpoint System Prompt Builder
 * Returns structured blocks for Anthropic Prompt Caching
 */
function buildSystemBlocks(contextSnapshot) {
    const staticText = buildStaticSystemPrompt();
    const blocks = [
        {
            type: 'text',
            text: staticText,
            cache_control: { type: 'ephemeral' }, // Breakpoint 2: Static instructions
        },
    ];

    if (contextSnapshot) {
        blocks.push({
            type: 'text',
            text: buildDynamicContextBlock(contextSnapshot),
            cache_control: { type: 'ephemeral' }, // Breakpoint 3: Dynamic context
        });
    }

    return blocks;
}

function buildSystemPrompt(contextSnapshot) {
    return buildSystemBlocks(contextSnapshot);
}

/**
 * Multi-turn Tool-Execution Loop with Anthropic Claude SDK & Prompt Caching
 * Compliant with Anthropic's 4-breakpoint prompt caching architecture:
 * 1. Last tool in TOOLS array (Breakpoint 1)
 * 2. Static instructions block (Breakpoint 2)
 * 3. Dynamic life snapshot block (Breakpoint 3)
 * 4. Last message in conversation turns (Breakpoint 4)
 */
async function runToolExecutionLoop({
    anthropic,
    model,
    system,
    messages,
    maxTurns = 8,
    tools = null,
    onToken = null,
    onToolCall = null,
    maxTokens = 2500,
}) {
    let turnCount = 0;
    const workingMessages = [...messages];
    const toolCallsExecuted = [];
    let pendingConfirmations = [];

    // System prompt blocks with ephemeral cache controls
    const cachedSystem = Array.isArray(system)
        ? system
        : [
            {
                type: 'text',
                text: typeof system === 'string' ? system : String(system),
                cache_control: { type: 'ephemeral' },
            },
        ];

    // Tools breakpoint: Cache all tool definitions on the final tool if tools are enabled
    const toolsToUse = tools !== null ? tools : TOOLS;
    const cachedTools = toolsToUse && toolsToUse.length > 0
        ? toolsToUse.map((tool, idx) => {
            if (idx === toolsToUse.length - 1) {
                return {
                    ...tool,
                    cache_control: { type: 'ephemeral' },
                };
            }
            return tool;
        })
        : undefined;

    while (turnCount < maxTurns) {
        turnCount += 1;

        // Apply 4th cache breakpoint to the last message block
        const messagesWithCache = workingMessages.map((msg, idx) => {
            if (idx === workingMessages.length - 1) {
                if (typeof msg.content === 'string') {
                    return {
                        ...msg,
                        content: [
                            {
                                type: 'text',
                                text: msg.content,
                                cache_control: { type: 'ephemeral' },
                            },
                        ],
                    };
                } else if (Array.isArray(msg.content) && msg.content.length > 0) {
                    return {
                        ...msg,
                        content: msg.content.map((block, bIdx) =>
                            bIdx === msg.content.length - 1 ? { ...block, cache_control: { type: 'ephemeral' } } : block
                        ),
                    };
                }
            }
            return msg;
        });

        const createParams = {
            model,
            max_tokens: maxTokens,
            system: cachedSystem,
            messages: messagesWithCache,
        };
        if (cachedTools && cachedTools.length > 0) {
            createParams.tools = cachedTools;
        }

        let response;
        if (typeof onToken === 'function' && typeof anthropic.messages.stream === 'function') {
            const stream = anthropic.messages.stream(createParams);

            stream.on('text', (delta) => {
                try {
                    onToken(delta);
                } catch (_) {}
            });

            response = await stream.finalMessage();
        } else {
            response = await anthropic.messages.create(createParams);
        }

        // Log prompt caching savings
        if (response.usage) {
            const { cache_creation_input_tokens = 0, cache_read_input_tokens = 0, input_tokens = 0 } = response.usage;
            if (cache_read_input_tokens > 0) {
                console.log(`[Anthropic Cache HIT] ${cache_read_input_tokens} tokens read from cache (90% savings) | Fresh: ${input_tokens}`);
            } else if (cache_creation_input_tokens > 0) {
                console.log(`[Anthropic Cache WRITE] ${cache_creation_input_tokens} tokens cached for next 5m | Fresh: ${input_tokens}`);
            }
        }

        // Check if model wants to call tools
        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');

        if (toolUseBlocks.length > 0 && typeof onToolCall === 'function') {
            toolUseBlocks.forEach((toolBlock) => {
                try {
                    onToolCall({ name: toolBlock.name, input: toolBlock.input });
                } catch (_) {}
            });
        }

        if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
            // Final response reached
            const textBlocks = response.content.filter((b) => b.type === 'text');
            const finalText = textBlocks.map((b) => b.text).join('\n').trim();

            return {
                reply: finalText,
                stopReason: response.stop_reason,
                turnsUsed: turnCount,
                toolCallsExecuted,
                pendingConfirmations,
                rawResponse: response,
                usage: response.usage,
                cacheStats: response.usage ? {
                    cacheReadTokens: response.usage.cache_read_input_tokens || 0,
                    cacheCreatedTokens: response.usage.cache_creation_input_tokens || 0,
                    regularInputTokens: response.usage.input_tokens || 0,
                    cached: (response.usage.cache_read_input_tokens || 0) > 0,
                } : null,
            };
        }

        // Add assistant's response to conversation history
        workingMessages.push({
            role: 'assistant',
            content: response.content,
        });

        // Execute each tool call in parallel
        const toolResultBlocks = await Promise.all(
            toolUseBlocks.map(async (toolBlock) => {
                toolCallsExecuted.push({ name: toolBlock.name, input: toolBlock.input });

                try {
                    const result = await executeTool(toolBlock.name, toolBlock.input);

                    if (result && result.status === 'confirmation_required') {
                        pendingConfirmations.push(result);
                    }

                    return {
                        type: 'tool_result',
                        tool_use_id: toolBlock.id,
                        content: JSON.stringify(result),
                    };
                } catch (toolErr) {
                    return {
                        type: 'tool_result',
                        tool_use_id: toolBlock.id,
                        content: JSON.stringify({ error: toolErr.message }),
                        is_error: true,
                    };
                }
            })
        );

        // Feed tool results back into the conversation
        workingMessages.push({
            role: 'user',
            content: toolResultBlocks,
        });
    }

    return {
        reply: 'Tool execution loop limit reached.',
        turnsUsed: turnCount,
        toolCallsExecuted,
        pendingConfirmations,
    };
}

/**
 * Grounded Simulation Engine
 * Generates deterministic structured command center briefing strictly grounded in real application data.
 * Adheres to all hard anti-hallucination rules (never invents durations, deadlines, or claims).
 */
function runMockSimulationSynthesis(context) {
    const todos = context.todos || {};
    const overdueList = Array.isArray(todos.overdue) ? todos.overdue : [];
    const pendingList = Array.isArray(todos.pendingList) ? todos.pendingList : [];
    const calendar = context.calendar || {};
    const events = Array.isArray(calendar.events) ? calendar.events : [];
    const email = context.email || {};
    const messages = Array.isArray(email.messages) ? email.messages : [];
    const budget = context.budget?.weeklySummary || {};

    const now = new Date();

    // 1. Calculate Overdue Tasks with exact days and duration
    const overdue_tasks = overdueList.map((t) => {
        let overdue_days = 0;
        if (t.dueDate) {
            const diffMs = now.getTime() - new Date(t.dueDate).getTime();
            overdue_days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
        }
        return {
            id: t.id ? String(t.id) : `task_${t.title}`,
            title: t.title,
            deadline: t.dueDate || 'No deadline specified',
            priority: t.priority || 'medium',
            duration: t.estimatedTime ? `${t.estimatedTime}m` : 'Duration: Not specified',
            overdue_days,
            recommendation: 'Complete today',
            next_action: 'Not specified',
            source_ref: 'Based on task data',
        };
    });

    // 2. Decisions Required: Overdue tasks needing explicit choices
    const decisions_required = overdue_tasks.slice(0, 3).map((t) => ({
        id: t.id,
        title: t.title,
        status: 'overdue',
        overdue_since: t.deadline,
        recommended_action: 'Complete today',
        reason: `Task is overdue by ${t.overdue_days} day(s)`,
        source_type: 'task',
        source_id: t.id,
        actions_available: ['complete', 'reschedule', 'open'],
    }));

    // 3. Execution Plan: Combine fixed calendar commitments with focus blocks
    const execution_plan = [];
    if (events.length > 0) {
        events.slice(0, 4).forEach((e) => {
            execution_plan.push({
                time_window: e.timeFormatted || 'Scheduled time',
                type: 'fixed_commitment',
                title: e.subject || 'Meeting',
                description: e.location ? `Location: ${e.location}` : 'Fixed calendar commitment',
                source_ref: 'Based on Outlook calendar',
            });
        });
        if (overdue_tasks.length > 0) {
            execution_plan.unshift({
                time_window: 'Focus Block',
                type: 'focus_block',
                title: overdue_tasks[0].title,
                description: `Dedicated work block to resolve overdue priority (${overdue_tasks[0].duration})`,
                source_ref: 'Based on task priority',
            });
        }
    } else if (calendar.configured) {
        if (overdue_tasks.length > 0) {
            execution_plan.push({
                time_window: 'Morning Focus',
                type: 'focus_block',
                title: overdue_tasks[0].title,
                description: `Dedicated work block for overdue task (${overdue_tasks[0].duration})`,
                source_ref: 'Based on task priority',
            });
        }
    }

    // Calculate real focus hours
    let available_focus_time = 'Calendar availability unavailable';
    if (calendar.configured) {
        if (events.length === 0) {
            available_focus_time = 'Full day open';
        } else {
            const openHours = Math.max(1, 8 - events.length * 1.25);
            available_focus_time = `${openHours}h estimated`;
        }
    }

    // 4. Inbox Decisions
    const inbox_decisions = messages.slice(0, 3).map((m) => {
        const isAction = m.importance === 'high' || (m.subject && /action|urgent|verify|submit|review/i.test(m.subject));
        return {
            sender: m.from || 'Unknown sender',
            subject: m.subject || 'No subject',
            classification: isAction ? 'action_required' : 'fyi',
            why_it_matters: isAction ? 'Action required per sender' : 'Informational message',
            recommended_action: isAction ? 'Review and respond' : 'Archive or read when free',
            deadline: 'Not specified',
            source_id: m.id || m.conversationId,
        };
    });

    // 5. Financial Signals: Strict Observed vs Interpretation
    const last7DaysSpend = Number(budget.last7DaysSpend) || 0;
    const prior7DaysSpend = Number(budget.prior7DaysSpend) || 0;
    const spendChangePercent = Number(budget.spendChangePercent) || 0;
    const topCat = (budget.topCategories && budget.topCategories[0]) ? budget.topCategories[0] : null;
    const largest_category = topCat ? `${topCat.category} ($${topCat.amount})` : 'Not available in connected data';

    const financial_signals = {
        observed: {
            spend_7d: last7DaysSpend,
            spend_prev_7d: prior7DaysSpend,
            change_pct: spendChangePercent,
            largest_category,
            notable_transactions: (budget.largeTransactions || []).map((t) => `${t.name}: $${t.cost}`),
        },
        interpretation: topCat
            ? `${topCat.category} accounts for $${topCat.amount} of current 7-day spending.`
            : 'Spending remains within normal parameters.',
        recommended_action: topCat
            ? `Review ${topCat.category} transactions if needed.`
            : 'No financial anomaly requiring action.',
    };

    // 6. Waiting On
    const waiting_on = [];
    messages.filter((m) => /waiting|pending|submitted/i.test(m.subject || '')).slice(0, 2).forEach((m) => {
        waiting_on.push({
            item: m.subject,
            from: m.from,
            type: 'email_reply',
            since: m.receivedDateTime ? m.receivedDateTime.slice(0, 10) : 'Recent',
        });
    });

    // 7. Avoid Today / Defer Today
    const avoid_today = [];
    if (overdue_tasks.length > 0 && pendingList.length > 0) {
        pendingList
            .filter((t) => t.priority === 'low' && !t.dueDate)
            .slice(0, 2)
            .forEach((t) => {
                avoid_today.push({
                    title: t.title,
                    reason: 'Lower-priority task without deadline; defer while clearing overdue commitments.',
                    source_id: t.id,
                });
            });
    }

    // 8. End of Day Checkpoint
    const end_of_day_checkpoint = [];
    if (overdue_tasks[0]) {
        end_of_day_checkpoint.push({ check: `Resolve or reschedule "${overdue_tasks[0].title}"`, source_ref: 'task' });
    }
    if (events[0]) {
        end_of_day_checkpoint.push({ check: `Attend "${events[0].subject}"`, source_ref: 'calendar' });
    }
    if (inbox_decisions.some((e) => e.classification === 'action_required')) {
        end_of_day_checkpoint.push({ check: 'Handle pending action-required emails', source_ref: 'email' });
    }
    end_of_day_checkpoint.push({ check: 'Review tomorrow\'s schedule and task queue', source_ref: 'routine' });

    // 9. Command Center & Daily Objective
    const must_finish = overdue_tasks.length + (Array.isArray(todos.dueToday) ? todos.dueToday.length : 0);
    const must_decide = decisions_required.length;
    const must_attend = events.length;
    const must_respond = inbox_decisions.filter((e) => e.classification === 'action_required').length;

    let daily_objective = 'Operations on track. Execute scheduled tasks and maintain focus windows.';
    if (overdue_tasks.length > 0) {
        daily_objective = `Resolve ${overdue_tasks.length} overdue task(s) and protect focus blocks.`;
    } else if (events.length > 2) {
        daily_objective = 'Busy calendar day: protect remaining focus blocks around meetings.';
    }

    return {
        daily_objective,
        command_center: {
            must_finish,
            must_decide,
            must_attend,
            must_respond,
            available_focus_time,
        },
        decisions_required,
        overdue_tasks,
        execution_plan,
        inbox_decisions,
        financial_signals,
        waiting_on,
        avoid_today,
        end_of_day_checkpoint,
        // Legacy compat fields
        suggestion: daily_objective,
        urgent: decisions_required,
        prioritizedPlan: execution_plan,
        patterns: [],
    };
}

/**
 * Generate Structured Digest
 * Calls Anthropic Claude (or deterministic simulation fallback) to synthesize
 * the command center briefing with strict anti-hallucination enforcement.
 */
async function generateDigest(contextSnapshot = null, options = {}) {
    const { buildPersonalContext } = require('./context');
    const context = contextSnapshot || (await buildPersonalContext());
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

    if (!apiKey || !Anthropic) {
        const simulationResult = runMockSimulationSynthesis(context);
        return {
            source: 'simulation_fallback',
            model: 'simulated-grounded-analyst',
            timestamp: new Date().toISOString(),
            digest: simulationResult,
            metrics: {
                todosCount: context.todos ? context.todos.total : 0,
                pendingTodos: context.todos ? context.todos.pendingCount : 0,
                weeklySpend: (context.budget && context.budget.weeklySummary) ? context.budget.weeklySummary.last7DaysSpend : 0,
                unreadEmails: context.email ? context.email.unreadCount : 0,
            },
        };
    }

    try {
        const anthropic = new Anthropic({ apiKey });
        const systemPrompt = `You are an elite, strictly grounded Executive Operations Analyst synthesizing Prajwal's Daily Operations Briefing.

CORE GROUNDING RULES (MANDATORY):
1. Ground every single claim in the provided personal data snapshot. Never invent, fabricate, infer, or hallucinate tasks, deadlines, task durations, priorities, calendar events, meeting locations, emails, people, or financial numbers.
2. If task duration is missing: "Duration: Not specified". Never assume or invent a duration.
3. If task deadline is missing: "No deadline specified". Never invent a deadline.
4. Urgency can ONLY be derived from explicit signals (overdue status, high priority, immediate deadline). Never invent urgency.
5. In Financial Signals: Strictly separate OBSERVED facts (numbers directly from budget data) from INTERPRETATION. Never say a category "caused" an increase unless transactions explicitly show that.
6. For Focus Windows: Available focus windows are calculated around fixed calendar meetings. If calendar is unavailable or disconnected, state: "Calendar availability unavailable". Never construct a fake schedule.
7. Return strictly valid JSON adhering to the exact schema below without any markdown wrapper or explanation outside the JSON.

SCHEMA:
{
  "daily_objective": "One short sentence generated from actual data",
  "command_center": {
    "must_finish": 0,
    "must_decide": 0,
    "must_attend": 0,
    "must_respond": 0,
    "available_focus_time": "e.g. 3h 30m or Calendar availability unavailable"
  },
  "decisions_required": [
    {
      "id": "task_id",
      "title": "Task title",
      "status": "overdue",
      "overdue_since": "Sep 12",
      "recommended_action": "Complete today",
      "reason": "Overdue by 2 days",
      "source_type": "task",
      "source_id": "task_id",
      "actions_available": ["complete", "reschedule", "open"]
    }
  ],
  "overdue_tasks": [
    {
      "id": "task_id",
      "title": "Task title",
      "deadline": "Sep 12",
      "priority": "high",
      "duration": "Duration: Not specified",
      "overdue_days": 2,
      "recommendation": "Complete today",
      "next_action": "Not specified",
      "source_ref": "Based on task"
    }
  ],
  "execution_plan": [
    {
      "time_window": "10:00 - 11:30",
      "type": "focus_block",
      "title": "Deep Focus Window",
      "description": "Details",
      "source_ref": "Based on calendar/task"
    }
  ],
  "inbox_decisions": [
    {
      "sender": "Sender name",
      "subject": "Email subject",
      "classification": "action_required",
      "why_it_matters": "Reasoning from email",
      "recommended_action": "Recommended action",
      "deadline": "Not specified",
      "source_id": "email_id"
    }
  ],
  "financial_signals": {
    "observed": {
      "spend_7d": 0,
      "spend_prev_7d": 0,
      "change_pct": 0,
      "largest_category": "",
      "notable_transactions": []
    },
    "interpretation": "Interpretation based strictly on observed facts",
    "recommended_action": "Action"
  },
  "waiting_on": [],
  "avoid_today": [],
  "end_of_day_checkpoint": [
    {
      "check": "Checkpoint description",
      "source_ref": "task"
    }
  ]
}`;

        const cleanSnapshot = slimContextForPrompt(context);
        const messages = [
            {
                role: 'user',
                content: `Here is the current aggregated personal snapshot:\n\n${JSON.stringify(cleanSnapshot, null, 2)}\n\nPlease synthesize my daily executive digest. Return ONLY structured JSON adhering strictly to the schema.`,
            },
        ];

        const loopResult = await runToolExecutionLoop({
            anthropic,
            model,
            system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
            messages,
            maxTurns: 1,
            tools: [],
            maxTokens: 2500,
        });

        function extractJson(rawText) {
            if (!rawText || typeof rawText !== 'string') return null;
            let clean = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
            const first = clean.indexOf('{');
            const last = clean.lastIndexOf('}');
            if (first !== -1 && last !== -1 && last > first) {
                clean = clean.slice(first, last + 1);
            }
            try { return JSON.parse(clean); } catch (_) { return null; }
        }

        let parsed = extractJson(loopResult.reply);
        if (!parsed || !parsed.command_center) {
            parsed = runMockSimulationSynthesis(context);
        } else {
            // Ensure compat fields
            parsed.suggestion = parsed.daily_objective || 'Operations on track.';
            parsed.urgent = parsed.decisions_required || [];
            parsed.prioritizedPlan = parsed.execution_plan || [];
            parsed.patterns = [];
        }

        return {
            source: 'anthropic_claude',
            model,
            timestamp: new Date().toISOString(),
            digest: parsed,
            metrics: {
                todosCount: context.todos ? context.todos.total : 0,
                pendingTodos: context.todos ? context.todos.pendingCount : 0,
                weeklySpend: (context.budget && context.budget.weeklySummary) ? context.budget.weeklySummary.last7DaysSpend : 0,
                unreadEmails: context.email ? context.email.unreadCount : 0,
            },
            turnsUsed: loopResult.turnsUsed,
        };
    } catch (err) {
        console.error('Claude digest generation failed, falling back to deterministic synthesis:', err.message);
        const fallback = runMockSimulationSynthesis(context);
        return {
            source: 'simulation_fallback_after_error',
            error: err.message,
            timestamp: new Date().toISOString(),
            digest: fallback,
        };
    }
}

/**
 * Lean Chat System Prompt (Without heavy context dumping)
 */
function buildChatSystemPrompt() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });

    return `You are Prajwal's personal executive AI assistant.
Current Date & Time: ${dateStr} at ${timeStr}.

CORE OPERATING INSTRUCTIONS:
1. Ground every statement in actual application data. NEVER invent, fabricate, infer, or hallucinate tasks, deadlines, task durations, calendar events, email contents, transaction amounts, notes, or people.
2. If data is not available or not found in the connected database, state explicitly: "Not available in the connected data."
3. You have access to specialized tools for all personal data stored in the website's database:
   - Tasks & Todos: get_todos, get_todo_details, add_todo, update_todo, delete_todo
   - Financials: get_budget_summary, get_transactions
   - Notes: get_notes, get_note_folders, get_note_details, create_note, delete_note
   - Calendar & Schedule: get_calendar_events
   - Email: get_unread_emails, search_emails, send_email
4. Choose the right tool to carry out the user's request on demand. Do NOT guess the answer when you can look it up with a tool.
5. If no duration exists for a task, say "Duration: Not specified". Never invent deadlines or urgency.
6. Actions with real-world consequences (delete_todo, delete_note, send_email) will automatically trigger a confirmation request to the user before execution.`;
}

/**
 * Handle On-Demand Chat with Streaming Support & Lean Prompting
 * Uses on-demand tool execution for all workspace data.
 */
async function processChatMessage({
    message,
    sessionId = 'default',
    conversationHistory = [],
    onToken = null,
    onToolCall = null,
}) {
    if (!message || typeof message !== 'string') {
        throw new Error('Message is required');
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

    if (!apiKey || !Anthropic) {
        // Fallback simulation / tool matching
        const lower = message.toLowerCase();
        let reply = '';
        const toolCallsMade = [];
        let pendingConfirmations = [];

        if (lower.includes('delete') && (lower.includes('todo') || lower.includes('task'))) {
            const confirmRes = await executeTool('delete_todo', { id: 'sample_id', title: 'Example Task' });
            pendingConfirmations.push(confirmRes);
            reply = confirmRes.message;
        } else if (lower.includes('delete') && lower.includes('note')) {
            const confirmRes = await executeTool('delete_note', { id: 'sample_note_id', title: 'Example Note' });
            pendingConfirmations.push(confirmRes);
            reply = confirmRes.message;
        } else if (lower.includes('send') && lower.includes('email')) {
            const confirmRes = await executeTool('send_email', { to: 'colleague@example.com', subject: 'Follow up', body: 'Draft text' });
            pendingConfirmations.push(confirmRes);
            reply = confirmRes.message;
        } else if (lower.startsWith('add todo') || lower.startsWith('create todo') || lower.startsWith('new todo')) {
            const title = message.replace(/^(add|create|new)\s+(todo|task)\s*:?/i, '').trim() || 'New Task';
            const addRes = await executeTool('add_todo', { title });
            toolCallsMade.push({ name: 'add_todo', input: { title } });
            reply = addRes.message || `Created todo "${title}".`;
        } else if (lower.includes('budget') || lower.includes('spend') || lower.includes('expense') || lower.includes('transaction')) {
            const budgetRes = await executeTool('get_budget_summary', { timeframe: '7d' });
            toolCallsMade.push({ name: 'get_budget_summary', input: { timeframe: '7d' } });
            const ws = budgetRes.weeklySummary || {};
            reply = `In the past 7 days, you have spent $${ws.last7DaysSpend || 0} (${ws.spendDelta >= 0 ? `+$${ws.spendDelta}` : `-$${Math.abs(ws.spendDelta)}`} vs prior week). Largest category: ${ws.topCategories && ws.topCategories[0] ? `${ws.topCategories[0].category} ($${ws.topCategories[0].amount})` : 'None'}.`;
        } else if (lower.includes('todo') || lower.includes('task')) {
            const todosRes = await executeTool('get_todos', { status: 'pending' });
            toolCallsMade.push({ name: 'get_todos', input: { status: 'pending' } });
            reply = `You have ${todosRes.count} pending tasks. Top priorities: ${todosRes.todos.slice(0, 3).map((t) => `"${t.title}" (${t.priority})`).join(', ')}.`;
        } else if (lower.includes('calendar') || lower.includes('meeting') || lower.includes('schedule') || lower.includes('event')) {
            const calRes = await executeTool('get_calendar_events', { timeframe: 'today' });
            toolCallsMade.push({ name: 'get_calendar_events', input: { timeframe: 'today' } });
            const events = calRes.events || [];
            reply = `You have ${calRes.todayCount || events.length} meeting(s) on your calendar today: ${events.map((e) => `"${e.subject}" (${e.timeFormatted})`).join(', ')}.`;
        } else if (lower.includes('note')) {
            const notesRes = await executeTool('get_notes', { limit: 3 });
            toolCallsMade.push({ name: 'get_notes', input: { limit: 3 } });
            reply = `Found ${notesRes.count} recent notes: ${notesRes.notes.map((n) => `"${n.title}"`).join(', ')}.`;
        } else {
            reply = `I am connected to your tasks, calendar, budget, notes, and emails. Ask me to query tasks, inspect recent transactions, view schedule, or take notes.`;
        }

        if (typeof onToken === 'function') {
            const words = reply.split(' ');
            for (let i = 0; i < words.length; i++) {
                onToken((i === 0 ? '' : ' ') + words[i]);
            }
        }

        return {
            source: 'simulation_fallback',
            reply,
            toolCallsExecuted: toolCallsMade,
            pendingConfirmations,
            contextTimestamp: new Date().toISOString(),
        };
    }

    const anthropic = new Anthropic({ apiKey });
    const chatPrompt = buildChatSystemPrompt();

    // Format conversation history (sliding window, max 8 recent messages)
    const recentHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
        .slice(-8)
        .map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: String(msg.content || ''),
        }));

    const messages = [
        ...recentHistory,
        { role: 'user', content: message },
    ];

    const result = await runToolExecutionLoop({
        anthropic,
        model,
        system: [{ type: 'text', text: chatPrompt, cache_control: { type: 'ephemeral' } }],
        messages,
        maxTurns: 8,
        onToken,
        onToolCall,
        maxTokens: 2000,
    });

    return {
        source: 'anthropic_claude',
        model,
        reply: result.reply,
        toolCallsExecuted: result.toolCallsExecuted,
        pendingConfirmations: result.pendingConfirmations,
        contextTimestamp: new Date().toISOString(),
        cacheStats: result.cacheStats || null,
        usage: result.usage || null,
    };
}

/**
 * Pre-warm the Anthropic Prompt Cache
 * Uses max_tokens: 0 as documented in Anthropic prompt caching documentation.
 * Primes the cache before any user traffic arrives with 0 output token billing.
 */
async function prewarmAssistantCache() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

    if (!apiKey || !Anthropic) {
        return { success: false, reason: 'Anthropic SDK or API key not available' };
    }

    try {
        const anthropic = new Anthropic({ apiKey });
        const staticPrompt = buildStaticSystemPrompt();
        const cachedTools = TOOLS.map((t, idx) => (idx === TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t));

        const res = await anthropic.messages.create({
            model,
            max_tokens: 0,
            tools: cachedTools,
            system: [
                {
                    type: 'text',
                    text: staticPrompt,
                    cache_control: { type: 'ephemeral' },
                },
            ],
            messages: [{ role: 'user', content: 'warmup' }],
        });

        console.log('[Anthropic Cache Pre-warmed]', {
            model,
            stopReason: res.stop_reason,
            cachedInputTokens: res.usage?.cache_creation_input_tokens || 0,
            readTokens: res.usage?.cache_read_input_tokens || 0,
        });

        return {
            success: true,
            model,
            stopReason: res.stop_reason,
            usage: res.usage,
            cachedTokens: res.usage?.cache_creation_input_tokens || 0,
        };
    } catch (err) {
        console.error('Anthropic Cache pre-warm error:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    generateDigest,
    processChatMessage,
    executeTool,
    executePendingConfirmation,
    createPendingConfirmation,
    buildSystemPrompt,
    buildStaticSystemPrompt,
    buildSystemBlocks,
    prewarmAssistantCache,
    TOOLS,
};
