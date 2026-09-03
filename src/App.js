import React from 'react';
import {BrowserRouter as Router, Navigate, Route, Routes, useParams} from 'react-router-dom';
import {LanguageProvider} from './utils/LanguageContext';
import {KonamiProvider} from './utils/KonamiContext';
import {AuthProvider} from './utils/AuthContext';
import ProtectedRoute from './components/admin/ProtectedRoute';
import AdminLogin from './components/admin/AdminLogin';
import BudgetAdmin from './components/admin/BudgetAdmin';
import TodoAdmin from './components/admin/TodoAdmin';
import NotesAdmin from './components/admin/NotesAdmin';
import Home from './components/Home';
import Projects from './components/Projects';
import Blog from './components/Blog';
import BlogPost from './components/BlogPost';
import Research from './components/Research';
import ResearchPost from './components/ResearchPost';
import BengaluruTeluguDictionary from './components/BengaluruTeluguDictionary';
import Photography from './components/Photography';
import Contact from './components/Contact';
import './styles.css';
import NotFound from "./components/NotFound";
import Konami from './components/Konami';
import KonamiListener from './components/KonamiListener';
import './blog.css';
import './research.css';
import './admin.css';
import Experience from './components/Experience';
import {useKonami} from './utils/KonamiContext';

// Wrapper to validate Konami code
const KonamiValidator = () => {
    const {code} = useParams();
    const {validKonamiCode} = useKonami();
    
    if (code === validKonamiCode && validKonamiCode !== null) {
        return <Konami />;
    }
    return <NotFound />;
};

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

function App() {
    return (<ErrorBoundary>
        <LanguageProvider>
            <KonamiProvider>
                <AuthProvider>
                <Router>
                    <KonamiListener/>
                    <Routes>
                        <Route path="/" element={<Home/>}/>
                        <Route path="/projects" element={<Projects/>}/>
                        <Route path="/blog" element={<Blog/>}/>
                        <Route path="/blog/:slug" element={<BlogPost/>}/>
                        <Route path="/about" element={<Contact/>}/>
                        <Route path="/contact" element={<Navigate to="/about" replace/>}/>

                        <Route path="/research" element={<Research/>}/>
                        <Route path="/research/bengaluru-telugu-dictionary" element={<BengaluruTeluguDictionary/>}/>
                        <Route path="/research/:slug" element={<ResearchPost/>}/>
                        <Route path="/photography" element={<Photography/>}/>
                        <Route path="/experience" element={<Experience/>}/>

                        <Route path="/konami/:code" element={<KonamiValidator />}/>

                        <Route path="/admin/login" element={<AdminLogin />} />
                        <Route path="/admin/budget" element={
                            <ProtectedRoute><BudgetAdmin /></ProtectedRoute>
                        } />
                        <Route path="/admin/todo" element={
                            <ProtectedRoute><TodoAdmin /></ProtectedRoute>
                        } />
                        <Route path="/admin/notes" element={
                            <ProtectedRoute><NotesAdmin /></ProtectedRoute>
                        } />
                        <Route path="/admin" element={<Navigate to="/admin/budget" replace />} />

                        <Route path="*" element={<NotFound/>}/>
                    </Routes>
                </Router>
                </AuthProvider>
            </KonamiProvider>
        </LanguageProvider>
    </ErrorBoundary>);
}

export default App;
