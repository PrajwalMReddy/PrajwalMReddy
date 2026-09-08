const fs = require('fs');
const path = require('path');
const { search_memory, get_goals, get_projects } = require('./memoryTools');
const {
    isNewsQuery,
    extractNewsTopic,
    fetchLiveNewsArticles,
    formatLiveNewsContext,
} = require('./newsService');
const { fetchLiveWeather } = require('./weatherService');

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
 * Retrieve targeted persistent memories
 */
async function getRelevantMemoriesContext(db) {
    try {
        let memories = await db.collection('ai_memories')
            .find({ importance: { $gte: 4 } })
            .sort({ importance: -1, updatedAt: -1 })
            .limit(5)
            .toArray();

        memories = memories.map(m => ({
            id: m._id.toString(),
            fact: m.fact,
            category: m.category || 'general',
            tags: m.tags || [],
            importance: m.importance || 4,
        }));

        if (!memories || memories.length === 0) {
            return '';
        }

        return `### RELEVANT LONG-TERM MEMORIES (Saved Across Sessions):
${memories.map((m) => `- [${m.category.toUpperCase()}] ${m.fact}${m.tags?.length ? ` (tags: ${m.tags.join(', ')})` : ''}`).join('\n')}`;
    } catch (err) {
        console.warn('Memory search warning:', err.message);
        return '';
    }
}

/**
 * Retrieve active goals & ongoing projects context
 */
/**
 * Retrieve active goals & ongoing projects context
 */
async function getGoalsAndProjectsContext(db) {
    try {
        const [goals, projects] = await Promise.all([
            get_goals({ status: 'active' }, db),
            get_projects({ status: 'active' }, db),
        ]);

        let goalsStr = 'None recorded';
        if (goals.length > 0) {
            goalsStr = goals
                .map((g) => `- **${g.title}**${g.targetDate ? ` (Target: ${g.targetDate})` : ''}${g.progress ? ` [Progress: ${g.progress}%]` : ''}: ${g.description || 'Active goal'}`)
                .join('\n');
        }

        let projectsStr = 'None recorded';
        if (projects.length > 0) {
            projectsStr = projects
                .map((p) => `- **${p.name}**${p.targetDate ? ` (Target: ${p.targetDate})` : ''}: ${p.description || 'Active project'}${p.tags?.length ? ` [${p.tags.join(', ')}]` : ''}`)
                .join('\n');
        }

        return `### PERSISTENT GOALS & ACTIVE PROJECTS:
#### Active Goals:
${goalsStr}

#### Active Projects:
${projectsStr}`;
    } catch (err) {
        console.warn('Goals and projects lookup warning:', err.message);
        return '';
    }
}

/**
 * Specialized planning context for:
 * "Plan my week", "What should I accomplish this month?", "Am I on track for [launch]?", "Review my goals", "What's falling through the cracks?"
 */
async function getPlanningContext(db, query = '') {
    const now = new Date();
    const todayStr = toDateKey(now);
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

    const [goalsContext, todosCol, notesCol] = await Promise.all([
        getGoalsAndProjectsContext(db),
        db.collection('todos').find().toArray(),
        db.collection('notes').find({ archived: { $ne: true } }).sort({ updatedAt: -1 }).limit(10).toArray(),
    ]);

    const activeTasks = todosCol.filter((t) => !t.completed);
    const overdueTasks = activeTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < todayStr);
    const todayTasks = activeTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === todayStr);
    const highPriorityTasks = activeTasks.filter((t) => t.priority === 'high');
    const upcomingTasks = activeTasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) > todayStr);

    // Notes with possible uncompleted action items
    const actionableNotes = notesCol
        .filter((n) => /todo|action|plan|target|launch|deadline|step/i.test(n.title + ' ' + (n.content || '')))
        .slice(0, 5)
        .map((n) => `- **${n.title}** (${toDateKey(n.updatedAt)}): ${(n.content || '').slice(0, 150)}...`);

    const memoriesContext = await getRelevantMemoriesContext(db);

    return `### COMPREHENSIVE PLANNING HORIZON (Today is ${dayOfWeek}, ${todayStr}):
${goalsContext}

${memoriesContext}

### TASK INVENTORY & DEADLINES:
- Total Active Tasks: ${activeTasks.length}
- Overdue Tasks (${overdueTasks.length}):
${formatTaskList(overdueTasks)}

- Tasks Scheduled for Today (${todayTasks.length}):
${formatTaskList(todayTasks)}

- High Priority Pending Tasks (${highPriorityTasks.length}):
${formatTaskList(highPriorityTasks)}

- Upcoming Tasks this Period (${upcomingTasks.length}):
${formatTaskList(upcomingTasks.slice(0, 15))}

### RECENT ACTIONABLE NOTES (Look for unassigned tasks or requirements):
${actionableNotes.length > 0 ? actionableNotes.join('\n') : 'None'}

PLANNING DIRECTIVES:
- If planning a week or month: allocate tasks logically across days (Monday to Sunday) balancing workload and prioritizing goal milestones.
- If evaluating "Am I on track for [launch/goal]": assess time remaining vs pending tasks, calculate completion feasibility, and pinpoint critical path items.
- If finding "What's falling through the cracks": highlight overdue tasks, neglected goals, and action items in notes with no corresponding task.
- Suggest concrete tasks using structured action blocks:
\`\`\`action:create_task
{"title": "Specific Task Name", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD"}
\`\`\``;
}

