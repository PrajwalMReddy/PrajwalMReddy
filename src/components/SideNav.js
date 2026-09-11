import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageContext';
import Settings from './Settings';

const SideNav = () => {
    const { t } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    return (<>
        <button
            className="hamburger-menu"
            onClick={toggleMenu}
            aria-label="Toggle menu"
        >
            <span></span>
            <span></span>
            <span></span>
        </button>
        <nav id="nav-div" className={isOpen ? 'open' : ''}>
            <ul id="nav-list">
                <li id="nav-main"><Link to="/" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('navName')}</Link></li>
                <li className="nav-element"><Link to="/projects" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('project')}</Link></li>
                {/*<li className="nav-element"><Link to="/experience" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('experience')}</Link></li>*/}
                <li className="nav-element"><Link to="/blog" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('blog')}</Link></li>
                <li className="nav-element"><Link to="/photography" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('photography')}</Link></li>
                <li className="nav-element"><Link to="/about" className="nav-link"
                    onClick={() => setIsOpen(false)}>{t('contact')}</Link></li>
            </ul>
            <Settings />
        </nav>
        {isOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </>);
};

export default SideNav;
