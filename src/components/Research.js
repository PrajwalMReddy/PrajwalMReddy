import React, {useEffect} from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import ResearchCard from './ResearchCard';
import {useLanguage} from '../utils/LanguageContext';
import {chunkArray} from '../utils/componentUtils';

const Research = () => {
    const {t} = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.research');
    }, [t]);

    // Get research cards from translations
    const researchCards = t('researchCards') || [];
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="project-heading">{t('researchTitle')}</h1>
                <div className="project-grid">
                    {researchCards.map((item, idx) => (
                        <ResearchCard
                            key={idx}
                            title={item.title}
                            image={item.image}
                            description={item.description}
                            link={item.link}
                        />
                    ))}
                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Research; 