/**
 * Context Aggregator Service
 * Synthesizes data in parallel from:
 * 1. Todos DB (pending, overdue, high-priority, recurring)
 * 2. Budget DB (weekly summary, 7-day spending vs prior week, category breakdown)
 * 3. Notes DB (recent active notes, snippets, folders)
 * 4. Email API (Gmail / Microsoft Graph - read-only unread/important emails)
 * 5. News API (NewsAPI / GNews with 1-hour cache)
 * 6. Weather API (OpenWeatherMap / WeatherAPI with 1-hour cache)
 * 7. Previous Digest (Memory across runs stored in assistant_digests collection)
 */

const { connectToDatabase } = require('../lib/db');
const { fetchOutlookEmails, fetchOutlookCalendar } = require('./outlook');
const { fetchCategorizedNews, formatNewsForContext } = require('./news');
const { getDashboardSettings } = require('./settings');

// Cache configuration
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CONTEXT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for rapid chat turns

const memoryCache = {
    news: { data: null, timestamp: 0 },
    weather: { data: null, timestamp: 0 },
};

let contextCache = {
    data: null,
    timestamp: 0,
};

function clearCache(key) {
    if (key === 'context') {
        contextCache = { data: null, timestamp: 0 };
    } else if (key === 'weather') {
        memoryCache.weather = { data: null, timestamp: 0 };
        weatherLocationCache.clear();
        geocodeCache.clear();
    } else if (key && memoryCache[key]) {
        memoryCache[key] = { data: null, timestamp: 0 };
    } else if (!key) {
        contextCache = { data: null, timestamp: 0 };
        memoryCache.news = { data: null, timestamp: 0 };
        memoryCache.weather = { data: null, timestamp: 0 };
        weatherLocationCache.clear();
        geocodeCache.clear();
    }
}

/**
 * Helper to parse date string YYYY-MM-DD
 */
function parseDateOnly(value) {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/**
 * 1. Aggregate Todos
 */
async function fetchTodoContext(db) {
    try {
        const collection = db.collection('todos');
        const todos = await collection.find({}).sort({ order: 1, createdAt: -1 }).toArray();

        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const todayKey = now.toISOString().slice(0, 10);
        const nextWeekUtc = new Date(todayUtc.getTime() + 7 * 24 * 60 * 60 * 1000);

        let completedCount = 0;
        let pendingCount = 0;
        const overdue = [];
        const highPriority = [];
        const dueToday = [];
        const dueThisWeek = [];
        const pendingList = [];
        const recurringList = [];

        for (const item of todos) {
            const isCompleted = Boolean(item.completed);
            const todo = {
                id: item._id ? item._id.toString() : String(item.id || ''),
                title: String(item.title || item.text || 'Untitled Task').trim(),
                completed: isCompleted,
                priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
                dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : null,
                createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
                recurrence: item.recurrence && item.recurrence !== 'none' ? item.recurrence : null,
                tags: Array.isArray(item.tags) ? item.tags : [],
                description: item.description ? String(item.description).slice(0, 200) : '',
            };

            if (isCompleted) {
                completedCount += 1;
                continue;
            }

            pendingCount += 1;
            pendingList.push(todo);

            if (todo.recurrence) {
                recurringList.push(todo);
            }

            if (todo.dueDate) {
                const dueParsed = parseDateOnly(todo.dueDate);
                if (dueParsed) {
                    if (dueParsed < todayUtc) {
                        overdue.push(todo);
                    } else if (todo.dueDate === todayKey) {
                        dueToday.push(todo);
                    } else if (dueParsed <= nextWeekUtc) {
                        dueThisWeek.push(todo);
                    }
                }
            }

            if (todo.priority === 'high') {
                highPriority.push(todo);
            }
        }

        // Longest pending non-completed tasks (stale indicator)
        const staleTasks = [...pendingList]
            .filter((t) => t.createdAt)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .slice(0, 5);

        return {
            total: todos.length,
            pendingCount,
            completedCount,
            overdueCount: overdue.length,
            highPriorityCount: highPriority.length,
            dueTodayCount: dueToday.length,
            dueThisWeekCount: dueThisWeek.length,
            overdue: overdue.slice(0, 10),
            highPriority: highPriority.slice(0, 10),
            dueToday: dueToday.slice(0, 10),
            dueThisWeek: dueThisWeek.slice(0, 10),
            recurring: recurringList.slice(0, 5),
            staleTasks,
            recentPending: pendingList.slice(0, 8),
        };
    } catch (err) {
        console.error('Context Aggregator: Todo DB error', err);
        return { error: err.message, pendingCount: 0, overdue: [], highPriority: [] };
    }
}

/**
 * 2. Aggregate Budget (Weekly Summary & Trends)
 */
async function fetchBudgetContext(db) {
    try {
        const [expenses, income, plans] = await Promise.all([
            db.collection('expenses').find({}).toArray().catch(() => []),
            db.collection('income').find({}).toArray().catch(() => []),
            db.collection('budget_plans').find({}).toArray().catch(() => []),
        ]);

        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const sevenDaysAgo = new Date(now - 7 * ONE_DAY_MS);
        const fourteenDaysAgo = new Date(now - 14 * ONE_DAY_MS);

        let totalExpensesAllTime = 0;
        let totalIncomeAllTime = 0;
        let last7DaysSpend = 0;
        let prior7DaysSpend = 0;
        const recentExpenses = [];
        const categoryMap7Days = {};

        for (const exp of expenses) {
            const cost = Number(exp.cost) || 0;
            totalExpensesAllTime += cost;
            const expDate = exp.date ? new Date(exp.date) : (exp.createdAt ? new Date(exp.createdAt) : null);

            if (expDate && !Number.isNaN(expDate.getTime())) {
                if (expDate >= sevenDaysAgo) {
                    last7DaysSpend += cost;
                    const cat = exp.category || 'General';
                    categoryMap7Days[cat] = (categoryMap7Days[cat] || 0) + cost;

                    recentExpenses.push({
                        id: exp._id ? exp._id.toString() : String(exp.id || ''),
                        name: exp.name || exp.title || 'Expense',
                        cost,
                        category: exp.category || 'General',
                        date: expDate.toISOString().slice(0, 10),
                    });
                } else if (expDate >= fourteenDaysAgo) {
                    prior7DaysSpend += cost;
                }
            }
        }

        for (const inc of income) {
            totalIncomeAllTime += Number(inc.value) || 0;
        }

        // Calculate week-over-week change
        const spendDelta = last7DaysSpend - prior7DaysSpend;
        const spendChangePercent = prior7DaysSpend > 0
            ? Math.round((spendDelta / prior7DaysSpend) * 100)
            : (last7DaysSpend > 0 ? 100 : 0);

        // Top categories in the past 7 days
        const topCategories = Object.entries(categoryMap7Days)
            .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
            .sort((a, b) => b.amount - a.amount);

        // Flag large transactions (> $100 or top cost in past 7 days)
        const largeTransactions = recentExpenses
            .filter((e) => e.cost >= 100)
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 5);

        return {
            weeklySummary: {
                last7DaysSpend: Math.round(last7DaysSpend * 100) / 100,
                prior7DaysSpend: Math.round(prior7DaysSpend * 100) / 100,
                spendDelta: Math.round(spendDelta * 100) / 100,
                spendChangePercent,
                dailyAverage7Days: Math.round((last7DaysSpend / 7) * 100) / 100,
                topCategories,
                largeTransactions,
                recentExpensesCount: recentExpenses.length,
            },
            allTime: {
                totalIncome: Math.round(totalIncomeAllTime * 100) / 100,
                totalExpenses: Math.round(totalExpensesAllTime * 100) / 100,
                netBalance: Math.round((totalIncomeAllTime - totalExpensesAllTime) * 100) / 100,
            },
            activePlansCount: plans.length,
        };
    } catch (err) {
        console.error('Context Aggregator: Budget DB error', err);
        return { error: err.message, weeklySummary: { last7DaysSpend: 0, topCategories: [] } };
    }
}

