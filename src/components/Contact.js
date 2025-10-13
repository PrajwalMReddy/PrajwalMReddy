import React, { useEffect } from 'react';
import { useLanguage } from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import ContactSection from './ContactSection';

const Contact = () => {
    const { t } = useLanguage();

    useEffect(() => {
        document.title = t('pageTitles.contact');
    }, [t]);

    return (
        <div id="app-root">
            <SideNav />
            <main id="main-content">
                <ContactSection />
            </main>
            <Footer />
        </div>
    );
};

export default Contact;
