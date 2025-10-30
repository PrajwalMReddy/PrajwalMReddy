import React, {useEffect, useRef, useState} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import ContactSection from './ContactSection';
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
    const allProjectCards = t('projectCards') || [];
    const featuredProjectCards = allProjectCards.filter(project => project.featured === true);

    // Get experience cards and show featured subset on home
    const allExperienceCards = t('experienceCards') || [];
    const featuredExperienceCards = allExperienceCards
        .filter(exp => exp.featured === true);

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

            {featuredProjectCards.length > 0 && <div id="featured-projects">
                <h2 id="featured-projects-heading">{t('featuredProjectsTitle')}</h2>
                <h2 id="featured-projects-subheading"><Link to="/projects"
                                                            className="nav-link">{t('featuredProjectsSubTitle')}</Link>
                </h2>
                <div className="project-line">
                    {featuredProjectCards.map((item, idx) => (<ProjectCard
                        key={idx}
                        title={item.title}
                        subtitle={item.featured ? t('featuredProjectsTitle') : null}
                        image={getImage(item.image)}
                        description={item.description}
                        link={item.link}
                    />))}
                </div>
            </div>}

            {featuredExperienceCards.length > 0 && <div id="experience">
                <h2 id="featured-projects-heading">{t('featuredExperienceTitle')}</h2>
                <h2 id="featured-projects-subheading"><Link to="/experience"
                                                            className="nav-link">{t('featuredExperienceSubTitle')}</Link>
                </h2>
                <div className="experience-line">
                    {chunkArray(featuredExperienceCards, 2).map((row, rowIdx) => (
                        <div className="experience-row" key={rowIdx}
                             style={{
                                 display: 'flex',
                                 width: '100%',
                                 gap: '30px'
                             }}>
                            {row.map((item, idx) => (<ExperienceCard
                                key={idx}
                                title={item.title}
                                subtitle={item.featured ? t('featuredExperienceTitle') : null}
                                company={item.company}
                                duration={item.duration}
                                description={item.description}
                                technologies={item.technologies}
                            />))}
                            {row.length === 1 && <div className="experience-info" style={{visibility: 'hidden'}}></div>}
                        </div>))}
                </div>
            </div>}

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

            <ContactSection showOnMainPage={true}/>
        </main>
        <Footer/>
    </div>;
};

export default Home;
