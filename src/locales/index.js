import {navigation} from './navigation';
import {home} from './home';
import {projects} from './projects';
import {blog} from './blog';
import {contact} from './contact';

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
    en: deepMerge(
        deepMerge(
            deepMerge(
                deepMerge(navigation.en, home.en),
                projects.en
            ),
            blog.en
        ),
        contact.en
    ),
    kn: deepMerge(
        deepMerge(
            deepMerge(
                deepMerge(navigation.kn, home.kn),
                projects.kn
            ),
            blog.kn
        ),
        contact.kn
    )
}; 