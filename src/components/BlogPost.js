import React, {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import {getBlogPostBySlug} from '../utils/blogUtils';
import NotFound from './NotFound';

class ComponentErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="blog-post-error">
                    <p>Failed to load custom component: <code>{this.props.componentName}</code></p>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{this.state.error?.message}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

const BlogPost = () => {
    const {slug} = useParams();
    const navigate = useNavigate();
    const {language, t, formatNumber} = useLanguage();
    const [blogData, setBlogData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadBlogPost = async () => {
            try {
                setLoading(true);

                // language-aware fetch
                const post = await getBlogPostBySlug(slug, language);
                setBlogData(post);

                const postTitle = post.title;
                const baseTitle = t('pageTitles.blog');
                document.title = `${postTitle} | ${baseTitle}`;
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadBlogPost();
    }, [slug, language, navigate, t]);

    const CustomComponent = useMemo(() => {
        if ((blogData?.type === 'custom' || blogData?.source === 'custom') && blogData?.component) {
            try {
                return lazy(() => import(`./${blogData.component}`));
            } catch (e) {
                console.error('Failed to import custom component:', e);
                return null;
            }
        }
        return null;
    }, [blogData?.type, blogData?.source, blogData?.component]);

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
        return <NotFound/>;
    }

    if (!blogData) return null;

    // Full-page standalone custom components (like BengaluruTeluguDictionary)
    const isStandalone = Boolean(
        blogData.standalone ||
        blogData.isFullPage ||
        blogData.component === 'BengaluruTeluguDictionary'
    );

    if (CustomComponent && isStandalone) {
        return (
            <ComponentErrorBoundary componentName={blogData.component}>
                <Suspense fallback={
                    <div id="app-root">
                        <SideNav/>
                        <main>
                            <div className="blog-post-loading">Loading...</div>
                        </main>
                        <Footer/>
                    </div>
                }>
                    <CustomComponent post={blogData} />
                </Suspense>
            </ComponentErrorBoundary>
        );
    }

    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <article className="blog-post">
                    <header className="blog-post-header">
                        <h1 className="blog-post-title">{blogData.title}</h1>
                        {blogData.description && (
                            <h2 className="blog-post-description">{blogData.description}</h2>
                        )}

                        <div className="blog-post-meta">
                            <time className="blog-post-date">
                                {formatNumber(blogData.date)}
                            </time>

                            {blogData.author && (
                                <span className="blog-post-author">
                                    by {blogData.author}
                                </span>
                            )}
                        </div>
                    </header>

                    {blogData.content && (
                        <div
                            className="blog-post-content"
                            dangerouslySetInnerHTML={{__html: blogData.content}}
                        />
                    )}

                    {CustomComponent && (
                        <div className="blog-post-content blog-post-custom-component">
                            <ComponentErrorBoundary componentName={blogData.component}>
                                <Suspense fallback={<div className="blog-post-loading">Loading component...</div>}>
                                    <CustomComponent post={blogData} />
                                </Suspense>
                            </ComponentErrorBoundary>
                        </div>
                    )}
                </article>
            </main>
            <Footer/>
        </div>
    );
};

export default BlogPost;
