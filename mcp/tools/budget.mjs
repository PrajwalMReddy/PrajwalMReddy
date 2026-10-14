import { z } from 'zod';
import { createRequire } from 'module';
import { connectToDatabase } from '../db.mjs';

const require = createRequire(import.meta.url);
const { resequenceExpenses, resequenceIncome } = require('../../lib/budgetResequence.js');

const EXPENSES_COLLECTION = 'expenses';
const INCOME_COLLECTION = 'income';

export function registerBudgetTools(server) {
    // 1. Get Budget Summary
    server.tool(
        'get_budget_summary',
        'Retrieve high-level financial summary including total income, total expenses, net balance, and spending breakdown by category',
        {
            year: z.number().int().optional().describe('Filter by specific year (e.g. 2026)'),
            month: z.number().int().min(1).max(12).optional().describe('Filter by specific month (1-12)')
        },
        async ({ year, month }) => {
            const db = await connectToDatabase();
            
            const expenses = await db.collection(EXPENSES_COLLECTION).find({}).toArray();
            const income = await db.collection(INCOME_COLLECTION).find({}).toArray();

            // Filter if year/month specified
            const filterByDate = (docDate) => {
                if (!docDate) return true;
                const d = new Date(docDate);
                if (Number.isNaN(d.getTime())) return true;
                if (year && d.getUTCFullYear() !== year) return false;
                if (month && d.getUTCMonth() + 1 !== month) return false;
                return true;
            };

            const filteredExpenses = expenses.filter(e => filterByDate(e.date));
            const filteredIncome = income.filter(i => filterByDate(i.date));

            const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
            const totalIncome = filteredIncome.reduce((sum, i) => sum + (Number(i.value) || 0), 0);

            // Group expenses by category
            const categoryBreakdown = {};
            filteredExpenses.forEach(e => {
                const cat = e.category || 'Uncategorized';
                categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (Number(e.cost) || 0);
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            period: year ? (month ? `${year}-${String(month).padStart(2, '0')}` : `${year}`) : 'All Time',
                            totalIncome: Number(totalIncome.toFixed(2)),
                            totalExpenses: Number(totalExpenses.toFixed(2)),
                            netBalance: Number((totalIncome - totalExpenses).toFixed(2)),
                            expenseCount: filteredExpenses.length,
                            incomeCount: filteredIncome.length,
                            categoryBreakdown
                        }, null, 2)
                    }
                ]
            };
        }
    );

    // 2. List Expenses
    server.tool(
        'list_expenses',
        'List recorded expense entries with optional category filter',
        {
            category: z.string().optional().describe('Category filter (e.g. Food, Utilities, Travel)'),
            limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum items to return')
        },
        async ({ category, limit }) => {
            const db = await connectToDatabase();
            const filter = {};
            if (category) {
                filter.category = new RegExp(`^${category.trim()}$`, 'i');
            }

            const docs = await db.collection(EXPENSES_COLLECTION)
                .find(filter)
                .sort({ date: -1, serialNumber: -1, _id: -1 })
                .limit(limit)
                .toArray();

            const expenses = docs.map(d => ({
                id: d._id.toString(),
                serialNumber: d.serialNumber,
                item: d.item,
                category: d.category,
                cost: d.cost,
                date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null
            }));

            return {
                content: [{ type: 'text', text: JSON.stringify(expenses, null, 2) }]
            };
        }
    );

    // 3. Add Expense
    server.tool(
        'add_expense',
        'Record a new expense item into the budget tracker',
        {
            item: z.string().min(1).describe('Description of the expense item or purchase'),
            category: z.string().min(1).describe('Category (e.g. Groceries, Tech, Dining, Rent)'),
            cost: z.number().positive().describe('Cost amount (number)'),
            date: z.string().optional().describe('Date of expense in YYYY-MM-DD format (defaults to today)')
        },
        async ({ item, category, cost, date }) => {
            const db = await connectToDatabase();
            const expenseDate = date ? new Date(date) : new Date();

            const doc = {
                date: expenseDate,
                item: item.trim(),
                category: category.trim(),
                cost: Number(cost),
                createdAt: new Date(),
            };

            const result = await db.collection(EXPENSES_COLLECTION).insertOne(doc);
            await resequenceExpenses(db);
            const savedDoc = await db.collection(EXPENSES_COLLECTION).findOne({ _id: result.insertedId });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Expense recorded: "${doc.item}" ($${doc.cost.toFixed(2)}) in category "${doc.category}" with Serial #${savedDoc ? savedDoc.serialNumber : 1} (ID ${result.insertedId.toString()})`
                    }
                ]
            };
        }
    );

    // 4. List Income
    server.tool(
        'list_income',
        'List recorded income sources and payments',
        {
            limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum items to return')
        },
        async ({ limit }) => {
            const db = await connectToDatabase();
            const docs = await db.collection(INCOME_COLLECTION)
                .find({})
                .sort({ date: -1, no: -1, _id: -1 })
                .limit(limit)
                .toArray();

            const income = docs.map(d => ({
                id: d._id.toString(),
                no: d.no,
                item: d.item,
                value: d.value,
                type: d.type || 'other',
                date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null
            }));

            return {
                content: [{ type: 'text', text: JSON.stringify(income, null, 2) }]
            };
        }
    );

    // 5. Add Income
    server.tool(
        'add_income',
        'Record a new income entry into the budget tracker',
        {
            item: z.string().min(1).describe('Source or description of income'),
            value: z.number().positive().describe('Amount received'),
            type: z.enum(['salary', 'freelance', 'investment', 'injection', 'other']).optional().default('other').describe('Type of income'),
            date: z.string().optional().describe('Date received in YYYY-MM-DD format (defaults to today)')
        },
        async ({ item, value, type, date }) => {
            const db = await connectToDatabase();
            const incomeDate = date ? new Date(date) : new Date();

            const doc = {
                date: incomeDate,
                item: item.trim(),
                value: Number(value),
                type: type || 'other',
                createdAt: new Date(),
            };

            const result = await db.collection(INCOME_COLLECTION).insertOne(doc);
            await resequenceIncome(db);
            const savedDoc = await db.collection(INCOME_COLLECTION).findOne({ _id: result.insertedId });

            return {
                content: [
                    {
                        type: 'text',
                        text: `Income recorded: "${doc.item}" ($${doc.value.toFixed(2)}) with No #${savedDoc ? savedDoc.no : 1} (ID ${result.insertedId.toString()})`
                    }
                ]
            };
        }
    );
}