/**
 * 3. Aggregate Notes
 */
async function fetchNotesContext(db) {
    try {
        const collection = db.collection('notes');
        const notes = await collection
            .find({ archived: { $ne: true } })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(10)
            .toArray();

        const folders = new Set();
        const recentNotes = notes.map((doc) => {
            if (doc.folder) folders.add(doc.folder);

            // Clean snippet
            const rawContent = String(doc.content || '');
            const clean = rawContent
                .replace(/<[^>]*>/g, ' ')
                .replace(/[#*`_~>[\]()]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            return {
                id: doc._id ? doc._id.toString() : String(doc.id || ''),
                title: doc.title || 'Untitled Note',
                folder: doc.folder || '',
                snippet: clean.slice(0, 150),
                updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
            };
        });

        const totalNotes = await collection.countDocuments({ archived: { $ne: true } });

        return {
            total: totalNotes,
            activeFolders: Array.from(folders),
            recentNotes,
        };
    } catch (err) {
        console.error('Context Aggregator: Notes DB error', err);
        return { error: err.message, total: 0, recentNotes: [] };
    }
}

/**
 * 3b. Aggregate Networking (Recent contacts, upcoming and overdue follow-ups)
 */
async function fetchNetworkingContext(db) {
    try {
        const collection = db.collection('networking_people');
        const people = await collection.find({}).sort({ updatedAt: -1, createdAt: -1 }).toArray();

        const todayStr = new Date().toISOString().slice(0, 10);
        const overdue = [];
        const upcoming = [];

        people.forEach((p) => {
            if (p.nextFollowUpAt && p.followUpStatus !== 'completed') {
                const item = {
                    id: p._id ? p._id.toString() : String(p.id || ''),
                    name: p.name || 'Unnamed',
                    role: p.role || '',
                    company: p.company || '',
                    nextFollowUpAt: p.nextFollowUpAt,
                    followUpNotes: p.followUpNotes || '',
                    category: p.category || '',
                };
                if (p.nextFollowUpAt < todayStr) {
                    overdue.push(item);
                } else {
                    upcoming.push(item);
                }
            }
        });

        const recentContacts = people.slice(0, 6).map((p) => ({
            id: p._id ? p._id.toString() : String(p.id || ''),
            name: p.name || '',
            role: p.role || '',
            company: p.company || '',
            category: p.category || '',
            tags: Array.isArray(p.tags) ? p.tags : [],
            lastInteractionAt: p.lastInteractionAt ? new Date(p.lastInteractionAt).toISOString() : null,
        }));

        return {
            total: people.length,
            overdueFollowUpsCount: overdue.length,
            upcomingFollowUpsCount: upcoming.length,
            overdueFollowUps: overdue.slice(0, 5),
            upcomingFollowUps: upcoming.slice(0, 5),
            recentContacts,
        };
    } catch (err) {
        console.error('Context Aggregator: Networking DB error', err);
        return { error: err.message, total: 0, overdueFollowUps: [], upcomingFollowUps: [] };
    }
}

/**
 * 4. Aggregate Email (Outlook / Microsoft Graph / Gmail, read-only)
 */
async function fetchEmailContext() {
    const hasOutlook = process.env.MS_GRAPH_REFRESH_TOKEN || process.env.MS_GRAPH_ACCESS_TOKEN || process.env.OUTLOOK_REFRESH_TOKEN;
    const hasGmail = process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID;

    // 1. Try Gmail if explicitly configured and Outlook is not
    if (hasGmail && !hasOutlook) {
        try {
            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GMAIL_CLIENT_ID,
                    client_secret: process.env.GMAIL_CLIENT_SECRET,
                    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
                    grant_type: 'refresh_token',
                }),
            });

            if (!tokenRes.ok) {
                const errText = await tokenRes.text();
                throw new Error(`Gmail token refresh failed: ${errText}`);
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;

            const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread%20OR%20is:important&maxResults=8';
            const listRes = await fetch(listUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!listRes.ok) {
                throw new Error(`Gmail list messages failed: ${listRes.statusText}`);
            }

            const listData = await listRes.json();
            const messageIds = (listData.messages || []).map((m) => m.id);

            const emailSnippets = await Promise.all(
                messageIds.slice(0, 6).map(async (id) => {
                    try {
                        const msgRes = await fetch(
                            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
                            { headers: { Authorization: `Bearer ${accessToken}` } }
                        );
                        if (!msgRes.ok) return null;
                        const msg = await msgRes.json();
                        const headers = (msg.payload && msg.payload.headers) || [];
                        const subject = (headers.find((h) => h.name.toLowerCase() === 'subject') || {}).value || '(No Subject)';
                        const from = (headers.find((h) => h.name.toLowerCase() === 'from') || {}).value || 'Unknown Sender';
                        const date = (headers.find((h) => h.name.toLowerCase() === 'date') || {}).value || '';
                        const isUnread = Array.isArray(msg.labelIds) && msg.labelIds.includes('UNREAD');
                        const isImportant = Array.isArray(msg.labelIds) && msg.labelIds.includes('IMPORTANT');

                        return {
                            id: msg.id,
                            threadId: msg.threadId,
                            from,
                            subject,
                            date,
                            snippet: msg.snippet || '',
                            isUnread,
                            isImportant,
                        };
                    } catch {
                        return null;
                    }
                })
            );

            const validEmails = emailSnippets.filter(Boolean);
            return {
                provider: 'gmail',
                configured: true,
                unreadCount: validEmails.filter((e) => e.isUnread).length,
                importantCount: validEmails.filter((e) => e.isImportant).length,
                messages: validEmails,
            };
        } catch (err) {
            console.warn('Gmail API error:', err.message);
            return {
                provider: 'gmail',
                configured: true,
                error: err.message,
                unreadCount: 0,
                messages: [],
            };
        }
    }

    // 2. Default & Preferred: Microsoft Outlook via Microsoft Graph
    return await fetchOutlookEmails(8);
}

