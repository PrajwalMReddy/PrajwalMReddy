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
    } else if (key && memoryCache[key]) {
        memoryCache[key] = { data: null, timestamp: 0 };
    } else if (!key) {
        contextCache = { data: null, timestamp: 0 };
        memoryCache.news = { data: null, timestamp: 0 };
        memoryCache.weather = { data: null, timestamp: 0 };
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

/**
 * 6. Aggregate Weather (OpenWeatherMap or WeatherAPI, cached ~1 hr)
 */
async function fetchWeatherContext() {
    const now = Date.now();
    if (memoryCache.weather.data && (now - memoryCache.weather.timestamp) < CACHE_TTL_MS) {
        return { ...memoryCache.weather.data, cached: true };
    }

    const apiKey = process.env.WEATHER_API_KEY;
    const location = process.env.WEATHER_LOCATION || 'New York';

    if (!apiKey) {
        return {
            configured: false,
            cached: false,
            location,
            status: 'Weather API not configured (set WEATHER_API_KEY in .env)',
            weather: null,
        };
    }

    try {
        let weatherData = null;

        // Try WeatherAPI.com (if key format aligns)
        const weatherApiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=1&aqi=no&alerts=yes`;
        const wRes = await fetch(weatherApiUrl);

        if (wRes.ok) {
            const data = await wRes.json();
            const current = data.current || {};
            const forecastDay = (data.forecast && data.forecast.forecastday && data.forecast.forecastday[0]) || {};
            const day = forecastDay.day || {};

            weatherData = {
                location: `${data.location.name}, ${data.location.region || data.location.country}`,
                temperatureC: Math.round(current.temp_c),
                temperatureF: Math.round(current.temp_f),
                condition: current.condition ? current.condition.text : 'Clear',
                feelsLikeC: Math.round(current.feelslike_c),
                feelsLikeF: Math.round(current.feelslike_f),
                humidity: current.humidity,
                highC: Math.round(day.maxtemp_c || current.temp_c),
                lowC: Math.round(day.mintemp_c || current.temp_c),
                chanceOfRain: day.daily_chance_of_rain || 0,
                alerts: (data.alerts && data.alerts.alert) ? data.alerts.alert.map((a) => a.headline) : [],
            };
        } else {
            // Try OpenWeatherMap
            const owmUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`;
            const owmRes = await fetch(owmUrl);
            if (owmRes.ok) {
                const data = await owmRes.json();
                const tempC = Math.round(data.main.temp);
                const tempF = Math.round((tempC * 9) / 5 + 32);
                weatherData = {
                    location: `${data.name}, ${data.sys ? data.sys.country : ''}`,
                    temperatureC: tempC,
                    temperatureF: tempF,
                    condition: data.weather && data.weather[0] ? data.weather[0].main : 'Clear',
                    description: data.weather && data.weather[0] ? data.weather[0].description : '',
                    highC: Math.round(data.main.temp_max),
                    lowC: Math.round(data.main.temp_min),
                    humidity: data.main.humidity,
                    chanceOfRain: (data.rain && data.rain['1h']) ? 80 : 0,
                    alerts: [],
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
            memoryCache.weather = { data: result, timestamp: now };
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
};
