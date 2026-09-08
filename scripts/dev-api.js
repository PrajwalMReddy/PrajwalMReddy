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
    '/api/ai/chat': '../lib/api-handlers/ai/chat',
    '/api/ai/memory': '../lib/api-handlers/ai/memory',
    '/api/ai/goals': '../lib/api-handlers/ai/goals',
    '/api/ai/projects': '../lib/api-handlers/ai/projects',
    '/api/ai/conversations': '../lib/api-handlers/ai/conversations',
    '/api/ai/preferences': '../lib/api-handlers/ai/preferences',
    '/api/ai/briefing': '../lib/api-handlers/ai/briefing',
    '/api/ai/news': '../lib/api-handlers/ai/news',
    '/api/ai/tools': '../lib/api-handlers/ai/tools',
};

function getHandler(pathname, query) {
    // Invalidate require cache for lib/ in development so changes take effect immediately
    const libDir = path.resolve(__dirname, '..', 'lib');
    Object.keys(require.cache).forEach((key) => {
        if (key.startsWith(libDir)) {
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

    const aiMatch = pathname.match(
        /^\/api\/ai\/(memory|goals|projects|conversations)\/([^/]+)$/
    );

    if (aiMatch) {
        query.id = decodeURIComponent(
            aiMatch[2]
        );

        return require(
            `../lib/api-handlers/ai/${aiMatch[1]}`
        );
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
