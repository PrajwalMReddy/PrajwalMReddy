const fs = require('fs');
const path = require('path');
const { requireAuth, isAuthenticated } = require('../../auth');
const { connectToDatabase, isMongoInCooldown } = require('../../db');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
const DATA_DIR = path.resolve(__dirname, '../../../data');

function getCollectionName(type) {
    switch (type) {
        case 'projects':
            return 'cms_projects';
        case 'experiences':
        case 'experience':
            return 'cms_experiences';
        case 'blog':
            return 'cms_blog';
        case 'quotes':
        case 'blog-quotes':
            return 'cms_quotes';
        case 'research':
            return 'cms_research';
        case 'photography':
            return 'cms_photography';
        case 'konami':
        case 'levels':
            return 'cms_konami';
        default:
            return null;
    }
}

function getFallbackFilePath(type) {
    switch (type) {
        case 'projects':
            return path.join(PUBLIC_DIR, 'projects', 'metadata.json');
        case 'experiences':
        case 'experience':
            return path.join(PUBLIC_DIR, 'experience', 'metadata.json');
        case 'blog':
            return path.join(PUBLIC_DIR, 'blog', '_metadata.json');
        case 'quotes':
        case 'blog-quotes':
            return path.join(PUBLIC_DIR, 'blog', 'quotes.json');
        case 'research':
            return path.join(PUBLIC_DIR, 'research', 'metadata.json');
        case 'photography':
            return path.join(PUBLIC_DIR, 'photography', 'metadata.json');
        case 'konami':
        case 'levels':
            return path.join(DATA_DIR, 'konami', 'levels.json');
        default:
            return null;
    }
}

function readLocalFallback(type, authed) {
    const filePath = getFallbackFilePath(type);
    if (filePath && fs.existsSync(filePath)) {
        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            let data = JSON.parse(raw);
            if (!authed && Array.isArray(data)) {
                data = data.filter((item) => !item.visibility || item.visibility === 'public');
            }
            return data;
        } catch (fsErr) {
            console.warn(`[CMS Content] Local file fallback read error for ${type}:`, fsErr.message);
        }
    }
    return null;
}

module.exports = async (req, res) => {
    const { type } = req.query || {};

    if (req.method === 'GET') {
        if (!type) {
            return res.status(400).json({ error: 'Missing type query parameter' });
        }

        const collectionName = getCollectionName(type);
        if (!collectionName) {
            return res.status(400).json({ error: `Invalid content type: ${type}` });
        }

        const authed = isAuthenticated(req);

        // If MongoDB is in cooldown, serve local file immediately
        if (isMongoInCooldown()) {
            const localData = readLocalFallback(type, authed);
            if (localData !== null) {
                return res.status(200).json(localData);
            }
            const fallback = type === 'projects' || type === 'experiences' ? { sections: [], [type]: [] } : [];
            return res.status(200).json(fallback);
        }

        // 1. Primary source of truth: MongoDB
        try {
            const db = await connectToDatabase();
            const doc = await db.collection(collectionName).findOne({ _id: 'current' });
            if (doc && doc.data !== undefined) {
                let result = doc.data;
                if (!authed && Array.isArray(result)) {
                    result = result.filter((item) => !item.visibility || item.visibility === 'public');
                }
                return res.status(200).json(result);
            }
        } catch (dbErr) {
            console.warn(`[CMS Content GET] MongoDB fetch error for ${type}:`, dbErr.message);
        }

        // 2. Emergency fallback to local disk file if present
        const localData = readLocalFallback(type, authed);
        if (localData !== null) {
            return res.status(200).json(localData);
        }

        // 3. Fallback default structure
        const fallback = type === 'projects' || type === 'experiences' ? { sections: [], [type]: [] } : [];
        return res.status(200).json(fallback);
    }

    if (req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        const { type: bodyType, data } = req.body || {};
        const contentType = bodyType || type;

        if (!contentType || data === undefined) {
            return res.status(400).json({ error: 'contentType and data are required' });
        }

        const collectionName = getCollectionName(contentType);
        if (!collectionName) {
            return res.status(400).json({ error: `Invalid content type: ${contentType}` });
        }

        // Unify legacy { en, kn } photography data if received
        let payload = data;
        if (contentType === 'photography' && !Array.isArray(data) && data && (data.en || data.kn)) {
            const enList = data.en || [];
            const knList = data.kn || [];
            payload = enList.map((enItem, idx) => {
                const knItem = knList.find((k) => k.filename === enItem.filename) || knList[idx] || {};
                return {
                    id: enItem.id || (enItem.filename ? enItem.filename.replace(/\.[^/.]+$/, '') : `photo-${idx}`),
                    filename: enItem.filename || '',
                    title: { en: enItem.title || '', kn: knItem.title || '' },
                    date: { en: enItem.date || '', kn: knItem.date || '' },
                    location: {
                        place: {
                            en: enItem.location?.place || '',
                            kn: knItem.location?.place || '',
                        },
                        lat: enItem.location?.lat ?? knItem.location?.lat ?? null,
                        lng: enItem.location?.lng ?? knItem.location?.lng ?? null,
                    },
                };
            });
        }

        // 1. ALWAYS save to local disk FIRST so save completes instantly
        const filePath = getFallbackFilePath(contentType);
        let fsSaved = false;
        if (filePath) {
            try {
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
                fsSaved = true;
            } catch (fsErr) {
                console.warn(`[CMS Content POST] Local file save error for ${contentType}:`, fsErr.message);
            }
        }

        // 2. Save to MongoDB if not in cooldown
        let dbSaved = false;
        if (!isMongoInCooldown()) {
            try {
                const db = await connectToDatabase();
                await db.collection(collectionName).updateOne(
                    { _id: 'current' },
                    { $set: { data: payload, updatedAt: new Date() } },
                    { upsert: true }
                );
                dbSaved = true;
            } catch (err) {
                console.warn(`[CMS Content POST] MongoDB save error for ${contentType}:`, err.message);
            }
        }

        if (dbSaved || fsSaved) {
            return res.status(200).json({
                success: true,
                message: `${contentType} saved successfully`,
                storage: { database: dbSaved, filesystem: fsSaved },
            });
        }

        return res.status(500).json({ error: `Failed to save ${contentType} content to database or local disk` });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
