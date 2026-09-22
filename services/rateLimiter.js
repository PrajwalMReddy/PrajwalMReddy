/**
 * Rate Limiter Service
 * In-memory sliding window rate limiter for protecting assistant endpoints
 * against runaway loops, denial of service, or API cost spikes.
 */

// Store records on global so it survives dev server require.cache invalidations
if (!global.__rateLimitRecords) {
    global.__rateLimitRecords = new Map();
}
const requestRecords = global.__rateLimitRecords;

// Periodic cleanup of expired rate limit entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupTimer = null;

function ensureCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, record] of requestRecords.entries()) {
            if (now - record.lastRequestTime > 10 * 60 * 1000) {
                requestRecords.delete(key);
            }
        }
    }, CLEANUP_INTERVAL_MS);

    if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
        cleanupTimer.unref();
    }
}

/**
 * Check if an action is permitted under the rate limit window
 * @param {string} key Identifier (IP, sessionId, or userId)
 * @param {object} options
 * @param {number} options.maxRequests Maximum requests allowed in window (default: 20)
 * @param {number} options.windowMs Window duration in milliseconds (default: 60,000ms = 1 min)
 * @returns {{ allowed: boolean, remaining: number, resetTimeMs: number, retryAfterSeconds: number }}
 */
function checkRateLimit(key, options = {}) {
    ensureCleanup();

    const maxRequests = Number(options.maxRequests || process.env.ASSISTANT_RATE_LIMIT_MAX || 20);
    const windowMs = Number(options.windowMs || process.env.ASSISTANT_RATE_LIMIT_WINDOW_MS || 60 * 1000);
    const now = Date.now();

    if (!requestRecords.has(key)) {
        requestRecords.set(key, { timestamps: [now], lastRequestTime: now });
        return {
            allowed: true,
            remaining: maxRequests - 1,
            resetTimeMs: now + windowMs,
            retryAfterSeconds: 0,
        };
    }

    const record = requestRecords.get(key);
    record.lastRequestTime = now;

    // Filter out timestamps outside the current rolling window
    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= maxRequests) {
        const oldestTimestamp = record.timestamps[0];
        const resetTimeMs = oldestTimestamp + windowMs;
        const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

        return {
            allowed: false,
            remaining: 0,
            resetTimeMs,
            retryAfterSeconds,
        };
    }

    record.timestamps.push(now);
    return {
        allowed: true,
        remaining: Math.max(0, maxRequests - record.timestamps.length),
        resetTimeMs: record.timestamps[0] + windowMs,
        retryAfterSeconds: 0,
    };
}

/**
 * Helper to extract client identifier from request
 */
function getClientIdentifier(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket && req.socket.remoteAddress) || '127.0.0.1';
    const authSession = req.headers.cookie ? (req.headers.cookie.match(/admin_session=([^;]+)/) || [])[1] : null;
    return authSession ? `session:${authSession.slice(-16)}` : `ip:${ip}`;
}

/**
 * Enforce rate limit on an HTTP request
 * @returns {boolean} true if allowed, false if rejected and response sent
 */
function enforceRateLimit(req, res, options = {}) {
    const clientId = getClientIdentifier(req);
    const result = checkRateLimit(clientId, options);

    if (res && res.setHeader && !res.headersSent) {
        res.setHeader('X-RateLimit-Limit', options.maxRequests || 20);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTimeMs / 1000));
    }

    if (!result.allowed) {
        if (res && res.setHeader && !res.headersSent) {
            res.setHeader('Retry-After', result.retryAfterSeconds);
        }
        res.status(429).json({
            error: 'Too Many Requests',
            message: `Assistant rate limit exceeded. Please wait ${result.retryAfterSeconds} seconds before trying again.`,
            retryAfter: result.retryAfterSeconds,
        });
        return false;
    }

    return true;
}

function resetRateLimits() {
    requestRecords.clear();
}

module.exports = {
    checkRateLimit,
    enforceRateLimit,
    getClientIdentifier,
    resetRateLimits,
};
