import React, {useEffect} from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {LanguageProvider, useLanguage} from './context/LanguageContext';
import Home from './components/Home';
import Projects from './components/Projects';
import Blog from './components/Blog';
import Contact from './components/Contact';
import './styles/LanguageSwitcher.css';
import {translations} from './locales';

function AppWithTitle() {
    const {language} = useLanguage();
    useEffect(() => {
        const path = window.location.pathname;
        let title;
        switch (path) {
            case '/projects':
                title = translations[language].pageTitles.projects;
                break;
            case '/blog':
                title = translations[language].pageTitles.blog;
                break;
            case '/contact':
                title = translations[language].pageTitles.contact;
                break;
            default:
                title = translations[language].pageTitles.home;
        }
        document.title = title;
    }, [window.location.pathname, language]);

    return (<Router>
        <Routes>
            <Route path="/" element={<Home/>}/>
            <Route path="/projects" element={<Projects/>}/>
            <Route path="/blog" element={<Blog/>}/>
            <Route path="/contact" element={<Contact/>}/>
        </Routes>
    </Router>);
}

function App() {
    return (<LanguageProvider>
        <AppWithTitle/>
    </LanguageProvider>);
}

export default App; 