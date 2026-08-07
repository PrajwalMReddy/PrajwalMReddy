import React, {useEffect} from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ExperienceCard from './ExperienceCard';

const Experience = () => {
    const {t} = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.experience');
    }, [t]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const allExperienceCards = t('experienceCards') || [];
    const sections = t('experienceSections') || [];

    const renderSections = () => {
        return sections.map((section) => {
            const sectionExperiences = allExperienceCards.filter(exp => exp.section === section.id);
            if (sectionExperiences.length === 0) return null;

            return (<div key={section.id} id={`experience-type-${section.id}`}>
                <h2 className="experience-type-heading">{section.title}</h2>
                <div className="experience-grid">
                    {sectionExperiences.map((item, idx) => (<ExperienceCard
                        key={idx}
                        title={item.title}
                        company={item.company}
                        duration={item.duration}
                        description={item.description}
                        notes={item.notes}
                    />))}
                </div>
            </div>);
        });
    };

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="project-heading">{t('experienceTitle')}</h1>
            <div style={{marginLeft: 'var(--nav-width)', paddingLeft: '6%', paddingRight: '6%', marginTop: '2rem'}}>
                {renderSections()}
            </div>
        </main>
        <Footer/>
    </div>);
};

export default Experience;
