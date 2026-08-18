const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { computeBudgetStats } = require('../../lib/budgetStats');

// Tracking start date is fixed.
const AYANA_START_DATE = '2024-07-01T00:00:00.000Z';

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getCurrentAyanaNumber(startDateStr) {
    const start = new Date(startDateStr);
    const now = new Date();
    const monthsDiff =
        (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth());
    return Math.max(1, Math.floor(monthsDiff / 6) + 1);
}

// ME Budgeted = sum of every monthly budget entry, across all plans, for
// months from the start of tracking through the end of the current month.
// AE Budgeted = sum of every ayana's budgeted total, across all plans, for
// ayanas from the start of tracking through the end of the current ayana.
async function computeBudgetedTotals(db) {
    const plans = await db.collection('budgetPlans').find().toArray();
    const currentMonthKey = getCurrentMonthKey();
    const currentAyanaNumber = getCurrentAyanaNumber(AYANA_START_DATE);

    let meBudgeted = 0;
    let aeBudgeted = 0;

    plans.forEach((plan) => {
        const monthlyBudgeted = plan.monthlyBudgeted || {};
        Object.keys(monthlyBudgeted).forEach((month) => {
            if (month <= currentMonthKey) {
                meBudgeted += Number(monthlyBudgeted[month]) || 0;
            }
        });

        if ((plan.ayanaNumber || 0) <= currentAyanaNumber) {
            aeBudgeted += Number(plan.ayanaBudgeted) || 0;
        }
    });

    return { meBudgeted, aeBudgeted };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = await connectToDatabase();
        const [expenses, income, budgetedTotals] = await Promise.all([
            db.collection('expenses').find().toArray(),
            db.collection('income').find().toArray(),
            computeBudgetedTotals(db),
        ]);

        const stats = computeBudgetStats(expenses, income, {
            ...budgetedTotals,
            ayanaStartDate: AYANA_START_DATE,
        });
        return res.status(200).json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
