const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../../auth');
const { connectToDatabase } = require('../../db');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

function sanitizeSlug(slug) {
    if (!slug || typeof slug !== 'string') return null;
    return slug.replace(/[^a-zA-Z0-9_\-\u0C80-\u0CFF]/g, '').trim();
}

function getFallbackMarkdownPath(type, slug) {
    const safeType = type === 'research' ? 'research' : 'blog';
    const safeSlug = sanitizeSlug(slug);
    if (!safeSlug) return null;
    return path.join(PUBLIC_DIR, safeType, `${safeSlug}.md`);
}

module.exports = async (req, res) => {
    const safeType = (req.query?.type || req.body?.type) === 'research' ? 'research' : 'blog';
    const rawSlug = req.query?.slug || req.body?.slug;
    const safeSlug = sanitizeSlug(rawSlug);

    if (req.method === 'GET') {
        if (!rawSlug || !safeSlug) {
            return res.status(400).json({ error: 'Missing or invalid slug parameter' });
        }

        // 1. Primary source: cms_blog or cms_research in MongoDB
        try {
            const db = await connectToDatabase();
            const collectionName = safeType === 'research' ? 'cms_research' : 'cms_blog';
            const doc = await db.collection(collectionName).findOne({ _id: 'current' });
            if (doc && Array.isArray(doc.data)) {
                const item = doc.data.find((p) => p.slug === safeSlug);
                if (item && typeof item.content === 'string') {
                    return res.status(200).json({ content: item.content, exists: true, source: 'database' });
                }
            }
        } catch (dbErr) {
            console.warn(`[CMS Markdown GET] DB fetch error for ${safeType}/${safeSlug}:`, dbErr.message);
        }

        // 2. Emergency fallback to local markdown file if present
        const filePath = getFallbackMarkdownPath(safeType, safeSlug);
        if (filePath && fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return res.status(200).json({ content, exists: true, source: 'filesystem' });
            } catch (fsErr) {
                console.warn('[CMS Markdown GET] Local file fallback error:', fsErr.message);
            }
        }

        return res.status(200).json({ content: '', exists: false });
    }

    if (req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        const { content } = req.body || {};
        if (!safeSlug || content === undefined) {
            return res.status(400).json({ error: 'Valid slug and content are required' });
        }

        try {
            const db = await connectToDatabase();
            const stringContent = String(content);
            const collectionName = safeType === 'research' ? 'cms_research' : 'cms_blog';

            const doc = await db.collection(collectionName).findOne({ _id: 'current' });
            const items = (doc && Array.isArray(doc.data)) ? [...doc.data] : [];
            const existingIndex = items.findIndex((p) => p.slug === safeSlug);

            if (existingIndex >= 0) {
                items[existingIndex] = {
                    ...items[existingIndex],
                    content: stringContent,
                    updatedAt: new Date().toISOString(),
                };
            } else {
                if (safeType === 'research') {
                    items.push({
                        type: 'article',
                        slug: safeSlug,
                        visibility: 'public',
                        image: '',
                        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        en: { sectionTitle: '', title: safeSlug, description: '' },
                        kn: { sectionTitle: '', title: safeSlug, description: '' },
                        content: stringContent,
                        updatedAt: new Date().toISOString(),
                    });
                } else {
                    items.push({
                        slug: safeSlug,
                        title: safeSlug,
                        description: '',
                        date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                        language: 'en',
                        visibility: 'public',
                        source: 'local',
                        type: 'article',
                        content: stringContent,
                        updatedAt: new Date().toISOString(),
                    });
                }
            }

            await db.collection(collectionName).updateOne(
                { _id: 'current' },
                { $set: { data: items, updatedAt: new Date() } },
                { upsert: true }
            );

            return res.status(200).json({
                success: true,
                message: `Markdown saved successfully with ${safeType} in MongoDB`,
                storage: { database: true, filesystem: false },
            });
        } catch (err) {
            console.error(`[CMS Markdown POST] Failed to save markdown for ${safeType}/${safeSlug}:`, err.message);
            return res.status(500).json({ error: `Failed to save markdown: ${err.message}` });
        }
    }

    if (req.method === 'DELETE') {
        if (!requireAuth(req, res)) return;

        if (!safeSlug) {
            return res.status(400).json({ error: 'Valid slug is required' });
        }

        try {
            const db = await connectToDatabase();
            const collectionName = safeType === 'research' ? 'cms_research' : 'cms_blog';
            const doc = await db.collection(collectionName).findOne({ _id: 'current' });
            if (doc && Array.isArray(doc.data)) {
                const items = doc.data.map((p) => (p.slug === safeSlug ? { ...p, content: '' } : p));
                await db.collection(collectionName).updateOne(
                    { _id: 'current' },
                    { $set: { data: items, updatedAt: new Date() } }
                );
            }
            return res.status(200).json({ success: true, message: 'Markdown cleared successfully' });
        } catch (dbErr) {
            console.error('[CMS Markdown DELETE] DB delete error:', dbErr.message);
            return res.status(500).json({ error: 'Failed to delete markdown from database' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