/**
 * Tasks & Todos context across the entire board
 */
async function getFocusContext(db) {
    const now = new Date();
    const todayStr = toDateKey(now);
    const todosCol = db.collection('todos');

    const [overdueTasks, todayTasks, highPriority, otherTasks, completedTasks] = await Promise.all([
        todosCol.find({ completed: { $ne: true }, dueDate: { $ne: null, $lt: todayStr } }).sort({ dueDate: 1 }).toArray(),
        todosCol.find({ completed: { $ne: true }, dueDate: { $regex: `^${todayStr}` } }).sort({ priority: 1, order: 1 }).toArray(),
        todosCol.find({ completed: { $ne: true }, priority: 'high', dueDate: { $not: { $lt: todayStr } } }).toArray(),
        todosCol.find({ completed: { $ne: true }, priority: { $ne: 'high' }, dueDate: { $not: { $regex: `^${todayStr}` }, $not: { $lt: todayStr } } }).limit(15).toArray(),
        todosCol.find({ completed: true }).sort({ updatedAt: -1, dueDate: -1 }).limit(6).toArray(),
    ]);

    return `### TODOS AND TASKS SUMMARY:
- Overdue Tasks (${overdueTasks.length}):
${formatTaskList(overdueTasks)}

- Tasks Due Today (${todayTasks.length}):
${formatTaskList(todayTasks)}

- High Priority Tasks (${highPriority.length}):
${formatTaskList(highPriority)}

- Other Active Tasks (${otherTasks.length}):
${formatTaskList(otherTasks)}

- Recently Completed Tasks (${completedTasks.length}):
${completedTasks.length > 0 ? completedTasks.map((t) => `- [Done] ${t.title}`).join('\n') : 'None'}`;
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
        .toArray();

    return `### OVERDUE TASKS (Total: ${overdueTasks.length}):
${formatTaskList(overdueTasks)}`;
}

/**
 * Notes context across all time
 */
async function getNotesContext(db, noteId = null) {
    const notesCol = db.collection('notes');

    if (noteId && ObjectId.isValid(noteId)) {
        const singleNote = await notesCol.findOne({ _id: new ObjectId(noteId) });
        if (singleNote) {
            return `### SELECTED NOTE:
Title: "${singleNote.title}"
Folder: ${singleNote.folder || 'Unfiled'}
Updated: ${toDateKey(singleNote.updatedAt)}
Content:
${singleNote.content || '(Empty content)'}`;
        }
    }

    const allNotes = await notesCol
        .find({ archived: { $ne: true } })
        .sort({ updatedAt: -1 })
        .limit(20)
        .toArray();

    const inventory = allNotes.map((n) => {
        const snippet = (n.content || '').slice(0, 200).replace(/\n+/g, ' ');
        return `- **${n.title || 'Untitled'}** (${n.folder || 'General'} - ${toDateKey(n.updatedAt)}): ${snippet}${snippet.length >= 200 ? '...' : ''}`;
    });

    return `### USER NOTES (${allNotes.length} total notes):
${inventory.length > 0 ? inventory.join('\n') : 'No notes recorded'}`;
}

/**
 * Spending & financial analysis context across ALL time
 */
