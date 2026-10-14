/**
 * Dashboard External Data Sources Settings Service
 * Manages dynamic configuration for Calendar, News, and Weather stored in MongoDB.
 * Eliminates all hardcoded subscription URLs, news topics, and locations.
 */

const { connectToDatabase } = require('../lib/db');

const SETTINGS_DOC_ID = 'data_sources';

// Initial schema used when initializing settings
const INITIAL_DEFAULT_SETTINGS = {
    calendar: {
        icsUrl: process.env.OUTLOOK_CALENDAR_ICS_URL || '',
        htmlUrl: process.env.OUTLOOK_CALENDAR_HTML_URL || '',
        label: 'Calendar (.ics)',
        enabled: true,
    },
    news: {
        enabled: true,
        maxArticlesPerChannel: 5,
        tags: [],
        customFeeds: [],
    },
    weather: {
        enabled: true,
        defaultLocation: process.env.WEATHER_LOCATION || '',
        defaultUnit: 'F',
        latitude: null,
        longitude: null,
    },
};

let cachedSettings = null;
let lastFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

/**
 * Retrieve current external data source settings from MongoDB
 */
async function getDashboardSettings(forceFresh = false) {
    const now = Date.now();
    if (!forceFresh && cachedSettings && (now - lastFetchTime) < SETTINGS_CACHE_TTL_MS) {
        return cachedSettings;
    }

    try {
        const db = await connectToDatabase();
        let doc = await db.collection('dashboard_settings').findOne({ _id: SETTINGS_DOC_ID });

        if (!doc) {
            // First time initialization in database
            const initialDoc = {
                _id: SETTINGS_DOC_ID,
                ...INITIAL_DEFAULT_SETTINGS,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await db.collection('dashboard_settings').insertOne(initialDoc);
            doc = initialDoc;
        }

        // Merge with defaults to ensure all required fields exist
        cachedSettings = {
            calendar: { ...INITIAL_DEFAULT_SETTINGS.calendar, ...(doc.calendar || {}) },
            news: {
                ...INITIAL_DEFAULT_SETTINGS.news,
                ...(doc.news || {}),
                tags: Array.isArray(doc.news?.tags) ? doc.news.tags : [],
                customFeeds: Array.isArray(doc.news?.customFeeds) ? doc.news.customFeeds : [],
            },
            weather: { ...INITIAL_DEFAULT_SETTINGS.weather, ...(doc.weather || {}) },
            updatedAt: doc.updatedAt || new Date().toISOString(),
        };
        lastFetchTime = now;
        return cachedSettings;
    } catch (err) {
        console.warn('Dashboard Settings: DB error, returning defaults:', err.message);
        return INITIAL_DEFAULT_SETTINGS;
    }
}

/**
 * Update dashboard external data source settings in MongoDB
 */
async function updateDashboardSettings(updates = {}) {
    const db = await connectToDatabase();
    const current = await getDashboardSettings(true);

    const merged = {
        calendar: {
            ...current.calendar,
            ...(updates.calendar || {}),
        },
        news: {
            ...current.news,
            ...(updates.news || {}),
            tags: Array.isArray(updates.news?.tags)
                ? updates.news.tags
                : (Array.isArray(current.news?.tags) ? current.news.tags : []),
            customFeeds: Array.isArray(updates.news?.customFeeds)
                ? updates.news.customFeeds
                : (Array.isArray(current.news?.customFeeds) ? current.news.customFeeds : []),
        },
        weather: {
            ...current.weather,
            ...(updates.weather || {}),
        },
        updatedAt: new Date().toISOString(),
    };

    await db.collection('dashboard_settings').updateOne(
        { _id: SETTINGS_DOC_ID },
        { $set: merged },
        { upsert: true }
    );

    // Update in-memory cache and invalidate downstream caches
    cachedSettings = merged;
    lastFetchTime = Date.now();

    // Clear news and weather caches so changes reflect immediately
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

    return merged;
}

/**
 * Test an ICS Calendar Subscription URL
 */
async function testIcsFeed(icsUrl) {
    if (!icsUrl || typeof icsUrl !== 'string' || !icsUrl.trim()) {
        return { success: false, error: 'ICS URL is required.' };
    }

    try {
        const response = await fetch(icsUrl.trim(), {
            headers: {
                'User-Agent': 'PersonalWebsite-CalendarService/1.0',
                'Accept': 'text/calendar, text/plain, */*',
            },
        });

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
            };
        }

        const text = await response.text();
        if (!text.includes('BEGIN:VCALENDAR')) {
            return {
                success: false,
                error: 'The provided URL did not return a valid iCalendar (BEGIN:VCALENDAR) feed.',
            };
        }

        // Count VEVENT items
        const eventMatches = text.match(/BEGIN:VEVENT/gi) || [];
        return {
            success: true,
            eventCount: eventMatches.length,
            message: `Feed verified successfully (${eventMatches.length} events found).`,
        };
    } catch (err) {
        return {
            success: false,
            error: err.message || 'Failed to connect to the ICS calendar URL.',
        };
    }
}

module.exports = {
    getDashboardSettings,
    updateDashboardSettings,
    testIcsFeed,
    INITIAL_DEFAULT_SETTINGS,
};
