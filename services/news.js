/**
 * Comprehensive Multi-Beat News Intelligence Service
 * Aggregates live, real-time news tailored to:
 * - Topics: Politics, AI, Technology, Economics, Culture, Current Affairs
 * - Geographies: American, Indian, and Karnataka / Bengaluru
 *
 * Uses robust Google News RSS streams with automated entity decoding,
 * source extraction, title normalization, and a 30-minute in-memory cache.
 */

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let memoryCache = {
    data: null,
    timestamp: 0,
};

const NEWS_CHANNELS = {
    ai: {
        id: 'ai',
        name: 'AI & Deep Tech',
        region: 'Global / US',
        badge: 'AI / TECH',
        url: 'https://news.google.com/rss/search?q=(AI+OR+"artificial+intelligence"+OR+Anthropic+OR+OpenAI+OR+Nvidia+OR+LLMs+OR+"generative+AI")+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
    technology: {
        id: 'technology',
        name: 'Technology & Startups',
        region: 'Global / US',
        badge: 'TECH',
        url: 'https://news.google.com/rss/search?q=(technology+OR+startups+OR+"Silicon+Valley"+OR+semiconductors)+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
    us_politics: {
        id: 'us_politics',
        name: 'US Politics & Affairs',
        region: 'United States',
        badge: 'US POLITICS',
        url: 'https://news.google.com/rss/search?q=(US+politics+OR+Congress+OR+"White+House"+OR+"Supreme+Court")+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
    india_politics: {
        id: 'india_politics',
        name: 'Indian National Affairs',
        region: 'India',
        badge: 'INDIA',
        url: 'https://news.google.com/rss/search?q=(India+politics+OR+Parliament+OR+"government+of+India"+OR+Modi)+when:24h&hl=en-IN&gl=IN&ceid=IN:en',
    },
    karnataka_bengaluru: {
        id: 'karnataka_bengaluru',
        name: 'Karnataka & Bengaluru',
        region: 'Karnataka / Bengaluru',
        badge: 'BENGALURU',
        url: 'https://news.google.com/rss/search?q=(Karnataka+OR+Bengaluru+OR+Bangalore)+when:24h&hl=en-IN&gl=IN&ceid=IN:en',
    },
    economics: {
        id: 'economics',
        name: 'Economics & Markets',
        region: 'Global / US / India',
        badge: 'ECONOMICS',
        url: 'https://news.google.com/rss/search?q=(economy+OR+inflation+OR+Fed+OR+RBI+OR+markets+OR+Sensex+OR+"Wall+Street+OR+Federal+Reserve")+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
    culture: {
        id: 'culture',
        name: 'Culture, Arts & Society',
        region: 'Global / Indo-US',
        badge: 'CULTURE',
        url: 'https://news.google.com/rss/search?q=(culture+OR+literature+OR+arts+OR+cinema+OR+heritage+OR+language)+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
    culture: {
        id: 'finance',
        name: 'Finance',
        region: 'Global / Indo-US',
        badge: 'CULTURE',
        url: 'https://news.google.com/rss/search?q=(finance+OR+stocks+OR+market+OR+shares)+when:24h&hl=en-US&gl=US&ceid=US:en',
    },
};

/**
 * Decode standard HTML and XML entities
 */
function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&#8217;/g, "'")
        .replace(/&#8216;/g, "'")
        .replace(/&#8220;/g, '"')
        .replace(/&#8221;/g, '"')
        .replace(/&#8212;/g, '—')
        .replace(/&mdash;/g, '—')
        .replace(/&#8211;/g, '–')
        .replace(/&ndash;/g, '–')
        .replace(/&#8230;/g, '...')
        .replace(/&hellip;/g, '...')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * Clean article title by removing trailing source attribution if duplicated
 */
function cleanTitle(rawTitle, source) {
    let title = decodeHtmlEntities(rawTitle);
    if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3)).trim();
    }
    return title;
}

/**
 * Parse an RSS feed XML string into normalized article objects
 */
function parseRssFeed(xmlText, channelMeta, limit = 5) {
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    while ((match = itemRegex.exec(xmlText)) !== null && articles.length < limit) {
        const itemXml = match[1];
        const rawTitle = (itemXml.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
        const rawLink = (itemXml.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
        const rawSource = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || '';
        const pubDateMatch = itemXml.match(/<(?:pubDate|dc:date|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|dc:date|published|updated)>/i);
        const rawPubDate = pubDateMatch ? decodeHtmlEntities(pubDateMatch[1]).trim() : '';
        const pubTime = rawPubDate ? new Date(rawPubDate).getTime() : NaN;

        // Strictly filter to articles from the last 1 day (24 hours)
        if (!isNaN(pubTime) && (now - pubTime) > oneDayMs) {
            continue;
        }

        const source = decodeHtmlEntities(rawSource) || channelMeta.name;
        const title = cleanTitle(rawTitle, source);
        const link = decodeHtmlEntities(rawLink);

        if (title && link) {
            articles.push({
                id: `${channelMeta.id}_${articles.length}`,
                title,
                source,
                url: link,
                publishedAt: !isNaN(pubTime) ? new Date(pubTime).toISOString() : null,
                topic: channelMeta.id,
                topicName: channelMeta.name,
                region: channelMeta.region,
                badge: channelMeta.badge,
            });
        }
    }

    return articles;
}

/**
 * Fetch a single RSS channel with timeout protection
 */
async function fetchChannel(channelKey, limit = 5) {
    const meta = NEWS_CHANNELS[channelKey];
    if (!meta) return [];

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(meta.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            console.warn(`[News Service] Channel ${channelKey} returned HTTP ${res.status}`);
            return [];
        }

        const xml = await res.text();
        return parseRssFeed(xml, meta, limit);
    } catch (err) {
        console.warn(`[News Service] Failed to fetch channel ${channelKey}:`, err.message);
        return [];
    }
}

/**
 * Fetch all categorized news channels concurrently with caching
 * @param {boolean} forceFresh Whether to bypass the 30-minute memory cache
 * @returns {Promise<object>} Categorized news payload
 */
async function fetchCategorizedNews(forceFresh = false) {
    const now = Date.now();

    if (!forceFresh && memoryCache.data && (now - memoryCache.timestamp) < CACHE_TTL_MS) {
        return { ...memoryCache.data, cached: true };
    }

    const channelKeys = Object.keys(NEWS_CHANNELS);
    const results = await Promise.allSettled(
        channelKeys.map((key) => fetchChannel(key, 5))
    );

    const categories = {};
    const topHeadlines = [];
    let totalCount = 0;

    channelKeys.forEach((key, idx) => {
        const items = results[idx].status === 'fulfilled' ? results[idx].value : [];
        categories[key] = items;
        totalCount += items.length;

        // Take top 1-2 from each channel for the top headlines feed
        if (items.length > 0) {
            topHeadlines.push(items[0]);
            if (items[1] && (key === 'ai' || key === 'karnataka_bengaluru' || key === 'india_politics')) {
                topHeadlines.push(items[1]);
            }
        }
    });

    const payload = {
        categories,
        topHeadlines: topHeadlines.slice(0, 10),
        totalCount,
        channels: Object.keys(NEWS_CHANNELS).map((k) => ({
            id: k,
            name: NEWS_CHANNELS[k].name,
            region: NEWS_CHANNELS[k].region,
            badge: NEWS_CHANNELS[k].badge,
            count: (categories[k] || []).length,
        })),
        updatedAt: new Date().toISOString(),
        cached: false,
    };

    memoryCache = {
        data: payload,
        timestamp: now,
    };

    return payload;
}

/**
 * Retrieve news filtered by specific topic
 * @param {string} topic e.g. 'ai', 'us_politics', 'india_politics', 'karnataka_bengaluru', 'economics', 'culture'
 */
async function getNewsByTopic(topic = 'all') {
    const data = await fetchCategorizedNews();
    if (!topic || topic === 'all') {
        return data;
    }
    const key = topic.toLowerCase().trim();
    return {
        topic: key,
        channel: NEWS_CHANNELS[key] || null,
        articles: data.categories[key] || [],
        updatedAt: data.updatedAt,
        cached: data.cached,
    };
}

/**
 * Retrieve news filtered by geographic region
 * @param {string} region 'us' | 'india' | 'karnataka' | 'all'
 */
async function getNewsByRegion(region = 'all') {
    const data = await fetchCategorizedNews();
    const reg = region.toLowerCase().trim();

    if (reg === 'us' || reg === 'american') {
        return [
            ...(data.categories.us_politics || []),
            ...(data.categories.ai || []),
            ...(data.categories.technology || []),
        ];
    }
    if (reg === 'karnataka' || reg === 'bengaluru' || reg === 'bangalore') {
        return data.categories.karnataka_bengaluru || [];
    }
    if (reg === 'india' || reg === 'indian') {
        return [
            ...(data.categories.india_politics || []),
            ...(data.categories.karnataka_bengaluru || []),
        ];
    }
    return data.topHeadlines;
}

/**
 * Format news into a clean prompt context snippet for Claude
 */
function formatNewsForContext(newsPayload) {
    if (!newsPayload || !newsPayload.categories) {
        return 'No live news streams available.';
    }

    const lines = [];
    const cats = newsPayload.categories;

    if (cats.ai && cats.ai.length > 0) {
        lines.push(`- AI & Deep Tech: ${cats.ai.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }
    if (cats.karnataka_bengaluru && cats.karnataka_bengaluru.length > 0) {
        lines.push(`- Karnataka & Bengaluru: ${cats.karnataka_bengaluru.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }
    if (cats.india_politics && cats.india_politics.length > 0) {
        lines.push(`- India National Affairs: ${cats.india_politics.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }
    if (cats.us_politics && cats.us_politics.length > 0) {
        lines.push(`- US Politics: ${cats.us_politics.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }
    if (cats.economics && cats.economics.length > 0) {
        lines.push(`- Economics & Markets: ${cats.economics.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }
    if (cats.culture && cats.culture.length > 0) {
        lines.push(`- Culture & Arts: ${cats.culture.slice(0, 2).map((a) => `"${a.title}" (${a.source})`).join('; ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : 'No recent headlines available.';
}

/**
 * Retrieve a flat, deduplicated list of news articles from the last 24 hours
 * Sorted by published date descending with pagination support
 * @param {object} options
 * @param {number} options.limit Number of items to return (default: 20)
 * @param {number} options.offset Offset for pagination (default: 0)
 * @param {boolean} options.forceFresh Bypass memory cache
 */
async function getFlatNewsFeed({ limit = 20, offset = 0, forceFresh = false } = {}) {
    const data = await fetchCategorizedNews(forceFresh);
    const seenLinks = new Set();
    const seenTitles = new Set();
    const allArticles = [];

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    Object.values(data.categories || {}).forEach((items) => {
        (items || []).forEach((item) => {
            if (!item || !item.url) return;
            const normTitle = (item.title || '').toLowerCase().trim();
            if (seenLinks.has(item.url) || (normTitle && seenTitles.has(normTitle))) {
                return;
            }

            const pubTime = item.publishedAt ? new Date(item.publishedAt).getTime() : NaN;
            if (!isNaN(pubTime) && (now - pubTime) > ONE_DAY_MS) {
                return;
            }

            seenLinks.add(item.url);
            if (normTitle) seenTitles.add(normTitle);

            allArticles.push({
                id: item.id || `news_${allArticles.length}`,
                title: item.title,
                source: item.source,
                url: item.url,
                publishedAt: item.publishedAt || new Date().toISOString(),
                topic: item.topic || 'general',
                badge: item.badge || 'NEWS',
            });
        });
    });

    // Sort chronologically descending
    allArticles.sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime() || 0;
        const timeB = new Date(b.publishedAt).getTime() || 0;
        return timeB - timeA;
    });

    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const paginated = allArticles.slice(safeOffset, safeOffset + safeLimit);

    return {
        articles: paginated,
        total: allArticles.length,
        hasMore: safeOffset + paginated.length < allArticles.length,
        offset: safeOffset,
        limit: safeLimit,
        updatedAt: data.updatedAt,
    };
}

function clearNewsCache() {
    memoryCache = { data: null, timestamp: 0 };
}

module.exports = {
    NEWS_CHANNELS,
    fetchCategorizedNews,
    getFlatNewsFeed,
    getNewsByTopic,
    getNewsByRegion,
    formatNewsForContext,
    clearNewsCache,
};

