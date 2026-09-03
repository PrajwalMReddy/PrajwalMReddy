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

const handlers = {
    '/api/auth/login':
        require('../lib/api-handlers/auth/login'),

    '/api/auth/logout':
        require('../lib/api-handlers/auth/logout'),

    '/api/auth/session':
        require('../lib/api-handlers/auth/session'),

    '/api/budget/expenses':
        require('../lib/api-handlers/budget/expenses'),

    '/api/budget/income':
        require('../lib/api-handlers/budget/income'),

    '/api/budget/stats':
        require('../lib/api-handlers/budget/stats'),

    '/api/budget/planner':
        require('../lib/api-handlers/budget/planner'),

    '/api/todo':
        require('../lib/api-handlers/todo'),

    '/api/notes':
        require('../lib/api-handlers/notes'),
};

function getHandler(pathname, query) {
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

    return handlers[pathname];
}

function addVercelResponseHelpers(res) {
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };

    res.json = (data) => {
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

            if (!res.writableEnded) {
                res.status(500).json({
                    error:
                        'Internal server error',
                });
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
