import React, {useEffect} from 'react';
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

    useEffect(() => {
        document.title = t('pageTitles.home');
    }, [t]);

    // Get all project cards and filter for featured ones
    const programmingProjectCards = t('programmingProjectCards') || [];
    const otherProjectCards = t('otherProjectCards') || [];
    const allProjectCards = [...programmingProjectCards, ...otherProjectCards];
    const featuredProjectCards = allProjectCards.filter(project => project.featured === true);

    return <div id="app-root">
        <SideNav/>

        <main>
            <div id="home">
                <h1 id="home-heading">{t('homeTitle')}</h1>
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
                </ul>
            </div>
        </main>
        <Footer/>
    </div>;
};

export default Home; 