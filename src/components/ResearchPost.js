import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import NotFound from './NotFound';
import { getResearchPostBySlug } from '../utils/researchUtils';

const ResearchPost = () => {
    const { slug } = useParams();
    const { t } = useLanguage();
    const [postData, setPostData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const post = await getResearchPostBySlug(slug);
                setPostData(post);
                const baseTitle = t('pageTitles.research') || 'Research';
                document.title = `${post.title} | ${baseTitle}`;
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [slug, t]);

    if (loading) {
        return (
            <div id="app-root">
                <SideNav />
                <main>
                    <div className="blog-post-loading">Loading...</div>
                </main>
                <Footer />
            </div>
        );
    }

    if (error) return <NotFound />;
    if (!postData) return null;

    return (
        <div id="app-root">
            <SideNav />
            <main className="research-page">
                <article className="blog-post research-article">
                    <header className="blog-post-header research-article-header">
                        <h1 className="blog-post-title research-article-title">{postData.title}</h1>
                        {postData.description && (
                            <p className="blog-post-description research-article-desc">{postData.description}</p>
                        )}
                        <div className="blog-post-meta research-article-meta">
                            {postData.date && (
                                <time className="blog-post-date">{postData.date}</time>
                            )}
                            {postData.author && (
                                <span className="blog-post-author">by {postData.author}</span>
                            )}
                        </div>
                    </header>
                    <div
                        className="blog-post-content research-article-content"
                        dangerouslySetInnerHTML={{ __html: postData.content }}
                    />
                </article>
            </main>
            <Footer />
        </div>
    );
};

export default ResearchPost;
