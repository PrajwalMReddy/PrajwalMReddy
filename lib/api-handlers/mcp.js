const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../db');
const { isAuthenticated } = require('../auth');
const { resequenceExpenses, resequenceIncome } = require('../budgetResequence');

const { getDiscoveryMetadata, getProtectedResourceMetadata } = require('./oauth');

// -------------------------------------------------------------
// Authentication Helper (Static Key, Admin Password, JWT, or OAuth Token)
// -------------------------------------------------------------
async function verifyMcpAuth(req, db) {
    const authHeader = req.headers['authorization'] || '';
    const apiKeyHeader = req.headers['x-api-key'] || '';
    const queryKey = req.query?.key || req.query?.apiKey || '';

    let token = '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else if (authHeader) {
        token = authHeader.trim();
    } else if (apiKeyHeader) {
        token = String(apiKeyHeader).trim();
    } else if (queryKey) {
        token = String(queryKey).trim();
    }

    const validKeys = [
        process.env.MCP_SECRET_KEY,
        process.env.MCP_API_KEY,
        process.env.ADMIN_PASSWORD,
    ].filter(Boolean);

    // 1. Direct match with configured secret key or admin password
    if (token && validKeys.includes(token)) {
        return true;
    }

    // 2. Dynamic OAuth token lookup in MongoDB
    if (token && db) {
        try {
            const tokenDoc = await db.collection('oauth_tokens').findOne({ access_token: token });
            if (tokenDoc) {
                if (!tokenDoc.expiresAt || new Date() < new Date(tokenDoc.expiresAt)) {
                    return true;
                }
            }
        } catch (_) {}
    }

    // 3. Fallback: check if standard web session cookie/JWT is present
    if (isAuthenticated(req)) {
        return true;
    }

    return false;
}

