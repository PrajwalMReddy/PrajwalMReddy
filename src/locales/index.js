import {home} from './home';
import {projects} from './projects';
import {blog} from './blog';
import {contact} from './about';
import {footer} from './footer';
import {sideNav} from './sideNav';
import {meta} from './meta';
import {research} from './research';
import {photography} from "./photography";
import {settings} from './settings';
import {experience} from './experience';
import {konami} from './konami';

// Deep merge function to combine objects
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const deepMerge = (target, source) => {
    // If both are arrays, prefer the source array (do not merge array elements as objects)
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

// Combine all translations
export const translations = {
    en: deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(home.en, projects.en), blog.en), contact.en), footer.en), settings.en), sideNav.en), meta.en), research.en), photography.en), experience.en), konami.en),
    kn: deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(home.kn, projects.kn), blog.kn), contact.kn), footer.kn), settings.kn), sideNav.kn), meta.kn), research.kn), photography.kn), experience.kn), konami.kn),
};
