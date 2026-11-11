/**
 * Database Management Service
 * Provides MongoDB storage metrics, backup export, and backup restore utilities
 * for personal_dashboard database.
 */

const { connectToDatabase } = require('../lib/db');
const { ObjectId, BSON } = require('mongodb');

// Standard MongoDB Atlas M0 free tier limit: 512 MB
const DEFAULT_STORAGE_LIMIT_MB = 512;

// Collections that use custom string IDs rather than auto-generated ObjectIds
const STRING_ID_COLLECTIONS = new Set([
    'dashboard_settings',
    'cms_konami',
    'cms_experiences',
    'cms_projects',
    'cms_quotes',
    'cms_photography',
    'cms_home',
]);

/**
 * Assign user-friendly categories and display names to collections
 */
function getCollectionMetadata(name) {
    if (name.startsWith('cms_')) {
        const subtype = name.replace('cms_', '');
        return {
            category: 'CMS',
            label: `CMS: ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`,
            icon: 'cms',
        };
    }
    if (name.startsWith('assistant_')) {
        const subtype = name.replace('assistant_', '');
        return {
            category: 'Assistant',
            label: `Assistant: ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`,
            icon: 'assistant',
        };
    }
    if (name.startsWith('oauth_')) {
        const subtype = name.replace('oauth_', '');
        return {
            category: 'OAuth & MCP',
            label: `OAuth: ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`,
            icon: 'oauth',
        };
    }
    if (name.startsWith('networking_')) {
        const subtype = name.replace('networking_', '');
        return {
            category: 'Networking',
            label: `Networking: ${subtype.charAt(0).toUpperCase() + subtype.slice(1)}`,
            icon: 'networking',
        };
    }

    switch (name) {
        case 'todos':
            return { category: 'Tasks', label: 'Todos & Tasks', icon: 'todo' };
        case 'notes':
            return { category: 'Notes', label: 'Notes & Documents', icon: 'notes' };
        case 'expenses':
            return { category: 'Budget', label: 'Budget: Expenses', icon: 'budget' };
        case 'income':
            return { category: 'Budget', label: 'Budget: Income', icon: 'budget' };
        case 'budget_plans':
            return { category: 'Budget', label: 'Budget: Ayana Plans', icon: 'budget' };
        case 'dashboard_settings':
            return { category: 'Settings', label: 'Dashboard Settings', icon: 'settings' };
        default:
            return {
                category: 'General',
                label: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                icon: 'database',
            };
    }
}

/**
 * Format bytes to human readable string (KB, MB, GB)
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Retrieve database storage statistics, collection metrics, and MongoDB Atlas capacity info.
 */
