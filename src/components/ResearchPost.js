import React, {lazy, Suspense, useEffect, useMemo, useState} from 'react';
import {useParams} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import NotFound from './NotFound';
import {getResearchPostBySlug} from '../utils/researchUtils';

class ResearchErrorBoundary extends React.Component {
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
                    <p>Failed to load custom research component: <code>{this.props.componentName}</code></p>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{this.state.error?.message}</p>
                </div>
            );
        }
        return this.props.children;
    }
}

const ResearchPost = () => {
    const {slug} = useParams();
    const {t, formatNumber} = useLanguage();
    const [postData, setPostData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            if (!slug) {
                setError('No article specified');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const post = await getResearchPostBySlug(slug);
                setPostData(post);
                const baseTitle = t('pageTitles.research') || 'Research';
                document.title = `${post.title} | ${baseTitle}`;
            } catch (e) {
                console.error('Error loading research article:', e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [slug, t]);

    const CustomComponent = useMemo(() => {
        if ((postData?.type === 'custom' || postData?.source === 'custom') && postData?.component) {
            try {
                return lazy(() => import(`./${postData.component}`));
            } catch (e) {
                console.error('Failed to import custom research component:', e);
                return null;
            }
        }
        return null;
    }, [postData?.type, postData?.source, postData?.component]);

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

    if (error) return <NotFound/>;
    if (!postData) return null;

    // Full-page standalone custom components (or custom components without separate article content)
    const isStandalone = Boolean(
        postData.standalone ||
        postData.isFullPage ||
        postData.fullPage ||
        (!postData.content && CustomComponent)
    );

    if (CustomComponent && isStandalone) {
        return (
            <ResearchErrorBoundary componentName={postData.component}>
                <Suspense fallback={
                    <div id="app-root">
                        <SideNav/>
                        <main>
                            <div className="blog-post-loading">Loading...</div>
                        </main>
                        <Footer/>
                    </div>
                }>
                    <CustomComponent post={postData} customData={postData.customData || postData.data} data={postData.customData || postData.data} />
                </Suspense>
            </ResearchErrorBoundary>
        );
    }

    return (
        <div id="app-root">
            <SideNav/>
            <main className="research-page">
                <article className="blog-post research-article">
                    <header className="blog-post-header research-article-header">
                        <h1 className="blog-post-title research-article-title">{postData.title}</h1>
                        {postData.description && (
                            <p className="blog-post-description research-article-desc">{postData.description}</p>
                        )}
                        <div className="blog-post-meta research-article-meta">
                            {postData.date && (
                                <time className="blog-post-date">{formatNumber(postData.date)}</time>
                            )}
                            {postData.author && (
                                <span className="blog-post-author">by {postData.author}</span>
                            )}
                        </div>
                    </header>
                    {postData.content && (
                        <div
                            className="blog-post-content research-article-content"
                            dangerouslySetInnerHTML={{__html: postData.content}}
                        />
                    )}
                    {CustomComponent && (
                        <div className="blog-post-content research-article-custom-component">
                            <ResearchErrorBoundary componentName={postData.component}>
                                <Suspense fallback={<div className="blog-post-loading">Loading component...</div>}>
                                    <CustomComponent post={postData} customData={postData.customData || postData.data} data={postData.customData || postData.data} />
                                </Suspense>
                            </ResearchErrorBoundary>
                        </div>
                    )}
                </article>
            </main>
            <Footer/>
        </div>
    );
};

export default ResearchPost;
