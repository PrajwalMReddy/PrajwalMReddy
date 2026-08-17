const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const COOKIE_NAME = 'admin_session';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is not set');
    }
    return secret;
}

function createToken() {
    return jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: TOKEN_MAX_AGE });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, getJwtSecret());
    } catch {
        return null;
    }
}

function parseCookies(cookieHeader) {
    if (!cookieHeader) return {};
    return cookieHeader.split(';').reduce((acc, part) => {
        const [key, ...rest] = part.trim().split('=');
        acc[key] = decodeURIComponent(rest.join('='));
        return acc;
    }, {});
}

function getSessionToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[COOKIE_NAME] || null;
}

function requireAuth(req, res) {
    const token = getSessionToken(req);
    if (!token || !verifyToken(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

function setAuthCookie(res, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE}; SameSite=Strict${secure}`
    );
}

function clearAuthCookie(res) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`
    );
}

async function verifyPassword(password) {
    const hash = process.env.ADMIN_PASSWORD_HASH;
    if (!hash) {
        throw new Error('ADMIN_PASSWORD_HASH environment variable is not set');
    }
    return bcrypt.compare(password, hash);
}

module.exports = {
    COOKIE_NAME,
    createToken,
    verifyToken,
    getSessionToken,
    requireAuth,
    setAuthCookie,
    clearAuthCookie,
    verifyPassword,
};
