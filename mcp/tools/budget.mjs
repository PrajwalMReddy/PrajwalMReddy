import { z } from 'zod';
import { createRequire } from 'module';
import { connectToDatabase } from '../db.mjs';

const require = createRequire(import.meta.url);
const { resequenceExpenses, resequenceIncome } = require('../../lib/budgetResequence.js');

const EXPENSES_COLLECTION = 'expenses';
const INCOME_COLLECTION = 'income';

export function registerBudgetTools(server) {
    // 1. Get Budget Trends (Aggregated Monthly Breakdown)
    server.tool(
        'get_budget_trends',
        'Retrieve monthly breakdown and trends of spending and income over time. Primary tool for budget analysis, historical trends, spending patterns, and multi-month comparisons.',
        {
            monthsBack: z.number().int().positive().optional().describe('Number of recent months to include (defaults to all available)'),
            year: z.number().int().optional().describe('Filter trends to a specific year (e.g. 2025 or 2026)')
        },
        async ({ monthsBack, year }) => {
            const db = await connectToDatabase();

            const expenses = await db.collection(EXPENSES_COLLECTION).find({}).toArray();
            const income = await db.collection(INCOME_COLLECTION).find({}).toArray();

            const getMonthKey = (dateVal) => {
                if (!dateVal) return null;
                const d = new Date(dateVal);
                if (Number.isNaN(d.getTime())) return null;
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                return `${y}-${m}`;
            };

            const monthlyMap = new Map();

            const ensureMonth = (monthKey) => {
                if (!monthlyMap.has(monthKey)) {
                    monthlyMap.set(monthKey, {
                        month: monthKey,
                        totalIncome: 0,
                        totalExpenses: 0,
                        netBalance: 0,
                        expenseCount: 0,
                        incomeCount: 0,
                        categories: {}
                    });
                }
                return monthlyMap.get(monthKey);
            };

            for (const e of expenses) {
                const mk = getMonthKey(e.date);
                if (!mk) continue;
                if (year && !mk.startsWith(`${year}-`)) continue;
                const rec = ensureMonth(mk);
                const cost = Number(e.cost) || 0;
                rec.totalExpenses += cost;
                rec.expenseCount += 1;
                const cat = e.category || 'Uncategorized';
                rec.categories[cat] = (rec.categories[cat] || 0) + cost;
            }

            for (const i of income) {
                const mk = getMonthKey(i.date);
                if (!mk) continue;
                if (year && !mk.startsWith(`${year}-`)) continue;
                const rec = ensureMonth(mk);
                const val = Number(i.value) || 0;
                rec.totalIncome += val;
                rec.incomeCount += 1;
            }

            // Sort months chronologically
            let sortedMonths = Array.from(monthlyMap.keys()).sort();

            if (monthsBack && monthsBack > 0) {
                sortedMonths = sortedMonths.slice(-monthsBack);
            }

            let overallIncome = 0;
            let overallExpenses = 0;

            const trends = sortedMonths.map((mk) => {
                const data = monthlyMap.get(mk);
                const net = Number((data.totalIncome - data.totalExpenses).toFixed(2));
                overallIncome += data.totalIncome;
                overallExpenses += data.totalExpenses;

                // Sort categories by highest spend
                const topCategories = Object.entries(data.categories)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .reduce((acc, [k, v]) => {
                        acc[k] = Number(v.toFixed(2));
                        return acc;
                    }, {});

                return {
                    month: mk,
                    totalIncome: Number(data.totalIncome.toFixed(2)),
                    totalExpenses: Number(data.totalExpenses.toFixed(2)),
                    netBalance: net,
                    expenseCount: data.expenseCount,
                    incomeCount: data.incomeCount,
                    topCategories
                };
            });

            const result = {
                summary: {
                    period: year ? `Year ${year}` : (monthsBack ? `Last ${monthsBack} months` : 'All Time'),
                    totalMonths: trends.length,
                    totalIncome: Number(overallIncome.toFixed(2)),
                    totalExpenses: Number(overallExpenses.toFixed(2)),
                    netBalance: Number((overallIncome - overallExpenses).toFixed(2)),
                    averageMonthlyExpenses: trends.length ? Number((overallExpenses / trends.length).toFixed(2)) : 0,
                    averageMonthlyIncome: trends.length ? Number((overallIncome / trends.length).toFixed(2)) : 0
                },
                monthlyTrends: trends
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        }
    );

    // 2. Get Budget Summary
    server.tool(
        'get_budget_summary',
        'Retrieve high-level financial summary including total income, total expenses, net balance, and spending breakdown by category for all-time or a specific year/month. For historical multi-month trends, use get_budget_trends instead.',
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

    // 3. List Expenses
    server.tool(
        'list_expenses',
        'List detailed individual expense entries. Use for looking up specific transactions, receipts, or items within a date range or category. For overall budget analysis or trends, use get_budget_trends instead.',
        {
            category: z.string().optional().describe('Category filter (e.g. Food, Utilities, Travel)'),
            startDate: z.string().optional().describe('Filter expenses on or after this date (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Filter expenses on or before this date (YYYY-MM-DD)'),
            year: z.number().int().optional().describe('Filter by specific year (e.g. 2026)'),
            month: z.number().int().min(1).max(12).optional().describe('Filter by specific month (1-12)'),
            limit: z.number().int().min(1).max(500).optional().default(50).describe('Maximum items to return (default 50, max 500)'),
            skip: z.number().int().min(0).optional().default(0).describe('Number of items to skip for pagination')
        },
        async ({ category, startDate, endDate, year, month, limit, skip }) => {
            const db = await connectToDatabase();
            const filterConditions = [];

            if (category) {
                filterConditions.push({ category: new RegExp(`^${category.trim()}$`, 'i') });
            }

            if (year && month) {
                const sDate = new Date(Date.UTC(year, month - 1, 1));
                const eDate = new Date(Date.UTC(year, month, 1));
                const sStr = `${year}-${String(month).padStart(2, '0')}-01`;
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const eStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
                filterConditions.push({
                    $or: [
                        { date: { $gte: sDate, $lt: eDate } },
                        { date: { $gte: sStr, $lt: eStr } }
                    ]
                });
            } else if (year) {
                const sDate = new Date(Date.UTC(year, 0, 1));
                const eDate = new Date(Date.UTC(year + 1, 0, 1));
                const sStr = `${year}-01-01`;
                const eStr = `${year + 1}-01-01`;
                filterConditions.push({
                    $or: [
                        { date: { $gte: sDate, $lt: eDate } },
                        { date: { $gte: sStr, $lt: eStr } }
                    ]
                });
            } else if (startDate || endDate) {
                if (startDate) {
                    const sDate = new Date(startDate);
                    filterConditions.push({
                        $or: [
                            { date: { $gte: sDate } },
                            { date: { $gte: startDate } }
                        ]
                    });
                }
                if (endDate) {
                    const eDate = new Date(endDate);
                    eDate.setUTCHours(23, 59, 59, 999);
                    filterConditions.push({
                        $or: [
                            { date: { $lte: eDate } },
                            { date: { $lte: endDate } }
                        ]
                    });
                }
            }

            const filter = filterConditions.length > 0 ? { $and: filterConditions } : {};

            const totalMatches = await db.collection(EXPENSES_COLLECTION).countDocuments(filter);
            const docs = await db.collection(EXPENSES_COLLECTION)
                .find(filter)
                .sort({ date: -1, serialNumber: -1, _id: -1 })
                .skip(skip)
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
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        totalMatches,
                        returnedCount: expenses.length,
                        offset: skip,
                        hasMore: skip + expenses.length < totalMatches,
                        expenses
                    }, null, 2)
                }]
            };
        }
    );

    // 4. Add Expense
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

    // 5. List Income
    server.tool(
        'list_income',
        'List recorded income sources and payments. For overall budget trends, use get_budget_trends instead.',
        {
            startDate: z.string().optional().describe('Filter income on or after this date (YYYY-MM-DD)'),
            endDate: z.string().optional().describe('Filter income on or before this date (YYYY-MM-DD)'),
            year: z.number().int().optional().describe('Filter by specific year (e.g. 2026)'),
            month: z.number().int().min(1).max(12).optional().describe('Filter by specific month (1-12)'),
            limit: z.number().int().min(1).max(500).optional().default(50).describe('Maximum items to return (default 50, max 500)'),
            skip: z.number().int().min(0).optional().default(0).describe('Number of items to skip for pagination')
        },
        async ({ startDate, endDate, year, month, limit, skip }) => {
            const db = await connectToDatabase();
            const filterConditions = [];

            if (year && month) {
                const sDate = new Date(Date.UTC(year, month - 1, 1));
                const eDate = new Date(Date.UTC(year, month, 1));
                const sStr = `${year}-${String(month).padStart(2, '0')}-01`;
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                const eStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
                filterConditions.push({
                    $or: [
                        { date: { $gte: sDate, $lt: eDate } },
                        { date: { $gte: sStr, $lt: eStr } }
                    ]
                });
            } else if (year) {
                const sDate = new Date(Date.UTC(year, 0, 1));
                const eDate = new Date(Date.UTC(year + 1, 0, 1));
                const sStr = `${year}-01-01`;
                const eStr = `${year + 1}-01-01`;
                filterConditions.push({
                    $or: [
                        { date: { $gte: sDate, $lt: eDate } },
                        { date: { $gte: sStr, $lt: eStr } }
                    ]
                });
            } else if (startDate || endDate) {
                if (startDate) {
                    const sDate = new Date(startDate);
                    filterConditions.push({
                        $or: [
                            { date: { $gte: sDate } },
                            { date: { $gte: startDate } }
                        ]
                    });
                }
                if (endDate) {
                    const eDate = new Date(endDate);
                    eDate.setUTCHours(23, 59, 59, 999);
                    filterConditions.push({
                        $or: [
                            { date: { $lte: eDate } },
                            { date: { $lte: endDate } }
                        ]
                    });
                }
            }

            const filter = filterConditions.length > 0 ? { $and: filterConditions } : {};

            const totalMatches = await db.collection(INCOME_COLLECTION).countDocuments(filter);
            const docs = await db.collection(INCOME_COLLECTION)
                .find(filter)
                .sort({ date: -1, no: -1, _id: -1 })
                .skip(skip)
                .limit(limit)
                .toArray();

            const income = docs.map(d => ({
                id: d._id.toString(),
                no: d.no,
                item: d.item,
                value: d.value,
                type: d.type === 'income' ? 'income' : (d.type === 'injection' ? 'injection' : 'repayment'),
                date: d.date ? new Date(d.date).toISOString().slice(0, 10) : null
            }));

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        totalMatches,
                        returnedCount: income.length,
                        offset: skip,
                        hasMore: skip + income.length < totalMatches,
                        income
                    }, null, 2)
                }]
            };
        }
    );

    // 6. Add Income
    server.tool(
        'add_income',
        'Record a new income entry into the budget tracker',
        {
            item: z.string().min(1).describe('Source or description of income'),
            value: z.number().positive().describe('Amount received'),
            type: z.enum(['salary', 'freelance', 'investment', 'injection', 'income', 'repayment', 'other']).optional().default('repayment').describe('Type of income'),
            date: z.string().optional().describe('Date received in YYYY-MM-DD format (defaults to today)')
        },
        async ({ item, value, type, date }) => {
            const db = await connectToDatabase();
            const incomeDate = date ? new Date(date) : new Date();

            const doc = {
                date: incomeDate,
                item: item.trim(),
                value: Number(value),
                type: type === 'income' ? 'income' : (type === 'injection' ? 'injection' : 'repayment'),
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
