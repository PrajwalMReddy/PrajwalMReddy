const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');
const { computeBudgetStats } = require('../../lib/budgetStats');

const SETTINGS_ID = 'budget_settings';

async function getSettings(db) {
    const settings = await db.collection('settings').findOne({ _id: SETTINGS_ID });
    return settings || {
        _id: SETTINGS_ID,
        meBudgeted: 0,
        aeBudgeted: 0,
        ayanaStartDate: new Date().toISOString(),
    };
}

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const db = await connectToDatabase();
        const [expenses, income, settings] = await Promise.all([
            db.collection('expenses').find().toArray(),
            db.collection('income').find().toArray(),
            getSettings(db),
        ]);

        const stats = computeBudgetStats(expenses, income, settings);
        return res.status(200).json(stats);
    } catch (error) {
        console.error('Stats API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
