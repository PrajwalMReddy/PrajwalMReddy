import {home} from './home';
import {projects} from './projects';
import {blog} from './blog';
import {contact} from './contact';
import {footer} from './footer';
import {sideNav} from './sideNav';
import {meta} from './meta';
import {research} from './research';
import {photography} from "./photography";
import {settings} from './settings';
import {experience} from './experience';
import {konami} from './konami';

// Deep merge function to combine objects
const deepMerge = (target, source) => {
    const result = {...target};
    for (const key in source) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
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
