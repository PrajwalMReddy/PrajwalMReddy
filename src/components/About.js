import React from 'react';
import {Link} from 'react-router-dom';
import {useContent} from '../utils/ContentContext';

const About = ({showOnMainPage = false}) => {
    const {t, aboutContent} = useContent();

    const heading = showOnMainPage
        ? (aboutContent?.homeHeading || t('contactHeadingHome'))
        : (aboutContent?.heading || t('contactHeading'));
    const intro = aboutContent?.intro || t('contactIntro');
    const subheading = aboutContent?.subheading || t('contactSubheading');
    const notice = aboutContent?.notice || t('contactNotice');

    const links = (aboutContent?.links || []).filter((item) => {
        if (showOnMainPage) {
            return item.showOnHome;
        }
        return true;
    });

    return (
        <div id="contact-section">
            {showOnMainPage ? (
                <h2 className="section-heading">{heading}</h2>
            ) : (
                <>
                    <h1 id="contact-heading">{heading}</h1>
                    {intro && intro.trim() ? (
                        <p id="intro" className="contact-intro">{intro}</p>
                    ) : null}
                    {subheading && (
                        <h2 id="subheading" className="contact-subheading">{subheading}</h2>
                    )}
                </>
            )}

            <ul id="contact-list">
                {links.map((linkItem, idx) => (
                    <li key={linkItem.id || idx} className="contact-element">
                        {linkItem.label && <span>{linkItem.label}</span>}
                        {linkItem.isLink && linkItem.url ? (
                            linkItem.isInternal ? (
                                <Link to={linkItem.url} className="contact-link">
                                    {linkItem.text || linkItem.url}
                                </Link>
                            ) : (
                                <a
                                    className="contact-link"
                                    href={linkItem.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {linkItem.text || linkItem.url}
                                </a>
                            )
                        ) : (
                            <span>{linkItem.text}</span>
                        )}
                    </li>
                ))}
            </ul>

            {notice && <p id="notice" className="contact-notice">{notice}</p>}
        </div>
    );
};

export default About;
