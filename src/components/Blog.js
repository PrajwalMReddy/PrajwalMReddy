import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useLanguage} from '../context/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import {getAllBlogPosts} from '../utils/blogUtils';

const Blog = () => {
    const {t, language} = useLanguage();
    const [blogPosts, setBlogPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadBlogPosts = async () => {
            try {
                setLoading(true);
                const posts = await getAllBlogPosts();
                // Filter posts by current language
                const filteredPosts = posts.filter(post => post.language === language);
                setBlogPosts(filteredPosts);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadBlogPosts();
    }, [language]);

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="blog-heading">{t('blogHeading')}</h1>
                {loading ? (
                    <div className="blog-loading">Loading...</div>
                ) : error ? (
                    <div className="blog-error">Error: {error}</div>
                ) : (
                    <>
                        <div id="blog-notice-div">
                            <div className="blog-notice">
                                <h1 className="blog-notice-heading">
                                    {blogPosts.length === 0 ? t('blogNoticeEmpty') : t('blogNotice')}
                                </h1>
                            </div>
                        </div>
                        {blogPosts.length > 0 && (
                            <div className="blog-grid">
                                {blogPosts.map((post) => (
                                    <Link
                                        to={`/blog/${post.slug}`}
                                        key={post.slug}
                                        className="blog-card"
                                    >
                                        <h2 className="blog-title">{post.title}</h2>
                                        <p className="blog-excerpt">{post.description}</p>
                                        <div className="blog-meta">
                                            <time className="blog-date">{post.date}</time>
                                            {post.author && (
                                                <span className="blog-author">by {post.author}</span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
            <Footer/>
        </div>
    );
};

export default Blog; 