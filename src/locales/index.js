import {home} from './home';
import {projects} from './projects';
import {blog} from './blog';
import {contact} from './contact';
import {footer} from './footer';
import {languageSwitcher} from './languageSwitcher';
import {sideNav} from './sideNav';
import {projectCard} from './projectCard';
import {meta} from './meta';
import {research} from './research';
import {photography} from "./photography";

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
    en: deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(home.en, projects.en), blog.en), contact.en), footer.en), languageSwitcher.en), sideNav.en), projectCard.en), meta.en), research.en), photography.en),
    kn: deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(deepMerge(home.kn, projects.kn), blog.kn), contact.kn), footer.kn), languageSwitcher.kn), sideNav.kn), projectCard.kn), meta.kn), research.kn), photography.kn),
};
