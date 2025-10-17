import React, {useEffect, useState} from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import ResearchCard from './ResearchCard';
import {useLanguage} from '../utils/LanguageContext';
import { getAllResearchPosts } from '../utils/researchUtils';
import { translations } from '../locales';

const Research = () => {
    const {t} = useLanguage();
    const [mdPosts, setMdPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = t('pageTitles.research');
    }, [t]);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const posts = await getAllResearchPosts();
                // Preserve sectionTitle so we can place cards into correct locale-defined sections by localized title
                setMdPosts(posts.map(p => ({
                    title: p.title,
                    description: p.description,
                    link: `/research/${p.slug}`,
                    image: '',
                    sectionTitle: p.sectionTitle || null
                })));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Prefer grouped sections if available, otherwise fallback to flat list for backward compatibility
    const researchSections = t('researchSections');
    const researchCards = t('researchCards') || [];
    const hasSections = Array.isArray(researchSections) && researchSections.length > 0;

    let mergedSections = [];
    let mergedFlat = [];

    if (hasSections) {
        // Deep clone sections to avoid mutating translations
        mergedSections = researchSections.map(sec => ({
            ...sec,
            cards: Array.isArray(sec.cards) ? [...sec.cards] : []
        }));

        const leftovers = [];
        const norm = (s) => (s || '').toString().trim().toLowerCase();
        const currentSections = researchSections;
        const enSections = (translations?.en?.researchSections) || [];

        for (const card of mdPosts) {
            if (card.sectionTitle) {
                let inserted = false;

                // 1) Prefer English title index mapping => current language same index
                const enIdx = enSections.findIndex(s => norm(s.title) === norm(card.sectionTitle));
                if (enIdx !== -1 && enIdx < mergedSections.length) {
                    mergedSections[enIdx].cards.push({
                        title: card.title,
                        description: card.description,
                        link: card.link,
                        image: card.image
                    });
                    inserted = true;
                }

                // 2) Fallback: direct match by current language title
                if (!inserted) {
                    const curIdx = currentSections.findIndex(s => norm(s.title) === norm(card.sectionTitle));
                    if (curIdx !== -1) {
                        mergedSections[curIdx].cards.push({
                            title: card.title,
                            description: card.description,
                            link: card.link,
                            image: card.image
                        });
                        inserted = true;
                    }
                }

                if (inserted) continue;
            }
            leftovers.push(card);
        }

        if (leftovers.length) {
            mergedSections.push({
                title: t('researchArticlesTitle') || 'Articles',
                cards: leftovers.map(c => ({
                    title: c.title,
                    description: c.description,
                    link: c.link,
                    image: c.image
                }))
            });
        }
    } else {
        mergedFlat = [...researchCards, ...mdPosts.map(c => ({
            title: c.title,
            description: c.description,
            link: c.link,
            image: c.image
        }))];
    }
    return (
        <div id="app-root">
            <SideNav/>
            <main className="research-page">
                <h1 id="project-heading">{t('researchTitle')}</h1>
                {hasSections ? (
                    mergedSections.map((section, sIdx) => (
                        <div key={sIdx} className="project-section">
                            {section.title && (
                                <h2 className="project-type-heading">{section.title}</h2>
                            )}
                            <div className="project-grid">
                                {(section.cards || []).map((item, idx) => (
                                    <ResearchCard
                                        key={`${sIdx}-${idx}`}
                                        title={item.title}
                                        image={item.image}
                                        description={item.description}
                                        link={item.link}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="project-grid">
                        {mergedFlat.map((item, idx) => (
                            <ResearchCard
                                key={idx}
                                title={item.title}
                                image={item.image}
                                description={item.description}
                                link={item.link}
                            />
                        ))}
                    </div>
                )}
                {loading && (<div className="blog-loading">Loading...</div>)}
            </main>
            <Footer/>
        </div>
    );
};

export default Research; 