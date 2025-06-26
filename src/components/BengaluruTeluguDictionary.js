import React, {useEffect, useState} from 'react';
import SideNav from './SideNav';
import Footer from './Footer';
import {useLanguage} from '../utils/LanguageContext';

// Helper to get the first Kannada character
const getKannadaInitial = (word) => {
    if (!word) return '#';
    // Kannada unicode range: 0C80–0CFF
    const match = word.match(/[\u0C80-\u0CFF]/);
    return match ? match[0] : '#';
};

const groupByInitial = (entries) => {
    const grouped = {};
    entries.forEach(entry => {
        const initial = getKannadaInitial(entry.telugu);
        if (!grouped[initial]) grouped[initial] = [];
        grouped[initial].push(entry);
    });
    return grouped;
};

// Helper to split an array into two nearly equal columns
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
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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