/**
 * 5. Aggregate Calendar (Outlook Calendar / Microsoft Graph, read-only)
 */
async function fetchCalendarContext(timeframe = 'today') {
    return await fetchOutlookCalendar(timeframe);
}

/**
 * 5. Aggregate Multi-Beat News (AI, Tech, US/India Politics, Karnataka/Bengaluru, Economics, Culture)
 */
async function fetchNewsContext() {
    try {
        const newsData = await fetchCategorizedNews();
        return {
            configured: true,
            cached: Boolean(newsData.cached),
            count: newsData.totalCount || 0,
            categories: newsData.categories || {},
            channels: newsData.channels || [],
            headlines: newsData.topHeadlines || [],
            contextSummary: formatNewsForContext(newsData),
            updatedAt: newsData.updatedAt || new Date().toISOString(),
        };
    } catch (err) {
        console.warn('News aggregator fetch error:', err.message);
        return {
            configured: false,
            error: err.message,
            cached: false,
            categories: {},
            channels: [],
            headlines: [],
            count: 0,
            contextSummary: 'News streams currently unavailable.',
            updatedAt: new Date().toISOString(),
        };
    }
}

function getWeatherConditionFromWmo(code) {
    const table = {
        0: { text: 'Clear sky', icon: 'clear' },
        1: { text: 'Mainly clear', icon: 'partly-cloudy' },
        2: { text: 'Partly cloudy', icon: 'partly-cloudy' },
        3: { text: 'Overcast', icon: 'cloudy' },
        45: { text: 'Foggy', icon: 'fog' },
        48: { text: 'Depositing rime fog', icon: 'fog' },
        51: { text: 'Light drizzle', icon: 'rain' },
        53: { text: 'Moderate drizzle', icon: 'rain' },
        55: { text: 'Dense drizzle', icon: 'rain' },
        56: { text: 'Light freezing drizzle', icon: 'sleet' },
        57: { text: 'Dense freezing drizzle', icon: 'sleet' },
        61: { text: 'Slight rain', icon: 'rain' },
        63: { text: 'Moderate rain', icon: 'rain' },
        65: { text: 'Heavy rain', icon: 'heavy-rain' },
        66: { text: 'Light freezing rain', icon: 'sleet' },
        67: { text: 'Heavy freezing rain', icon: 'sleet' },
        71: { text: 'Slight snowfall', icon: 'snow' },
        73: { text: 'Moderate snowfall', icon: 'snow' },
        75: { text: 'Heavy snowfall', icon: 'snow' },
        77: { text: 'Snow grains', icon: 'snow' },
        80: { text: 'Slight rain showers', icon: 'rain' },
        81: { text: 'Moderate rain showers', icon: 'rain' },
        82: { text: 'Violent rain showers', icon: 'heavy-rain' },
        85: { text: 'Slight snow showers', icon: 'snow' },
        86: { text: 'Heavy snow showers', icon: 'snow' },
        95: { text: 'Thunderstorm', icon: 'thunderstorm' },
        96: { text: 'Thunderstorm with hail', icon: 'thunderstorm' },
        99: { text: 'Heavy thunderstorm', icon: 'thunderstorm' },
    };
    return table[code] || { text: 'Partly cloudy', icon: 'partly-cloudy' };
}

