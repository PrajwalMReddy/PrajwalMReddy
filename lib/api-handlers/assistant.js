/**
 * Assistant Routes (Output Mode 2: On-Demand Chat & Assistant API)
 * Handles:
 * - POST /api/assistant/chat: On-demand chat with tool loop, context injection, and session memory
 * - GET  /api/assistant/digest: Retrieve latest stored digest
 * - POST /api/assistant/digest: Trigger on-demand digest run
 * - GET  /api/assistant/alerts: Retrieve active alerts
 * - POST /api/assistant/alerts/dismiss: Dismiss an alert
 * - POST /api/assistant/confirm: Confirm or reject pending high-consequence action
 * - GET  /api/assistant/context: View aggregated life context snapshot
 */

const { requireAuth } = require('../auth');
const { connectToDatabase } = require('../db');
const { enforceRateLimit } = require('../../services/rateLimiter');
const { buildPersonalContext } = require('../../services/context');
const { processChatMessage, executePendingConfirmation, prewarmAssistantCache } = require('../../services/assistant');
const { runDigestJob } = require('../../jobs/digest');
const {
    getOutlookAuthUrl,
    exchangeCodeForTokens,
    fetchOutlookCalendar,
    fetchOutlookEmails,
    getOutlookUserProfile,
    initiateDeviceCodeFlow,
    pollDeviceCodeToken,
} = require('../../services/outlook');
const {
    fetchCategorizedNews,
    getFlatNewsFeed,
    getNewsByTopic,
    getNewsByRegion,
} = require('../../services/news');

// In-memory conversation store with TTL cleanup
const sessions = new Map();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSessionHistory(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return [];
    if (Date.now() - session.lastAccess > SESSION_TTL_MS) {
        sessions.delete(sessionId);
        return [];
    }
    session.lastAccess = Date.now();
    return session.history || [];
}

function updateSessionHistory(sessionId, newMessages) {
    const history = getSessionHistory(sessionId);
    const updated = [...history, ...newMessages].slice(-10); // Keep last 10 messages
    sessions.set(sessionId, {
        history: updated,
        lastAccess: Date.now(),
    });
}

function clearSessionHistory(sessionId) {
    sessions.delete(sessionId);
}

