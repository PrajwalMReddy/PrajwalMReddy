import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, tStatic } from '../locales';

const ContentContext = createContext();

export const NUMERAL_SYSTEMS = {
    kn: ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'],
};

export const formatNumber = (value, lang = DEFAULT_LANGUAGE) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    const digits = NUMERAL_SYSTEMS[lang];
    if (digits) {
        return str.replace(/[0-9]/g, (digit) => digits[Number(digit)] || digit);
    }
    return str;
};

export const MONTH_REGISTRY = {
    en: {
        short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    },
    kn: {
        short: ['ಜನ', 'ಫೆಬ್ರ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿ', 'ಮೇ', 'ಜೂನ್', 'ಜುಲೈ', 'ಆಗ', 'ಸೆಪ್ಟೆಂ', 'ಅಕ್ಟೋ', 'ನವೆಂ', 'ಡಿಸೆಂ'],
        long: ['ಜನವರಿ', 'ಫೆಬ್ರವರಿ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿಲ್', 'ಮೇ', 'ಜೂನ್', 'ಜುಲೈ', 'ಆಗಸ್ಟ್', 'ಸೆಪ್ಟೆಂಬರ್', 'ಅಕ್ಟೋಬರ್', 'ನವೆಂಬರ್', 'ಡಿಸೆಂಬರ್'],
    },
};

export const formatDate = (val, lang = DEFAULT_LANGUAGE, options = {}) => {
    if (!val) return '';
    let d;
    if (val instanceof Date) {
        d = val;
    } else {
        const str = String(val).trim();
        if (!str) return '';
        const matchDay = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const matchMonth = str.match(/^(\d{4})-(\d{2})$/);
        if (matchDay) {
            d = new Date(Number(matchDay[1]), Number(matchDay[2]) - 1, Number(matchDay[3]));
        } else if (matchMonth) {
            d = new Date(Number(matchMonth[1]), Number(matchMonth[2]) - 1, 1);
        } else {
            d = new Date(str);
        }
    }
    if (!d || Number.isNaN(d.getTime())) {
        return formatNumber(String(val), lang);
    }

    const monthIdx = d.getMonth();
    const day = d.getDate();
    const year = d.getFullYear();

    const monthFormat = options?.month || 'short';
    const isLong = monthFormat === 'long';
    const includeDay = options?.day !== false;
    const includeYear = options?.year !== false;

    const langMonths = MONTH_REGISTRY[lang] || MONTH_REGISTRY[DEFAULT_LANGUAGE] || MONTH_REGISTRY.en;
    const monthName = isLong ? langMonths.long[monthIdx] : langMonths.short[monthIdx];
    const dayStr = formatNumber(day, lang);
    const yearStr = formatNumber(year, lang);

    if (includeDay && includeYear) {
        return `${monthName} ${dayStr}, ${yearStr}`;
    }
    if (includeDay && !includeYear) {
        return `${monthName} ${dayStr}`;
    }
    if (!includeDay && includeYear) {
        return `${monthName} ${yearStr}`;
    }
    return monthName;
};

const normalizeEscapedNewlines = (value) => {
    if (typeof value === 'string') {
        return value.replace(/\\n/g, '\n');
    }
    if (Array.isArray(value)) {
        return value.map(normalizeEscapedNewlines);
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, normalizeEscapedNewlines(v)])
        );
    }
    return value;
};

const resolveLocalizedField = (field, lang = DEFAULT_LANGUAGE) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return (
        field[lang] ||
        field[DEFAULT_LANGUAGE] ||
        Object.values(field).find((v) => typeof v === 'string' && v.trim() !== '') ||
        ''
    );
};

