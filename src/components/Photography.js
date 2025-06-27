import React, {useEffect, useState} from "react";
import {useLanguage} from "../utils/LanguageContext";
import SideNav from "./SideNav";
import Footer from "./Footer";

// Dynamically import all images from the photography folder
function importAll(r) {
    return r.keys().map((key) => ({
        src: r(key), filename: key.replace(/^\.\//, "")
    }));
}

const images = importAll(require.context("../assets/photography", false, /\.(png|jpe?g|svg|webp)$/));

const Photography = () => {
    const {t, language} = useLanguage();
    const [metadata, setMetadata] = useState([]);
    const [hoveredIdx, setHoveredIdx] = useState(null);

    useEffect(() => {
        // Fetch the language-specific metadata file, fallback to English
        const fetchMeta = async () => {
            const langFile = `/photography/metadata.${language}.json?v=${Date.now()}`;
            try {
                const res = await fetch(langFile);
                if (res.ok) {
                    setMetadata(await res.json());
                } else {
                    const res = await fetch(langFile);
                    setMetadata(res.ok ? await res.json() : []);
                }
            } catch {
                const res = await fetch(langFile);
                setMetadata(res.ok ? await res.json() : []);
            }
        };
        fetchMeta();
    }, [language]);

    // Helper to get metadata for a given filename
    const getMeta = (filename) => metadata.find(m => m.filename === filename);

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="blog-heading">{t("pageTitle")}</h1>
            <div id="gallery-div">
                {images.length === 0 ? (<div id="blog-notice-div">
                    <div className="blog-notice">
                        <h1 className="blog-notice-heading">{t("emptyGallery")}</h1>
                    </div>
                </div>) : (<div className="gallery-grid">
                    {images.map((img, idx) => {
                        const meta = getMeta(img.filename);
                        return (<div
                            className="gallery-item"
                            key={idx}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            style={{position: "relative"}}
                        >
                            <img src={img.src} alt={meta?.title || `Photography ${idx + 1}`}/>
                            {hoveredIdx === idx && meta && (<div className="photo-meta-overlay">
                                <div className="photo-meta-title">{meta.title}</div>
                                <div className="photo-meta-location">
                                    {meta.location && meta.location.place && meta.location.lat && meta.location.lng ? (
                                        <a href={`https://www.google.com/maps?q=${meta.location.lat},${meta.location.lng}`}
                                           target="_blank" rel="noopener noreferrer">
                                            {meta.location.place}
                                        </a>) : (<span>{meta.location?.place}</span>)}
                                </div>
                                {meta.date && (<div className="photo-meta-date">{meta.date}</div>)}
                            </div>)}
                        </div>);
                    })}
                </div>)}
            </div>
        </main>
        <Footer/>
    </div>);
};

export default Photography;
