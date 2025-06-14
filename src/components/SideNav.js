import React from 'react';
import {Link} from 'react-router-dom';
import {useLanguage} from '../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const SideNav = () => {
    const {t, language} = useLanguage();
    return (
        <nav id="nav-div">
            <ul id="nav-list">
                <li id="nav-main"><Link to="/" className="nav-link">{t('navName')}</Link></li>
                <li className="nav-element"><Link to="/projects" className="nav-link">{t('project')}</Link></li>
                <li className="nav-element"><Link to="/blog" className="nav-link">{t('blog')}</Link></li>
                <li className="nav-element"><Link to="/contact" className="nav-link">{t('contact')}</Link></li>
            </ul>
            <LanguageSwitcher/>
        </nav>
    );
};

export default SideNav; 