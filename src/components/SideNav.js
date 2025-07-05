import React, {useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

const SideNav = () => {
    const {t, language} = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    // Get all project cards and filter for featured ones
    const programmingProjectCards = t('programmingProjectCards') || [];
    const otherProjectCards = t('otherProjectCards') || [];
    const allProjectCards = [...programmingProjectCards, ...otherProjectCards];
    const featuredProjectCards = allProjectCards.filter(project => project.featured === true);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const navigateToSection = (sectionId) => {
        setIsOpen(false);

        // If we're not on the homepage, navigate there first
        if (location.pathname !== '/') {
            navigate('/');
            // Wait for navigation to complete, then scroll to section
            setTimeout(() => {
                const element = document.getElementById(sectionId);
                if (element) {
                    element.scrollIntoView({behavior: 'smooth'});
                }
            }, 100);
        } else {
            // If we're already on homepage, just scroll to section
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({behavior: 'smooth'});
            }
        }
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
                {/*<li className="nav-element"><Link to="/projects" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('project')}</Link></li>
                <li className="nav-element"><Link to="/blog" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('blog')}</Link></li>
                <li className="nav-element"><Link to="/research" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('research')}</Link></li>
                <li className="nav-element"><Link to="/photography" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('photography')}</Link></li>
                <li className="nav-element"><Link to="/contact" className="nav-link"
                                                  onClick={() => setIsOpen(false)}>{t('contact')}</Link></li>*/}

                {/* Homepage subsections */}
                <li className="nav-element">
                    <button
                        className="nav-link subsection-link"
                        onClick={() => navigateToSection('skill-div')}
                    >
                        {t('skill')}
                    </button>
                </li>
                {featuredProjectCards.length > 0 && <li className="nav-element">
                    <button
                        className="nav-link subsection-link"
                        onClick={() => navigateToSection('featured-projects')}
                    >
                        {t('project')}
                    </button>
                </li>}
                <li className="nav-element">
                    <button
                        className="nav-link subsection-link"
                        onClick={() => navigateToSection('contact-section')}
                    >
                        {t('contact')}
                    </button>
                </li>
            </ul>
            <LanguageSwitcher/>
        </nav>
        {isOpen && <div className="overlay" onClick={toggleMenu}></div>}
    </>);
};

export default SideNav; 