// -------------------------------------------------------------
// Tool Definitions Catalog
// -------------------------------------------------------------
const TOOL_DEFINITIONS = [
    {
        name: 'search_notes',
        description: 'Search notes by keyword in title/content, folder name, or pinned status',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search keyword to match in title or content' },
                folder: { type: 'string', description: 'Folder name filter' },
                pinnedOnly: { type: 'boolean', description: 'Only return pinned notes if true' },
                limit: { type: 'number', description: 'Maximum notes to return (default: 15)' }
            }
        }
    },
    {
        name: 'get_note',
        description: 'Retrieve full contents of a specific note by ID or exact title',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId string of the note' },
                title: { type: 'string', description: 'Exact title of the note' }
            }
        }
    },
    {
        name: 'create_note',
        description: 'Create a new markdown note in the notes repository',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the note' },
                content: { type: 'string', description: 'Markdown or plain text content of the note' },
                folder: { type: 'string', description: 'Optional folder/category name' },
                pinned: { type: 'boolean', description: 'Whether to pin the note' },
                tags: { type: 'array', items: { type: 'string' }, description: 'List of tags' }
            },
            required: ['title', 'content']
        }
    },
    {
        name: 'update_note',
        description: 'Update an existing note (title, content, folder, pinned, or archived status)',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId of the note' },
                title: { type: 'string', description: 'New title for the note' },
                content: { type: 'string', description: 'New content' },
                folder: { type: 'string', description: 'New folder' },
                pinned: { type: 'boolean', description: 'Pin or unpin the note' },
                archived: { type: 'boolean', description: 'Archive or unarchive the note' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Updated tags' }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_note',
        description: 'Permanently delete a note by ID',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId of the note to delete' }
            },
            required: ['id']
        }
    },
    {
        name: 'list_todos',
        description: 'List todo tasks with optional filters for completion status, priority, or tags',
        inputSchema: {
            type: 'object',
            properties: {
                completed: { type: 'boolean', description: 'Filter by completed status' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority filter' },
                tag: { type: 'string', description: 'Tag filter' },
                search: { type: 'string', description: 'Keyword search' },
                limit: { type: 'number', description: 'Maximum tasks (default: 30)' }
            }
        }
    },
    {
        name: 'create_todo',
        description: 'Add a new todo task to the personal dashboard',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Title of the task' },
                description: { type: 'string', description: 'Description or notes' },
                link: { type: 'string', description: 'URL link related to the task' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
                dueDate: { type: 'string', description: 'Due date formatted as YYYY-MM-DD' },
                estimatedTime: { type: 'number', description: 'Estimated duration in minutes' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Category tags' }
            },
            required: ['title']
        }
    },
    {
        name: 'update_todo',
        description: 'Update a todo task status, title, priority, due date, or description',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId of the task' },
                completed: { type: 'boolean', description: 'Mark as completed or pending' },
                title: { type: 'string', description: 'Updated title' },
                link: { type: 'string', description: 'Updated URL link' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                dueDate: { type: 'string', description: 'Updated due date (YYYY-MM-DD or null)' }
            },
            required: ['id']
        }
    },
    {
        name: 'delete_todo',
        description: 'Permanently delete a todo task by ID',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId of the task to delete' }
            },
            required: ['id']
        }
    },
    {
        name: 'get_budget_summary',
        description: 'Retrieve high-level financial summary (total income, expenses, net savings, category breakdown)',
        inputSchema: {
            type: 'object',
            properties: {
                year: { type: 'number', description: 'Filter by year (e.g. 2026)' },
                month: { type: 'number', description: 'Filter by month (1-12)' }
            }
        }
    },
    {
        name: 'list_expenses',
        description: 'List recorded expense entries with optional category filter',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: 'Category filter' },
                limit: { type: 'number', description: 'Maximum items (default: 20)' }
            }
        }
    },
    {
        name: 'add_expense',
        description: 'Record a new expense item into the budget tracker',
        inputSchema: {
            type: 'object',
            properties: {
                item: { type: 'string', description: 'Description of the expense' },
                category: { type: 'string', description: 'Category (e.g. Groceries, Tech, Dining)' },
                cost: { type: 'number', description: 'Cost amount' },
                date: { type: 'string', description: 'Date in YYYY-MM-DD format (default: today)' }
            },
            required: ['item', 'category', 'cost']
        }
    },
    {
        name: 'list_income',
        description: 'List recorded income sources and payments',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum items (default: 20)' }
            }
        }
    },
    {
        name: 'add_income',
        description: 'Record a new income entry into the budget tracker',
        inputSchema: {
            type: 'object',
            properties: {
                item: { type: 'string', description: 'Source or description of income' },
                value: { type: 'number', description: 'Amount received' },
                type: { type: 'string', enum: ['salary', 'freelance', 'investment', 'injection', 'other'] },
                date: { type: 'string', description: 'Date in YYYY-MM-DD format (default: today)' }
            },
            required: ['item', 'value']
        }
    },
    {
        name: 'search_contacts',
        description: 'Search networking contacts by name, company, role, tags, or follow-up status',
        inputSchema: {
            type: 'object',
            properties: {
                search: { type: 'string', description: 'Keyword search' },
                tag: { type: 'string', description: 'Tag filter' },
                followUp: { type: 'string', enum: ['all', 'overdue', 'upcoming', 'pending', 'none'] },
                limit: { type: 'number', description: 'Maximum contacts (default: 20)' }
            }
        }
    },
    {
        name: 'get_contact',
        description: 'Get full details of a contact including their complete interaction history',
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'MongoDB ObjectId of the contact' },
                name: { type: 'string', description: 'Name of the contact' }
            }
        }
    },
    {
        name: 'create_contact',
        description: 'Add a new person to the networking CRM',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Full name of the contact' },
                company: { type: 'string', description: 'Company or organization' },
                role: { type: 'string', description: 'Title / Role' },
                email: { type: 'string', description: 'Email address' },
                phone: { type: 'string', description: 'Phone number' },
                location: { type: 'string', description: 'Location / city' },
                linkedin: { type: 'string', description: 'LinkedIn URL' },
                tags: { type: 'array', items: { type: 'string' } },
                notes: { type: 'string', description: 'General notes' },
                nextFollowUpAt: { type: 'string', description: 'Next follow-up date (YYYY-MM-DD)' }
            },
            required: ['name']
        }
    },
    {
        name: 'log_interaction',
        description: 'Log a meeting, call, email, or chat with a contact and optionally update next follow-up date',
        inputSchema: {
            type: 'object',
            properties: {
                personId: { type: 'string', description: 'MongoDB ObjectId of the contact' },
                type: { type: 'string', enum: ['meeting', 'call', 'email', 'coffee', 'message', 'event', 'other'] },
                notes: { type: 'string', description: 'Summary of discussion' },
                date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
                nextFollowUpAt: { type: 'string', description: 'Updated follow-up date (YYYY-MM-DD)' }
            },
            required: ['personId', 'type', 'notes']
        }
    },
    {
        name: 'get_cms_content',
        description: 'Retrieve website CMS content by category',
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['projects', 'experiences', 'blog', 'quotes', 'research', 'photography', 'konami'] }
            },
            required: ['type']
        }
    },
    {
        name: 'update_cms_content',
        description: 'Update or overwrite a CMS section with new JSON content data',
        inputSchema: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['projects', 'experiences', 'blog', 'quotes', 'research', 'photography', 'konami'] },
                data: { description: 'New content structure' }
            },
            required: ['type', 'data']
        }
    }
];

