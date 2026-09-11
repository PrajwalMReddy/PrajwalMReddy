const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../../auth');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');
const ALLOWED_FOLDERS = ['photography', 'img', 'blog', 'research'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];

const MIME_MAP = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif',
};

function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return null;
    const base = path.basename(filename);
    const cleaned = base.replace(/[^a-zA-Z0-9_\-\.]/g, '_').toLowerCase();
    const ext = path.extname(cleaned);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return null;
    }
    return cleaned;
}

module.exports = async (req, res) => {
    const { folder, file, filename: queryFilename } = req.query || {};
    const safeFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'photography';

    // Image serving if requested via API
    if (req.method === 'GET' && (file || queryFilename)) {
        const rawTarget = file || queryFilename;
        const targetFilename = sanitizeFilename(rawTarget);
        if (!targetFilename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const ext = path.extname(targetFilename).toLowerCase();
        const mimeType = MIME_MAP[ext] || 'application/octet-stream';
        const localPath = path.join(PUBLIC_DIR, safeFolder, targetFilename);

        if (fs.existsSync(localPath)) {
            try {
                const data = fs.readFileSync(localPath);
                res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                return res.status(200).send(data);
            } catch (fsErr) {
                console.warn(`[CMS Upload] Failed reading local file:`, fsErr.message);
            }
        }

        return res.status(404).json({ error: 'Image not found' });
    }

    // Auth required for library listing and mutations
    if (!requireAuth(req, res)) return;

    // Library listing: GET /api/cms/upload?folder=...
    if (req.method === 'GET') {
        const targetDir = path.join(PUBLIC_DIR, safeFolder);
        if (!fs.existsSync(targetDir)) {
            return res.status(200).json({ images: [] });
        }

        try {
            const files = fs.readdirSync(targetDir);
            const images = files
                .filter((f) => ALLOWED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
                .map((f) => {
                    try {
                        const stats = fs.statSync(path.join(targetDir, f));
                        return {
                            filename: f,
                            url: `/${safeFolder}/${f}`,
                            size: stats.size,
                            mtime: stats.mtime,
                        };
                    } catch {
                        return {
                            filename: f,
                            url: `/${safeFolder}/${f}`,
                            size: 0,
                            mtime: new Date(),
                        };
                    }
                })
                .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

            return res.status(200).json({ images });
        } catch (err) {
            console.warn('[CMS Upload GET] Local directory read skipped:', err.message);
            return res.status(200).json({ images: [] });
        }
    }

    // Upload: POST /api/cms/upload
    if (req.method === 'POST') {
        const { folder: bodyFolder, filename: bodyFilename, data } = req.body || {};

        if (!data) {
            return res.status(400).json({ error: 'Image data (base64) is required' });
        }

        const currentFolder = ALLOWED_FOLDERS.includes(bodyFolder) ? bodyFolder : safeFolder;
        const rawFilename = bodyFilename || `upload-${Date.now()}.jpeg`;
        const safeFilename = sanitizeFilename(rawFilename);

        if (!safeFilename) {
            return res.status(400).json({
                error: `Invalid file extension. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}`,
            });
        }

        try {
            const base64Data = data.includes(';base64,') ? data.split(';base64,').pop() : data;
            const buffer = Buffer.from(base64Data, 'base64');

            const targetDir = path.join(PUBLIC_DIR, currentFolder);
            fs.mkdirSync(targetDir, { recursive: true });
            const targetPath = path.join(targetDir, safeFilename);
            fs.writeFileSync(targetPath, buffer);

            const url = `/${currentFolder}/${safeFilename}`;

            return res.status(200).json({
                success: true,
                filename: safeFilename,
                url,
                size: buffer.length,
                message: 'Image uploaded successfully to static storage',
            });
        } catch (err) {
            if (err.code === 'EROFS' || err.code === 'EACCES') {
                return res.status(400).json({
                    error: 'Filesystem is read-only in this deployment. Please use the "Image URL" tab to paste an external image URL (e.g. Unsplash, Imgur, Cloudinary) or select from the Library.',
                });
            }
            console.error('[CMS Upload POST] Error saving image file:', err);
            return res.status(500).json({ error: `Failed to save image: ${err.message}` });
        }
    }

    // Delete: DELETE /api/cms/upload
    if (req.method === 'DELETE') {
        const { folder: bodyFolder, filename: bodyFilename } = req.query || req.body || {};
        const currentFolder = ALLOWED_FOLDERS.includes(bodyFolder) ? bodyFolder : safeFolder;
        const safeFilename = sanitizeFilename(bodyFilename);

        if (!safeFilename) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(PUBLIC_DIR, currentFolder, safeFilename);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                return res.status(200).json({ success: true, message: 'Local image deleted' });
            } catch (err) {
                if (err.code === 'EROFS' || err.code === 'EACCES') {
                    return res.status(400).json({ error: 'Cannot delete bundled image in read-only deployment' });
                }
                console.error('[CMS Upload DELETE] Error deleting local image:', err);
                return res.status(500).json({ error: 'Failed to delete image' });
            }
        }

        return res.status(404).json({ error: 'Image not found' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
