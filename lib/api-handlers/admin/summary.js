const { connectToDatabase } = require('../../db');
const { requireAuth } = require('../../auth');

const parseDateOnly = (value) => {
    if (!value) return null;
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
};

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = await connectToDatabase();
        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

        // Run queries in parallel
        const [
            allTodos,
            allNotes,
            expenses,
            income,
            cmsProjectsDoc,
            cmsBlogDocs,
            cmsExperiencesDoc,
            cmsResearchDocs,
            cmsKonamiDoc,
        ] = await Promise.all([
            db.collection('todos').find({}).toArray().catch(() => []),
            db.collection('notes').find({ archived: { $ne: true } }).sort({ updatedAt: -1, _id: -1 }).toArray().catch(() => []),
            db.collection('expenses').find({}).toArray().catch(() => []),
            db.collection('income').find({}).toArray().catch(() => []),
            db.collection('cms_projects').findOne({}).catch(() => null),
            db.collection('cms_blog').find({}).toArray().catch(() => []),
            db.collection('cms_experiences').findOne({}).catch(() => null),
            db.collection('cms_research').find({}).toArray().catch(() => []),
            db.collection('cms_konami').findOne({ _id: 'levels' }).catch(() => null),
        ]);

        // Process Todos
        let completedCount = 0;
        let pendingCount = 0;
        let highPriorityCount = 0;
        let overdueCount = 0;
        const pendingList = [];

        for (const todo of allTodos) {
            const isCompleted = Boolean(todo.completed);
            if (isCompleted) {
                completedCount += 1;
            } else {
                pendingCount += 1;
                if (todo.priority === 'high') {
                    highPriorityCount += 1;
                }

                let isOverdue = false;
                if (todo.dueDate) {
                    const dueDate = parseDateOnly(todo.dueDate);
                    if (dueDate && dueDate < todayUtc) {
                        isOverdue = true;
                        overdueCount += 1;
                    }
                }

                pendingList.push({
                    id: todo._id ? todo._id.toString() : (todo.id || ''),
                    text: todo.text || todo.title || '',
                    completed: false,
                    priority: todo.priority || 'medium',
                    dueDate: todo.dueDate || null,
                    isOverdue,
                    tags: Array.isArray(todo.tags) ? todo.tags : [],
                });
            }
        }

        // Sort pending list: overdue first, then by dueDate, then high priority
        pendingList.sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            if (a.dueDate && b.dueDate) {
                return a.dueDate.localeCompare(b.dueDate);
            }
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            const priorityScore = { high: 1, medium: 2, low: 3 };
            return (priorityScore[a.priority] || 2) - (priorityScore[b.priority] || 2);
        });

        // Process Notes
        const folderSet = new Set();
        const recentNotes = [];
        for (let i = 0; i < allNotes.length; i += 1) {
            const note = allNotes[i];
            if (note.folder) folderSet.add(note.folder);
            if (i < 4) {
                // Strip HTML, markdown, and extra whitespace for clean snippet
                const cleanContent = String(note.content || '')
                    .replace(/<[^>]*>/g, ' ')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/[#*`_~>[\]()]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                recentNotes.push({
                    id: note._id ? note._id.toString() : (note.id || ''),
                    title: note.title || 'Untitled Note',
                    folder: note.folder || '',
                    snippet: cleanContent.slice(0, 110),
                    updatedAt: note.updatedAt ? new Date(note.updatedAt).toISOString() : null,
                });
            }
        }

        // Process Budget
        const totalExpenses = expenses.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
        const totalIncome = income.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
        const netBalance = totalIncome - totalExpenses;

        // Process CMS
        let projectsCount = 0;
        if (cmsProjectsDoc) {
            if (Array.isArray(cmsProjectsDoc.projects)) {
                projectsCount = cmsProjectsDoc.projects.length;
            } else if (Array.isArray(cmsProjectsDoc)) {
                projectsCount = cmsProjectsDoc.length;
            }
        }

        let experiencesCount = 0;
        if (cmsExperiencesDoc) {
            if (Array.isArray(cmsExperiencesDoc.experiences)) {
                experiencesCount = cmsExperiencesDoc.experiences.length;
            } else if (Array.isArray(cmsExperiencesDoc)) {
                experiencesCount = cmsExperiencesDoc.length;
            }
        }

        const blogCount = Array.isArray(cmsBlogDocs) ? cmsBlogDocs.length : 0;
        const researchCount = Array.isArray(cmsResearchDocs) ? cmsResearchDocs.length : 0;

        // Process Konami
        let customLevelsCount = 0;
        if (cmsKonamiDoc && Array.isArray(cmsKonamiDoc.levels)) {
            customLevelsCount = cmsKonamiDoc.levels.length;
        }

        return res.status(200).json({
            todos: {
                total: allTodos.length,
                completed: completedCount,
                pending: pendingCount,
                highPriority: highPriorityCount,
                overdue: overdueCount,
                recentPending: pendingList.slice(0, 5),
            },
            notes: {
                total: allNotes.length,
                foldersCount: folderSet.size,
                recentNotes,
            },
            budget: {
                totalIncome,
                totalExpenses,
                netBalance,
                expenseCount: expenses.length,
                incomeCount: income.length,
            },
            cms: {
                projects: projectsCount,
                blog: blogCount,
                experiences: experiencesCount,
                research: researchCount,
                totalItems: projectsCount + blogCount + experiencesCount + researchCount,
            },
            konami: {
                levelsCount: customLevelsCount,
            },
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to generate admin summary' });
    }
};
