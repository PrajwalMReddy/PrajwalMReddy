import React, {useEffect, useRef, useState} from 'react';
import {useContent} from '../utils/ContentContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import About from './About';
import {Link} from 'react-router-dom';
import {colorStopsDark, colorStopsLight, getInterpolatedColorAtPercent, isDarkMode} from '../utils/colorUtils';
import ExperienceCard from './ExperienceCard';
import {chunkArray, getImage} from '../utils/componentUtils';

const Home = () => {
    const {t, projects, experiences, homeContent} = useContent();
    const [isCycling, setIsCycling] = useState(false);
    const [lastColor, setLastColor] = useState('');
    const [lastPct, setLastPct] = useState(0);
    const headingRef = useRef(null);
    const hoverStartRef = useRef(null);

    const handleHeadingMouseEnter = () => {
        setIsCycling(true);
        setLastColor('');
        hoverStartRef.current = Date.now();
        if (headingRef.current) {
            const duration = 10;
            headingRef.current.style.animationDelay = `${-lastPct * duration}s`;
        }
    };

    const handleHeadingMouseLeave = () => {
        setIsCycling(false);
        if (hoverStartRef.current) {
            const elapsed = (Date.now() - hoverStartRef.current) / 1000;
            const duration = 10;
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

    const featuredProjectCards = projects.filter(project => Boolean(project.featured));
    const featuredExperienceCards = experiences.filter(exp => Boolean(exp.featured));

    const skills = homeContent?.skills || [];
    const midSkills = Math.ceil(skills.length / 2);
    const skillRow1 = skills.slice(0, midSkills);
    const skillRow2 = skills.slice(midSkills);

    return (
        <div id="app-root">
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
                        {homeContent?.title || t('homeTitle')}
                    </h1>
                    <div id="home-info">
                        <p className="home-text">{homeContent?.intro || t('homeIntro')}</p>
                        <p className="home-text">{homeContent?.subtitle || t('homeSubtitle')}</p>
                        <p className="home-text-sub">{homeContent?.description || t('homeDescription')}</p>
                    </div>
                </div>

                {featuredProjectCards.length > 0 && (
                    <div id="featured-projects">
                        <div className="featured-section-header">
                            <h2 className="featured-section-heading">{t('featuredProjectsTitle')}</h2>
                            <h2 className="featured-section-subheading">
                                <Link to="/projects" className="nav-link featured-section-link">
                                    {t('featuredProjectsSubTitle')}
                                </Link>
                            </h2>
                        </div>
                        <div className="project-line">
                            {featuredProjectCards.map((item, idx) => (
                                <ProjectCard
                                    key={item.id || idx}
                                    title={item.title}
                                    subtitle={item.featured ? t('featuredProjectsTitle') : null}
                                    image={getImage(item.image)}
                                    description={item.description}
                                    link={item.link}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {featuredExperienceCards.length > 0 && (
                    <div id="experience">
                        <div className="featured-section-header">
                            <h2 className="featured-section-heading">{t('featuredExperienceTitle')}</h2>
                            <h2 className="featured-section-subheading">
                                <Link to="/experience" className="nav-link featured-section-link">
                                    {t('featuredExperienceSubTitle')}
                                </Link>
                            </h2>
                        </div>
                        <div className="experience-line">
                            {chunkArray(featuredExperienceCards, 2).map((row, rowIdx) => (
                                <div
                                    className="experience-row"
                                    key={rowIdx}
                                >
                                    {row.map((item, idx) => (
                                        <ExperienceCard
                                            key={item.id || idx}
                                            title={item.title}
                                            subtitle={item.featured ? t('featuredExperienceTitle') : null}
                                            company={item.company}
                                            duration={item.duration}
                                            description={item.description}
                                            notes={item.notes}
                                        />
                                    ))}
                                    {row.length === 1 && (
                                        <div className="experience-info experience-info-spacer" style={{visibility: 'hidden'}} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {skills.length > 0 && (
                    <div id="skill-div">
                        <h2 id="skill-heading">{homeContent?.skillsTitle || t('skillsTitle')}</h2>
                        <div className="skill-line">
                            {skillRow1.map((skill, idx) => (
                                <p key={skill.id || idx} className="skill-info">{skill.name}</p>
                            ))}
                        </div>
                        {skillRow2.length > 0 && (
                            <div className="skill-line">
                                {skillRow2.map((skill, idx) => (
                                    <p key={skill.id || idx} className="skill-info">{skill.name}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <About showOnMainPage={true}/>
            </main>
            <Footer/>
        </div>
    );
};

export default Home;
