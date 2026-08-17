const fs = require('fs');
const http = require('http');
const path = require('path');

function loadEnvironment() {
    const envPath = path.resolve(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;

    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;

        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
    }
}

loadEnvironment();

const handlers = {
    '/api/auth/login': require('../api/auth/login'),
    '/api/auth/logout': require('../api/auth/logout'),
    '/api/auth/session': require('../api/auth/session'),
    '/api/budget/expenses': require('../api/budget/expenses'),
    '/api/budget/income': require('../api/budget/income'),
    '/api/budget/settings': require('../api/budget/settings'),
    '/api/budget/stats': require('../api/budget/stats'),
};

function getHandler(pathname, query) {
    const expenseMatch = pathname.match(/^\/api\/budget\/expenses\/([^/]+)$/);
    if (expenseMatch) {
        query.id = decodeURIComponent(expenseMatch[1]);
        return require('../api/budget/expenses/[id]');
    }

    const incomeMatch = pathname.match(/^\/api\/budget\/income\/([^/]+)$/);
    if (incomeMatch) {
        query.id = decodeURIComponent(incomeMatch[1]);
        return require('../api/budget/income/[id]');
    }

    return handlers[pathname];
}

function addVercelResponseHelpers(res) {
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        res.end(JSON.stringify(data));
        return res;
    };
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = Object.fromEntries(url.searchParams);
    const handler = getHandler(url.pathname, query);
    addVercelResponseHelpers(res);

    if (!handler) {
        return res.status(404).json({ error: 'Not found' });
    }

    try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const rawBody = Buffer.concat(chunks).toString('utf8');
        req.body = rawBody ? JSON.parse(rawBody) : {};
        req.query = query;
        await handler(req, res);
    } catch (error) {
        console.error('Local API error:', error);
        if (!res.writableEnded) res.status(500).json({ error: 'Internal server error' });
    }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
    console.log(`Local API server listening on http://localhost:${port}`);
});
