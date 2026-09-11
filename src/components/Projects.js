import React, {useEffect} from 'react';
import {useContent} from '../utils/ContentContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ProjectCard from './ProjectCard';
import {getImage} from '../utils/componentUtils';

const Projects = () => {
    const {t, projects, projectSections} = useContent();

    useEffect(() => {
        document.title = t('pageTitles.projects');
    }, [t]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <div id="projects">
                    <h1 id="project-heading">{t('projectsTitle')}</h1>
                    {projectSections.map((section) => {
                        const sectionProjects = projects.filter(p => p.section === section.id);
                        if (sectionProjects.length === 0) return null;

                        return (
                            <div key={section.id} id={`project-type-${section.id}`}>
                                <h2 className="project-type-heading">{section.title}</h2>
                                <div className="project-grid">
                                    {sectionProjects.map((item, idx) => (
                                        <ProjectCard
                                            key={item.id || idx}
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
                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Projects;
