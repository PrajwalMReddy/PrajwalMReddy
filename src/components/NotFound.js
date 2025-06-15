// components/NotFound.jsx
import React from 'react';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';

const NotFound = () => {
    const {t} = useLanguage();
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="not-found-heading">{t('notFoundHeading')}</h1>
                <p className="not-found-element">{t('notFoundMessage')}</p>
            </main>
            <Footer/>
        </div>
    );
};

export default NotFound;
