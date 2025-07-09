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

function KonamiListener() {
    const position = React.useRef(0);
    React.useEffect(() => {
        const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

        function onKeyDown(e) {
            // Optionally ignore if modifier keys are pressed
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (e.key === konami[position.current]) {
                position.current++;
                if (position.current === konami.length) {
                    alert(t('konami'));
                    position.current = 0;
                }
            } else {
                position.current = (e.key === konami[0]) ? 1 : 0;
            }
        }

        // Use capture phase to catch events before inputs
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, []);
    return null;
}

function App() {
    return (<ErrorBoundary>
        <KonamiListener/>
        <LanguageProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Home/>}/>
                    <Route path="/projects" element={<Projects/>}/>
                    <Route path="/blog" element={<Blog/>}/>
                    <Route path="/blog/:slug" element={<BlogPost/>}/>

                    <Route path="/research" element={<Research/>}/>
                    <Route path="/research/bengaluru-telugu" element={<BengaluruTeluguDictionary/>}/>
                    <Route path="/photography" element={<Photography/>}/>

                    <Route path="*" element={<NotFound/>}/>
                </Routes>
            </Router>
        </LanguageProvider>
    </ErrorBoundary>);
}

export default App; 