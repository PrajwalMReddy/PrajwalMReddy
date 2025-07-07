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

const Projects = () => {
    const {t} = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.projects');
    }, [t]);

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    // Get project cards from translations
    const programmingProjectCards = t('programmingProjectCards') || [];
    const otherProjectCards = t('otherProjectCards') || [];

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="project-heading">{t('projectsTitle')}</h1>
            <div id="project-type-programming">
                <h2 className="project-type-heading">{t('programmingProjects')}</h2>
                {chunkArray(programmingProjectCards, 2).map((row, rowIdx) => (
                    <div className="project-line" key={rowIdx}>
                        {row.map((item, idx) => (<ProjectCard
                            key={idx}
                            title={item.title}
                            image={getImage(item.image)}
                            description={item.description}
                            link={item.link}
                        />))}
                    </div>))}
            </div>
            <div id="project-type-other">
                <h2 className="project-type-heading">{t('otherProjects')}</h2>
                {chunkArray(otherProjectCards, 2).map((row, rowIdx) => (<div className="project-line" key={rowIdx}>
                    {row.map((item, idx) => (<ProjectCard
                        key={idx}
                        title={item.title}
                        image={getImage(item.image)}
                        description={item.description}
                        link={item.link}
                    />))}
                </div>))}
            </div>
        </main>
        <Footer/>
    </div>);
};

export default Projects; 