const { ObjectId } = require('mongodb');

const toDateKey = (d) => {
    try {
        return new Date(d).toISOString().slice(0, 10);
    } catch {
        return null;
    }
};

/**
 * Format a compact tasks list
 */
function formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) return 'None';
    return tasks
        .map((t) => {
            const due = t.dueDate ? ` (Due: ${t.dueDate.slice(0, 10)})` : '';
            const priority = t.priority ? ` [${t.priority.toUpperCase()}]` : '';
            const sub = Array.isArray(t.subtasks) && t.subtasks.length > 0
                ? ` (${t.subtasks.filter((s) => s.completed).length}/${t.subtasks.length} subtasks)`
                : '';
            return `- ${t.title}${priority}${due}${sub}`;
        })
        .join('\n');
}

/**
 * Focus and priorities context
 */
async function getFocusContext(db) {
    const now = new Date();
    const todayStr = toDateKey(now);

    const todosCol = db.collection('todos');
    const notesCol = db.collection('notes');

    // Overdue tasks
    const overdueTasks = await todosCol
        .find({
            completed: { $ne: true },
            dueDate: { $ne: null, $lt: todayStr },
        })
        .sort({ dueDate: 1 })
        .limit(8)
        .toArray();

    // Today's tasks
    const todayTasks = await todosCol
        .find({
            completed: { $ne: true },
            dueDate: { $regex: `^${todayStr}` },
        })
        .sort({ priority: 1, order: 1 })
        .limit(8)
        .toArray();

    // Other high priority tasks
    const highPriority = await todosCol
        .find({
            completed: { $ne: true },
            priority: 'high',
            dueDate: { $not: { $lt: todayStr } },
        })
        .limit(5)
        .toArray();

    // Recent notes for context
    const recentNotes = await notesCol
        .find({ archived: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(3)
        .project({ title: 1, folder: 1, updatedAt: 1 })
        .toArray();

    return `### TODAY'S DATE: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

#### Overdue Tasks (${overdueTasks.length}):
${formatTaskList(overdueTasks)}

#### Tasks Due Today (${todayTasks.length}):
${formatTaskList(todayTasks)}

#### Other High Priority Tasks:
${formatTaskList(highPriority)}

#### Recent Notes:
${
    recentNotes.length > 0
        ? recentNotes.map((n) => `- "${n.title || 'Untitled'}"${n.folder ? ` (Folder: ${n.folder})` : ''}`).join('\n')
        : 'None'
}`;
}

/**
 * Overdue tasks context
 */
async function getOverdueContext(db) {
    const now = new Date();
    const todayStr = toDateKey(now);
    const todosCol = db.collection('todos');

    const overdueTasks = await todosCol
        .find({
            completed: { $ne: true },
            dueDate: { $ne: null, $lt: todayStr },
        })
        .sort({ dueDate: 1 })
        .limit(15)
        .toArray();

    return `### OVERDUE TASKS SUMMARY (As of ${todayStr}):
Total Overdue: ${overdueTasks.length}
${formatTaskList(overdueTasks)}`;
}

/**
 * Recent notes context
 */
async function getNotesContext(db, noteId = null) {
    const notesCol = db.collection('notes');

    if (noteId && ObjectId.isValid(noteId)) {
        const singleNote = await notesCol.findOne({ _id: new ObjectId(noteId) });
        if (singleNote) {
            return `### SELECTED NOTE DETAILS:
Title: "${singleNote.title}"
Folder: ${singleNote.folder || 'Unfiled'}
Updated: ${toDateKey(singleNote.updatedAt)}
Content:
${singleNote.content || '(Empty content)'}`;
        }
    }

    const notes = await notesCol
        .find({ archived: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(6)
        .toArray();

    const formatted = notes.map((n) => {
        const snippet = (n.content || '').slice(0, 180).replace(/\n+/g, ' ');
        return `- **${n.title || 'Untitled'}** (${n.folder || 'General'} - ${toDateKey(n.updatedAt)}): ${snippet}...`;
    });

    return `### RECENT NOTES (${notes.length}):
${formatted.join('\n\n')}`;
}

/**
 * Spending & financial analysis context
 */
async function getSpendingContext(db) {
    const expensesCol = db.collection('expenses');
    const incomeCol = db.collection('income');

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Month expenses
    const monthExpenses = await expensesCol
        .find({
            date: { $gte: firstDayOfMonth },
        })
        .sort({ cost: -1 })
        .toArray();

    // Month income
    const monthIncome = await incomeCol
        .find({
            date: { $gte: firstDayOfMonth },
        })
        .toArray();

    const totalSpent = monthExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
    const totalIncome = monthIncome.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

    // Group by category
    const categories = {};
    for (const exp of monthExpenses) {
        const cat = exp.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + (Number(exp.cost) || 0);
    }

    const sortedCategories = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)} (${Math.round((amount / (totalSpent || 1)) * 100)}%)`)
        .join('\n');

    // Top 5 largest expenses
    const topExpenses = monthExpenses.slice(0, 5).map(
        (e) => `- ${e.item} ($${Number(e.cost).toFixed(2)}) on ${toDateKey(e.date)} [${e.category}]`
    );

    return `### FINANCIAL OVERVIEW (Month of ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}):
- Total Spending: $${totalSpent.toFixed(2)} (${monthExpenses.length} transactions)
- Total Income: $${totalIncome.toFixed(2)} (${monthIncome.length} transactions)
- Net Cash Flow: $${(totalIncome - totalSpent).toFixed(2)}

#### Top Spending Categories:
${sortedCategories || 'No expenses recorded this month'}

#### Largest Individual Expenses:
${topExpenses.length > 0 ? topExpenses.join('\n') : 'None'}`;
}

/**
 * Natural language search across tasks and notes
 */
async function getSearchContext(db, query) {
    if (!query || typeof query !== 'string') return '';
    const cleanQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(cleanQuery, 'i');

    const todos = await db
        .collection('todos')
        .find({ $or: [{ title: regex }, { description: regex }] })
        .limit(5)
        .toArray();

    const notes = await db
        .collection('notes')
        .find({ $or: [{ title: regex }, { content: regex }] })
        .limit(5)
        .toArray();

    const expenses = await db
        .collection('expenses')
        .find({ $or: [{ item: regex }, { category: regex }] })
        .limit(5)
        .toArray();

    return `### SEARCH RESULTS FOR "${query}":
Tasks (${todos.length}):
${formatTaskList(todos)}

Notes (${notes.length}):
${notes.map((n) => `- ${n.title} (${n.folder || 'General'})`).join('\n') || 'None'}

Expenses (${expenses.length}):
${expenses.map((e) => `- ${e.item}: $${e.cost} [${e.category}]`).join('\n') || 'None'}`;
}

function isGreeting(text) {
    const clean = (text || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
    if (!clean) return false;
    const greetings = [
        'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
        'howdy', 'greetings', 'yo', 'sup', 'how are you', 'how are you doing',
        'whats up', 'what is up', 'who are you', 'what can you do', 'test',
    ];
    return greetings.includes(clean) || greetings.some((g) => clean.startsWith(g + ' ') && clean.length < g.length + 15);
}

/**
 * Main context builder routing based on action or query intent
 */
async function buildContext(db, { action, query, noteId }) {
    if (action === 'focus_today' || action === 'priorities') {
        return getFocusContext(db);
    }
    if (action === 'summarize_overdue') {
        return getOverdueContext(db);
    }
    if (action === 'summarize_notes' || action === 'note_to_tasks') {
        return getNotesContext(db, noteId);
    }
    if (action === 'analyze_spending' || action === 'unusual_spending') {
        return getSpendingContext(db);
    }
    if (action === 'search' && query) {
        return getSearchContext(db, query);
    }

    // Auto-detect intent from query text
    const lower = (query || '').toLowerCase();

    if (!action && isGreeting(query)) {
        return `The user is greeting you or initiating conversation.
Respond warmly and directly in 1-2 friendly sentences. Welcome Prajwal and let him know you are ready to help with his tasks, notes, or spending today.
Do NOT dump raw database items in this turn unless asked.`;
    }

    if (lower.includes('overdue') || lower.includes('late')) {
        return getOverdueContext(db);
    }
    if (lower.includes('spend') || lower.includes('expense') || lower.includes('budget') || lower.includes('cost') || lower.includes('money')) {
        return getSpendingContext(db);
    }
    if (lower.includes('note') || lower.includes('meeting')) {
        return getNotesContext(db, noteId);
    }
    if (lower.includes('focus') || lower.includes('today') || lower.includes('priority') || lower.includes('priorities')) {
        return getFocusContext(db);
    }

    // General dashboard combined context
    const [focus, spending] = await Promise.all([
        getFocusContext(db),
        getSpendingContext(db),
    ]);

    return `${focus}\n\n${spending}`;
}

module.exports = {
    buildContext,
    getFocusContext,
    getOverdueContext,
    getNotesContext,
    getSpendingContext,
    getSearchContext,
};
