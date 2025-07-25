import React from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import {LanguageProvider} from './utils/LanguageContext';
import Home from './components/Home';
import Projects from './components/Projects';
import Blog from './components/Blog';
import BlogPost from './components/BlogPost';
import Research from './components/Research';
import BengaluruTeluguDictionary from './components/BengaluruTeluguDictionary';
import Photography from './components/Photography';
import './styles.css';
import NotFound from "./components/NotFound";
import {translations} from './locales';
import Konami from './components/Konami';
import KonamiListener from './components/KonamiListener';
import './blog.css';

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

function getCurrentLanguage() {
    return localStorage.getItem('language') || 'en';
}

function t(key) {
    const lang = getCurrentLanguage();
    return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : undefined), translations[lang]) || key;
}

function App() {
    return (<ErrorBoundary>
        <LanguageProvider>
            <Router>
                <KonamiListener/>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/projects" element={<Projects/>}/>
                    <Route path="/blog" element={<Blog/>}/>
                    <Route path="/blog/:slug" element={<BlogPost/>}/>

                    <Route path="/research" element={<Research/>}/>
                    <Route path="/research/bengaluru-telugu" element={<BengaluruTeluguDictionary/>}/>
                    <Route path="/photography" element={<Photography/>}/>
                    <Route path="/konami" element={<Konami/>}/>

                    <Route path="*" element={<NotFound/>}/>
                </Routes>
            </Router>
        </LanguageProvider>
    </ErrorBoundary>);
}

export default App; 