// -------------------------------------------------------------
// Tool Execution Handler
// -------------------------------------------------------------
async function executeTool(name, args, db) {
    switch (name) {
        case 'search_notes': {
            const filter = {};
            if (!args.includeArchived) filter.archived = { $ne: true };
            if (args.pinnedOnly) filter.pinned = true;
            if (args.folder) filter.folder = args.folder;
            if (args.query && args.query.trim()) {
                const regex = new RegExp(args.query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ title: regex }, { content: regex }];
            }
            const docs = await db.collection('notes')
                .find(filter)
                .sort({ pinned: -1, updatedAt: -1, createdAt: -1 })
                .limit(args.limit || 15)
                .toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(docs.map(d => ({
                        id: d._id.toString(),
                        title: d.title,
                        content: d.content,
                        folder: d.folder || '',
                        pinned: !!d.pinned,
                        tags: d.tags || [],
                        updatedAt: d.updatedAt
                    })), null, 2)
                }]
            };
        }

        case 'get_note': {
            let filter = {};
            if (args.id) {
                if (!ObjectId.isValid(args.id)) throw new Error(`Invalid note ID: ${args.id}`);
                filter._id = new ObjectId(args.id);
            } else if (args.title) {
                filter.title = new RegExp(`^${args.title.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            } else {
                throw new Error('Either id or title must be provided');
            }
            const doc = await db.collection('notes').findOne(filter);
            if (!doc) return { isError: true, content: [{ type: 'text', text: 'Note not found' }] };
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        id: doc._id.toString(),
                        title: doc.title,
                        content: doc.content,
                        folder: doc.folder || '',
                        pinned: !!doc.pinned,
                        tags: doc.tags || [],
                        updatedAt: doc.updatedAt
                    }, null, 2)
                }]
            };
        }

        case 'create_note': {
            const now = new Date();
            const doc = {
                title: String(args.title || '').trim(),
                content: String(args.content || ''),
                folder: args.folder ? String(args.folder).trim() : '',
                archived: false,
                pinned: args.pinned === true,
                tags: Array.isArray(args.tags) ? args.tags : [],
                createdAt: now,
                updatedAt: now,
            };
            const result = await db.collection('notes').insertOne(doc);
            return {
                content: [{ type: 'text', text: `Note created with ID: ${result.insertedId.toString()}` }]
            };
        }

        case 'update_note': {
            if (!ObjectId.isValid(args.id)) throw new Error(`Invalid note ID: ${args.id}`);
            const updateDoc = { updatedAt: new Date() };
            if (args.title !== undefined) updateDoc.title = String(args.title).trim();
            if (args.content !== undefined) updateDoc.content = String(args.content);
            if (args.folder !== undefined) updateDoc.folder = String(args.folder).trim();
            if (args.pinned !== undefined) updateDoc.pinned = Boolean(args.pinned);
            if (args.archived !== undefined) updateDoc.archived = Boolean(args.archived);
            if (args.tags !== undefined) updateDoc.tags = args.tags;

            const res = await db.collection('notes').updateOne({ _id: new ObjectId(args.id) }, { $set: updateDoc });
            if (res.matchedCount === 0) return { isError: true, content: [{ type: 'text', text: 'Note not found' }] };
            return { content: [{ type: 'text', text: `Note ${args.id} updated successfully.` }] };
        }

        case 'delete_note': {
            if (!ObjectId.isValid(args.id)) throw new Error(`Invalid note ID: ${args.id}`);
            const res = await db.collection('notes').deleteOne({ _id: new ObjectId(args.id) });
            if (res.deletedCount === 0) return { isError: true, content: [{ type: 'text', text: 'Note not found' }] };
            return { content: [{ type: 'text', text: `Note ${args.id} deleted successfully.` }] };
        }

        case 'list_todos': {
            const filter = {};
            if (args.completed !== undefined) filter.completed = args.completed;
            if (args.priority) filter.priority = args.priority;
            if (args.tag) filter.tags = args.tag;
            if (args.search && args.search.trim()) {
                const regex = new RegExp(args.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ title: regex }, { description: regex }];
            }
            const docs = await db.collection('todos')
                .find(filter)
                .sort({ completed: 1, dueDate: 1, order: 1, createdAt: -1 })
                .limit(args.limit || 30)
                .toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(docs.map(d => ({
                        id: d._id.toString(),
                        title: d.title,
                        completed: !!d.completed,
                        priority: d.priority || 'medium',
                        dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : null,
                        description: d.description || '',
                        link: d.link || '',
                        tags: d.tags || []
                    })), null, 2)
                }]
            };
        }

        case 'create_todo': {
            const now = new Date();
            const latest = await db.collection('todos').find().sort({ order: -1 }).limit(1).next();
            const order = latest ? (Number(latest.order || 0) + 1) : 1;
            const doc = {
                title: String(args.title || '').trim(),
                description: args.description || '',
                link: args.link ? String(args.link).trim() : '',
                completed: false,
                priority: args.priority || 'medium',
                dueDate: args.dueDate ? new Date(args.dueDate).toISOString().slice(0, 10) : null,
                estimatedTime: args.estimatedTime || null,
                tags: Array.isArray(args.tags) ? args.tags : [],
                order,
                serialNumber: order,
                createdAt: now,
                updatedAt: now,
            };
            const res = await db.collection('todos').insertOne(doc);
            return { content: [{ type: 'text', text: `Task created with ID: ${res.insertedId.toString()}` }] };
        }

        case 'update_todo': {
            if (!ObjectId.isValid(args.id)) throw new Error(`Invalid todo ID: ${args.id}`);
            const updateDoc = { updatedAt: new Date() };
            if (args.completed !== undefined) updateDoc.completed = Boolean(args.completed);
            if (args.title !== undefined) updateDoc.title = String(args.title).trim();
            if (args.link !== undefined) updateDoc.link = String(args.link).trim();
            if (args.priority !== undefined) updateDoc.priority = args.priority;
            if (args.dueDate !== undefined) updateDoc.dueDate = args.dueDate ? new Date(args.dueDate).toISOString().slice(0, 10) : null;

            const res = await db.collection('todos').updateOne({ _id: new ObjectId(args.id) }, { $set: updateDoc });
            if (res.matchedCount === 0) return { isError: true, content: [{ type: 'text', text: 'Task not found' }] };
            return { content: [{ type: 'text', text: `Task ${args.id} updated successfully.` }] };
        }

        case 'delete_todo': {
            if (!ObjectId.isValid(args.id)) throw new Error(`Invalid todo ID: ${args.id}`);
            const res = await db.collection('todos').deleteOne({ _id: new ObjectId(args.id) });
            if (res.deletedCount === 0) return { isError: true, content: [{ type: 'text', text: 'Task not found' }] };
            return { content: [{ type: 'text', text: `Task ${args.id} deleted successfully.` }] };
        }

        case 'get_budget_summary': {
            const expenses = await db.collection('expenses').find({}).toArray();
            const income = await db.collection('income').find({}).toArray();

            const filterByDate = (docDate) => {
                if (!docDate) return true;
                const d = new Date(docDate);
                if (Number.isNaN(d.getTime())) return true;
                if (args.year && d.getUTCFullYear() !== args.year) return false;
                if (args.month && d.getUTCMonth() + 1 !== args.month) return false;
                return true;
            };

            const filteredExpenses = expenses.filter(e => filterByDate(e.date));
            const filteredIncome = income.filter(i => filterByDate(i.date));

            const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
            const totalIncome = filteredIncome.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

            const categoryBreakdown = {};
            filteredExpenses.forEach(e => {
                const cat = e.category || 'Uncategorized';
                categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (Number(e.cost) || 0);
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        period: args.year ? (args.month ? `${args.year}-${String(args.month).padStart(2, '0')}` : `${args.year}`) : 'All Time',
                        totalIncome: Number(totalIncome.toFixed(2)),
                        totalExpenses: Number(totalExpenses.toFixed(2)),
                        netBalance: Number((totalIncome - totalExpenses).toFixed(2)),
                        categoryBreakdown
                    }, null, 2)
                }]
            };
        }

        case 'list_expenses': {
            const filter = {};
            if (args.category) filter.category = new RegExp(`^${args.category.trim()}$`, 'i');
            const docs = await db.collection('expenses').find(filter).sort({ date: -1, serialNumber: -1 }).limit(args.limit || 20).toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(docs.map(d => ({
                        id: d._id.toString(),
                        item: d.item,
                        category: d.category,
                        cost: d.cost,
                        date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null
                    })), null, 2)
                }]
            };
        }

        case 'add_expense': {
            const doc = {
                date: args.date ? new Date(args.date) : new Date(),
                item: String(args.item).trim(),
                category: String(args.category).trim(),
                cost: Number(args.cost),
                createdAt: new Date(),
            };
            const res = await db.collection('expenses').insertOne(doc);
            await resequenceExpenses(db);
            const savedDoc = await db.collection('expenses').findOne({ _id: res.insertedId });
            return {
                content: [{ type: 'text', text: `Expense recorded: "${doc.item}" ($${doc.cost.toFixed(2)}) with Serial #${savedDoc ? savedDoc.serialNumber : 1} (ID ${res.insertedId.toString()})` }]
            };
        }

        case 'list_income': {
            const docs = await db.collection('income').find({}).sort({ date: -1, no: -1 }).limit(args.limit || 20).toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(docs.map(d => ({
                        id: d._id.toString(),
                        no: d.no,
                        item: d.item,
                        value: d.value,
                        type: d.type || 'other',
                        date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null
                    })), null, 2)
                }]
            };
        }

        case 'add_income': {
            const doc = {
                date: args.date ? new Date(args.date) : new Date(),
                item: String(args.item).trim(),
                value: Number(args.value),
                type: args.type || 'other',
                createdAt: new Date(),
            };
            const res = await db.collection('income').insertOne(doc);
            await resequenceIncome(db);
            const savedDoc = await db.collection('income').findOne({ _id: res.insertedId });
            return {
                content: [{ type: 'text', text: `Income recorded: "${doc.item}" ($${doc.value.toFixed(2)}) with No #${savedDoc ? savedDoc.no : 1} (ID ${res.insertedId.toString()})` }]
            };
        }

        case 'search_contacts': {
            const filter = {};
            if (args.tag) filter.tags = new RegExp(`^${args.tag.trim()}$`, 'i');
            if (args.search && args.search.trim()) {
                const regex = new RegExp(args.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ name: regex }, { company: regex }, { role: regex }, { notes: regex }];
            }
            const todayStr = new Date().toISOString().slice(0, 10);
            if (args.followUp === 'overdue') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $lt: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            } else if (args.followUp === 'upcoming' || args.followUp === 'pending') {
                filter.nextFollowUpAt = { $exists: true, $ne: null, $gte: todayStr };
                filter.followUpStatus = { $ne: 'completed' };
            }
            const docs = await db.collection('networking_people').find(filter).sort({ nextFollowUpAt: 1, createdAt: -1 }).limit(args.limit || 20).toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(docs.map(d => ({
                        id: d._id.toString(),
                        name: d.name,
                        role: d.role,
                        company: d.company,
                        email: d.email,
                        nextFollowUpAt: d.nextFollowUpAt,
                        followUpStatus: d.followUpStatus
                    })), null, 2)
                }]
            };
        }

        case 'get_contact': {
            let filter = {};
            if (args.id) {
                if (!ObjectId.isValid(args.id)) throw new Error(`Invalid contact ID: ${args.id}`);
                filter._id = new ObjectId(args.id);
            } else if (args.name) {
                filter.name = new RegExp(args.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            } else {
                throw new Error('Either contact id or name must be provided');
            }
            const person = await db.collection('networking_people').findOne(filter);
            if (!person) return { isError: true, content: [{ type: 'text', text: 'Contact not found' }] };

            const interactions = await db.collection('networking_interactions').find({ personId: person._id.toString() }).sort({ date: -1 }).toArray();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        id: person._id.toString(),
                        name: person.name,
                        role: person.role,
                        company: person.company,
                        email: person.email,
                        phone: person.phone,
                        notes: person.notes,
                        nextFollowUpAt: person.nextFollowUpAt,
                        interactions: interactions.map(i => ({ id: i._id.toString(), date: i.date, type: i.type, notes: i.notes }))
                    }, null, 2)
                }]
            };
        }

        case 'create_contact': {
            const now = new Date();
            const doc = {
                name: String(args.name || '').trim(),
                company: String(args.company || '').trim(),
                role: String(args.role || '').trim(),
                email: String(args.email || '').trim(),
                phone: String(args.phone || '').trim(),
                location: String(args.location || '').trim(),
                linkedin: String(args.linkedin || '').trim(),
                tags: Array.isArray(args.tags) ? args.tags : [],
                notes: String(args.notes || '').trim(),
                nextFollowUpAt: args.nextFollowUpAt ? String(args.nextFollowUpAt).trim() : null,
                followUpStatus: args.nextFollowUpAt ? 'pending' : 'none',
                createdAt: now,
                updatedAt: now,
            };
            const res = await db.collection('networking_people').insertOne(doc);
            return { content: [{ type: 'text', text: `Contact created with ID: ${res.insertedId.toString()}` }] };
        }

        case 'log_interaction': {
            if (!ObjectId.isValid(args.personId)) throw new Error(`Invalid contact ID: ${args.personId}`);
            const person = await db.collection('networking_people').findOne({ _id: new ObjectId(args.personId) });
            if (!person) return { isError: true, content: [{ type: 'text', text: 'Contact not found' }] };

            const now = new Date();
            const interactionDate = args.date ? new Date(args.date) : now;
            const interactionDoc = {
                personId: args.personId,
                personName: person.name,
                type: args.type,
                notes: String(args.notes).trim(),
                date: interactionDate,
                createdAt: now,
                updatedAt: now
            };
            const res = await db.collection('networking_interactions').insertOne(interactionDoc);

            const personUpdate = { lastInteractionAt: interactionDate, updatedAt: now };
            if (args.nextFollowUpAt !== undefined) {
                personUpdate.nextFollowUpAt = args.nextFollowUpAt ? String(args.nextFollowUpAt).trim() : null;
                personUpdate.followUpStatus = args.nextFollowUpAt ? 'pending' : 'none';
            }
            await db.collection('networking_people').updateOne({ _id: new ObjectId(args.personId) }, { $set: personUpdate });

            return { content: [{ type: 'text', text: `Interaction logged for ${person.name} with ID ${res.insertedId.toString()}` }] };
        }

        case 'get_cms_content': {
            const collectionMap = {
                projects: 'cms_projects',
                experiences: 'cms_experiences',
                blog: 'cms_blog',
                quotes: 'cms_quotes',
                research: 'cms_research',
                photography: 'cms_photography',
                konami: 'cms_konami'
            };
            const collName = collectionMap[args.type];
            if (!collName) throw new Error(`Invalid CMS type: ${args.type}`);
            const doc = await db.collection(collName).findOne({ _id: 'current' });
            return { content: [{ type: 'text', text: JSON.stringify(doc ? doc.data : [], null, 2) }] };
        }

        case 'update_cms_content': {
            const collectionMap = {
                projects: 'cms_projects',
                experiences: 'cms_experiences',
                blog: 'cms_blog',
                quotes: 'cms_quotes',
                research: 'cms_research',
                photography: 'cms_photography',
                konami: 'cms_konami'
            };
            const collName = collectionMap[args.type];
            if (!collName) throw new Error(`Invalid CMS type: ${args.type}`);
            await db.collection(collName).updateOne(
                { _id: 'current' },
                { $set: { data: args.data, updatedAt: new Date() } },
                { upsert: true }
            );
            return { content: [{ type: 'text', text: `CMS content for "${args.type}" updated successfully.` }] };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

// -------------------------------------------------------------
// Resource Definitions Catalog & Readers
// -------------------------------------------------------------
const RESOURCE_DEFINITIONS = [
    { uri: 'website://todos/active', name: 'Active Todos', description: 'List of all active/pending tasks from the dashboard', mimeType: 'application/json' },
    { uri: 'website://notes/recent', name: 'Recent Notes', description: 'Recent and pinned notes stored on the personal website', mimeType: 'text/markdown' },
    { uri: 'website://budget/summary', name: 'Budget Summary', description: 'Current budget financial status and totals', mimeType: 'application/json' },
    { uri: 'website://crm/followups', name: 'CRM Follow-ups', description: 'List of contacts with overdue or upcoming follow-up dates', mimeType: 'application/json' }
];

const PROMPT_DEFINITIONS = [
    {
        name: 'daily_briefing',
        description: 'Generate an executive morning briefing summarizing pending tasks, overdue contacts, and recent notes'
    },
    {
        name: 'contact_prep',
        description: 'Prepare briefing notes before meeting with a specific networking contact',
        arguments: [
            { name: 'contactName', description: 'Name of the contact', required: true }
        ]
    }
];

async function readResource(uri, db) {
    if (uri === 'website://todos/active') {
        const todos = await db.collection('todos').find({ completed: { $ne: true } }).sort({ dueDate: 1, priority: 1, order: 1 }).toArray();
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(todos, null, 2) }] };
    }
    if (uri === 'website://notes/recent') {
        const notes = await db.collection('notes').find({ archived: { $ne: true } }).sort({ pinned: -1, updatedAt: -1 }).limit(20).toArray();
        let md = '# Recent & Pinned Notes\n\n';
        for (const note of notes) {
            md += `## ${note.pinned ? '📌 ' : ''}${note.title}\n`;
            if (note.folder) md += `*Folder: ${note.folder}*\n`;
            if (Array.isArray(note.tags) && note.tags.length > 0) md += `*Tags: ${note.tags.join(', ')}*\n`;
            md += `\n${note.content || '(No content)'}\n\n---\n\n`;
        }
        return { contents: [{ uri, mimeType: 'text/markdown', text: md }] };
    }
    if (uri === 'website://budget/summary') {
        const expenses = await db.collection('expenses').find({}).toArray();
        const income = await db.collection('income').find({}).toArray();
        const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
        const totalIncome = income.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
        const summary = {
            totalIncome: Number(totalIncome.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            netSavings: Number((totalIncome - totalExpenses).toFixed(2)),
            expenseCount: expenses.length,
            incomeCount: income.length,
        };
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(summary, null, 2) }] };
    }
    if (uri === 'website://crm/followups') {
        const contacts = await db.collection('networking_people').find({
            nextFollowUpAt: { $exists: true, $ne: null },
            followUpStatus: { $ne: 'completed' }
        }).sort({ nextFollowUpAt: 1 }).toArray();
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(contacts, null, 2) }] };
    }
    throw new Error(`Unknown resource URI: ${uri}`);
}

