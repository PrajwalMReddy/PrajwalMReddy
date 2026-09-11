import React from 'react';
import {Link} from 'react-router-dom';
import {useContent} from '../utils/ContentContext';

const About = ({showOnMainPage = false}) => {
    const {t} = useContent();

    return (
        <div id="contact-section">
            {showOnMainPage ? (
                <h2 className="section-heading">{t('contactHeadingHome')}</h2>
            ) : (
                <>
                    <h1 id="contact-heading">{t('contactHeading')}</h1>
                    {t('contactIntro') && t('contactIntro').trim() ? (
                        <p id="intro" className="contact-intro">{t('contactIntro')}</p>
                    ) : null}
                    <h2 id="subheading" className="contact-subheading">{t('contactSubheading')}</h2>
                </>
            )}

            <ul id="contact-list">
                <li className="contact-element">{t('contactEmail')}</li>
                <li className="contact-element">
                    {t('contactGitHub')}
                    <a className="contact-link" href="https://github.com/PrajwalMReddy" target="_blank" rel="noopener noreferrer">github.com/PrajwalMReddy</a>
                </li>
                <li className="contact-element">
                    {t('contactLinkedIn')}
                    <a className="contact-link" href="https://www.linkedin.com/in/prajwalmreddy" target="_blank" rel="noopener noreferrer">linkedin.com/in/prajwalmreddy</a>
                </li>
                {!showOnMainPage && (
                    <>
                        <li className="contact-element">
                            {t('contactCalendar')}
                            <a className="contact-link" href="https://calendly.com/pmr93-cornell" target="_blank" rel="noopener noreferrer">{t('contactCalendarInfo')}</a>
                        </li>
                        <li className="contact-element">
                            {t('contactBlog')}
                            <Link to="/blog" className="contact-link">{t('contactBlogInfo')}</Link>
                        </li>
                    </>
                )}
            </ul>

            <p id="notice" className="contact-notice">{t('contactNotice')}</p>
        </div>
    );
};

export default About;
