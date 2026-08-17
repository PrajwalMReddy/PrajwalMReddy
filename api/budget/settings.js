const { connectToDatabase } = require('../../lib/db');
const { requireAuth } = require('../../lib/auth');

const SETTINGS_ID = 'budget_settings';

module.exports = async (req, res) => {
    if (!requireAuth(req, res)) return;

    try {
        const db = await connectToDatabase();
        const collection = db.collection('settings');

        if (req.method === 'GET') {
            const settings = await collection.findOne({ _id: SETTINGS_ID });
            return res.status(200).json({
                meBudgeted: settings?.meBudgeted ?? 0,
                aeBudgeted: settings?.aeBudgeted ?? 0,
                ayanaStartDate: settings?.ayanaStartDate ?? new Date().toISOString(),
            });
        }

        if (req.method === 'PUT') {
            const { meBudgeted, aeBudgeted, ayanaStartDate } = req.body || {};
            const update = { _id: SETTINGS_ID };

            if (meBudgeted !== undefined) update.meBudgeted = Number(meBudgeted);
            if (aeBudgeted !== undefined) update.aeBudgeted = Number(aeBudgeted);
            if (ayanaStartDate !== undefined) update.ayanaStartDate = new Date(ayanaStartDate).toISOString();

            await collection.updateOne(
                { _id: SETTINGS_ID },
                { $set: update },
                { upsert: true }
            );

            const settings = await collection.findOne({ _id: SETTINGS_ID });
            return res.status(200).json({
                meBudgeted: settings.meBudgeted,
                aeBudgeted: settings.aeBudgeted,
                ayanaStartDate: settings.ayanaStartDate,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Settings API error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
