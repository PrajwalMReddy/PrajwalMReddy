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
};

const itemHandlers = {
    expenses: require('../lib/api-handlers/budget/expenses/[id]'),
    income: require('../lib/api-handlers/budget/income/[id]'),
    planner: require('../lib/api-handlers/budget/planner/[id]'),
    todo: require('../lib/api-handlers/todo/[id]'),
    notes: require('../lib/api-handlers/notes/[id]'),
};

function getHandler(pathname, query) {
    const itemMatch = pathname.match(/^\/api\/budget\/(expenses|income|planner)\/([^/]+)$/);
    if (itemMatch) {
        query.id = decodeURIComponent(itemMatch[2]);
        return itemHandlers[itemMatch[1]];
    }

    const simpleItemMatch = pathname.match(/^\/api\/(todo|notes)\/([^/]+)$/);
    if (simpleItemMatch) {
        query.id = decodeURIComponent(simpleItemMatch[2]);
        return itemHandlers[simpleItemMatch[1]];
    }

    return handlers[pathname];
}

module.exports = async (req, res) => {
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