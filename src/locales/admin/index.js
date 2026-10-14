import { adminCommon } from './common.js';
import { adminCms } from './cms.js';
import { adminTodo } from './todo.js';
import { adminBudget } from './budget.js';
import { adminNotes } from './notes.js';
import { adminNetworking } from './networking.js';

const adminModules = [
    adminCommon,
    adminCms,
    adminTodo,
    adminBudget,
    adminNotes,
    adminNetworking,
];

// Dynamically combine all admin sections for any arbitrary number of languages
export const admin = adminModules.reduce((acc, mod) => {
    if (mod && typeof mod === 'object') {
        Object.keys(mod).forEach((lang) => {
            if (!acc[lang]) acc[lang] = { admin: {} };
            acc[lang].admin = {
                ...acc[lang].admin,
                ...(mod[lang] || {}),
            };
        });
    }
    return acc;
}, {});

export { adminCommon } from './common.js';
export { adminCms } from './cms.js';
export { adminTodo } from './todo.js';
export { adminBudget } from './budget.js';
export { adminNotes } from './notes.js';
export { adminNetworking } from './networking.js';
