import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useContent } from "../utils/ContentContext";
import SideNav from "./SideNav";
import Footer from "./Footer";

const Photography = () => {
    const { t, photos, formatNumber } = useContent();
    const [hoveredIdx, setHoveredIdx] = useState(null);
    const [fullscreenPhotoId, setFullscreenPhotoId] = useState(null);

    useEffect(() => {
        document.title = t('pageTitles.photography');
    }, [t]);

    const setPhotoHash = useCallback((photoId) => {
        if (!photoId) return;
        const encodedHash = `#${encodeURIComponent(photoId)}`;
        if (window.location.hash !== encodedHash) {
            window.location.hash = encodedHash;
        }
    }, []);

    const clearPhotoHash = useCallback(() => {
        if (!window.location.hash) return;
        const { pathname, search } = window.location;
        window.history.pushState(null, '', `${pathname}${search}`);
    }, []);

    const openFullscreen = useCallback((photo) => {
        setFullscreenPhotoId(photo.id);
        setPhotoHash(photo.id);
    }, [setPhotoHash]);

    const closeFullscreen = useCallback(() => {
        setFullscreenPhotoId(null);
        clearPhotoHash();
    }, [clearPhotoHash]);

    // Sync fullscreen state with URL hash
    useEffect(() => {
        const syncFullscreenFromHash = () => {
            const hashPhotoId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
            if (!hashPhotoId) {
                setFullscreenPhotoId(null);
                return;
            }

            const targetPhoto = photos.find((p) => p.id === hashPhotoId);
            if (targetPhoto) {
                setFullscreenPhotoId(targetPhoto.id);
            }
        };

        syncFullscreenFromHash();
        window.addEventListener('hashchange', syncFullscreenFromHash);
        return () => window.removeEventListener('hashchange', syncFullscreenFromHash);
    }, [photos]);

    // Close fullscreen on escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && fullscreenPhotoId) {
                closeFullscreen();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [closeFullscreen, fullscreenPhotoId]);

    const fullscreenPhoto = photos.find((p) => p.id === fullscreenPhotoId) || null;

    const [numColumns, setNumColumns] = useState(() => {
        if (typeof window === 'undefined') return 3;
        if (window.innerWidth <= 600) return 1;
        if (window.innerWidth <= 900) return 2;
        return 3;
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width <= 600) {
                setNumColumns(1);
            } else if (width <= 900) {
                setNumColumns(2);
            } else {
                setNumColumns(3);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Automatically distribute photos into columns based on sizing and aspect ratio
    // so columns are balanced in height and pictures fit neatly together without manual shuffling
    const columns = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        const count = Math.max(1, numColumns);
        const cols = Array.from({ length: count }, () => []);
        const colHeights = Array(count).fill(0);

        photos.forEach((photo) => {
            const w = photo.width || 1600;
            const h = photo.height || 1200;
            const aspect = w > 0 && h > 0 ? w / h : 1.33;
            const heightFactor = 1 / aspect;

            // Pick the column that currently has the lowest total height
            let minCol = 0;
            for (let i = 1; i < count; i++) {
                if (colHeights[i] < colHeights[minCol]) {
                    minCol = i;
                }
            }
            cols[minCol].push(photo);
            colHeights[minCol] += heightFactor;
        });

        return cols;
    }, [photos, numColumns]);

    return (
        <div id="app-root">
            <SideNav />
            <main>
                <h1 id="blog-heading">{t("pageTitle")}</h1>
                <div id="gallery-div">
                    {photos.length === 0 ? null : (
                        <div className="gallery-columns">
                            {columns.map((columnPhotos, colIdx) => (
                                <div key={colIdx} className="gallery-column">
                                    {columnPhotos.map((photo) => {
                                        const originalIdx = photos.indexOf(photo);
                                        const imgUrl = photo.filename && (photo.filename.startsWith('http://') || photo.filename.startsWith('https://') || photo.filename.startsWith('/'))
                                            ? photo.filename
                                            : `/photography/${photo.filename}`;
                                        return (
                                            <div
                                                className="gallery-item"
                                                key={photo.id || photo.filename || originalIdx}
                                                style={{ position: "relative" }}
                                                onMouseEnter={() => setHoveredIdx(originalIdx)}
                                                onMouseLeave={() => setHoveredIdx(null)}
                                            >
                                                <img
                                                    src={imgUrl}
                                                    alt={photo.title || `Photography ${originalIdx + 1}`}
                                                    loading="lazy"
                                                    style={{ opacity: 1, transition: 'opacity 0.3s ease' }}
                                                />
                                                {hoveredIdx === originalIdx && (
                                                    <>
                                                        <div className="photo-meta-overlay">
                                                            <div className="photo-meta-title">{photo.title}</div>
                                                            {photo.location?.place && (
                                                                photo.location.lat && photo.location.lng ? (
                                                                    <a
                                                                        className="photo-meta-location"
                                                                        href={`https://www.google.com/maps?q=${photo.location.lat},${photo.location.lng}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {photo.location.place}
                                                                    </a>
                                                                ) : (
                                                                    <span className="photo-meta-location">{photo.location.place}</span>
                                                                )
                                                            )}
                                                            {photo.date && (
                                                                <span className="photo-meta-date">{formatNumber(photo.date)}</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className="expand-icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openFullscreen(photo);
                                                            }}
                                                            aria-label="Expand image"
                                                            title="Expand image"
                                                            style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}
                                                        >
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                                                                 stroke="currentColor" strokeWidth="2">
                                                                <path
                                                                    d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                                                            </svg>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Fullscreen overlay */}
            {fullscreenPhoto && (
                <div className="fullscreen-overlay" onClick={closeFullscreen}>
                    <div className="fullscreen-content">
                        <button
                            className="close-fullscreen"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeFullscreen();
                            }}
                            aria-label="Close fullscreen"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                 strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                        <img
                            src={fullscreenPhoto.filename && (fullscreenPhoto.filename.startsWith('http://') || fullscreenPhoto.filename.startsWith('https://') || fullscreenPhoto.filename.startsWith('/'))
                                ? fullscreenPhoto.filename
                                : `/photography/${fullscreenPhoto.filename}`}
                            alt={fullscreenPhoto.title || "Fullscreen image"}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="image-protector" onClick={(e) => e.stopPropagation()} />
                        <div className="fullscreen-meta">
                            <div className="fullscreen-title">{fullscreenPhoto.title}</div>
                            {(fullscreenPhoto.date || fullscreenPhoto.location?.place) && (
                                <div className="fullscreen-date-location">
                                    {fullscreenPhoto.location?.place && (
                                        fullscreenPhoto.location.lat && fullscreenPhoto.location.lng ? (
                                            <a
                                                className="fullscreen-location"
                                                href={`https://www.google.com/maps?q=${fullscreenPhoto.location.lat},${fullscreenPhoto.location.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {fullscreenPhoto.location.place}
                                            </a>
                                        ) : (
                                            <span className="fullscreen-location">{fullscreenPhoto.location.place}</span>
                                        )
                                    )}
                                    {fullscreenPhoto.location?.place && fullscreenPhoto.date &&
                                        <span> &nbsp;&ndash;&nbsp; </span>}
                                    {fullscreenPhoto.date &&
                                        <span className="fullscreen-date">{formatNumber(fullscreenPhoto.date)}</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <Footer />
        </div>
    );
};

export default Photography;
