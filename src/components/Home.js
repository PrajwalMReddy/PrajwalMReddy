import React, {useEffect, useRef, useState} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import pulsarImg from '../../content/img/pulsar.png';
import midilangImg from '../../content/img/midilang.png';
import kannadadiscoImg from '../../content/img/kannadadisco.png';
import sentimentImg from '../../content/img/research-paper.png';
import firemediaImg from '../../content/img/firemedia.png';
import jetblastersImg from '../../content/img/jetblasters.png';
import robocupImg from '../../content/img/robocup-2023.png';
import northlandImg from '../../content/img/city-skyline.png';
import {Link} from "react-router-dom";
import {colorStopsDark, colorStopsLight, getInterpolatedColorAtPercent, isDarkMode} from '../utils/colorUtils';
import ExperienceCard from './ExperienceCard';
import {chunkArray, getImage} from '../utils/componentUtils';

const Home = () => {
    const {t, language} = useLanguage();
    const [isCycling, setIsCycling] = useState(false);
    const [lastColor, setLastColor] = useState('');
    const [lastPct, setLastPct] = useState(0); // percent (0-1) of animation
    const headingRef = useRef(null);
    const hoverStartRef = useRef(null);

    // Handlers for color cycling
    const handleHeadingMouseEnter = () => {
        setIsCycling(true);
        setLastColor('');
        hoverStartRef.current = Date.now();
        // Set animation delay so it resumes from lastPct
        if (headingRef.current) {
            const duration = 10; // seconds
            headingRef.current.style.animationDelay = `${-lastPct * duration}s`;
        }
    };
    const handleHeadingMouseLeave = () => {
        setIsCycling(false);
        if (hoverStartRef.current) {
            const elapsed = (Date.now() - hoverStartRef.current) / 1000; // seconds
            const duration = 10; // seconds
            const pct = ((elapsed % duration) / duration + lastPct) % 1;
            const stops = isDarkMode() ? colorStopsDark : colorStopsLight;
            const color = getInterpolatedColorAtPercent(pct, stops);
            setLastColor(color);
            setLastPct(pct);
            if (headingRef.current) {
                headingRef.current.style.animationDelay = '';
            }
        }
    };

    useEffect(() => {
        document.title = t('pageTitles.home');
    }, [t]);

    // Get all project cards and filter for featured ones
    const programmingProjectCards = t('programmingProjectCards') || [];
    const otherProjectCards = t('otherProjectCards') || [];
    const allProjectCards = [...programmingProjectCards, ...otherProjectCards];
    const featuredProjectCards = allProjectCards.filter(project => project.featured === true);

    // Get experience cards
    const experienceCards = t('experienceCards') || [];

    console.log(t('plane'));
    return <div id="app-root">
        <SideNav/>

        <main>
            <div id="home">
                <h1
                    id="home-heading"
                    ref={headingRef}
                    className={isCycling ? 'cycle-animating' : ''}
                    style={lastColor ? {color: lastColor} : {}}
                    onMouseEnter={handleHeadingMouseEnter}
                    onMouseLeave={handleHeadingMouseLeave}
                >
                    {t('homeTitle')}
                </h1>
                <div id="home-info">
                    <p className="home-text">{t('homeIntro')}</p>
                    <p className="home-text">{t('homeSubtitle')}</p>
                    <p className="home-text-sub">{t('homeDescription')}</p>
                </div>
            </div>

            <div id="skill-div">
                <h2 id="skill-heading">{t('skillsTitle')}</h2>
                <div className="skill-line">
                    <p className="skill-info">{t('skills.python')}</p>
                    <p className="skill-info">{t('skills.javaKotlin')}</p>
                    <p className="skill-info">{t('skills.cpp')}</p>
                    <p className="skill-info">{t('skills.dartFlutter')}</p>
                    <p className="skill-info">{t('skills.php')}</p>
                </div>
                <div className="skill-line">
                    <p className="skill-info">{t('skills.sql')}</p>
                    <p className="skill-info">{t('skills.web')}</p>
                    <p className="skill-info">{t('skills.rust')}</p>
                    <p className="skill-info">{t('skills.arduino')}</p>
                </div>
            </div>

            {featuredProjectCards.length > 0 && <div id="featured-projects">
                <h2 id="featured-projects-heading">{t('featuredProjectsTitle')}</h2>
                <h2 id="featured-projects-subheading"><Link to="/projects"
                                                            className="nav-link">{t('featuredProjectsSubTitle')}</Link>
                </h2>
                <div className="project-line">
                    {featuredProjectCards.map((item, idx) => (<ProjectCard
                        key={idx}
                        title={item.title}
                        image={getImage(item.image)}
                        description={item.description}
                        link={item.link}
                    />))}
                </div>
            </div>}

            {experienceCards.length > 0 && <div id="experience">
                <h2 id="featured-projects-heading">{t('experienceTitle')}</h2>
                <p id="featured-projects-subheading">{t('experienceDescription')}</p>
                <div className="experience-line">
                    {chunkArray(experienceCards, 2).map((row, rowIdx) => (<div className="experience-row" key={rowIdx}
                                                                               style={{
                                                                                   display: 'flex',
                                                                                   width: '100%',
                                                                                   gap: '30px'
                                                                               }}>
                        {row.map((item, idx) => (<ExperienceCard
                            key={idx}
                            title={item.title}
                            company={item.company}
                            duration={item.duration}
                            description={item.description}
                            technologies={item.technologies}
                        />))}
                        {row.length === 1 && <div className="experience-info" style={{visibility: 'hidden'}}></div>}
                    </div>))}
                </div>
            </div>}

            <div id="contact-section">
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
                    <li className="contact-element">
                        {t('contactBlog')}
                        <Link to="/blog" className="contact-link">{t('contactBlogInfo')}</Link>
                    </li>
                </ul>
            </div>
        </main>
        <Footer/>
    </div>;
};

export default Home;
