import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { translations } from '../locales';

const ContentContext = createContext();

export const KANNADA_DIGITS = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];

export const formatNumber = (value, lang = 'en') => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (lang === 'kn') {
        return str.replace(/[0-9]/g, (digit) => KANNADA_DIGITS[Number(digit)]);
    }
    return str;
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

const resolveLocalizedField = (field, lang) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.en || '';
};

export const ContentProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('language') || 'en';
    });

    const [rawContent, setRawContent] = useState({
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
                    console.warn(`[ContentProvider] Error fetching ${type}:`, fetchErr);
                }
                return null;
            };

            const [projData, expData, photoData, quotesData] = await Promise.all([
                fetchType('projects'),
                fetchType('experiences'),
                fetchType('photography'),
                fetchType('quotes'),
            ]);

            const newContent = {
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
            console.warn('[ContentProvider] Could not load dynamic content:', err);
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

    const toggleLanguage = () => {
        setLanguage((prev) => (prev === 'en' ? 'kn' : 'en'));
    };

    // UI Translation helper
    const t = (key, fallback) => {
        const translatedValue = key
            .split('.')
            .reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), translations[language]);

        if (translatedValue === undefined) {
            return fallback !== undefined ? fallback : key;
        }

        return normalizeEscapedNewlines(translatedValue);
    };

    // Pre-localized collections resolved for active language
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
        .filter((q) => (q.language || 'en') === language)
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

    const value = {
        language,
        setLanguage,
        toggleLanguage,
        t,
        tArray,
        formatNumber: formatNumberBound,
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

// Aliased export so existing useLanguage imports continue to work seamlessly
export const useLanguage = useContent;
