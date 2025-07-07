import React, {useEffect, useState} from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import {useLanguage} from '../utils/LanguageContext';

// Helper function to group entries by initial letter
const groupByInitial = (entries) => {
    const grouped = {};
    entries.forEach(entry => {
        if (entry.telugu && entry.telugu.length > 0) {
            let initial = entry.telugu.charAt(0);
            if (initial === '-') {
                initial = entry.telugu.charAt(1);
            }

            if (!grouped[initial]) {
                grouped[initial] = [];
            }
            grouped[initial].push(entry);
        }
    });

    Object.keys(grouped).forEach(initial => {
        grouped[initial].sort((a, b) => a.telugu.localeCompare(b.telugu));
    });
    return grouped;
};

// Helper function to split array into two columns
const splitIntoColumns = (arr) => {
    const mid = Math.ceil(arr.length / 2);
    return [arr.slice(0, mid), arr.slice(mid)];
};

const BengaluruTeluguDictionary = () => {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const {t} = useLanguage();

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/research_content/bengaluru-telugu-lexicon.json');
                if (!response.ok) throw new Error('Failed to fetch dictionary');
                const data = await response.json();
                setEntries(data);

                // Set the page title for the dictionary subpage
                document.title = t('pageTitles.dictionary');
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [t]);

    // Filter entries by search
    const filteredEntries = entries.filter(entry => {
        const searchLower = search.toLowerCase();
        const teluguMatch = entry.telugu && entry.telugu.toLowerCase().includes(searchLower);
        const meaningMatch = entry.meaning && entry.meaning.some(m => m.toLowerCase().includes(searchLower));
        return teluguMatch || meaningMatch;
    });

    // Group entries by initial Kannada letter
    const grouped = groupByInitial(filteredEntries);
    const sortedInitials = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'kn'));

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="project-heading">{t('researchDictionaryTitle')}</h1>
            <div className="dictionary-search-bar">
                <h2 className="dictionary-section-heading">{t('researchDictionarySearchTitle')}</h2>
                <input
                    type="text"
                    placeholder={t('researchDictionarySearchPlaceholder')}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="dictionary-search-input"
                />
            </div>
            {loading ? (<div className="blog-post-loading">Loading...</div>) : error ? (
                <div className="blog-post-error">Error: {error}</div>) : (<div className="dictionary-list">
                {sortedInitials.length === 0 && (<div className="blog-post-error">{t('researchNoResults')}</div>)}
                {sortedInitials.map(initial => {
                    const [col1, col2] = splitIntoColumns(grouped[initial]);
                    return (<section key={initial} className="dictionary-section">
                        <h2 className="dictionary-section-heading">{initial}</h2>
                        <div className="dictionary-section-cols">
                            <div className="dictionary-section-col">
                                {col1.map((entry, idx) => (<div className="dictionary-entry" key={idx}>
                                    <div className="dictionary-word">
                                        <span className="dictionary-telugu">{entry.telugu}</span>
                                        {entry.ipa && <span className="dictionary-ipa">[{entry.ipa}]</span>}
                                        {entry.pos && <span className="dictionary-pos">({entry.pos})</span>}
                                    </div>
                                    <ol className="dictionary-meanings">
                                        {entry.meaning && entry.meaning.map((meaning, mIdx) => (
                                            <li key={mIdx}>{meaning}</li>))}
                                    </ol>
                                    {entry.note && Array.isArray(entry.note) && entry.note.length > 0 && (
                                        <div className="dictionary-note">{entry.note.map((n, i) => (
                                            <span key={i}>{n}<br/></span>))}</div>)}
                                </div>))}
                            </div>
                            <div className="dictionary-section-col">
                                {col2.map((entry, idx) => (<div className="dictionary-entry" key={idx}>
                                    <div className="dictionary-word">
                                        <span className="dictionary-telugu">{entry.telugu}</span>
                                        {entry.ipa && <span className="dictionary-ipa">[{entry.ipa}]</span>}
                                        {entry.pos && <span className="dictionary-pos">({entry.pos})</span>}
                                    </div>
                                    <ol className="dictionary-meanings">
                                        {entry.meaning && entry.meaning.map((meaning, mIdx) => (
                                            <li key={mIdx}>{meaning}</li>))}
                                    </ol>
                                    {entry.note && Array.isArray(entry.note) && entry.note.length > 0 && (
                                        <div className="dictionary-note">
                                            <b>{t('researchDictionaryNote')}</b><br/>{entry.note.map((n, i) => (
                                            <span key={i}>{n}<br/></span>))}</div>)}
                                </div>))}
                            </div>
                        </div>
                    </section>);
                })}
            </div>)}
        </main>
        <Footer/>
    </div>);
};

export default BengaluruTeluguDictionary;