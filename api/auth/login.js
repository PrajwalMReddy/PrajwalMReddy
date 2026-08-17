const { createToken, setAuthCookie, verifyPassword } = require('../../lib/auth');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        const valid = await verifyPassword(password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = createToken();
        setAuthCookie(res, token);
        return res.status(200).json({ authenticated: true });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
