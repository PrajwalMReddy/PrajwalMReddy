const { getSessionToken, verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = getSessionToken(req);
    const authenticated = token ? !!verifyToken(token) : false;
    return res.status(200).json({ authenticated });
};
