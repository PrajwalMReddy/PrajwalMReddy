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

    // Settings config array for extensibility
    const settingsConfig = [{
        key: 'darkMode',
        label: <span className="settings-mode-label">{darkMode ? t('darkMode') : t('lightMode')}</span>,
        control: (<label className="theme-switch" style={{margin: 0}}>
            <input
                type="checkbox"
                checked={darkMode}
                onChange={() => setDarkMode((prev) => !prev)}
                aria-label={t('toggleDarkMode')}
            />
            <span className="slider round"></span>
        </label>)
    }, {
        key: 'language',
        label: <label htmlFor="nav-language-choice" className="settings-label">{t('changeLanguage')}</label>,
        control: (<select
            id="nav-language-choice"
            onChange={handleLanguageChange}
            name="languages"
            value={language === 'en' ? 'language-two' : 'language-one'}
            className="nav-language-select"
        >
            <option className="nav-language-option" value="language-one">{t('kannada')}</option>
            <option className="nav-language-option" value="language-two">{t('english')}</option>
        </select>)
    }];

    return (<div className="settings-bottom">
        <div id="settings-grid">
            {settingsConfig.map(setting => (<div className="settings-item" key={setting.key}>
                {setting.label}
                {setting.control}
            </div>))}
        </div>
    </div>);
};

export default Settings;