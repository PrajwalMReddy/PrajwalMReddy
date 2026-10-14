import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { connectToDatabase } from './db.mjs';

export function registerResources(server) {
    // 1. Resource: Active Todos
    server.resource(
        'active-todos',
        'website://todos/active',
        {
            description: 'List of all active/pending tasks from the dashboard',
            mimeType: 'application/json'
        },
        async (uri) => {
            const db = await connectToDatabase();
            const todos = await db.collection('todos')
                .find({ completed: { $ne: true } })
                .sort({ dueDate: 1, priority: 1, order: 1 })
                .toArray();

            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify(todos, null, 2),
                        mimeType: 'application/json'
                    }
                ]
            };
        }
    );

    // 2. Resource: Recent Notes Summary
    server.resource(
        'recent-notes',
        'website://notes/recent',
        {
            description: 'Recent and pinned notes stored on the personal website',
            mimeType: 'text/markdown'
        },
        async (uri) => {
            const db = await connectToDatabase();
            const notes = await db.collection('notes')
                .find({ archived: { $ne: true } })
                .sort({ pinned: -1, updatedAt: -1 })
                .limit(20)
                .toArray();

            let md = '# Recent & Pinned Notes\n\n';
            for (const note of notes) {
                md += `## ${note.pinned ? '📌 ' : ''}${note.title}\n`;
                if (note.folder) md += `*Folder: ${note.folder}*\n`;
                if (Array.isArray(note.tags) && note.tags.length > 0) md += `*Tags: ${note.tags.join(', ')}*\n`;
                md += `\n${note.content || '(No content)'}\n\n---\n\n`;
            }

            return {
                contents: [
                    {
                        uri: uri.href,
                        text: md,
                        mimeType: 'text/markdown'
                    }
                ]
            };
        }
    );

    // 3. Resource: Budget Summary
    server.resource(
        'budget-summary',
        'website://budget/summary',
        {
            description: 'Current budget financial status and totals',
            mimeType: 'application/json'
        },
        async (uri) => {
            const db = await connectToDatabase();
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

            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify(summary, null, 2),
                        mimeType: 'application/json'
                    }
                ]
            };
        }
    );

    // 4. Resource: Pending CRM Follow-ups
    server.resource(
        'crm-followups',
        'website://crm/followups',
        {
            description: 'List of contacts with overdue or upcoming follow-up dates',
            mimeType: 'application/json'
        },
        async (uri) => {
            const db = await connectToDatabase();
            const todayStr = new Date().toISOString().slice(0, 10);
            const contacts = await db.collection('networking_people')
                .find({
                    nextFollowUpAt: { $exists: true, $ne: null },
                    followUpStatus: { $ne: 'completed' }
                })
                .sort({ nextFollowUpAt: 1 })
                .toArray();

            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify(contacts, null, 2),
                        mimeType: 'application/json'
                    }
                ]
            };
        }
    );
}
