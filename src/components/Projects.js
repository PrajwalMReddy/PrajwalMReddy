import React, {useEffect} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import {chunkArray, getImage} from '../utils/componentUtils';

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
                <div className="project-grid">
                    {programmingProjectCards.map((item, idx) => (<ProjectCard
                        key={idx}
                        title={item.title}
                        image={getImage(item.image)}
                        description={item.description}
                        link={item.link}
                    />))}
                </div>
            </div>
            <div id="project-type-other">
                <h2 className="project-type-heading">{t('otherProjects')}</h2>
                <div className="project-grid">
                    {otherProjectCards.map((item, idx) => (<ProjectCard
                        key={idx}
                        title={item.title}
                        image={getImage(item.image)}
                        description={item.description}
                        link={item.link}
                    />))}
                </div>
            </div>
        </main>
        <Footer/>
    </div>);
};

export default Projects; 