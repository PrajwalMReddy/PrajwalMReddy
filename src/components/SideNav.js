import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const SideNav = () => {
  const { t, language } = useLanguage();
  return (
    <nav id="nav-div">
      <ul id="nav-list">
        <li id="nav-main"><a href="/" className="nav-link">{t('navName')}</a></li>
        <li className="nav-element"><a href="/projects" className="nav-link">{t('project')}</a></li>
        <li className="nav-element"><a href="/blog" className="nav-link">{t('blog')}</a></li>
        <li className="nav-element"><a href="/contact" className="nav-link">{t('contact')}</a></li>
      </ul>
      <LanguageSwitcher />
    </nav>
  );
};

export default SideNav; 