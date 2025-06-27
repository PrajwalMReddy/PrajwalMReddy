import React, {useEffect} from 'react';
import {BrowserRouter as Router, Route, Routes, useLocation} from 'react-router-dom';
import {LanguageProvider, useLanguage} from './utils/LanguageContext';
import Home from './components/Home';
import Projects from './components/Projects';
import Blog from './components/Blog';
import Contact from './components/Contact';
import BlogPost from './components/BlogPost';
import Research from './components/Research';
import BengaluruTeluguDictionary from './components/BengaluruTeluguDictionary';
import Photography from './components/Photography';
import './styles.css';
import {translations} from './locales';
import NotFound from "./components/NotFound";

// Error Boundary Component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error) {
        return {hasError: true, error};
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (<div style={{padding: '20px', color: 'red'}}>
                <h1>Something went wrong.</h1>
                <pre>{this.state.error?.toString()}</pre>
            </div>);
        }
        return this.props.children;
    }
}

// Separate component to handle title updates
function TitleUpdater() {
    const {language} = useLanguage();
    const location = useLocation();

    useEffect(() => {
        console.log('Location changed:', location);
        try {
            // Remove the leading # and / from the pathname
            const path = location.pathname.replace(/^#/, '');
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
                case '/research':
                    title = translations[language].pageTitles.research;
                    break;
                case '/photography':
                    title = translations[language].pageTitles.photography;
                    break;
                default:
                    title = translations[language].pageTitles.home;
            }
            console.log('Setting title:', title);
            document.title = title;
        } catch (error) {
            console.error('Error in TitleUpdater useEffect:', error);
        }
    }, [location, language]);

    return null;
}

function AppWithTitle() {
    return (<ErrorBoundary>
        <Router>
            <TitleUpdater/>
            <Routes>
                <Route path="/" element={<Home/>}/>
                <Route path="/projects" element={<Projects/>}/>
                <Route path="/blog" element={<Blog/>}/>
                <Route path="/blog/:slug" element={<BlogPost/>}/>
                <Route path="/contact" element={<Contact/>}/>

                <Route path="/research" element={<Research/>}/>
                <Route path="/research/bengaluru-telugu" element={<BengaluruTeluguDictionary/>}/>
                <Route path="/photography" element={<Photography/>}/>

                <Route path="*" element={<NotFound/>}/>
            </Routes>
        </Router>
    </ErrorBoundary>);
}

function App() {
    console.log('App component rendering');
    return (<ErrorBoundary>
        <LanguageProvider>
            <AppWithTitle/>
        </LanguageProvider>
    </ErrorBoundary>);
}

export default App; 