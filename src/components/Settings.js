import React from 'react';
import {useLanguage} from '../utils/LanguageContext';

const Settings = () => {
    const {language, setLanguage, t, darkMode, setDarkMode} = useLanguage();

    const settingsConfig = [{
        key: 'darkMode',
        label: <span className="settings-mode-label">{darkMode ? t('darkMode') : t('lightMode')}</span>,
        control: (
            <label className="theme-switch" style={{margin: 0}} title={t('toggleDarkMode')}>
                <input
                    type="checkbox"
                    checked={Boolean(darkMode)}
                    onChange={() => setDarkMode((prev) => !prev)}
                    aria-label={t('toggleDarkMode')}
                />
                <span className="slider round"></span>
            </label>
        )
    }, {
        key: 'language',
        label: <label htmlFor="nav-language-choice" className="settings-label">{t('changeLanguage')}</label>,
        control: (
            <select
                id="nav-language-choice"
                onChange={(event) => setLanguage(event.target.value)}
                name="languages"
                value={language === 'kn' ? 'kn' : 'en'}
                className="nav-language-select"
            >
                <option className="nav-language-option" value="kn">{t('kannada')}</option>
                <option className="nav-language-option" value="en">{t('english')}</option>
            </select>
        )
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
