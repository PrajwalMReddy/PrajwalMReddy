import React from 'react';
import {useLanguage} from '../utils/LanguageContext';

const LanguageSwitcher = () => {
    const {language, setLanguage, t} = useLanguage();

    const handleLanguageChange = (event) => {
        setLanguage(event.target.value === 'language-two' ? 'en' : 'kn');
    };

    return (<div id="nav-language-div">
        <label id="nav-language-text" htmlFor="nav-language-choice">{t('changeLanguage')}</label>
        <select
            id="nav-language-choice"
            onChange={handleLanguageChange}
            name="languages"
            value={language === 'en' ? 'language-two' : 'language-one'}
        >
            <option className="nav-language-option" value="language-one">ಕನ್ನಡ</option>
            <option className="nav-language-option" value="language-two">English</option>
        </select>
    </div>);
};

export default LanguageSwitcher;