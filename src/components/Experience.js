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
        window.scrollTo(0, 0)
    }, [])

    const experienceCards = t('experienceCards') || [];

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="project-heading">{t('experienceTitle')}</h1>
                <p className="home-text-sub" style={{marginLeft: 'var(--nav-width)', paddingLeft: '6%', paddingRight: '6%'}}>
                    {t('experienceDescription')}
                </p>

                <div className="experience-line" style={{marginLeft: 'var(--nav-width)', paddingLeft: '6%', paddingRight: '6%', marginTop: '2rem'}}>
                    {experienceCards.map((item, idx) => (
                        <ExperienceCard
                            key={idx}
                            title={item.title}
                            company={item.company}
                            duration={item.duration}
                            description={item.description}
                            technologies={item.technologies}
                        />
                    ))}
                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Experience;
