import React, {useCallback, useEffect, useRef, useState} from "react";
import {useLanguage} from "../utils/LanguageContext";
import SideNav from "./SideNav";
import Footer from "./Footer";

// Remove importAll and require.context usage
// Dynamically import all images from the photography folder

const Photography = () => {
    const {t, language} = useLanguage();
    const [metadata, setMetadata] = useState([]);
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const [loadedImages, setLoadedImages] = useState(new Set());
    const [visibleImages, setVisibleImages] = useState(new Set());
    const [fullscreenImage, setFullscreenImage] = useState(null);
    const imageRefs = useRef({});

    useEffect(() => {
        document.title = t('pageTitles.photography');
    }, [t]);

    useEffect(() => {
        // Fetch the language-specific metadata file, fallback to English
        const fetchMeta = async () => {
            const langFile = `/photography/_metadata.${language}.json?v=${Date.now()}`;
            try {
                const res = await fetch(langFile);
                if (res.ok) {
                    setMetadata(await res.json());
                } else {
                    const fallback = await fetch('/photography/_metadata.en.json');
                    setMetadata(fallback.ok ? await fallback.json() : []);
                }
            } catch {
                const fallback = await fetch('/photography/_metadata.en.json');
                setMetadata(fallback.ok ? await fallback.json() : []);
            }
        };
        fetchMeta();
    }, [language]);

    // Intersection Observer for lazy loading
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const idx = parseInt(entry.target.dataset.index);
                if (entry.isIntersecting) {
                    setVisibleImages(prev => new Set([...prev, idx]));
                    // Load the image when it becomes visible
                    setLoadedImages(prev => new Set([...prev, idx]));
                }
            });
        }, {
            rootMargin: '100px', // Start loading 100px before the image comes into view
            threshold: 0.1
        });

        // Observe all image containers
        Object.values(imageRefs.current).forEach(ref => {
            if (ref) observer.observe(ref);
        });

        return () => observer.disconnect();
    }, []);

    // Helper to get metadata for a given filename
    const getMeta = (filename) => metadata.find(m => m.filename === filename);

    // Set ref for each image container
    const setImageRef = useCallback((el, idx) => {
        imageRefs.current[idx] = el;
    }, []);

    // Handle fullscreen toggle
    const toggleFullscreen = (img, meta) => {
        setFullscreenImage(fullscreenImage ? null : { img, meta });
    };

    // Close fullscreen on escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && fullscreenImage) {
                setFullscreenImage(null);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [fullscreenImage]);

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="blog-heading">{t("pageTitle")}</h1>
            <div id="gallery-div">
                {metadata.length === 0 ? null : (<div className="gallery-grid">
                    {metadata.map((meta, idx) => {
                        const imgUrl = `/photography/${meta.filename}`;
                        return (
                            <div
                                className="gallery-item"
                                key={idx}
                                style={{position: "relative"}}
                                onMouseEnter={() => setHoveredIdx(idx)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                <img
                                    src={imgUrl}
                                    alt={meta?.title || `Photography ${idx + 1}`}
                                    loading="lazy"
                                    style={{opacity: 1, transition: 'opacity 0.3s ease'}}
                                />
                                {hoveredIdx === idx && (
                                    <>
                                        <div className="photo-meta-overlay">
                                            <div className="photo-meta-title">{meta.title}</div>
                                            {meta.location && meta.location.place && (
                                                meta.location.lat && meta.location.lng ? (
                                                    <a className="photo-meta-location" href={`https://www.google.com/maps?q=${meta.location.lat},${meta.location.lng}`}
                                                       target="_blank" rel="noopener noreferrer">
                                                        {meta.location.place}
                                                    </a>
                                                ) : (
                                                    <span className="photo-meta-location">{meta.location.place}</span>
                                                )
                                            )}
                                            {meta.date && (
                                                <span className="photo-meta-date">{meta.date}</span>
                                            )}
                                        </div>
                                        <button
                                            className="expand-icon"
                                            onClick={e => {
                                                e.stopPropagation();
                                                setFullscreenImage({img: {src: imgUrl}, meta});
                                            }}
                                            aria-label="Expand image"
                                            style={{position: 'absolute', top: 10, right: 10, zIndex: 2}}
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>)}
            </div>
        </main>
        
        {/* Fullscreen overlay */}
        {fullscreenImage && (
            <div className="fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
                <div className="fullscreen-content">
                    <button 
                        className="close-fullscreen"
                        onClick={(e) => {
                            e.stopPropagation();
                            setFullscreenImage(null);
                        }}
                        aria-label="Close fullscreen"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                    <img 
                        src={fullscreenImage.img.src} 
                        alt={fullscreenImage.meta?.title || "Fullscreen image"}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="image-protector" onClick={e => e.stopPropagation()} />
                    {fullscreenImage.meta && (
                        <div className="fullscreen-meta">
                            <div className="fullscreen-title">{fullscreenImage.meta.title}</div>
                            {(fullscreenImage.meta.date || (fullscreenImage.meta.location && fullscreenImage.meta.location.place)) && (
                                <div className="fullscreen-date-location">
                                    {fullscreenImage.meta.location && fullscreenImage.meta.location.place && (
                                        fullscreenImage.meta.location.lat && fullscreenImage.meta.location.lng ? (
                                            <a className="fullscreen-location" href={`https://www.google.com/maps?q=${fullscreenImage.meta.location.lat},${fullscreenImage.meta.location.lng}`}
                                               target="_blank" rel="noopener noreferrer">
                                                {fullscreenImage.meta.location.place}
                                            </a>
                                        ) : (
                                            <span className="fullscreen-location">{fullscreenImage.meta.location.place}</span>
                                        )
                                    )}
                                    {fullscreenImage.meta.location && fullscreenImage.meta.location.place && fullscreenImage.meta.date && <span> &nbsp;&ndash;&nbsp; </span>}
                                    {fullscreenImage.meta.date && <span className="fullscreen-date">{fullscreenImage.meta.date}</span>}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}
        <Footer/>
    </div>);
};

export default Photography;