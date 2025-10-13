import React from 'react';
import { useLanguage } from '../utils/LanguageContext';
import { Link } from "react-router-dom";

const ContactSection = ({ showOnMainPage = false }) => {
    const { t } = useLanguage();

    // Configuration for every element in the contact section
    const sectionElements = {
        heading: {
            id: 'heading',
            type: 'heading',
            content: () => <h1 id="contact-heading">{t('contactHeading')}</h1>,
            showOnMain: true
        },
        intro: {
            id: 'intro',
            type: 'intro',
            content: () => (
                <p className="contact-intro">
                    {t('contactIntro')}
                </p>
            ),
            showOnMain: false
        },
        subheading: {
            id: 'subheading',
            type: 'subheading',
            content: () => <h2 className="contact-subheading">{t('contactSubheading')}</h2>,
            showOnMain: false
        },
        contactItems: [
            {
                id: 'email',
                type: 'contact-item',
                content: () => <>{t('contactEmail')}</>,
                showOnMain: true
            },
            {
                id: 'github',
                type: 'contact-item',
                content: () => (
                    <>
                        {t('contactGitHub')}
                        <a className="contact-link" href="https://github.com/PrajwalMReddy" target="_blank"
                           rel="noopener noreferrer">github.com/PrajwalMReddy</a>
                    </>
                ),
                showOnMain: true
            },
            {
                id: 'linkedin',
                type: 'contact-item',
                content: () => (
                    <>
                        {t('contactLinkedIn')}
                        <a className="contact-link" href="https://www.linkedin.com/in/prajwalmreddy" target="_blank"
                           rel="noopener noreferrer">linkedin.com/in/prajwalmreddy</a>
                    </>
                ),
                showOnMain: true
            },
            {
                id: 'calendar',
                type: 'contact-item',
                content: () => (
                    <>
                        {t('contactCalendar')}
                        <a className="contact-link" href="https://calendly.com/pmr93-cornell" target="_blank"
                           rel="noopener noreferrer">{t('contactCalendarInfo')}</a>
                    </>
                ),
                showOnMain: false
            },
            {
                id: 'blog',
                type: 'contact-item',
                content: () => (
                    <>
                        {t('contactBlog')}
                        <Link to="/blog" className="contact-link">{t('contactBlogInfo')}</Link>
                    </>
                ),
                showOnMain: false
            }
        ],
        notice: {
            id: 'notice',
            type: 'notice',
            content: () => <p className="contact-notice">{t('contactNotice')}</p>,
            showOnMain: true
        }
    };

    // Filter contact items based on the current page
    const filteredContactItems = sectionElements.contactItems.filter(item => 
        showOnMainPage ? item.showOnMain : true
    );

    // Helper function to check if an element should be shown
    const shouldShowElement = (element) => {
        return showOnMainPage ? element.showOnMain : true;
    };

    return (
        <div id="contact-section">
            {shouldShowElement(sectionElements.heading) && sectionElements.heading.content()}
            
            {shouldShowElement(sectionElements.intro) && sectionElements.intro.content()}
            
            {shouldShowElement(sectionElements.subheading) && sectionElements.subheading.content()}
            
            {filteredContactItems.length > 0 && (
                <ul id="contact-list">
                    {filteredContactItems.map(item => (
                        <li key={item.id} className="contact-element">
                            {item.content()}
                        </li>
                    ))}
                </ul>
            )}
            
            {shouldShowElement(sectionElements.notice) && sectionElements.notice.content()}
        </div>
    );
};

export default ContactSection;