export const ContentProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const saved = localStorage.getItem('language');
            if (saved && translations[saved]) return saved;
        }
        return DEFAULT_LANGUAGE;
    });

    const [rawContent, setRawContent] = useState({
        home: null,
        about: null,
        projects: { sections: [], projects: [] },
        experiences: { sections: [], experiences: [] },
        photos: [],
        quotes: [],
    });

    const [loading, setLoading] = useState(true);

    const loadAllContent = useCallback(async () => {
        try {
            const fetchType = async (type) => {
                try {
                    const apiRes = await fetch(`/api/cms/content?type=${type}&_t=${Date.now()}`);
                    if (apiRes.ok) {
                        return await apiRes.json();
                    }
                } catch (fetchErr) {
                    console.warn((tStatic('logs.contentFetchError', undefined, '[ContentProvider] Error fetching {type}:') || '').replace('{type}', type), fetchErr);
                }
                return null;
            };

            const [projData, expData, photoData, quotesData, homeData, aboutData] = await Promise.all([
                fetchType('projects'),
                fetchType('experiences'),
                fetchType('photography'),
                fetchType('quotes'),
                fetchType('home'),
                fetchType('about'),
            ]);

            const newContent = {
                home: homeData,
                about: aboutData,
                projects: { sections: [], projects: [] },
                experiences: { sections: [], experiences: [] },
                photos: [],
                quotes: [],
            };

            if (projData) {
                newContent.projects = {
                    sections: Array.isArray(projData.sections) ? projData.sections : [],
                    projects: Array.isArray(projData.projects) ? projData.projects : [],
                };
            }

            if (expData) {
                newContent.experiences = {
                    sections: Array.isArray(expData.sections) ? expData.sections : [],
                    experiences: Array.isArray(expData.experiences) ? expData.experiences : [],
                };
            }

            if (Array.isArray(photoData)) {
                newContent.photos = photoData;
            }

            if (Array.isArray(quotesData)) {
                newContent.quotes = quotesData;
            }

            setRawContent(newContent);
        } catch (err) {
            console.warn(tStatic('logs.contentDynamicError', undefined, '[ContentProvider] Could not load dynamic content:'), err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllContent();

        const handleUpdate = () => loadAllContent();
        window.addEventListener('cms-content-updated', handleUpdate);
        return () => window.removeEventListener('cms-content-updated', handleUpdate);
    }, [loadAllContent]);

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const toggleLanguage = (targetLang) => {
        if (targetLang && SUPPORTED_LANGUAGES.includes(targetLang)) {
            setLanguage(targetLang);
            return;
        }
        setLanguage((prev) => {
            const currentIdx = SUPPORTED_LANGUAGES.indexOf(prev);
            const nextIdx = (currentIdx + 1) % (SUPPORTED_LANGUAGES.length || 1);
            return SUPPORTED_LANGUAGES[nextIdx] || DEFAULT_LANGUAGE;
        });
    };

    // Pre-localized collections resolved for active language
    const defaultHome = {
        title: { en: "Hello World!", kn: "ನಮಸ್ಕಾರ!" },
        intro: { en: "I'm [ˈprɐ.dʒʋəl ˈrɛ.ɖːi]", kn: "ನಾನು ಪ್ರಜ್ವಲ ರೆಡ್ಡಿ" },
        subtitle: { en: "a student, programmer, and builder.", kn: "ಕಲಿಗ, ಹಮ್ಮುಗ, ಮತ್ತು ಕಟ್ಟುಗ." },
        description: {
            en: "I am a college student at Cornell University, studying a double major in Linguistics and Computer Science, with a specialization in Economics. I am also passionate about Urban Planning, often developing applications that focus on issues in these areas. My other non-academic interests include world building and conlanging.",
            kn: "ನಾನು ಕೊರ್ನೆಲ ಮೇಲ್ಕಲಿಮನೆಯಲ್ಲಿ ಕಲಿಗರಾಗಿದ್ದೇನೆ. ನುಡಿಯರಿಮೆ, ಎಣಿಯರಿಮೆ, ಮತ್ತು ಸೊಮ್ಮರಿಮೆಯನ್ನು ಓದುತ್ತಿದ್ದೇನೆ. ಅಶ್ಟೇ ಅಲ್ಲ, ನಗರ ಹಮ್ಮುಗೆಯ ಮೇಲೆ ತುಂಬಾ ಇಶ್ಟಪಡುತೇನೆ. ನನ್ನ ಇತರ ಆಸಕ್ತಿಗಳಲ್ಲಿ ಪ್ರಪಂಚ ಕಟ್ಟುವಿಕೆ ಮತ್ತು ನುಡಿ ಕಟ್ಟುವಿಕೆ ಎರಡು."
        },
        skillsTitle: { en: "My Programming Skills", kn: "ನನ್ನ ಹಮ್ಮುಗಾರಿಕೆಯ ಕಲಿಕೆಗಳು" },
        skills: [
            { id: "python", name: { en: "Python", kn: "ಪಾಯ್ತನ್" } },
            { id: "javaKotlin", name: { en: "Java and Kotlin", kn: "ಜಾವ ಮತ್ತು ಕಾಟ್ಲಿನ್" } },
            { id: "cpp", name: { en: "C and C++", kn: "ಸಿ ಮತ್ತು ಸಿ++" } },
            { id: "dartFlutter", name: { en: "Dart + Flutter", kn: "ಡಾರ್ಟ್ + ಪ್ಲಟರ್" } },
            { id: "php", name: { en: "PHP", kn: "ಪಿ.ಏಚ್.ಪಿ." } },
            { id: "sql", name: { en: "SQL + MySQL", kn: "ಸೀಕ್ವಲ್ + ಮಯ್ಸೀಕ್ವಲ್" } },
            { id: "web", name: { en: "HTML + CSS + JavaScript", kn: "ಏಚ್.ಟಿ.ಎಮ್.ಎಲ್. + ಸಿ.ಎಸ್.ಎಸ್. + ಜಾವಸ್ಕ್ರಿಪ್ಟ್" } },
            { id: "rust", name: { en: "Rust", kn: "ರಸ್ಟ್" } },
            { id: "arduino", name: { en: "Arduino", kn: "ಆರ್ಡ್ವೀನೊ" } }
        ]
    };

    const defaultAbout = {
        heading: { en: "About Me", kn: "ನನ್ನ ಬಗ್ಗೆ" },
        homeHeading: { en: "Contact Me", kn: "ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಿ" },
        intro: { en: "", kn: "" },
        subheading: { en: "Find Me Here", kn: "ನಾನು ಇಲ್ಲಿ ಸಿಗಬಹುದು" },
        notice: {
            en: "Feel free to reach out with any questions, thoughts, or just to say hello!",
            kn: "ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು, ಅನಿಸಿಕೆಗಳು, ಅಥವಾ ವಂದನೆಗಳು ಹೇಳಲು ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಲು ಹಿಂಜರಿಯಬೇಡಿ!"
        },
        links: [
            {
                id: "email",
                label: { en: "Email: ", kn: "ಮಿನ್ನಂಚೆ: " },
                text: { en: "prajwalmsreddy AT gmail DOT com", kn: "gmail ಚುಕ್ಕೆ com ಅಲ್ಲಿ prajwalmsreddy" },
                url: "mailto:prajwalmsreddy@gmail.com",
                isLink: false,
                isInternal: false,
                showOnHome: true,
            },
            {
                id: "github",
                label: { en: "GitHub: ", kn: "ಗಿಟ್‌ಹಬ್: " },
                text: { en: "github.com/PrajwalMReddy", kn: "github.com/PrajwalMReddy" },
                url: "https://github.com/PrajwalMReddy",
                isLink: true,
                isInternal: false,
                showOnHome: true,
            },
            {
                id: "linkedin",
                label: { en: "LinkedIn: ", kn: "ಲಿಂಕ್ಡ್ಇನ್: " },
                text: { en: "linkedin.com/in/prajwalmreddy", kn: "linkedin.com/in/prajwalmreddy" },
                url: "https://www.linkedin.com/in/prajwalmreddy",
                isLink: true,
                isInternal: false,
                showOnHome: true,
            },
            {
                id: "calendar",
                label: { en: "Calendar: ", kn: "ಹೊತ್ತುಪಟ್ಟಿ: " },
                text: { en: "book a short meeting with me...", kn: "ನನ್ನೊಂದಿಗೆ ಸಣ್ಣ ಸಭೆಯನ್ನು ಸೇರಿಸಲು..." },
                url: "https://calendly.com/pmr93-cornell",
                isLink: true,
                isInternal: false,
                showOnHome: false,
            },
            {
                id: "blog",
                label: { en: "Blog: ", kn: "ಮಿಂಬರಹ: " },
                text: { en: "read some of my thoughts here...", kn: "ನನ್ನ ಕೆಲವು ಯೋಚನೆಗಳನ್ನು ಇಲ್ಲಿ ಓದಿ..." },
                url: "/blog",
                isLink: true,
                isInternal: true,
                showOnHome: false,
            }
        ]
    };

    const activeHome = rawContent.home && (rawContent.home.title || rawContent.home.skills) ? rawContent.home : defaultHome;
    const homeContent = {
        title: resolveLocalizedField(activeHome.title, language),
        intro: resolveLocalizedField(activeHome.intro, language),
        subtitle: resolveLocalizedField(activeHome.subtitle, language),
        description: resolveLocalizedField(activeHome.description, language),
        skillsTitle: resolveLocalizedField(activeHome.skillsTitle, language),
        skills: (activeHome.skills || []).map((s) => ({
            id: s.id,
            name: resolveLocalizedField(s.name, language),
        })),
    };

    const activeAbout = rawContent.about && (rawContent.about.heading || rawContent.about.links) ? rawContent.about : defaultAbout;
    const aboutContent = {
        heading: resolveLocalizedField(activeAbout.heading, language),
        homeHeading: resolveLocalizedField(activeAbout.homeHeading, language),
        intro: resolveLocalizedField(activeAbout.intro, language),
        subheading: resolveLocalizedField(activeAbout.subheading, language),
        notice: resolveLocalizedField(activeAbout.notice, language),
        links: (activeAbout.links || []).map((l) => ({
            id: l.id,
            label: resolveLocalizedField(l.label, language),
            text: resolveLocalizedField(l.text, language),
            url: l.url || '',
            isLink: l.isLink !== false && Boolean(l.url),
            isInternal: Boolean(l.isInternal),
            showOnHome: l.showOnHome !== false,
        })),
    };

    const getNestedTranslation = (langCode, keyPath) => {
        const langDict = translations[langCode] || {};
        return keyPath.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), langDict);
    };

    // UI Translation helper with multi-tier fallback and token interpolation
    const t = (key, fallback, params) => {
        let actualFallback = fallback;
        let actualParams = params;
        if (typeof fallback === 'object' && fallback !== null && params === undefined) {
            actualParams = fallback;
            actualFallback = undefined;
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

        // Dynamic overrides for CMS home & about keys if called via t()
        if (key === 'homeTitle') return interpolate(homeContent.title || actualFallback || key);
        if (key === 'homeIntro') return interpolate(homeContent.intro || actualFallback || key);
        if (key === 'homeSubtitle') return interpolate(homeContent.subtitle || actualFallback || key);
        if (key === 'homeDescription') return interpolate(homeContent.description || actualFallback || key);
        if (key === 'skillsTitle') return interpolate(homeContent.skillsTitle || actualFallback || key);
        if (key === 'contactHeading') return interpolate(aboutContent.heading || actualFallback || key);
        if (key === 'contactHeadingHome') return interpolate(aboutContent.homeHeading || actualFallback || key);
        if (key === 'contactIntro') return interpolate(aboutContent.intro || actualFallback || '');
        if (key === 'contactSubheading') return interpolate(aboutContent.subheading || actualFallback || key);
        if (key === 'contactNotice') return interpolate(aboutContent.notice || actualFallback || key);

        let translatedValue = getNestedTranslation(language, key);

        if (translatedValue === undefined && language !== DEFAULT_LANGUAGE) {
            translatedValue = getNestedTranslation(DEFAULT_LANGUAGE, key);
        }

        if (translatedValue === undefined) {
            const raw = actualFallback !== undefined ? actualFallback : key;
            return interpolate(raw);
        }

        return interpolate(normalizeEscapedNewlines(translatedValue));
    };

    const projects = (rawContent.projects.projects || []).map((p) => ({
        id: p.id || '',
        title: resolveLocalizedField(p.title, language),
        description: resolveLocalizedField(p.description, language),
        link: p.link || '',
        image: p.image || '',
        featured: Boolean(p.featured),
        section: p.section || 'programming',
    }));

    const projectSections = (rawContent.projects.sections || []).map((s) => ({
        id: s.id,
        title: resolveLocalizedField(s.title, language) || s.id,
    }));

    const experiences = (rawContent.experiences.experiences || []).map((e) => ({
        id: e.id || '',
        title: resolveLocalizedField(e.title, language),
        company: resolveLocalizedField(e.company, language),
        duration: resolveLocalizedField(e.duration, language),
        description: resolveLocalizedField(e.description, language),
        notes: e.notes || { label: '', text: '' },
        featured: Boolean(e.featured),
        section: e.section || 'professional',
    }));

    const experienceSections = (rawContent.experiences.sections || []).map((s) => ({
        id: s.id,
        title: resolveLocalizedField(s.title, language) || s.id,
    }));

    const photos = (rawContent.photos || []).map((photo) => ({
        id: photo.id || photo.filename?.replace(/\.[^/.]+$/, '') || '',
        filename: photo.filename,
        title: resolveLocalizedField(photo.title, language),
        date: resolveLocalizedField(photo.date, language),
        location: {
            place: resolveLocalizedField(photo.location?.place, language),
            lat: photo.location?.lat ?? null,
            lng: photo.location?.lng ?? null,
        },
    }));

    const activeQuotes = (rawContent.quotes || [])
        .filter((q) => (q.language || DEFAULT_LANGUAGE) === language)
        .map((q) => {
            const text = resolveLocalizedField(q.text, language);
            const author = resolveLocalizedField(q.author, language);
            if (text && author) {
                const cleanAuthor = author.replace(/^[—–-]\s*/, '');
                return `${text}\n— ${cleanAuthor}`;
            }
            return text || '';
        })
        .filter(Boolean);

    const fallbackQuotes = (rawContent.quotes || [])
        .map((q) => {
            const text = resolveLocalizedField(q.text, language);
            const author = resolveLocalizedField(q.author, language);
            if (text && author) {
                const cleanAuthor = author.replace(/^[—–-]\s*/, '');
                return `${text}\n— ${cleanAuthor}`;
            }
            return text || '';
        })
        .filter(Boolean);

    const quotes = activeQuotes.length > 0 ? activeQuotes : fallbackQuotes;

    // Backwards compatibility helper for existing tArray calls
    const tArray = (key, fallback = []) => {
        if (key === 'projectCards') return projects;
        if (key === 'projectSections') return projectSections;
        if (key === 'experienceCards') return experiences;
        if (key === 'experienceSections') return experienceSections;
        const val = t(key, fallback);
        return Array.isArray(val) ? val : fallback;
    };

    const formatNumberBound = useCallback(
        (val, overrideLang) => formatNumber(val, overrideLang || language),
        [language]
    );

    const formatDateBound = useCallback(
        (val, options, overrideLang) => formatDate(val, overrideLang || language, options),
        [language]
    );

    const value = {
        language,
        setLanguage,
        toggleLanguage,
        supportedLanguages: SUPPORTED_LANGUAGES,
        defaultLanguage: DEFAULT_LANGUAGE,
        t,
        tArray,
        formatNumber: formatNumberBound,
        formatDate: formatDateBound,
        homeContent,
        aboutContent,
        rawContent,
        projects,
        projectSections,
        experiences,
        experienceSections,
        photos,
        quotes,
        loading,
        reloadContent: loadAllContent,
    };

    return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};

export const useContent = () => {
    const context = useContext(ContentContext);
    if (!context) {
        throw new Error('useContent must be used within a ContentProvider');
    }
    return context;
};

export const useLanguage = useContent;
export { tStatic, getActiveLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../locales';
