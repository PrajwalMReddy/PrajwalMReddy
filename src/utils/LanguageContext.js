import React, {createContext, useContext, useEffect, useState} from 'react';
import {translations} from '../locales';

const LanguageContext = createContext();

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

export const LanguageProvider = ({children}) => {
    const [language, setLanguage] = useState(() => {
        // Get the initial language from localStorage or default to 'en'
        return localStorage.getItem('language') || 'en';
    });

    const [dynamicTranslations, setDynamicTranslations] = useState({ en: {}, kn: {} });

    const loadDynamicMetadata = async () => {
        try {
            const [projectsRes, experienceRes] = await Promise.all([
                fetch(`/projects/metadata.json?v=${Date.now()}`).catch(() => null),
                fetch(`/experience/metadata.json?v=${Date.now()}`).catch(() => null),
            ]);

            const newDynamic = { en: {}, kn: {} };

            if (projectsRes && projectsRes.ok) {
                const pData = await projectsRes.json();
                if (pData) {
                    ['en', 'kn'].forEach((lang) => {
                        if (Array.isArray(pData.projects)) {
                            newDynamic[lang].projectCards = pData.projects.map((p) => ({
                                title: (p.title && (p.title[lang] || p.title.en || p.title)) || '',
                                description: (p.description && (p.description[lang] || p.description.en || p.description)) || '',
                                link: p.link || '',
                                image: p.image || '',
                                featured: Boolean(p.featured),
                                section: p.section || 'programming',
                            }));
                        }

                        if (Array.isArray(pData.sections)) {
                            newDynamic[lang].projectSections = pData.sections.map((s) => ({
                                id: s.id,
                                title: (s.title && (s.title[lang] || s.title.en || s.title)) || s.id,
                            }));
                        }
                    });
                }
            }

            if (experienceRes && experienceRes.ok) {
                const eData = await experienceRes.json();
                if (eData) {
                    ['en', 'kn'].forEach((lang) => {
                        if (Array.isArray(eData.experiences)) {
                            newDynamic[lang].experienceCards = eData.experiences.map((e) => ({
                                title: (e.title && (e.title[lang] || e.title.en || e.title)) || '',
                                company: (e.company && (e.company[lang] || e.company.en || e.company)) || '',
                                duration: (e.duration && (e.duration[lang] || e.duration.en || e.duration)) || '',
                                description: (e.description && (e.description[lang] || e.description.en || e.description)) || '',
                                notes: e.notes || { label: '', text: '' },
                                featured: Boolean(e.featured),
                                section: e.section || 'professional',
                            }));
                        }

                        if (Array.isArray(eData.sections)) {
                            newDynamic[lang].experienceSections = eData.sections.map((s) => ({
                                id: s.id,
                                title: (s.title && (s.title[lang] || s.title.en || s.title)) || s.id,
                            }));
                        }
                    });
                }
            }

            setDynamicTranslations(newDynamic);
        } catch (err) {
            console.warn('Could not load dynamic CMS metadata, using bundled locales:', err);
        }
    };

    useEffect(() => {
        loadDynamicMetadata();

        const handleUpdate = () => loadDynamicMetadata();
        window.addEventListener('cms-content-updated', handleUpdate);
        return () => window.removeEventListener('cms-content-updated', handleUpdate);
    }, []);

    useEffect(() => {
        // Save language preference to localStorage whenever it changes
        localStorage.setItem('language', language);
    }, [language]);

    const t = (key) => {
        // Check dynamic override first
        const dynamicVal = key
            .split('.')
            .reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), dynamicTranslations[language]);

        if (dynamicVal !== undefined) {
            return normalizeEscapedNewlines(dynamicVal);
        }

        // Support nested keys like 'skills.python'
        const translatedValue = key
            .split('.')
            .reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), translations[language]);

        if (translatedValue === undefined) {
            return key;
        }

        return normalizeEscapedNewlines(translatedValue);
    };

    const toggleLanguage = () => {
        setLanguage(prevLang => prevLang === 'en' ? 'kn' : 'en');
    };

    return (
        <LanguageContext.Provider value={{language, setLanguage, t, toggleLanguage, reloadMetadata: loadDynamicMetadata}}>
            {children}
        </LanguageContext.Provider>
    );
};

// Custom hook to use the language context
export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
