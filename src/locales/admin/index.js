import { adminCommon } from './common.js';
import { adminCms } from './cms.js';
import { adminTodo } from './todo.js';
import { adminBudget } from './budget.js';
import { adminNotes } from './notes.js';

export const admin = {
    en: {
        admin: {
            ...adminCommon.en,
            ...adminCms.en,
            ...adminTodo.en,
            ...adminBudget.en,
            ...adminNotes.en,
        },
    },
    kn: {
        admin: {
            ...adminCommon.kn,
            ...adminCms.kn,
            ...adminTodo.kn,
            ...adminBudget.kn,
            ...adminNotes.kn,
        },
    },
};

export { adminCommon } from './common.js';
export { adminCms } from './cms.js';
export { adminTodo } from './todo.js';
export { adminBudget } from './budget.js';
export { adminNotes } from './notes.js';
