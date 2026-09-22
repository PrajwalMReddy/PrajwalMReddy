const handlers = {
    '/api/auth/login': require('../lib/api-handlers/auth/login'),
    '/api/auth/logout': require('../lib/api-handlers/auth/logout'),
    '/api/auth/session': require('../lib/api-handlers/auth/session'),
    '/api/budget/expenses': require('../lib/api-handlers/budget/expenses'),
    '/api/budget/income': require('../lib/api-handlers/budget/income'),
    '/api/budget/stats': require('../lib/api-handlers/budget/stats'),
    '/api/budget/planner': require('../lib/api-handlers/budget/planner'),
    '/api/todo': require('../lib/api-handlers/todo'),
    '/api/notes': require('../lib/api-handlers/notes'),
    '/api/cms/content': require('../lib/api-handlers/cms/content'),
    '/api/content': require('../lib/api-handlers/cms/content'),
    '/api/cms/markdown': require('../lib/api-handlers/cms/markdown'),
    '/api/konami/levels': require('../lib/api-handlers/konami/levels'),
    '/api/admin/summary': require('../lib/api-handlers/admin/summary'),
    '/api/networking/people': require('../lib/api-handlers/networking'),
    '/api/networking/interactions': require('../lib/api-handlers/networking/interactions'),
};

const itemHandlers = {
    expenses: require('../lib/api-handlers/budget/expenses/[id]'),
    income: require('../lib/api-handlers/budget/income/[id]'),
    planner: require('../lib/api-handlers/budget/planner/[id]'),
    todo: require('../lib/api-handlers/todo/[id]'),
    notes: require('../lib/api-handlers/notes/[id]'),
    'networking-people': require('../lib/api-handlers/networking/people/[id]'),
    'networking-interactions': require('../lib/api-handlers/networking/interactions/[id]'),
};

function getHandler(pathname, query) {
    const itemMatch = pathname.match(/^\/api\/budget\/(expenses|income|planner)\/([^/]+)$/);
    if (itemMatch) {
        query.id = decodeURIComponent(itemMatch[2]);
        return itemHandlers[itemMatch[1]];
    }

    const networkingPersonMatch = pathname.match(/^\/api\/networking\/people\/([^/]+)$/);
    if (networkingPersonMatch) {
        query.id = decodeURIComponent(networkingPersonMatch[1]);
        return itemHandlers['networking-people'];
    }

    const networkingInteractionMatch = pathname.match(/^\/api\/networking\/interactions\/([^/]+)$/);
    if (networkingInteractionMatch) {
        query.id = decodeURIComponent(networkingInteractionMatch[1]);
        return itemHandlers['networking-interactions'];
    }

    const simpleItemMatch = pathname.match(/^\/api\/(todo|notes)\/([^/]+)$/);
    if (simpleItemMatch) {
        query.id = decodeURIComponent(simpleItemMatch[2]);
        return itemHandlers[simpleItemMatch[1]];
    }

    if (pathname.startsWith('/api/assistant')) {
        return require('../lib/api-handlers/assistant');
    }

    return handlers[pathname];
}

module.exports = async (req, res) => {
    if (res && res.setHeader && !res.headersSent) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const query = { ...Object.fromEntries(url.searchParams) };
    const pathname = query.path ? `/api/${query.path.replace(/^\/+/, '')}` : url.pathname;
    delete query.path;
    const handler = getHandler(pathname, query);

    if (!handler) {
        return res.status(404).json({ error: 'Not found', path: pathname });
    }

    req.query = { ...query, ...req.query };
    return handler(req, res);
};