async function getPrompt(name, args, db) {
    if (name === 'daily_briefing') {
        const todos = await db.collection('todos').find({ completed: { $ne: true } }).limit(10).toArray();
        const followups = await db.collection('networking_people').find({ nextFollowUpAt: { $exists: true, $ne: null } }).limit(5).toArray();
        const pinnedNotes = await db.collection('notes').find({ pinned: true, archived: { $ne: true } }).limit(5).toArray();

        return {
            description: 'Executive morning briefing',
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Provide an executive summary of Prajwal's day:\n- Pending tasks (${todos.length}): ${todos.map(t => t.title).join(', ') || 'None'}\n- Urgent followups (${followups.length}): ${followups.map(f => f.name).join(', ') || 'None'}\n- Pinned Notes: ${pinnedNotes.map(n => n.title).join(', ') || 'None'}`
                    }
                }
            ]
        };
    }
    if (name === 'contact_prep') {
        const contactName = args?.contactName || '';
        const person = await db.collection('networking_people').findOne({
            name: { $regex: new RegExp(contactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        });
        const interactions = person ? await db.collection('networking_interactions').find({ personId: person._id.toString() }).sort({ date: -1 }).toArray() : [];

        return {
            description: `Briefing packet for meeting with ${contactName}`,
            messages: [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Prepare a meeting briefing for ${contactName}:\n- Person Profile: ${JSON.stringify(person || 'Not found')}\n- Past Interactions: ${JSON.stringify(interactions)}`
                    }
                }
            ]
        };
    }
    throw new Error(`Unknown prompt: ${name}`);
}

// -------------------------------------------------------------
// Main HTTP / SSE Route Handler
// -------------------------------------------------------------
module.exports = async (req, res) => {
    // 1. Enable CORS for all LLM clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'] || 'www.prajwalmreddy.com';
    const baseUrl = `${proto}://${host}`;

    // Set OAuth discovery metadata headers for RFC 9728 compliance
    res.setHeader('Link', `<${baseUrl}/.well-known/oauth-authorization-server>; rel="oauth-authorization-server", <${baseUrl}/.well-known/oauth-protected-resource>; rel="oauth-protected-resource"`);

    const url = new URL(req.url, baseUrl);
    const pathname = url.pathname.replace(/\/+$/, '');

    // OAuth Discovery routes fallback
    if (pathname.endsWith('/oauth-authorization-server') || pathname.endsWith('/.well-known/oauth-authorization-server')) {
        return res.status(200).json(getDiscoveryMetadata(baseUrl));
    }
    if (pathname.endsWith('/oauth-protected-resource') || pathname.endsWith('/.well-known/oauth-protected-resource')) {
        return res.status(200).json(getProtectedResourceMetadata(baseUrl));
    }

    // Public / Open Info & Discovery Endpoint (No auth required to inspect capabilities)
    if (pathname === '/.well-known/mcp' || pathname === '/.well-known/mcp.json' || pathname === '/api/mcp/discovery' || pathname === '/api/mcp/info') {
        return res.status(200).json({
            name: 'prajwal-website-mcp',
            version: '1.0.0',
            status: 'online',
            description: "Model Context Protocol server for Prajwal Reddy's personal website, notes, tasks, finances, CRM, and CMS.",
            protocolVersion: '2024-11-05',
            transport: ['JSON-RPC 2.0 (HTTP POST)', 'Server-Sent Events (SSE GET)'],
            endpoints: {
                mcp: `${baseUrl}/api/mcp`,
                sse: `${baseUrl}/api/mcp/sse`,
                tools: `${baseUrl}/api/mcp/tools`,
                resources: `${baseUrl}/api/mcp/resources`,
                prompts: `${baseUrl}/api/mcp/prompts`,
                authorize: `${baseUrl}/api/mcp/authorize`,
                token: `${baseUrl}/api/mcp/token`,
                discovery: `${baseUrl}/api/mcp/discovery`
            },
            capabilities: {
                tools: { count: TOOL_DEFINITIONS.length, list: TOOL_DEFINITIONS.map(t => t.name) },
                resources: { count: RESOURCE_DEFINITIONS.length, list: RESOURCE_DEFINITIONS.map(r => r.uri) },
                prompts: { count: PROMPT_DEFINITIONS.length, list: PROMPT_DEFINITIONS.map(p => p.name) }
            }
        });
    }

    let db;
    try {
        db = await connectToDatabase();
    } catch (dbErr) {
        console.error('Database connection error in MCP handler:', dbErr);
    }

    // 2. Authentication Check for Transport and Tool Endpoints
    const isAuthed = await verifyMcpAuth(req, db);
    if (!isAuthed) {
        res.setHeader('WWW-Authenticate', `Bearer realm="${host}", authorization_uri="${baseUrl}/api/mcp/authorize", registration_uri="${baseUrl}/api/mcp/register"`);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Provide valid Bearer token, x-api-key, or authorize via OAuth at /api/mcp/authorize',
            authorization_uri: `${baseUrl}/api/mcp/authorize`,
            registration_uri: `${baseUrl}/api/mcp/register`
        });
    }

    try {
        if (!db) db = await connectToDatabase();

        // 3. Handle Clean GET Endpoints
        if (req.method === 'GET') {
            // Direct Clean Tools List
            if (pathname === '/api/mcp/tools') {
                return res.status(200).json({ count: TOOL_DEFINITIONS.length, tools: TOOL_DEFINITIONS });
            }

            // Direct Clean Resources List
            if (pathname === '/api/mcp/resources') {
                const resourceUri = url.searchParams.get('uri');
                if (resourceUri) {
                    const content = await readResource(resourceUri, db);
                    return res.status(200).json(content);
                }
                return res.status(200).json({ count: RESOURCE_DEFINITIONS.length, resources: RESOURCE_DEFINITIONS });
            }

            // Direct Clean Prompts List
            if (pathname === '/api/mcp/prompts') {
                return res.status(200).json({ count: PROMPT_DEFINITIONS.length, prompts: PROMPT_DEFINITIONS });
            }

            // SSE Connection
            const accept = req.headers['accept'] || '';
            const isSse = pathname === '/api/mcp/sse' || accept.includes('text/event-stream') || req.url?.includes('/sse') || req.query?.sse === 'true';

            if (isSse) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });

                const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const endpointUri = `${baseUrl}/api/mcp?sessionId=${sessionId}`;

                res.write(`event: endpoint\ndata: ${endpointUri}\n\n`);

                const keepAlive = setInterval(() => {
                    if (!res.writableEnded) {
                        res.write(': keep-alive\n\n');
                    }
                }, 15000);

                req.on('close', () => clearInterval(keepAlive));
                return;
            }

            // Standard GET info endpoint
            return res.status(200).json({
                name: 'prajwal-website-mcp',
                version: '1.0.0',
                status: 'online',
                protocol: 'MCP (JSON-RPC 2.0 / SSE)',
                endpoint: `${baseUrl}/api/mcp`,
                toolsEndpoint: `${baseUrl}/api/mcp/tools`,
                resourcesEndpoint: `${baseUrl}/api/mcp/resources`,
                promptsEndpoint: `${baseUrl}/api/mcp/prompts`,
                toolsCount: TOOL_DEFINITIONS.length,
                availableTools: TOOL_DEFINITIONS.map(t => t.name)
            });
        }

        // 4. Handle POST /api/mcp (JSON-RPC 2.0 Request)
        if (req.method === 'POST') {
            const body = req.body || {};
            const { jsonrpc, id, method, params } = body;

            // Handle notifications (no error response allowed for JSON-RPC notifications)
            if (method?.startsWith('notifications/') || method?.startsWith('$/') || (id === undefined && method)) {
                return res.status(200).json({ jsonrpc: '2.0', id: id ?? null, result: {} });
            }

            // Health check / ping
            if (method === 'ping') {
                return res.status(200).json({ jsonrpc: '2.0', id, result: {} });
            }

            // MCP Initialize
            if (method === 'initialize') {
                return res.status(200).json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: '2024-11-05',
                        serverInfo: {
                            name: 'prajwal-website-mcp',
                            version: '1.0.0'
                        },
                        capabilities: {
                            tools: {},
                            resources: {},
                            prompts: {}
                        }
                    }
                });
            }

            // MCP Tools List
            if (method === 'tools/list') {
                return res.status(200).json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: TOOL_DEFINITIONS
                    }
                });
            }

            // MCP Prompts List
            if (method === 'prompts/list') {
                return res.status(200).json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        prompts: PROMPT_DEFINITIONS
                    }
                });
            }

            // MCP Prompts Get
            if (method === 'prompts/get') {
                const promptName = params?.name;
                const promptArgs = params?.arguments || {};
                try {
                    const promptResult = await getPrompt(promptName, promptArgs, db);
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        result: promptResult
                    });
                } catch (promptErr) {
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32602, message: promptErr.message }
                    });
                }
            }

            // MCP Tools Call
            if (method === 'tools/call') {
                const toolName = params?.name;
                const toolArgs = params?.arguments || {};

                if (!toolName) {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32602, message: 'Missing tool name parameter' }
                    });
                }

                try {
                    const toolResult = await executeTool(toolName, toolArgs, db);
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        result: toolResult
                    });
                } catch (toolErr) {
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        result: {
                            isError: true,
                            content: [{ type: 'text', text: toolErr.message }]
                        }
                    });
                }
            }

            // MCP Resources List
            if (method === 'resources/list') {
                return res.status(200).json({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        resources: RESOURCE_DEFINITIONS
                    }
                });
            }

            // MCP Resources Read
            if (method === 'resources/read') {
                const uri = params?.uri;
                if (!uri) {
                    return res.status(400).json({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32602, message: 'Missing uri parameter' }
                    });
                }

                try {
                    const readResult = await readResource(uri, db);
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        result: readResult
                    });
                } catch (resErr) {
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32602, message: resErr.message }
                    });
                }
            }

            // Unknown method
            return res.status(400).json({
                jsonrpc: '2.0',
                id,
                error: { code: -32601, message: `Method not found: ${method}` }
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('MCP Remote API Error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
