import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';

const Contact = () => {
    const {t} = useLanguage();
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="contact-heading">{t('contactHeading')}</h1>
                <ul id="contact-list">
                    <li className="contact-element">{t('contactEmail')}</li>
                    <li className="contact-element">
                        {t('contactGitHub')}
                        <a className="contact-link" href="https://github.com/PrajwalMReddy" target="_blank"
                           rel="noopener noreferrer">github.com/PrajwalMReddy</a>
                    </li>
                    <li className="contact-element">
                        {t('contactLinkedIn')}
                        <a className="contact-link" href="https://www.linkedin.com/in/prajwalmreddy" target="_blank"
                           rel="noopener noreferrer">www.linkedin.com/in/prajwalmreddy</a>
                    </li>
                </ul>
            </main>
            <Footer/>
        </div>
    );
};

export default Contact; 