module.exports = async function assistantHandler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname.replace(/\/+$/, '');
    const method = req.method;

    // Allow OAuth callback from Microsoft without session cookie
    if (pathname !== '/api/assistant/outlook/callback') {
        // 1. Enforce Admin Authentication
        if (!requireAuth(req, res)) return;
    }

    // 2. Enforce Sliding Window Rate Limiting
    // Differentiate LLM-heavy endpoints (chat, on-demand digest) from standard dashboard reads (calendar, news, weather)
    const isLlmHeavy = pathname === '/api/assistant/chat' || (pathname === '/api/assistant/digest' && method === 'POST');
    const rateLimitOpts = isLlmHeavy
        ? { maxRequests: 30, windowMs: 60 * 1000 }
        : { maxRequests: 150, windowMs: 60 * 1000 };

    if (!enforceRateLimit(req, res, rateLimitOpts)) {
        return;
    }

    try {
        const db = await connectToDatabase();

        // -------------------------------------------------------------
        // POST /api/assistant/chat (On-Demand Chat with SSE Streaming Support)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/chat' && method === 'POST') {
            const { message, sessionId = 'default', resetHistory = false, stream = false } = req.body || {};

            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ error: 'Message is required and must be non-empty string.' });
            }

            if (resetHistory) {
                clearSessionHistory(sessionId);
            }

            const conversationHistory = getSessionHistory(sessionId);
            const isStream = stream === true || Boolean(req.headers['accept']?.includes('text/event-stream'));

            if (isStream) {
                // Initialize Server-Sent Events (SSE) stream
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });

                const sendEvent = (event, data) => {
                    try {
                        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
                        if (typeof res.flush === 'function') {
                            res.flush();
                        }
                    } catch (_) {}
                };

                try {
                    const result = await processChatMessage({
                        message: message.trim(),
                        sessionId,
                        conversationHistory,
                        onToken: (token) => {
                            sendEvent('token', { text: token });
                        },
                        onToolCall: (tool) => {
                            sendEvent('tool', tool);
                        },
                    });

                    // Update session history
                    updateSessionHistory(sessionId, [
                        { role: 'user', content: message.trim() },
                        { role: 'assistant', content: result.reply },
                    ]);

                    sendEvent('done', {
                        reply: result.reply,
                        toolCallsExecuted: result.toolCallsExecuted || [],
                        pendingConfirmations: result.pendingConfirmations || [],
                        source: result.source,
                        sessionId,
                        cacheStats: result.cacheStats || null,
                        timestamp: new Date().toISOString(),
                    });

                    res.end();
                    return;
                } catch (streamErr) {
                    console.error('Error during chat stream:', streamErr);
                    sendEvent('error', { error: streamErr.message || 'Stream processing failed' });
                    res.end();
                    return;
                }
            }

            const result = await processChatMessage({
                message: message.trim(),
                sessionId,
                conversationHistory,
            });

            // Update session history
            updateSessionHistory(sessionId, [
                { role: 'user', content: message.trim() },
                { role: 'assistant', content: result.reply },
            ]);

            return res.status(200).json({
                reply: result.reply,
                toolCallsExecuted: result.toolCallsExecuted || [],
                pendingConfirmations: result.pendingConfirmations || [],
                source: result.source,
                sessionId,
                cacheStats: result.cacheStats || null,
                timestamp: new Date().toISOString(),
            });
        }

        // -------------------------------------------------------------
        // GET /api/assistant/digest (Retrieve Latest Digest)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/digest' && method === 'GET') {
            const limit = Math.min(Number(req.query.limit || 1), 10);
            const digests = await db
                .collection('assistant_digests')
                .find({})
                .sort({ createdAt: -1 })
                .limit(limit)
                .toArray();

            if (digests.length === 0) {
                return res.status(200).json({
                    message: 'No digests generated yet. Trigger a run with POST /api/assistant/digest.',
                    digest: null,
                    history: [],
                });
            }

            return res.status(200).json({
                latest: digests[0],
                history: digests,
            });
        }

        // -------------------------------------------------------------
        // POST /api/assistant/digest (Trigger Digest Generation)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/digest' && method === 'POST') {
            const digest = await runDigestJob({ trigger: 'on_demand' });
            return res.status(201).json({
                success: true,
                message: 'Digest generated successfully.',
                digest,
            });
        }

        // -------------------------------------------------------------
        // GET /api/assistant/alerts (Retrieve Active Alerts)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/alerts' && method === 'GET') {
            const includeDismissed = req.query.includeDismissed === 'true';
            const filter = includeDismissed ? {} : { status: 'active', dismissed: false };

            const alerts = await db
                .collection('assistant_alerts')
                .find(filter)
                .sort({ createdAt: -1 })
                .limit(20)
                .toArray();

            return res.status(200).json({
                count: alerts.length,
                alerts,
            });
        }

        // -------------------------------------------------------------
        // POST /api/assistant/alerts/dismiss (Dismiss Alert)
        // -------------------------------------------------------------
        if ((pathname === '/api/assistant/alerts/dismiss' || pathname === '/api/assistant/alerts') && method === 'POST') {
            const { alertId } = req.body || {};
            if (!alertId) {
                return res.status(400).json({ error: 'alertId is required.' });
            }

            const updateResult = await db.collection('assistant_alerts').updateOne(
                { alertId },
                { $set: { status: 'dismissed', dismissed: true, dismissedAt: new Date() } }
            );

            if (updateResult.matchedCount === 0) {
                return res.status(404).json({ error: 'Alert not found.' });
            }

            return res.status(200).json({ success: true, message: `Alert ${alertId} dismissed.` });
        }

        // -------------------------------------------------------------
        // POST /api/assistant/confirm (Confirm/Reject Sensitive Action)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/confirm' && method === 'POST') {
            const { confirmationId, confirmed } = req.body || {};
            if (!confirmationId) {
                return res.status(400).json({ error: 'confirmationId is required.' });
            }

            const isConfirmed = confirmed !== false && confirmed !== 'false';
            const execResult = await executePendingConfirmation(confirmationId, isConfirmed);

            if (!execResult.success && execResult.error) {
                return res.status(400).json(execResult);
            }

            return res.status(200).json(execResult);
        }

        // -------------------------------------------------------------
        // GET /api/assistant/context (Inspect Life Context Snapshot)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/context' && method === 'GET') {
            const context = await buildPersonalContext();
            return res.status(200).json(context);
        }

        // -------------------------------------------------------------
        // Generic GET /api/assistant status info
        // -------------------------------------------------------------
        if (pathname === '/api/assistant' && method === 'GET') {
            const latestDigest = await db.collection('assistant_digests').find().sort({ createdAt: -1 }).limit(1).next();
            const activeAlertsCount = await db.collection('assistant_alerts').countDocuments({ status: 'active', dismissed: false });

            return res.status(200).json({
                status: 'operational',
                service: 'AI Executive Dashboard Assistant',
                activeAlertsCount,
                hasLatestDigest: Boolean(latestDigest),
                latestDigestDate: latestDigest ? latestDigest.createdAt : null,
                endpoints: [
                    'POST /api/assistant/chat',
                    'GET /api/assistant/digest',
                    'POST /api/assistant/digest',
                    'GET /api/assistant/alerts',
                    'POST /api/assistant/alerts/dismiss',
                    'POST /api/assistant/confirm',
                    'GET /api/assistant/context',
                ],
            });
        }

        // -------------------------------------------------------------
        // GET /api/assistant/news (Retrieve Categorized Multi-Beat or Flat News)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/news' && method === 'GET') {
            const topic = url.searchParams.get('topic');
            const region = url.searchParams.get('region');
            const format = url.searchParams.get('format');
            const limit = url.searchParams.get('limit');
            const offset = url.searchParams.get('offset');
            const forceFresh = url.searchParams.get('fresh') === 'true';

            if (format === 'flat' || limit !== null || offset !== null) {
                const flatData = await getFlatNewsFeed({
                    limit: limit ? Number(limit) : 20,
                    offset: offset ? Number(offset) : 0,
                    forceFresh,
                });
                return res.status(200).json(flatData);
            }

            if (topic) {
                const topicData = await getNewsByTopic(topic);
                return res.status(200).json(topicData);
            }
            if (region) {
                const regionArticles = await getNewsByRegion(region);
                return res.status(200).json({ region, articles: regionArticles });
            }

            const newsData = await fetchCategorizedNews(forceFresh);
            return res.status(200).json(newsData);
        }

        // -------------------------------------------------------------
        // GET /api/assistant/weather (Independent Live Weather)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/weather' && method === 'GET') {
            const { fetchWeatherContext } = require('../../services/context');
            const weather = await fetchWeatherContext();
            return res.status(200).json(weather);
        }

        // -------------------------------------------------------------
        // POST /api/assistant/prewarm (Prime Claude Prompt Cache with max_tokens: 0)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/prewarm' && method === 'POST') {
            const prewarmRes = await prewarmAssistantCache();
            return res.status(prewarmRes.success ? 200 : 500).json(prewarmRes);
        }

        // -------------------------------------------------------------
        // GET /api/assistant/outlook/profile (Connected User Info)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/outlook/profile' && method === 'GET') {
            const profile = await getOutlookUserProfile();
            return res.status(200).json(profile);
        }

        // -------------------------------------------------------------
        // POST /api/assistant/outlook/device-code (Start Device Code Auth)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/outlook/device-code' && method === 'POST') {
            const { clientId } = req.body || {};
            try {
                const deviceData = await initiateDeviceCodeFlow(clientId);
                return res.status(200).json(deviceData);
            } catch (err) {
                return res.status(400).json({ error: err.message });
            }
        }

        // -------------------------------------------------------------
        // POST /api/assistant/outlook/device-poll (Poll Device Code Auth)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/outlook/device-poll' && method === 'POST') {
            const { deviceCode, clientId } = req.body || {};
            if (!deviceCode) {
                return res.status(400).json({ error: 'deviceCode is required.' });
            }
            const tokenRes = await pollDeviceCodeToken(deviceCode, clientId);
            return res.status(200).json(tokenRes);
        }

        // -------------------------------------------------------------
        // GET /api/assistant/calendar (Retrieve Outlook Calendar Events)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/calendar' && method === 'GET') {
            const timeframe = url.searchParams.get('timeframe') || 'upcoming';
            const forceFresh = url.searchParams.get('fresh') !== 'false';
            const calendar = await fetchOutlookCalendar(timeframe, forceFresh);
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return res.status(200).json(calendar);
        }

        // -------------------------------------------------------------
        // GET /api/assistant/outlook/auth (Initiate Outlook OAuth)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/outlook/auth' && method === 'GET') {
            const host = req.headers.host || 'localhost:3000';
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const redirectUri = `${protocol}://${host}/api/assistant/outlook/callback`;
            const authUrl = getOutlookAuthUrl(redirectUri);

            if (!authUrl) {
                return res.status(400).json({
                    error: 'MS_GRAPH_CLIENT_ID is not configured in .env',
                    setupInstructions: 'Set MS_GRAPH_CLIENT_ID and MS_GRAPH_CLIENT_SECRET in .env from Azure App Registration.',
                });
            }

            res.writeHead(302, { Location: authUrl });
            return res.end();
        }

        // -------------------------------------------------------------
        // GET /api/assistant/outlook/callback (OAuth Callback Handler)
        // -------------------------------------------------------------
        if (pathname === '/api/assistant/outlook/callback' && method === 'GET') {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            const errorDesc = url.searchParams.get('error_description');

            if (error) {
                return res.status(400).send(`
                    <html>
                    <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
                        <h2 style="color: #dc2626;">Outlook Authorization Failed</h2>
                        <p><strong>Error:</strong> ${error}</p>
                        <p>${errorDesc || ''}</p>
                        <a href="/admin">&larr; Back to Admin Dashboard</a>
                    </body>
                    </html>
                `);
            }

            if (!code) {
                return res.status(400).json({ error: 'Authorization code missing from callback.' });
            }

            const host = req.headers.host || 'localhost:3000';
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const redirectUri = `${protocol}://${host}/api/assistant/outlook/callback`;

            try {
                const tokenData = await exchangeCodeForTokens(code, redirectUri);
                const refreshToken = tokenData.refresh_token;

                return res.status(200).send(`
                    <html>
                    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 3rem 1.5rem; max-width: 720px; margin: auto; line-height: 1.6; color: #1e293b;">
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.5rem 2rem;">
                            <h2 style="color: #166534; margin-top: 0;">Outlook Connected Successfully!</h2>
                            <p>Microsoft Graph has granted read-only access to your <strong>Calendar</strong> and <strong>Email Inbox</strong>.</p>
                            <p>To persist this connection, add this refresh token to your <code>.env</code> file:</p>
                            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; position: relative;">
                                <code id="envCode" style="font-size: 0.85rem; word-break: break-all; display: block;">MS_GRAPH_REFRESH_TOKEN=${refreshToken || 'Token received in session'}</code>
                            </div>
                            <div style="margin-top: 1.5rem;">
                                <a href="/admin" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 0.6rem 1.25rem; border-radius: 6px; text-decoration: none; font-weight: 600;">&larr; Return to Admin Dashboard</a>
                            </div>
                        </div>
                    </body>
                    </html>
                `);
            } catch (exchangeErr) {
                return res.status(500).send(`
                    <html>
                    <body style="font-family: sans-serif; padding: 2rem; max-width: 600px; margin: auto;">
                        <h2 style="color: #dc2626;">Token Exchange Error</h2>
                        <p>${exchangeErr.message}</p>
                        <a href="/admin">&larr; Back to Admin Dashboard</a>
                    </body>
                    </html>
                `);
            }
        }

        return res.status(404).json({ error: 'Not found', path: pathname });
    } catch (err) {
        console.error('Assistant API Route Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