async function getSpendingContext(db) {
    const expensesCol = db.collection('expenses');
    const incomeCol = db.collection('income');
    const budgetPlansCol = db.collection('budgetPlans');

    const [allExpenses, allIncome, budgetPlans] = await Promise.all([
        expensesCol.find().sort({ date: -1 }).toArray(),
        incomeCol.find().sort({ date: -1 }).toArray(),
        budgetPlansCol.find().toArray().catch(() => []),
    ]);

    const totalSpent = allExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
    const totalIncome = allIncome.reduce((sum, i) => sum + (Number(i.value || i.amount) || 0), 0);
    const netCashFlow = totalIncome - totalSpent;

    const monthlySpending = {};
    for (const exp of allExpenses) {
        if (!exp.date) continue;
        const monthKey = toDateKey(exp.date).slice(0, 7);
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (Number(exp.cost) || 0);
    }
    const sortedMonths = Object.entries(monthlySpending)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 12)
        .map(([m, amount]) => `${m}: $${amount.toFixed(2)}`)
        .join(', ');

    const categoryTotals = {};
    for (const exp of allExpenses) {
        const cat = exp.category || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(exp.cost) || 0);
    }
    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([cat, amount]) => `- ${cat}: $${amount.toFixed(2)} (${Math.round((amount / (totalSpent || 1)) * 100)}%)`)
        .join('\n');

    const recentExpenses = allExpenses.slice(0, 15).map(
        (e) => `- ${toDateKey(e.date)}: ${e.item} ($${Number(e.cost).toFixed(2)}) [${e.category || 'Uncategorized'}]`
    );

    return `### FINANCIAL OVERVIEW:
- All-Time Total Spending: $${totalSpent.toFixed(2)} (${allExpenses.length} transactions)
- All-Time Total Income: $${totalIncome.toFixed(2)} (${allIncome.length} transactions)
- Net Balance: $${netCashFlow.toFixed(2)}
- Historical Monthly Spending: ${sortedMonths || 'None recorded'}

#### Top Spending Categories:
${topCategories || 'No expenses recorded'}

#### Most Recent Transactions:
${recentExpenses.length > 0 ? recentExpenses.join('\n') : 'None recorded'}`;
}

/**
 * Public website content context (blogs, writing, research, projects)
 */
function getWebsiteContentContext() {
    try {
        const blogPath = path.resolve(__dirname, '../../public/blog/_metadata.json');
        const researchPath = path.resolve(__dirname, '../../public/research/metadata.json');

        let blogs = [];
        if (fs.existsSync(blogPath)) {
            blogs = JSON.parse(fs.readFileSync(blogPath, 'utf8'));
        }

        let research = [];
        if (fs.existsSync(researchPath)) {
            research = JSON.parse(fs.readFileSync(researchPath, 'utf8'));
        }

        const blogList = blogs.map((b) => `- "${b.title}" (${b.date}, ${b.language.toUpperCase()}): ${b.description || 'Writing'}`).join('\n');
        const researchList = research.map((r) => `- "${r.en?.title || r.title}": ${r.en?.description || r.description || ''}`).join('\n');

        return `### PUBLIC WEBSITE CONTENT & RESEARCH:
#### Published Blog Posts & Writing:
${blogList || 'None'}

#### Research Projects & Publications:
${researchList || 'None'}`;
    } catch {
        return '';
    }
}

/**
 * Main context builder routing.
 * Provides rich situational awareness context for the LLM without brittle regex gating.
 * Natural language intent and specialized queries are handled naturally by the LLM
 * via native tools (get_weather, search_expenses, search_web, get_tasks, etc.).
 */
async function buildContext(db, { action, query, noteId, userContext = null } = {}) {
    // 1. Dedicated Action / Dashboard Button Routing
    if (action === 'daily_briefing') {
        const { getDailyBriefing } = require('./briefingEngine');
        const briefing = await getDailyBriefing({}, db);
        return briefing.executiveSummary;
    }

    if (action === 'news_briefing' || action === 'news_update') {
        const { getNewsBriefing } = require('./newsService');
        const newsResult = await getNewsBriefing({}, db);
        return newsResult.summary;
    }

    if (action === 'focus_today' || action === 'priorities') {
        const [goals, focus, memories] = await Promise.all([
            getGoalsAndProjectsContext(db),
            getFocusContext(db),
            getRelevantMemoriesContext(db),
        ]);
        return [goals, memories, focus].filter(Boolean).join('\n\n');
    }

    if (action === 'summarize_overdue') {
        return await getOverdueContext(db);
    }

    if (action === 'summarize_notes' || action === 'note_to_tasks' || noteId) {
        return await getNotesContext(db, noteId);
    }

    if (action === 'analyze_spending' || action === 'unusual_spending') {
        return await getSpendingContext(db);
    }

    if (action === 'plan_week' || action === 'review_goals' || action === 'falling_through_cracks') {
        return await getPlanningContext(db, query);
    }

    // 2. Baseline Situational Context for Chat & Assistant Conversations
    // Provides ultra-fast situational awareness for the LLM without choking CPU context.
    // Specific lookups (weather, historical purchases, web search, tasks, notes) are handled
    // dynamically and naturally by the LLM via native tools.
    return await getChatBaselineContext(db, query, userContext);
}

