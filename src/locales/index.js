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
import {logs} from './logs.js';

export const DEFAULT_LANGUAGE = 'en';

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
    logs,
];

// Dynamically combine and discover all supported languages from imported modules
export const translations = modules.reduce((acc, mod) => {
    if (mod && typeof mod === 'object') {
        Object.keys(mod).forEach((lang) => {
            acc[lang] = deepMerge(acc[lang] || {}, mod[lang] || {});
        });
    }
    return acc;
}, {});

export const SUPPORTED_LANGUAGES = Object.keys(translations);

export const getActiveLanguage = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('language');
        if (stored && translations[stored]) {
            return stored;
        }
    }
    return DEFAULT_LANGUAGE;
};

const getNestedValue = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((curr, key) => (curr && curr[key] !== undefined ? curr[key] : undefined), obj);
};

export const tStatic = (key, lang = getActiveLanguage(), fallback, params) => {
    let activeLang = lang;
    let actualFallback = fallback;
    let actualParams = params;

    // Handle signatures where lang is omitted or passed as fallback or params
    if (typeof lang === 'object' && lang !== null && fallback === undefined) {
        actualParams = lang;
        actualFallback = undefined;
        activeLang = getActiveLanguage();
    } else if (typeof lang === 'string' && !translations[lang]) {
        if (typeof fallback === 'object' && fallback !== null && params === undefined) {
            actualParams = fallback;
            actualFallback = lang;
            activeLang = getActiveLanguage();
        }
    }

    const interpolate = (val) => {
        if (typeof val !== 'string' || !actualParams || typeof actualParams !== 'object') {
            return val;
        }
        let res = val;
        Object.entries(actualParams).forEach(([k, v]) => {
            const replacement = v !== undefined && v !== null ? String(v) : '';
            res = res.split(`{${k}}`).join(replacement);
        });
        return res;
    };

    const resolvedLang = translations[activeLang] ? activeLang : DEFAULT_LANGUAGE;

    // 1. Try active language
    let translatedValue = getNestedValue(translations[resolvedLang], key);

    // 2. Fallback to default language if missing in active
    if (translatedValue === undefined && resolvedLang !== DEFAULT_LANGUAGE) {
        translatedValue = getNestedValue(translations[DEFAULT_LANGUAGE], key);
    }

    // 3. Fallback to explicit fallback argument or key
    if (translatedValue === undefined) {
        return interpolate(actualFallback !== undefined ? actualFallback : key);
    }
    return interpolate(translatedValue);
};
