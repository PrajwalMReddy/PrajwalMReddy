import React, {useEffect} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import {getImage} from '../utils/componentUtils';

const Projects = () => {
    const {t} = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.projects');
    }, [t]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const allProjectCards = t('projectCards') || [];
    const sections = t('projectSections') || [];

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="project-heading">{t('projectsTitle')}</h1>
                {sections.map((section) => {
                    const sectionProjects = allProjectCards.filter(project => project.section === section.id);
                    if (sectionProjects.length === 0) return null;

                    return (
                        <div key={section.id} id={`project-type-${section.id}`}>
                            <h2 className="project-type-heading">{section.title}</h2>
                            <div className="project-grid">
                                {sectionProjects.map((item, idx) => (
                                    <ProjectCard
                                        key={idx}
                                        title={item.title}
                                        image={getImage(item.image)}
                                        description={item.description}
                                        link={item.link}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </main>
            <Footer/>
        </div>
    );
};

export default Projects;
