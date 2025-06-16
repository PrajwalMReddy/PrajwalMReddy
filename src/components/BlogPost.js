import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import {getBlogPostBySlug} from '../utils/blogUtils';

const BlogPost = () => {
    const {slug} = useParams();
    const navigate = useNavigate();
    const {language} = useLanguage();
    const [blogData, setBlogData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadBlogPost = async () => {
            try {
                setLoading(true);
                const post = await getBlogPostBySlug(slug);
                setBlogData(post);
            } catch (err) {
                setError(err.message);
                navigate('/blog');
            } finally {
                setLoading(false);
            }
        };
        loadBlogPost();
    }, [slug, language, navigate]);

    if (loading) {
        return (
            <div id="app-root">
                <SideNav/>
                <main>
                    <div className="blog-post-loading">Loading...</div>
                </main>
                <Footer/>
            </div>
        );
    }

    if (error) {
        return (
            <div id="app-root">
                <SideNav/>
                <main>
                    <div className="blog-post-error">Error: {error}</div>
                </main>
                <Footer/>
            </div>
        );
    }

    if (!blogData) return null;

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <article className="blog-post">
                    <header className="blog-post-header">
                        <h1 className="blog-post-title">{blogData.title}</h1>
                        <h1 className="blog-post-description">{blogData.description}</h1>
                        <div className="blog-post-meta">
                            <time className="blog-post-date">{blogData.date}</time>
                            {blogData.author && (
                                <span className="blog-post-author">by {blogData.author}</span>
                            )}
                        </div>
                    </header>
                    <div
                        className="blog-post-content"
                        dangerouslySetInnerHTML={{__html: blogData.content}}
                    />
                </article>
            </main>
            <Footer/>
        </div>
    );
};

export default BlogPost; 