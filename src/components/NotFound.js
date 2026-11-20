// components/NotFound.jsx
import React, {useEffect} from 'react';
import { useContent } from '../utils/ContentContext';
import SideNav from './SideNav';
import Footer from './Footer';

const NotFound = () => {
    const {t} = useContent();

    useEffect(() => {
        document.title = t('pageTitles.notFound');
    }, [t]);

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