function generateDayPlanRecommendations({ highF, lowF, chanceOfRain, rainAmount, uvIndex, windSpeedMph, hourlyNext12 }) {
    // 1. Umbrella & Rain Planning
    let umbrellaNeeded = false;
    let umbrellaStatus = 'No Umbrella Needed';
    let umbrellaAdvice = 'Dry conditions expected today. No umbrella needed.';

    if (chanceOfRain >= 60 || (rainAmount && rainAmount >= 0.05)) {
        umbrellaNeeded = true;
        umbrellaStatus = 'Bring an Umbrella';
        umbrellaAdvice = `High chance of rain (${chanceOfRain}%). Keep an umbrella with you throughout the day.`;
    } else if (chanceOfRain >= 25) {
        umbrellaNeeded = true;
        umbrellaStatus = 'Umbrella Recommended';
        umbrellaAdvice = `Scattered showers possible (${chanceOfRain}% chance). Packing a compact umbrella is recommended.`;
    }

    // Peak rain timing from next 12 hours
    let peakRainHour = null;
    let maxHourRain = 0;
    if (Array.isArray(hourlyNext12)) {
        for (const h of hourlyNext12) {
            if (h.rainChance > maxHourRain) {
                maxHourRain = h.rainChance;
                peakRainHour = h.timeLabel;
            }
        }
    }
    const rainTimingAdvice = peakRainHour && maxHourRain >= 25
        ? `Peak rain chance around ${peakRainHour} (${maxHourRain}%).`
        : (chanceOfRain >= 25 ? `Rain possible today (${chanceOfRain}%).` : 'Dry conditions expected.');

    // 2. Outfit / Layering Planning
    let outfitType = 'Comfortable Layers';
    let outfitAdvice = 'Comfortable layers recommended.';
    if (highF <= 32) {
        outfitType = 'Heavy Winter Coat';
        outfitAdvice = 'Freezing temperatures — heavy winter coat, scarf, gloves, and warm boots essential.';
    } else if (highF <= 48) {
        outfitType = 'Winter Jacket';
        outfitAdvice = 'Cold day — winter jacket, sweater, and warm layers recommended.';
    } else if (highF <= 62) {
        outfitType = 'Light Jacket / Sweater';
        outfitAdvice = 'Crisp and cool — a light jacket or sweater will keep you comfortable.';
    } else if (highF <= 74) {
        outfitType = 'Light Layers / Long Sleeves';
        outfitAdvice = 'Mild and pleasant — comfortable light layers or long sleeves recommended.';
    } else if (highF <= 85) {
        outfitType = 'T-Shirt / Light Clothing';
        outfitAdvice = 'Warm day — breathable light clothing and stay hydrated.';
    } else {
        outfitType = 'Summer Heat Clothing';
        outfitAdvice = 'Hot temperatures — lightweight breathable fabrics, sunglasses, and plenty of water.';
    }

    // 3. UV & Sun Protection
    let uvAdvice = 'Low UV exposure today.';
    if (uvIndex >= 8) {
        uvAdvice = `Very high UV (${uvIndex}) — apply SPF 30+ sunscreen, wear sunglasses and protective headwear.`;
    } else if (uvIndex >= 6) {
        uvAdvice = `High UV (${uvIndex}) — sun protection recommended between 10 AM and 4 PM.`;
    } else if (uvIndex >= 3) {
        uvAdvice = `Moderate UV (${uvIndex}) — consider sunscreen if outdoors for extended periods.`;
    }

    // 4. Wind
    let windAdvice = 'Gentle breeze.';
    if (windSpeedMph >= 25) {
        windAdvice = `Brisk winds (${windSpeedMph} mph) — secure loose gear and dress warmly against wind chill.`;
    } else if (windSpeedMph >= 15) {
        windAdvice = `Moderate breeze (${windSpeedMph} mph).`;
    }

    // Overall summary sentence
    const summary = `${outfitType} recommended. ${rainTimingAdvice}`;

    return {
        umbrellaNeeded,
        umbrellaStatus,
        umbrellaAdvice,
        rainTimingAdvice,
        outfitType,
        outfitAdvice,
        uvAdvice,
        windAdvice,
        summary,
    };
}