/**
 * Lean situational baseline context for general chat and conversational queries.
 * Keeps prompt evaluation fast (~5-15s) while giving the LLM core situational grounding.
 * Specific deep lookups (weather, historical purchases, web facts, tasks, notes) are handled
 * dynamically by the LLM via native tools.
 */
async function getChatBaselineContext(db, query, userContext = null) {
    try {
        const now = new Date();
        const todayStr = toDateKey(now);

        const [memories, overdueTasks, todayTasks, goals, spendingAgg] = await Promise.all([
            // 1. High-importance memories
            db.collection('ai_memories')
                .find({ importance: { $gte: 4 } })
                .sort({ importance: -1, updatedAt: -1 })
                .limit(3)
                .toArray()
                .catch(() => []),

            // 2. Overdue tasks (top 3)
            db.collection('todos')
                .find({ completed: { $ne: true }, dueDate: { $ne: null, $lt: todayStr } })
                .sort({ dueDate: 1 })
                .limit(3)
                .toArray()
                .catch(() => []),

            // 3. Tasks due today
            db.collection('todos')
                .find({ completed: { $ne: true }, dueDate: todayStr })
                .limit(3)
                .toArray()
                .catch(() => []),

            // 4. Active goals
            db.collection('goals')
                .find({ status: 'active' })
                .limit(3)
                .toArray()
                .catch(() => []),

            // 5. Real Financial aggregation across all expenses and income
            Promise.all([
                db.collection('expenses').find().sort({ date: -1 }).toArray().catch(() => []),
                db.collection('income').find().sort({ date: -1 }).toArray().catch(() => []),
            ]).catch(() => [[], []])
        ]);

        const allExpenses = spendingAgg[0] || [];
        const allIncome = spendingAgg[1] || [];

        const totalSpent = allExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
        const totalIncome = allIncome.reduce((sum, i) => sum + (Number(i.value || i.amount) || 0), 0);
        const netBalance = totalIncome - totalSpent;

        const monthlySpending = {};
        for (const exp of allExpenses) {
            if (!exp.date) continue;
            const monthKey = toDateKey(exp.date).slice(0, 7);
            monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (Number(exp.cost) || 0);
        }
        const sortedMonths = Object.entries(monthlySpending)
            .sort((a, b) => b[0].localeCompare(a[0]))
            .slice(0, 8)
            .map(([m, amount]) => `${m}: $${amount.toFixed(2)}`)
            .join(', ');

        const categoryTotals = {};
        for (const exp of allExpenses) {
            const cat = exp.category || 'Uncategorized';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(exp.cost) || 0);
        }
        const topCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([cat, amount]) => `${cat}: $${amount.toFixed(2)} (${Math.round((amount / (totalSpent || 1)) * 100)}%)`)
            .join(', ');

        const sections = [];

        if (memories.length > 0) {
            sections.push(`### IMPORTANT FACTS & MEMORIES:\n${memories.map(m => `- ${m.fact}`).join('\n')}`);
        }

        const taskItems = [];
        for (const t of overdueTasks) {
            taskItems.push(`- [OVERDUE] ${t.title} (Due: ${t.dueDate.slice(0, 10)})`);
        }
        for (const t of todayTasks) {
            taskItems.push(`- [DUE TODAY] ${t.title}`);
        }
        if (taskItems.length > 0) {
            sections.push(`### IMMEDIATE TASK PRIORITIES:\n${taskItems.join('\n')}`);
        }

        if (goals.length > 0) {
            sections.push(`### ACTIVE GOALS:\n${goals.map(g => `- ${g.title}`).join('\n')}`);
        }

        sections.push(`### REAL FINANCIAL RECORDS (All-Time & 2026):
- Net Balance: $${netBalance.toFixed(2)} | Total Spent: $${totalSpent.toFixed(2)} | Total Income: $${totalIncome.toFixed(2)}
- Real 2026 Monthly Spending: ${sortedMonths || 'None recorded'}
- Real Categories & Totals: ${topCategories || 'None recorded'}
- CRITICAL: There are NO expenses for Rent, Healthcare, or Paris. ONLY report the exact categories and amounts listed above.`);

        return sections.join('\n\n');
    } catch (err) {
        console.warn('Baseline context generation warning:', err.message);
        return '';
    }
}

module.exports = {
    buildContext,
    getChatBaselineContext,
    getRelevantMemoriesContext,
    getGoalsAndProjectsContext,
    getPlanningContext,
    getFocusContext,
    getOverdueContext,
    getNotesContext,
    getSpendingContext,
    getWebsiteContentContext,
};
