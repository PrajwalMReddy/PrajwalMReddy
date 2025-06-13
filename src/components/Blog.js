import React from 'react';
import {useLanguage} from '../context/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';

const Blog = () => {
    const {t} = useLanguage();
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="blog-heading">{t('blogHeading')}</h1>
                <div id="blog-notice-div">
                    <div className="blog-notice">
                        {/* <h1 className="blog-notice-heading">{t('blogNotice')}</h1> */}
                        <h1 className="blog-notice-heading">{t('blogNotice')}</h1>
                    </div>
                </div>
            </main>
            <Footer/>
        </div>
    );
};

export default Blog; 