const weatherLocationCache = new Map();
const geocodeCache = new Map();

async function resolveGeocoding(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') return null;
    const cleanQuery = rawQuery.trim();
    if (!cleanQuery) return null;

    const cacheKey = cleanQuery.toLowerCase();
    if (geocodeCache.has(cacheKey)) {
        return geocodeCache.get(cacheKey);
    }

    const parts = cleanQuery.split(',').map((s) => s.trim()).filter(Boolean);
    const primaryName = parts[0];
    const qualifier = parts.length > 1 ? parts.slice(1).join(' ').toLowerCase() : '';

    try {
        let results = [];
        // First try searching with the full query
        const exactUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=10&language=en&format=json`;
        const exactRes = await fetch(exactUrl);
        if (exactRes.ok) {
            const data = await exactRes.json();
            if (Array.isArray(data.results) && data.results.length > 0) {
                results = data.results;
            }
        }

        // If no results and query had commas (e.g. "London, UK", "New York, NY"), query primary name
        if (results.length === 0 && primaryName && primaryName !== cleanQuery) {
            const primaryUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(primaryName)}&count=10&language=en&format=json`;
            const primaryRes = await fetch(primaryUrl);
            if (primaryRes.ok) {
                const data = await primaryRes.json();
                if (Array.isArray(data.results) && data.results.length > 0) {
                    results = data.results;
                }
            }
        }

        if (results.length === 0) return null;

        let matched = results[0];
        if (qualifier && results.length > 1) {
            const found = results.find((item) => {
                const countryCode = (item.country_code || '').toLowerCase();
                const country = (item.country || '').toLowerCase();
                const admin1 = (item.admin1 || '').toLowerCase();
                const isUk = (qualifier === 'uk' || qualifier === 'united kingdom') && (countryCode === 'gb' || country.includes('kingdom'));
                const stateMatch = admin1.includes(qualifier) || country.includes(qualifier) || countryCode === qualifier;
                return isUk || stateMatch;
            });
            if (found) matched = found;
        }

        const out = {
            latitude: matched.latitude,
            longitude: matched.longitude,
            name: `${matched.name}${matched.admin1 ? `, ${matched.admin1}` : ''}${matched.country ? ` (${matched.country_code || matched.country})` : ''}`,
            country: matched.country,
            countryCode: matched.country_code,
        };

        geocodeCache.set(cacheKey, out);
        return out;
    } catch (err) {
        console.warn('Geocoding resolution error:', err.message);
        return null;
    }
}

/**
 * 6. Aggregate Weather (Open-Meteo, OpenWeatherMap or WeatherAPI, cached ~30 min)
 */
