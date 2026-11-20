import React, {useEffect} from 'react';
import { useContent } from '../utils/ContentContext';
import SideNav from './SideNav';
import Footer from './Footer';
import About from './About';

const Contact = () => {
    const {t} = useContent();

    useEffect(() => {
        document.title = t('pageTitles.contact');
    }, [t]);

    return (
        <div id="app-root">
            <SideNav/>
            <main id="main-content">
                <About/>
            </main>
            <Footer/>
        </div>
    );
};

export default Contact;
