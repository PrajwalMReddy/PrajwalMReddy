import {home} from './home.js';
import {projects} from './projects.js';
import {blog} from './blog.js';
import {contact} from './about.js';
import {footer} from './footer.js';
import {sideNav} from './sideNav.js';
import {meta} from './meta.js';
import {research} from './research.js';
import {photography} from './photography.js';
import {settings} from './settings.js';
import {experience} from './experience.js';
import {konami} from './konami.js';
import {admin} from './admin.js';

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

const deepMerge = (target, source) => {
    if (Array.isArray(target) && Array.isArray(source)) {
        return source.slice();
    }

    const result = Array.isArray(target) ? target.slice() : {...target};
    for (const key in source) {
        if (isObject(source[key]) && key in target && isObject(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
};

const modules = [
    home,
    projects,
    blog,
    contact,
    footer,
    settings,
    sideNav,
    meta,
    research,
    photography,
    experience,
    konami,
    admin,
];

// Combine all translations
export const translations = {
    en: modules.reduce((acc, mod) => deepMerge(acc, mod?.en || {}), {}),
    kn: modules.reduce((acc, mod) => deepMerge(acc, mod?.kn || {}), {}),
};