async function fetchWeatherContext(options = {}) {
    const { location: customLocation, lat: customLat, lon: customLon, forceFresh = false } = options;
    const now = Date.now();
    const settings = await getDashboardSettings(forceFresh);
    const weatherConfig = settings.weather || {};
    const location = (customLocation || weatherConfig.defaultLocation || process.env.WEATHER_LOCATION || 'Ithaca, NY').trim();
    const configLat = weatherConfig.latitude !== undefined && weatherConfig.latitude !== null && weatherConfig.latitude !== '' ? Number(weatherConfig.latitude) : undefined;
    const configLon = weatherConfig.longitude !== undefined && weatherConfig.longitude !== null && weatherConfig.longitude !== '' ? Number(weatherConfig.longitude) : undefined;
    
    // When a custom location string is passed, do NOT use config coordinates from Ithaca!
    const effectiveLat = customLat !== undefined ? customLat : (customLocation ? undefined : configLat);
    const effectiveLon = customLon !== undefined ? customLon : (customLocation ? undefined : configLon);

    const cacheKey = customLat !== undefined && customLon !== undefined
        ? `geo_${Number(customLat).toFixed(2)}_${Number(customLon).toFixed(2)}`
        : `loc_${location.toLowerCase().trim()}`;

    if (!forceFresh) {
        const cachedEntry = weatherLocationCache.get(cacheKey);
        if (cachedEntry && (now - cachedEntry.timestamp) < (30 * 60 * 1000)) {
            return { ...cachedEntry.data, cached: true };
        }
        if (!customLocation && customLat === undefined && memoryCache.weather.data && (now - memoryCache.weather.timestamp) < CACHE_TTL_MS) {
            return { ...memoryCache.weather.data, cached: true };
        }
    }

    const apiKey = process.env.WEATHER_API_KEY;

    try {
        let weatherData = null;

        // 1. Try WeatherAPI.com if API key is provided
        if (apiKey) {
            try {
                const weatherApiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=1&aqi=no&alerts=yes`;
                const wRes = await fetch(weatherApiUrl);
                if (wRes.ok) {
                    const data = await wRes.json();
                    const current = data.current || {};
                    const forecastDay = (data.forecast && data.forecast.forecastday && data.forecast.forecastday[0]) || {};
                    const day = forecastDay.day || {};

                    const highF = Math.round(day.maxtemp_f || current.temp_f);
                    const lowF = Math.round(day.mintemp_f || current.temp_f);
                    const chanceOfRain = day.daily_chance_of_rain || 0;
                    const uvIndex = current.uv || day.uv || 0;
                    const windSpeedMph = Math.round(current.wind_mph || 0);

                    const recommendations = generateDayPlanRecommendations({
                        highF,
                        lowF,
                        chanceOfRain,
                        rainAmount: day.totalprecip_in || 0,
                        uvIndex,
                        windSpeedMph,
                        hourlyNext12: [],
                    });

                    weatherData = {
                        location: `${data.location.name}, ${data.location.region || data.location.country}`,
                        temperatureC: Math.round(current.temp_c),
                        temperatureF: Math.round(current.temp_f),
                        condition: current.condition ? current.condition.text : 'Clear',
                        conditionIcon: 'partly-cloudy',
                        feelsLikeC: Math.round(current.feelslike_c),
                        feelsLikeF: Math.round(current.feelslike_f),
                        humidity: current.humidity,
                        highC: Math.round(day.maxtemp_c || current.temp_c),
                        highF,
                        lowC: Math.round(day.mintemp_c || current.temp_c),
                        lowF,
                        chanceOfRain,
                        precipitationSum: day.totalprecip_in || 0,
                        windSpeedMph,
                        windSpeedKmh: Math.round((current.wind_kph || current.wind_mph * 1.609) || 0),
                        uvIndex,
                        sunrise: forecastDay.astro ? forecastDay.astro.sunrise : null,
                        sunset: forecastDay.astro ? forecastDay.astro.sunset : null,
                        hourly: [],
                        recommendations,
                        alerts: (data.alerts && data.alerts.alert) ? data.alerts.alert.map((a) => a.headline) : [],
                    };
                }
            } catch (wApiErr) {
                console.warn('WeatherAPI error, falling back to Open-Meteo:', wApiErr.message);
            }
        }

        // 2. Open-Meteo (No API key needed, high reliability, full hourly + precipitation metrics)
        if (!weatherData) {
            let latitude = effectiveLat;
            let longitude = effectiveLon;
            let resolvedLocationName = location;

            if (latitude === undefined || longitude === undefined) {
                const resolved = await resolveGeocoding(location);
                if (resolved) {
                    latitude = resolved.latitude;
                    longitude = resolved.longitude;
                    resolvedLocationName = resolved.name;
                } else {
                    // Fallback to Ithaca, NY coordinates only if completely unresolvable
                    latitude = 42.4406;
                    longitude = -76.4966;
                    resolvedLocationName = location || 'Ithaca, NY';
                }
            }

            const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
            const omRes = await fetch(forecastUrl);

            if (omRes.ok) {
                const omData = await omRes.json();
                const cur = omData.current || {};
                const daily = omData.daily || {};
                const hourly = omData.hourly || {};

                const conditionInfo = getWeatherConditionFromWmo(cur.weather_code);
                const tempF = Math.round(cur.temperature_2m);
                const tempC = Math.round(((tempF - 32) * 5) / 9);
                const feelsLikeF = Math.round(cur.apparent_temperature);
                const feelsLikeC = Math.round(((feelsLikeF - 32) * 5) / 9);

                const highF = Math.round(daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined ? daily.temperature_2m_max[0] : tempF);
                const highC = Math.round(((highF - 32) * 5) / 9);
                const lowF = Math.round(daily.temperature_2m_min && daily.temperature_2m_min[0] !== undefined ? daily.temperature_2m_min[0] : tempF);
                const lowC = Math.round(((lowF - 32) * 5) / 9);

                const chanceOfRain = daily.precipitation_probability_max && daily.precipitation_probability_max[0] !== undefined
                    ? daily.precipitation_probability_max[0]
                    : (cur.precipitation > 0 ? 80 : 0);

                const precipitationSum = daily.precipitation_sum && daily.precipitation_sum[0] !== undefined
                    ? Math.round(daily.precipitation_sum[0] * 100) / 100
                    : (cur.precipitation || 0);

                const windSpeedMph = Math.round(cur.wind_speed_10m || 0);
                const windSpeedKmh = Math.round(windSpeedMph * 1.609);
                const uvIndex = daily.uv_index_max && daily.uv_index_max[0] !== undefined ? daily.uv_index_max[0] : 0;

                // Format sunrise / sunset (use local time components directly)
                let sunriseFormatted = null;
                let sunsetFormatted = null;
                if (daily.sunrise && daily.sunrise[0]) {
                    const parts = String(daily.sunrise[0]).split('T');
                    if (parts[1]) {
                        const [hStr, mStr] = parts[1].split(':');
                        const h = parseInt(hStr, 10);
                        const h12 = h % 12 || 12;
                        const ampm = h < 12 ? 'AM' : 'PM';
                        sunriseFormatted = `${h12}:${mStr} ${ampm}`;
                    }
                }
                if (daily.sunset && daily.sunset[0]) {
                    const parts = String(daily.sunset[0]).split('T');
                    if (parts[1]) {
                        const [hStr, mStr] = parts[1].split(':');
                        const h = parseInt(hStr, 10);
                        const h12 = h % 12 || 12;
                        const ampm = h < 12 ? 'AM' : 'PM';
                        sunsetFormatted = `${h12}:${mStr} ${ampm}`;
                    }
                }

                // Process next 16 hours of hourly forecast
                const hourlyFormatted = [];
                if (Array.isArray(hourly.time)) {
                    let currentHourPrefix = (cur.time || '').slice(0, 13);
                    if (!currentHourPrefix) {
                        try {
                            const tz = omData.timezone || 'America/New_York';
                            const parts = new Intl.DateTimeFormat('en-CA', {
                                timeZone: tz,
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                hour12: false,
                            }).formatToParts(new Date());
                            const y = parts.find((p) => p.type === 'year')?.value;
                            const m = parts.find((p) => p.type === 'month')?.value;
                            const d = parts.find((p) => p.type === 'day')?.value;
                            const h = parts.find((p) => p.type === 'hour')?.value;
                            currentHourPrefix = `${y}-${m}-${d}T${h}`;
                        } catch {
                            currentHourPrefix = '';
                        }
                    }

                    let startIndex = currentHourPrefix
                        ? hourly.time.findIndex((t) => t.startsWith(currentHourPrefix))
                        : 0;
                    if (startIndex === -1) {
                        startIndex = 0;
                    }

                    const endIndex = Math.min(hourly.time.length, startIndex + 16);
                    for (let i = startIndex; i < endIndex; i++) {
                        const timeStr = hourly.time[i];
                        const isFirst = i === startIndex;
                        let timeLabel = 'Now';
                        if (!isFirst && timeStr) {
                            const hourPart = parseInt(timeStr.slice(11, 13), 10);
                            if (!isNaN(hourPart)) {
                                const hour12 = hourPart % 12 || 12;
                                const ampm = hourPart < 12 ? 'AM' : 'PM';
                                timeLabel = `${hour12} ${ampm}`;
                            }
                        }
                        const hTempF = isFirst ? tempF : Math.round(hourly.temperature_2m[i]);
                        const hTempC = isFirst ? tempC : Math.round(((hTempF - 32) * 5) / 9);
                        const hRain = Math.round(hourly.precipitation_probability ? hourly.precipitation_probability[i] || 0 : 0);
                        const hWmo = hourly.weather_code ? hourly.weather_code[i] : 0;
                        const hCond = isFirst ? conditionInfo : getWeatherConditionFromWmo(hWmo);

                        // If the model code outputs rain/drizzle but rain probability is negligible (< 20%),
                        // represent it as cloudy to avoid showing rain cloud icons when conditions are dry
                        let conditionIcon = hCond.icon;
                        if ((conditionIcon === 'rain' || conditionIcon === 'heavy-rain') && hRain < 20) {
                            conditionIcon = 'cloudy';
                        }

                        hourlyFormatted.push({
                            time: timeStr,
                            timeLabel,
                            tempF: hTempF,
                            tempC: hTempC,
                            rainChance: hRain,
                            condition: hCond.text,
                            conditionIcon,
                        });
                    }
                }

                const recommendations = generateDayPlanRecommendations({
                    highF,
                    lowF,
                    chanceOfRain,
                    rainAmount: precipitationSum,
                    uvIndex,
                    windSpeedMph,
                    hourlyNext12: hourlyFormatted.slice(0, 12),
                });

                weatherData = {
                    location: resolvedLocationName,
                    latitude,
                    longitude,
                    temperatureC: tempC,
                    temperatureF: tempF,
                    condition: conditionInfo.text,
                    conditionIcon: conditionInfo.icon,
                    feelsLikeC,
                    feelsLikeF,
                    humidity: cur.relative_humidity_2m || 0,
                    highC,
                    highF,
                    lowC,
                    lowF,
                    chanceOfRain,
                    precipitationSum,
                    windSpeedMph,
                    windSpeedKmh,
                    uvIndex,
                    isDay: cur.is_day === 1,
                    sunrise: sunriseFormatted,
                    sunset: sunsetFormatted,
                    hourly: hourlyFormatted,
                    recommendations,
                    unit: settings.weather?.defaultUnit || 'F',
                    alerts: chanceOfRain >= 70 ? [`High precipitation probability (${chanceOfRain}%)`] : [],
                };
            }
        }

        const result = {
            configured: Boolean(weatherData),
            cached: false,
            weather: weatherData,
            updatedAt: new Date().toISOString(),
        };

        if (weatherData) {
            weatherLocationCache.set(cacheKey, { data: result, timestamp: now });
            if (!customLocation && !customLat) {
                memoryCache.weather = { data: result, timestamp: now };
            }
        }

        return result;
    } catch (err) {
        console.warn('Weather API fetch error:', err.message);
        return {
            configured: true,
            error: err.message,
            cached: false,
            weather: null,
        };
    }
}

/**
 * 7. Memory Across Runs (Previous Stored Digest)
 */
async function fetchPreviousDigest(db) {
    try {
        const collection = db.collection('assistant_digests');
        const previous = await collection
            .find({})
            .sort({ createdAt: -1 })
            .limit(1)
            .next();

        if (!previous) return null;

        return {
            id: previous._id ? previous._id.toString() : null,
            createdAt: previous.createdAt,
            trigger: previous.trigger || 'scheduled',
            digest: previous.digest || null,
            metrics: previous.metrics || null,
        };
    } catch (err) {
        console.warn('Context Aggregator: Failed to query previous digest', err.message);
        return null;
    }
}

/**
 * Main Aggregator: buildContext()
 * Fetches all snapshots in parallel and formats into cohesive intelligence context
 */
async function buildContext(options = {}) {
    const { forceFresh = false } = options;
    const nowMs = Date.now();
    if (!forceFresh && contextCache.data && (nowMs - contextCache.timestamp) < CONTEXT_CACHE_TTL_MS) {
        return contextCache.data;
    }

    const startTime = Date.now();
    let db = null;
    try {
        db = await connectToDatabase();
    } catch (dbErr) {
        console.error('Context Aggregator: Failed to connect to DB', dbErr);
    }

    const [
        todoResult,
        budgetResult,
        notesResult,
        networkingResult,
        emailResult,
        calendarResult,
        newsResult,
        weatherResult,
        previousDigestResult,
    ] = await Promise.allSettled([
        db ? fetchTodoContext(db) : Promise.resolve({ error: 'DB not connected' }),
        db ? fetchBudgetContext(db) : Promise.resolve({ error: 'DB not connected' }),
        db ? fetchNotesContext(db) : Promise.resolve({ error: 'DB not connected' }),
        db ? fetchNetworkingContext(db) : Promise.resolve({ error: 'DB not connected' }),
        fetchEmailContext(),
        fetchCalendarContext('today'),
        fetchNewsContext(),
        fetchWeatherContext(),
        db ? fetchPreviousDigest(db) : Promise.resolve(null),
    ]);

    const todos = todoResult.status === 'fulfilled' ? todoResult.value : { error: todoResult.reason };
    const budget = budgetResult.status === 'fulfilled' ? budgetResult.value : { error: budgetResult.reason };
    const notes = notesResult.status === 'fulfilled' ? notesResult.value : { error: notesResult.reason };
    const networking = networkingResult.status === 'fulfilled' ? networkingResult.value : { error: networkingResult.reason };
    const email = emailResult.status === 'fulfilled' ? emailResult.value : { error: emailResult.reason };
    const calendar = calendarResult.status === 'fulfilled' ? calendarResult.value : { error: calendarResult.reason };
    const news = newsResult.status === 'fulfilled' ? newsResult.value : { error: newsResult.reason };
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value : { error: weatherResult.reason };
    const previousDigest = previousDigestResult.status === 'fulfilled' ? previousDigestResult.value : null;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const result = {
        timestamp: now.toISOString(),
        dateFormatted: formattedDate,
        executionTimeMs: Date.now() - startTime,
        todos,
        budget,
        notes,
        networking,
        email,
        calendar,
        news,
        weather,
        previousDigest,
    };

    contextCache = {
        data: result,
        timestamp: nowMs,
    };

    return result;
}

/**
 * Build Personal Data Context (Excludes news and weather)
 * Used strictly for LLM executive briefing synthesis and reasoning
 */
async function buildPersonalContext() {
    const startTime = Date.now();
    let db = null;
    try {
        db = await connectToDatabase();
    } catch (dbErr) {
        console.error('Context Aggregator: Failed to connect to DB', dbErr);
    }

    const [
        todoResult,
        budgetResult,
        notesResult,
        emailResult,
        calendarResult,
        previousDigestResult,
    ] = await Promise.allSettled([
        db ? fetchTodoContext(db) : Promise.resolve({ error: 'DB not connected' }),
        db ? fetchBudgetContext(db) : Promise.resolve({ error: 'DB not connected' }),
        db ? fetchNotesContext(db) : Promise.resolve({ error: 'DB not connected' }),
        fetchEmailContext(),
        fetchCalendarContext('today'),
        db ? fetchPreviousDigest(db) : Promise.resolve(null),
    ]);

    const todos = todoResult.status === 'fulfilled' ? todoResult.value : { error: todoResult.reason };
    const budget = budgetResult.status === 'fulfilled' ? budgetResult.value : { error: budgetResult.reason };
    const notes = notesResult.status === 'fulfilled' ? notesResult.value : { error: notesResult.reason };
    const email = emailResult.status === 'fulfilled' ? emailResult.value : { error: emailResult.reason };
    const calendar = calendarResult.status === 'fulfilled' ? calendarResult.value : { error: calendarResult.reason };
    const previousDigest = previousDigestResult.status === 'fulfilled' ? previousDigestResult.value : null;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return {
        timestamp: now.toISOString(),
        dateFormatted: formattedDate,
        executionTimeMs: Date.now() - startTime,
        todos,
        budget,
        notes,
        email,
        calendar,
        previousDigest,
    };
}

module.exports = {
    buildContext,
    buildPersonalContext,
    clearCache,
    fetchTodoContext,
    fetchBudgetContext,
    fetchNotesContext,
    fetchEmailContext,
    fetchCalendarContext,
    fetchNewsContext,
    fetchWeatherContext,
    fetchPreviousDigest,
    resolveGeocoding,
};