async function getDatabaseStats() {
    const db = await connectToDatabase();
    const dbName = db.databaseName || process.env.MONGODB_DB || 'personal_dashboard';

    // 1. Fetch cluster / db stats
    const rawDbStats = await db.command({ dbStats: 1 });

    // 2. Determine storage limit (default 512 MB for MongoDB Atlas M0 Free Tier)
    const limitMB = process.env.MONGODB_STORAGE_LIMIT_MB
        ? parseFloat(process.env.MONGODB_STORAGE_LIMIT_MB)
        : DEFAULT_STORAGE_LIMIT_MB;
    const limitBytes = limitMB * 1024 * 1024;

    // 3. Query all collections
    const collectionsList = await db.listCollections().toArray();
    const userCollections = collectionsList.filter((c) => !c.name.startsWith('system.'));

    let totalDocsCalculated = 0;
    const collectionsDetail = [];

    for (const col of userCollections) {
        try {
            const cStats = await db.command({ collStats: col.name });
            const meta = getCollectionMetadata(col.name);
            totalDocsCalculated += cStats.count || 0;

            collectionsDetail.push({
                name: col.name,
                label: meta.label,
                category: meta.category,
                icon: meta.icon,
                count: cStats.count || 0,
                sizeBytes: cStats.size || 0,
                storageSizeBytes: cStats.storageSize || 0,
                indexSizeBytes: cStats.totalIndexSize || cStats.indexSize || 0,
                avgObjSizeBytes: cStats.avgObjSize || 0,
                sizeFormatted: formatBytes(cStats.size || 0),
                storageSizeFormatted: formatBytes(cStats.storageSize || 0),
            });
        } catch (_) {
            // Fallback for collections where collStats fails
            const count = await db.collection(col.name).countDocuments().catch(() => 0);
            totalDocsCalculated += count;
            const meta = getCollectionMetadata(col.name);
            collectionsDetail.push({
                name: col.name,
                label: meta.label,
                category: meta.category,
                icon: meta.icon,
                count,
                sizeBytes: 0,
                storageSizeBytes: 0,
                indexSizeBytes: 0,
                avgObjSizeBytes: 0,
                sizeFormatted: '0 B',
                storageSizeFormatted: '0 B',
            });
        }
    }

    // Sort collections by storage size descending, then count descending
    collectionsDetail.sort((a, b) => b.storageSizeBytes - a.storageSizeBytes || b.count - a.count);

    const dataSizeBytes = rawDbStats.dataSize || 0;
    const storageSizeBytes = rawDbStats.storageSize || 0;
    const indexSizeBytes = rawDbStats.indexSize || 0;
    const totalUsedBytes = storageSizeBytes + indexSizeBytes;
    const remainingBytes = Math.max(0, limitBytes - totalUsedBytes);
    const usedPercentage = Math.min(100, (totalUsedBytes / limitBytes) * 100);

    return {
        database: dbName,
        limitMB,
        limitBytes,
        limitFormatted: formatBytes(limitBytes),
        totalUsedBytes,
        totalUsedFormatted: formatBytes(totalUsedBytes),
        dataSizeBytes,
        dataSizeFormatted: formatBytes(dataSizeBytes),
        storageSizeBytes,
        storageSizeFormatted: formatBytes(storageSizeBytes),
        indexSizeBytes,
        indexSizeFormatted: formatBytes(indexSizeBytes),
        remainingBytes,
        remainingFormatted: formatBytes(remainingBytes),
        usedPercentage: parseFloat(usedPercentage.toFixed(2)),
        freePercentage: parseFloat((100 - usedPercentage).toFixed(2)),
        collectionsCount: userCollections.length,
        totalDocuments: rawDbStats.objects || totalDocsCalculated,
        avgDocSizeBytes: rawDbStats.avgObjSize || 0,
        avgDocSizeFormatted: formatBytes(rawDbStats.avgObjSize || 0),
        collections: collectionsDetail,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Generate full database export with BSON Extended JSON serialization.
 */
async function createDatabaseBackup({ includeSensitive = true } = {}) {
    const db = await connectToDatabase();
    const dbName = db.databaseName || process.env.MONGODB_DB || 'personal_dashboard';
    const now = new Date();

    const collectionsList = await db.listCollections().toArray();
    const userCollections = collectionsList.filter((c) => !c.name.startsWith('system.'));
    userCollections.sort((a, b) => a.name.localeCompare(b.name));

    const collectionsData = {};
    const collectionCounts = {};
    let totalDocuments = 0;

    for (const col of userCollections) {
        const colName = col.name;
        // Optionally omit sensitive tokens if requested
        if (!includeSensitive && (colName === 'oauth_tokens' || colName === 'oauth_codes')) {
            continue;
        }

        const rawDocs = await db.collection(colName).find({}).toArray();
        // Convert to relaxed Extended JSON structure
        const serializedDocs = BSON.EJSON.serialize(rawDocs, { relaxed: true });
        collectionsData[colName] = serializedDocs;
        collectionCounts[colName] = rawDocs.length;
        totalDocuments += rawDocs.length;
    }

    // Ensure dashboard_settings is always included in the backup
    if (!collectionsData['dashboard_settings'] || collectionsData['dashboard_settings'].length === 0) {
        try {
            const { getDashboardSettings } = require('./settings');
            const currentSettings = await getDashboardSettings();
            const settingsDoc = {
                _id: 'data_sources',
                calendar: currentSettings.calendar || {},
                news: currentSettings.news || {},
                weather: currentSettings.weather || {},
                updatedAt: currentSettings.updatedAt || new Date().toISOString(),
            };
            collectionsData['dashboard_settings'] = [settingsDoc];
            collectionCounts['dashboard_settings'] = 1;
            totalDocuments += 1;
        } catch (_) {}
    }

    let currentSettings = null;
    try {
        const { getDashboardSettings } = require('./settings');
        currentSettings = await getDashboardSettings();
    } catch (_) {}

    const manifest = {
        version: 1,
        exportedAt: now.toISOString(),
        database: dbName,
        totalCollections: Object.keys(collectionsData).length,
        totalDocuments,
        format: 'ejson',
        collectionCounts,
        includesSettings: true,
    };

    return {
        manifest,
        settings: currentSettings,
        collections: collectionsData,
    };
}

/**
 * Revives a raw document from JSON / EJSON into native MongoDB types (ObjectId, Date, etc.)
 */
function reviveDocument(colName, doc) {
    if (!doc || typeof doc !== 'object') return doc;

    // First use BSON.EJSON.deserialize if it contains EJSON types like $oid, $date
    let deserialized;
    try {
        deserialized = BSON.EJSON.deserialize(doc);
    } catch (_) {
        deserialized = { ...doc };
    }

    // If _id is a 24-character hex string and NOT a known string-id collection, convert to ObjectId
    if (
        !STRING_ID_COLLECTIONS.has(colName) &&
        typeof deserialized._id === 'string' &&
        /^[0-9a-fA-F]{24}$/.test(deserialized._id)
    ) {
        try {
            deserialized._id = new ObjectId(deserialized._id);
        } catch (_) {}
    }

    return deserialized;
}

/**
 * Restores MongoDB data from an uploaded backup.
 * Supports:
 * - mode = 'replace': replaces collections with backup documents
 * - mode = 'merge': updates/upserts documents by _id, preserving non-conflicting documents
 * - selectedCollections: array of collection names to restore, or null to restore all
 */
async function restoreDatabaseBackup({ backup, mode = 'merge', selectedCollections = null } = {}) {
    if (!backup || typeof backup !== 'object') {
        throw new Error('Invalid backup payload: expected a JSON object.');
    }

    // Support either { manifest, collections } or direct { collections }
    const collectionsMap = backup.collections || backup;
    if (!collectionsMap || typeof collectionsMap !== 'object' || Array.isArray(collectionsMap)) {
        throw new Error('Invalid backup format: missing "collections" map.');
    }

    // Normalize settings if provided as top-level property or under 'settings' key
    if (!collectionsMap.dashboard_settings) {
        if (Array.isArray(collectionsMap.settings)) {
            collectionsMap.dashboard_settings = collectionsMap.settings;
        } else if (backup.settings && typeof backup.settings === 'object') {
            collectionsMap.dashboard_settings = [
                {
                    _id: 'data_sources',
                    calendar: backup.settings.calendar || {},
                    news: backup.settings.news || {},
                    weather: backup.settings.weather || {},
                    updatedAt: backup.settings.updatedAt || new Date().toISOString(),
                },
            ];
        }
    }

    const availableCollections = Object.keys(collectionsMap);
    if (availableCollections.length === 0) {
        throw new Error('Backup contains no collections to restore.');
    }

    const db = await connectToDatabase();
    const targetCollections = (selectedCollections && Array.isArray(selectedCollections) && selectedCollections.length > 0)
        ? availableCollections.filter((c) => selectedCollections.includes(c))
        : availableCollections;

    if (targetCollections.length === 0) {
        throw new Error('None of the selected collections were found in the backup.');
    }

    const results = {
        mode,
        collectionsRestored: 0,
        totalDocumentsRestored: 0,
        details: {},
    };

    for (const colName of targetCollections) {
        // Sanitize collection name
        if (!/^[a-zA-Z0-9_-]+$/.test(colName) || colName.startsWith('system.')) {
            continue;
        }

        const rawDocs = collectionsMap[colName];
        if (!Array.isArray(rawDocs)) {
            continue;
        }

        const revivedDocs = rawDocs.map((d) => reviveDocument(colName, d));
        const collection = db.collection(colName);

        if (mode === 'replace') {
            // Delete all existing documents in collection
            await collection.deleteMany({});
            let insertedCount = 0;
            if (revivedDocs.length > 0) {
                const insertRes = await collection.insertMany(revivedDocs);
                insertedCount = insertRes.insertedCount || revivedDocs.length;
            }
            results.details[colName] = {
                status: 'replaced',
                count: insertedCount,
            };
            results.totalDocumentsRestored += insertedCount;
        } else {
            // Merge mode: upsert each doc by _id if present
            let upsertedCount = 0;
            for (const doc of revivedDocs) {
                if (doc._id != null) {
                    await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
                } else {
                    await collection.insertOne(doc);
                }
                upsertedCount++;
            }
            results.details[colName] = {
                status: 'merged',
                count: upsertedCount,
            };
            results.totalDocumentsRestored += upsertedCount;
        }

        results.collectionsRestored++;
    }

    // Invalidate settings & downstream caches when dashboard_settings is restored
    if (results.details['dashboard_settings']) {
        try {
            const { clearSettingsCache } = require('./settings');
            if (typeof clearSettingsCache === 'function') {
                clearSettingsCache();
            }
        } catch (_) {}

        try {
            const { clearCache } = require('./context');
            if (typeof clearCache === 'function') {
                clearCache();
            }
        } catch (_) {}

        try {
            const { clearNewsCache } = require('./news');
            if (typeof clearNewsCache === 'function') {
                clearNewsCache();
            }
        } catch (_) {}

        try {
            const { clearIcsCache } = require('./outlook');
            if (typeof clearIcsCache === 'function') {
                clearIcsCache();
            }
        } catch (_) {}
    }

    return results;
}

module.exports = {
    getDatabaseStats,
    createDatabaseBackup,
    restoreDatabaseBackup,
    getCollectionMetadata,
    formatBytes,
    DEFAULT_STORAGE_LIMIT_MB,
};
