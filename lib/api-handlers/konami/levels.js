const fs = require('fs');
const path = require('path');
const { requireAuth, isAuthenticated } = require('../../auth');
const { connectToDatabase, isMongoInCooldown } = require('../../db');

const DATA_DIR = path.resolve(__dirname, '../../../data');
const FALLBACK_FILE = path.join(DATA_DIR, 'konami', 'levels.json');
const LEGACY_FALLBACK_FILE = path.resolve(__dirname, '../../../public/konami/levels.json');

function ensureDirectoryExists(filePath) {
    const dirname = path.dirname(filePath);
    if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
    }
}

function readLocalFallback() {
    if (fs.existsSync(FALLBACK_FILE)) {
        try {
            const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                return data;
            }
        } catch (fsErr) {
            console.warn('[Konami Levels] Local file fallback read error:', fsErr.message);
        }
    }
    if (fs.existsSync(LEGACY_FALLBACK_FILE)) {
        try {
            const raw = fs.readFileSync(LEGACY_FALLBACK_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) {
                return data;
            }
        } catch (fsErr) {
            console.warn('[Konami Levels] Legacy file read error:', fsErr.message);
        }
    }
    return null;
}

module.exports = async (req, res) => {
    if (req.method === 'GET') {
        // If MongoDB is in cooldown (recently failed), serve local file immediately (0ms)
        if (isMongoInCooldown()) {
            const localData = readLocalFallback();
            if (localData !== null) {
                return res.status(200).json(localData);
            }
            return res.status(200).json([]);
        }

        // 1. Primary source of truth: MongoDB
        try {
            const db = await connectToDatabase();
            const doc = await db.collection('cms_konami').findOne({ $or: [{ _id: 'levels' }, { _id: 'current' }] });
            if (doc) {
                const list = Array.isArray(doc.levels) ? doc.levels : (Array.isArray(doc.data) ? doc.data : null);
                if (list !== null) {
                    return res.status(200).json(list);
                }
            }
        } catch (dbErr) {
            console.warn('[Konami Levels GET] MongoDB fetch error:', dbErr.message);
        }

        // 2. Fallback to local disk file if present
        const localData = readLocalFallback();
        if (localData !== null) {
            return res.status(200).json(localData);
        }

        // 3. Fallback to empty list
        return res.status(200).json([]);
    }

    if (req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        const { levels } = req.body || {};
        if (!Array.isArray(levels)) {
            return res.status(400).json({ error: 'Payload must include an array of levels' });
        }

        // 1. ALWAYS save to local filesystem FIRST so save is instant (< 5ms) and guaranteed
        let fsSaved = false;
        try {
            ensureDirectoryExists(FALLBACK_FILE);
            fs.writeFileSync(FALLBACK_FILE, JSON.stringify(levels, null, 2), 'utf8');
            fsSaved = true;
        } catch (fsErr) {
            console.warn('[Konami Levels POST] Local file save error:', fsErr.message);
        }

        // 2. Try to sync to MongoDB if not in cooldown
        let dbSaved = false;
        if (!isMongoInCooldown()) {
            try {
                const db = await connectToDatabase();
                await Promise.all([
                    db.collection('cms_konami').updateOne(
                        { _id: 'levels' },
                        { $set: { levels, updatedAt: new Date() } },
                        { upsert: true }
                    ),
                    db.collection('cms_konami').updateOne(
                        { _id: 'current' },
                        { $set: { data: levels, updatedAt: new Date() } },
                        { upsert: true }
                    )
                ]);
                dbSaved = true;
            } catch (dbErr) {
                console.warn('[Konami Levels POST] MongoDB save warning:', dbErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            count: levels.length,
            storage: { database: dbSaved, filesystem: fsSaved }
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};

