import React, {useEffect, useState} from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import ResearchCard from './ResearchCard';
import {useLanguage} from '../utils/LanguageContext';
import {getAllResearchPosts, getTranslatedResearch} from '../utils/researchUtils';

const Research = () => {
    const {t, language} = useLanguage();
    const [researchSections, setResearchSections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = t('pageTitles.research');
    }, [t]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const metadata = await getAllResearchPosts();
                const translatedSections = getTranslatedResearch(metadata, language);
                setResearchSections(translatedSections);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [language]);

    return (
        <div id="app-root">
            <SideNav/>
            <main className="research-page">
                <h1 id="project-heading">{t('researchTitle')}</h1>
                {loading ? (
                    <div className="blog-loading">Loading...</div>
                ) : (
                    researchSections.map((section, sIdx) => (
                        <div key={sIdx} className="project-section">
                            {section.title && (
                                <h2 className="project-type-heading">{section.title}</h2>
                            )}
                            <div className="project-grid">
                                {section.items.map((item, idx) => (
                                    <ResearchCard
                                        key={`${sIdx}-${idx}`}
                                        type={item.type}
                                        component={item.component}
                                        title={item.title}
                                        image={item.image}
                                        description={item.description}
                                        link={item.link}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </main>
            <Footer/>
        </div>
    );
};

export default Research; 