import React from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import ResearchCard from './ResearchCard';
import { useLanguage } from '../utils/LanguageContext';

const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
        result.push(arr.slice(i, i + size));
    }
    return result;
};

const Research = () => {
    const { t, language } = useLanguage();
    // Get research cards from translations
    const researchCards = t('researchCards') || [];
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="project-heading">{t('researchTitle')}</h1>
                {chunkArray(researchCards, 2).map((row, rowIdx) => (
                    <div className="project-line" key={rowIdx}>
                        {row.map((item, idx) => (
                            <ResearchCard
                                key={idx}
                                title={item.title}
                                image={item.image}
                                description={item.description}
                                link={item.link}
                            />
                        ))}
                    </div>
                ))}
            </main>
            <Footer/>
        </div>
    );
};

export default Research; 