import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';

// Dynamically import all images from the photography folder
function importAll(r) {
    return r.keys().map(r);
}

const images = importAll(require.context('../assets/photography', false, /\.(png|jpe?g|svg|webp)$/));

const Photography = () => {
    const {t, language} = useLanguage();
    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="blog-heading">{t('pageTitle')}</h1>
            <div id="gallery-div">
                {images.length === 0 ? (<div id="blog-notice-div">
                    <div className="blog-notice">
                        <h1 className="blog-notice-heading">{t('emptyGallery')}</h1>
                    </div>
                </div>) : (<div className="gallery-grid">
                    {images.map((img, idx) => (<div className="gallery-item" key={idx}>
                        <img src={img} alt={`Photography ${idx + 1}`}/>
                    </div>))}
                </div>)}
            </div>
        </main>
        <Footer/>
    </div>);
};

export default Photography; 