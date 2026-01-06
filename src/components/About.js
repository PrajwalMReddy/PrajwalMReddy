import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import {Link} from "react-router-dom";

const About = ({showOnMainPage = false}) => {
    const {t} = useLanguage();

    const elements = [
        {
            id: 'heading',
            type: 'heading',
            textKey: showOnMainPage ? 'contactHeadingHome' : 'contactHeading',
            // Render heading in both contexts; renderer will choose appropriate tag/class
            showOnMain: true,
        },
        {
            id: 'intro',
            type: 'paragraph',
            textKey: 'contactIntro',
            className: 'contact-intro',
            showOnMain: false,
        },
        {
            id: 'subheading',
            type: 'heading2',
            textKey: 'contactSubheading',
            className: 'contact-subheading',
            showOnMain: false,
        },
        {
            id: 'contacts',
            type: 'list',
            listId: 'contact-list',
            itemClass: 'contact-element',
            showOnMain: true,
            items: [
                {id: 'email', render: () => <>{t('contactEmail')}</>, showOnMain: true},
                {
                    id: 'github',
                    render: () => (
                        <>
                            {t('contactGitHub')}
                            <a className="contact-link" href="https://github.com/PrajwalMReddy" target="_blank" rel="noopener noreferrer">github.com/PrajwalMReddy</a>
                        </>
                    ),
                    showOnMain: true
                },
                {
                    id: 'linkedin',
                    render: () => (
                        <>
                            {t('contactLinkedIn')}
                            <a className="contact-link" href="https://www.linkedin.com/in/prajwalmreddy" target="_blank" rel="noopener noreferrer">linkedin.com/in/prajwalmreddy</a>
                        </>
                    ),
                    showOnMain: true
                },
                {
                    id: 'calendar',
                    render: () => (
                        <>
                            {t('contactCalendar')}
                            <a className="contact-link" href="https://calendly.com/pmr93-cornell" target="_blank" rel="noopener noreferrer">{t('contactCalendarInfo')}</a>
                        </>
                    ),
                    showOnMain: false
                },
                {
                    id: 'blog',
                    render: () => (
                        <>
                            {t('contactBlog')}
                            <Link to="/blog" className="contact-link">{t('contactBlogInfo')}</Link>
                        </>
                    ),
                    showOnMain: false
                }
            ]
        },
        {
            id: 'notice',
            type: 'paragraph',
            textKey: 'contactNotice',
            className: 'contact-notice',
            showOnMain: true,
        }
    ];

    const shouldShow = (item) => (showOnMainPage ? item.showOnMain !== false : true);

    const renderElement = (el) => {
        if (!shouldShow(el)) return null;

        switch (el.type) {
            case 'heading':
                    // On the homepage, render a section-sized heading so it matches other
                    // homepage section headings (smaller). On the full About page render
                    // the main page-sized H1 so it matches other page headings.
                    if (showOnMainPage) {
                        return <h2 className="section-heading" key={el.id}>{t(el.textKey)}</h2>;
                    }
                    return <h1 id="contact-heading" key={el.id}>{t(el.textKey)}</h1>;
            case 'heading2':
                return <h2 id={el.id} className={el.className} key={el.id}>{t(el.textKey)}</h2>;
            case 'paragraph':
                return <p id={el.id} className={el.className} key={el.id}>{t(el.textKey)}</p>;
            case 'list': {
                const visibleItems = el.items ? el.items.filter(it => shouldShow(it)) : [];
                if (visibleItems.length === 0) return null;
                return (
                    <ul id={el.listId || el.id} key={el.id}>
                        {visibleItems.map(item => (
                            <li key={item.id} className={el.itemClass || ''}>{typeof item.render === 'function' ? item.render() : (item.textKey ? t(item.textKey) : null)}</li>
                        ))}
                    </ul>
                );
            }
            case 'image':
                return <img id={el.id} key={el.id} src={el.src} alt={el.alt || ''} className={el.className} />;
            case 'custom':
                return typeof el.render === 'function' ? el.render() : null;
            default:
                return null;
        }
    };

    return (
        <div id="contact-section">
            {elements.map(el => (
                <React.Fragment key={el.id}>{renderElement(el)}</React.Fragment>
            ))}
        </div>
    );
};

export default About;
