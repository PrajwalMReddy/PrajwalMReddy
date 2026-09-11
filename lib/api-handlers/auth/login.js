const { createToken, setAuthCookie, verifyPassword } = require('../../../lib/auth');

const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

function cleanupAttempts() {
    const now = Date.now();
    for (const [ip, record] of loginAttempts.entries()) {
        if (now - record.firstAttempt > LOCKOUT_WINDOW_MS) {
            loginAttempts.delete(ip);
        }
    }
}

module.exports = async (req, res) => {
    if (res && res.setHeader && !res.headersSent) {
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        cleanupAttempts();

        const ip = getClientIp(req);
        const record = loginAttempts.get(ip);
        const now = Date.now();

        if (record && record.count >= MAX_ATTEMPTS) {
            const timeRemainingMinutes = Math.ceil((record.firstAttempt + LOCKOUT_WINDOW_MS - now) / 60000);
            return res.status(429).json({
                error: `Too many failed login attempts. Please try again in ${Math.max(1, timeRemainingMinutes)} minute(s).`,
            });
        }

        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const valid = await verifyPassword(password);
        if (!valid) {
            const current = loginAttempts.get(ip) || { count: 0, firstAttempt: now };
            current.count += 1;
            loginAttempts.set(ip, current);

            return res.status(401).json({ error: 'Invalid password' });
        }

        // Login succeeded, clear any failed attempts for this IP
        loginAttempts.delete(ip);

        const token = createToken();
        setAuthCookie(res, token);
        return res.status(200).json({ authenticated: true });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
