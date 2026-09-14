const fs = require('fs');
const http = require('http');
const path = require('path');

function loadEnvironment() {
    const envPath = path.resolve(
        __dirname,
        '..',
        '.env'
    );

    if (!fs.existsSync(envPath)) {
        return;
    }

    for (const line of fs
        .readFileSync(envPath, 'utf8')
        .split(/\r?\n/)) {
        const match = line.match(
            /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/
        );

        if (
            !match ||
            process.env[match[1]] !== undefined
        ) {
            continue;
        }

        let value = match[2];

        if (
            (value.startsWith('"') &&
                value.endsWith('"')) ||
            (value.startsWith("'") &&
                value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[match[1]] = value;
    }
}

loadEnvironment();

const routeMap = {
    '/api/auth/login': '../lib/api-handlers/auth/login',
    '/api/auth/logout': '../lib/api-handlers/auth/logout',
    '/api/auth/session': '../lib/api-handlers/auth/session',
    '/api/budget/expenses': '../lib/api-handlers/budget/expenses',
    '/api/budget/income': '../lib/api-handlers/budget/income',
    '/api/budget/stats': '../lib/api-handlers/budget/stats',
    '/api/budget/planner': '../lib/api-handlers/budget/planner',
    '/api/todo': '../lib/api-handlers/todo',
    '/api/notes': '../lib/api-handlers/notes',
    '/api/cms/content': '../lib/api-handlers/cms/content',
    '/api/content': '../lib/api-handlers/cms/content',
    '/api/cms/markdown': '../lib/api-handlers/cms/markdown',
    '/api/cms/upload': '../lib/api-handlers/cms/upload',
    '/api/konami/levels': '../lib/api-handlers/konami/levels',
    '/api/admin/summary': '../lib/api-handlers/admin/summary',
};

function getHandler(pathname, query) {
    // Invalidate require cache for lib/ in development so changes take effect immediately
    // Exclude lib/db.js so MongoDB client pool is persistent across requests
    const libDir = path.resolve(__dirname, '..', 'lib').toLowerCase();
    const dbPath = path.resolve(__dirname, '..', 'lib', 'db.js').toLowerCase();
    Object.keys(require.cache).forEach((key) => {
        const resolvedKey = path.resolve(key).toLowerCase();
        if (resolvedKey.startsWith(libDir) && resolvedKey !== dbPath) {
            delete require.cache[key];
        }
    });

    const expenseMatch = pathname.match(
        /^\/api\/budget\/expenses\/([^/]+)$/
    );

    if (expenseMatch) {
        query.id = decodeURIComponent(
            expenseMatch[1]
        );

        return require(
            '../lib/api-handlers/budget/expenses/[id]'
        );
    }

    const incomeMatch = pathname.match(
        /^\/api\/budget\/income\/([^/]+)$/
    );

    if (incomeMatch) {
        query.id = decodeURIComponent(
            incomeMatch[1]
        );

        return require(
            '../lib/api-handlers/budget/income/[id]'
        );
    }

    const plannerMatch = pathname.match(
        /^\/api\/budget\/planner\/([^/]+)$/
    );

    if (plannerMatch) {
        query.id = decodeURIComponent(
            plannerMatch[1]
        );

        return require(
            '../lib/api-handlers/budget/planner/[id]'
        );
    }

    const todoMatch = pathname.match(
        /^\/api\/todo\/([^/]+)$/
    );

    if (todoMatch) {
        query.id = decodeURIComponent(
            todoMatch[1]
        );

        return require(
            '../lib/api-handlers/todo/[id]'
        );
    }

    const notesMatch = pathname.match(
        /^\/api\/notes\/([^/]+)$/
    );

    if (notesMatch) {
        query.id = decodeURIComponent(
            notesMatch[1]
        );

        return require(
            '../lib/api-handlers/notes/[id]'
        );
    }



    const mediaMatch = pathname.match(
        /^\/(photography|img)\/([^/]+)$/
    );

    if (mediaMatch) {
        query.folder = mediaMatch[1];
        query.file = decodeURIComponent(
            mediaMatch[2]
        );

        return require(
            '../lib/api-handlers/cms/upload'
        );
    }

    if (pathname === '/api/konami/levels') {
        return require('../lib/api-handlers/konami/levels');
    }

    if (routeMap[pathname]) {
        return require(routeMap[pathname]);
    }

    return null;
}

function addVercelResponseHelpers(res) {
    res.status = (code) => {
        if (!res.headersSent) {
            res.statusCode = code;
        }
        return res;
    };

    res.send = (data) => {
        if (!res.headersSent) {
            res.end(data);
        }
        return res;
    };

    res.json = (data) => {
        if (res.headersSent) {
            if (!res.writableEnded) {
                res.end(JSON.stringify(data));
            }
            return res;
        }
        if (!res.getHeader('Content-Type')) {
            res.setHeader(
                'Content-Type',
                'application/json; charset=utf-8'
            );
        }

        res.end(JSON.stringify(data));

        return res;
    };
}

const server = http.createServer(
    async (req, res) => {
        const url = new URL(
            req.url,
            `http://${
                req.headers.host ||
                'localhost'
            }`
        );

        const query = Object.fromEntries(
            url.searchParams
        );

        const handler = getHandler(
            url.pathname,
            query
        );

        addVercelResponseHelpers(res);

        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (!handler) {
            return res.status(404).json({
                error: 'Not found',
                path: url.pathname,
            });
        }

        try {
            const chunks = [];

            for await (const chunk of req) {
                chunks.push(chunk);
            }

            const rawBody =
                Buffer.concat(chunks).toString(
                    'utf8'
                );

            try {
                req.body = rawBody
                    ? JSON.parse(rawBody)
                    : {};
            } catch {
                return res.status(400).json({
                    error:
                        'Invalid JSON request body',
                });
            }

            req.query = query;

            await handler(req, res);
        } catch (error) {
            console.error(
                'Local API error:',
                error
            );

            if (!res.headersSent && !res.writableEnded) {
                res.status(500).json({
                    error:
                        'Internal server error',
                });
            } else if (!res.writableEnded) {
                res.end();
            }
        }
    }
);

const port = Number(
    process.env.PORT || 3000
);

server.listen(port, () => {
    console.log(
        `Local API server listening on http://localhost:${port}`
    );
});

async function gracefulShutdown() {
    if (global.__mongoState && global.__mongoState.cachedClient) {
        try {
            await global.__mongoState.cachedClient.close();
        } catch (_) {}
    }
    process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
