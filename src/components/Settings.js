import React from 'react';
import {useLanguage} from '../utils/LanguageContext';

const Settings = () => {
    const {language, setLanguage, t} = useLanguage();

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value === 'language-two' ? 'en' : 'kn');
    };

    // Dark mode toggle logic (inline, not separate component)
    const [darkMode, setDarkMode] = React.useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('darkMode');
            if (stored !== null) return stored === 'true';
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    React.useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    return (<div id="nav-language-div" style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        display: 'flex',
        width: '100%',
        margin: '0 auto',
        textAlign: 'left',
        boxSizing: 'border-box'
    }}>
        <div className="theme-toggle-wrapper"
             style={{display: 'flex', alignItems: 'center', width: '100%', margin: 0}}>
                <span style={{
                    marginRight: '6px',
                    fontSize: '15px',
                    fontWeight: 500,
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                }}>{darkMode ? t('darkMode') : t('lightMode')}</span>
            <label className="theme-switch" style={{margin: 0}}>
                <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={() => setDarkMode((prev) => !prev)}
                    aria-label={t('toggleDarkMode')}
                />
                <span className="slider round"></span>
            </label>
        </div>
        <div className="language-row" style={{
            display: 'flex', alignItems: 'flex-start', gap: '6px', width: '100%', margin: 0, flexWrap: 'nowrap'
        }}>
            <label id="nav-language-text" htmlFor="nav-language-choice" style={{
                fontSize: '14px',
                fontWeight: 500,
                margin: 0,
                textAlign: 'left',
                lineHeight: 1.1,
                minWidth: '60px',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                display: 'block'
            }}>{t('changeLanguage')}</label>
            <select
                id="nav-language-choice"
                onChange={handleLanguageChange}
                name="languages"
                value={language === 'en' ? 'language-two' : 'language-one'}
                className="nav-language-select"
                style={{fontSize: '14px', margin: 0, flexShrink: 1, maxWidth: '100%'}}
            >
                <option className="nav-language-option" value="language-one">{t('kannada')}</option>
                <option className="nav-language-option" value="language-two">{t('english')}</option>
            </select>
        </div>
    </div>);
};

export default Settings;