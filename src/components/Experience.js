import React, {useEffect} from 'react';
import {useContent} from '../utils/ContentContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ExperienceCard from './ExperienceCard';

const Experience = () => {
    const {t, experiences, experienceSections} = useContent();

    useEffect(() => {
        document.title = t('pageTitles.experience');
    }, [t]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <div id="experience" className="experience-page-container">
                    <h1 id="project-heading">{t('experienceTitle')}</h1>
                    <div className="experience-sections-wrap">
                        {experienceSections.map((section) => {
                            const sectionExperiences = experiences.filter(exp => exp.section === section.id);
                            if (sectionExperiences.length === 0) return null;

                            return (
                                <div key={section.id} id={`experience-type-${section.id}`} className="experience-section-block">
                                    <h2 className="experience-type-heading">{section.title}</h2>
                                    <div className="experience-grid">
                                        {sectionExperiences.map((item, idx) => (
                                            <ExperienceCard
                                                key={item.id || idx}
                                                title={item.title}
                                                company={item.company}
                                                duration={item.duration}
                                                description={item.description}
                                                notes={item.notes}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Experience;
