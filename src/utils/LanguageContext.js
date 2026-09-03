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

    useEffect(() => {
        // Save language preference to localStorage whenever it changes
        localStorage.setItem('language', language);
    }, [language]);

    const t = (key) => {
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
        <LanguageContext.Provider value={{language, setLanguage, t, toggleLanguage}}>
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
