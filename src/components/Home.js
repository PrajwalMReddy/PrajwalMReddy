import React, {useEffect, useRef, useState} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import pulsarImg from '@img/pulsar.png';
import midilangImg from '@img/midilang.png';
import kannadadiscoImg from '@img/kannadadisco.png';
import sentimentImg from '@img/research-paper.png';
import firemediaImg from '@img/firemedia.png';
import jetblastersImg from '@img/jetblasters.png';
import robocupImg from '@img/robocup-2023.png';
import northlandImg from '@img/city-skyline.png';
import {Link} from "react-router-dom";

const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

// Image mapping function
const getImage = (imageName) => {
    const imageMap = {
        'pulsar': pulsarImg,
        'midilang': midilangImg,
        'kannadadisco': kannadadiscoImg,
        'research-paper': sentimentImg,
        'firemedia': firemediaImg,
        'jetblasters': jetblastersImg,
        'robocup-2023': robocupImg,
        'city-skyline': northlandImg
    };
    return imageMap[imageName] || null;
};

const Home = () => {
    const {t, language} = useLanguage();
    const [isCycling, setIsCycling] = useState(false);
    const [lastColor, setLastColor] = useState('');
    const [lastPct, setLastPct] = useState(0); // percent (0-1) of animation
    const headingRef = useRef(null);
    const hoverStartRef = useRef(null);

    // Color stops for both modes
    const colorStopsLight = [
        { pct: 0, color: '#2C3E50' },
        { pct: 0.16, color: '#0074D9' },
        { pct: 0.33, color: '#2ECC40' },
        { pct: 0.5, color: '#FFDC00' },
        { pct: 0.66, color: '#FF4136' },
        { pct: 0.83, color: '#F012BE' },
        { pct: 1, color: '#2C3E50' }
    ];
    const colorStopsDark = [
        { pct: 0, color: '#F5F7FA' },
        { pct: 0.16, color: '#39CCCC' },
        { pct: 0.33, color: '#FF851B' },
        { pct: 0.5, color: '#FFDC00' },
        { pct: 0.66, color: '#FF4136' },
        { pct: 0.83, color: '#F012BE' },
        { pct: 1, color: '#F5F7FA' }
    ];
    // Helper to get current mode
    const isDarkMode = () => document.body.classList.contains('dark-mode');
    // Helper to interpolate between two hex colors
    function interpolateColor(color1, color2, t) {
        // Remove # and parse
        const c1 = color1.substring(1);
        const c2 = color2.substring(1);
        const r1 = parseInt(c1.substring(0,2),16), g1 = parseInt(c1.substring(2,4),16), b1 = parseInt(c1.substring(4,6),16);
        const r2 = parseInt(c2.substring(0,2),16), g2 = parseInt(c2.substring(2,4),16), b2 = parseInt(c2.substring(4,6),16);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
    // Helper to get interpolated color at a given percent
    function getInterpolatedColorAtPercent(pct, stops) {
        for (let i = 1; i < stops.length; i++) {
            if (pct <= stops[i].pct) {
                const prev = stops[i-1];
                const next = stops[i];
                const localT = (pct - prev.pct) / (next.pct - prev.pct);
                return interpolateColor(prev.color, next.color, localT);
            }
        }
        return stops[stops.length-1].color;
    }
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

    return <div id="app-root">
        <SideNav/>

        <main>
            <div id="home">
                <h1
                    id="home-heading"
                    ref={headingRef}
                    className={isCycling ? 'cycle-animating' : ''}
                    style={lastColor ? { color: lastColor } : {}}
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

            {/*//TODO {experienceCards.length > 0 && <div id="experience">
                <h2 id="featured-projects-heading">{t('experienceTitle')}</h2>
                <p id="featured-projects-subheading">{t('experienceDescription')}</p>
                <div className="experience-line">
                    {experienceCards.map((item, idx) => (<ExperienceCard
                        key={idx}
                        title={item.title}
                        company={item.company}
                        duration={item.duration}
                        description={item.description}
                        technologies={item.technologies}
                    />))}
                </div>
            </div>}*/}

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
