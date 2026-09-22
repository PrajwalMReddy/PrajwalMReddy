import React, { useState, useEffect, useCallback } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { useContent } from '../../../utils/ContentContext';

function formatNewsDate(dateString, t, formatNumber) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
        return t('admin.news.justNow', 'Just now');
    }

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) {
        return t('admin.news.justNow', 'Just now');
    }
    if (diffMins === 1) {
        return t('admin.news.minuteAgo', '1 minute ago');
    }
    if (diffMins < 60) {
        return t('admin.news.minutesAgo', '{count} minutes ago').replace('{count}', formatNumber(diffMins));
    }
    if (diffHours === 1) {
        return t('admin.news.hourAgo', '1 hour ago');
    }
    if (diffHours < 24) {
        return t('admin.news.hoursAgo', '{count} hours ago').replace('{count}', formatNumber(diffHours));
    }
    if (diffDays === 1) {
        return t('admin.news.yesterday', 'Yesterday');
    }
    return t('admin.news.daysAgo', '{count} days ago').replace('{count}', formatNumber(diffDays));
}

const PAGE_SIZE = 5;

const ExecutiveBriefing = () => {
    const { t, formatNumber, language } = useContent();
    const [newsArticles, setNewsArticles] = useState([]);
    const [newsOffset, setNewsOffset] = useState(0);
    const [hasMoreNews, setHasMoreNews] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const loadNews = useCallback(async (forceFresh = false) => {
        try {
            setError(null);
            const res = await assistantApi.getNews({
                format: 'flat',
                limit: PAGE_SIZE,
                offset: 0,
                ...(forceFresh ? { forceFresh: 'true' } : {}),
            });

            const initialNews = Array.isArray(res?.articles) ? res.articles : [];
            setNewsArticles(initialNews);
            setNewsOffset(0);
            if (typeof res?.hasMore === 'boolean') {
                setHasMoreNews(res.hasMore);
            } else {
                setHasMoreNews(initialNews.length >= PAGE_SIZE);
            }
        } catch (err) {
            console.error('Failed to load recent news:', err);
            setError(err.message || t('admin.news.error', 'Failed to load recent news.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadNews(true);
    };

    const handleSeeMoreNews = async () => {
        if (loadingMore || !hasMoreNews) return;
        setLoadingMore(true);
        try {
            const nextOffset = newsOffset + PAGE_SIZE;
            const res = await assistantApi.getNews({
                format: 'flat',
                limit: PAGE_SIZE,
                offset: nextOffset,
            });
            const more = Array.isArray(res?.articles) ? res.articles : [];

            if (more.length === 0) {
                setHasMoreNews(false);
            } else {
                setNewsArticles((prev) => {
                    const existingUrls = new Set(prev.map((a) => a.url));
                    const fresh = more.filter((a) => !existingUrls.has(a.url));
                    return [...prev, ...fresh];
                });
                setNewsOffset(nextOffset);
                if (typeof res?.hasMore === 'boolean') {
                    setHasMoreNews(res.hasMore);
                } else if (more.length < PAGE_SIZE) {
                    setHasMoreNews(false);
                }
            }
        } catch (err) {
            console.error('Failed to load more news:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    if (loading) {
        return (
            <div className="briefing-memo-document" style={{ padding: '3rem 2rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.85rem' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                    {t('admin.news.loading', 'Loading Recent News...')}
                </div>
                <div style={{ fontSize: '0.84rem' }}>
                    {t('admin.news.fetchingLatest', 'Fetching the latest articles')}
                </div>
            </div>
        );
    }

    return (
        <article className="briefing-memo-document" aria-label={t('admin.news.recentNews', 'Recent News')}>
            {/* Header */}
            <header className="memo-masthead" style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem' }}>
                <div className="memo-header-top" style={{ marginBottom: 0, alignItems: 'center' }}>
                    <h2 className="memo-title" style={{ fontSize: '1.4rem', margin: 0 }}>
                        {t('admin.news.recentNews', 'Recent News')}
                    </h2>
                </div>
            </header>

            {/* Error Notification */}
            {error && (
                <div style={{ padding: '0.85rem 1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        style={{ padding: '0.35rem 0.75rem', background: '#ffffff', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                        {t('admin.news.retry', 'Retry')}
                    </button>
                </div>
            )}

            {/* Recent News List */}
            <main>
                {newsArticles.length > 0 ? (
                    <>
                        <ul className="memo-news-flat-list">
                            {newsArticles.map((item, idx) => (
                                <li key={item.id || item.url || idx} className="memo-news-flat-item">
                                    <div>
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="memo-news-headline-link"
                                        >
                                            {item.title}
                                        </a>
                                    </div>
                                    <div className="memo-news-meta-row" style={{ marginTop: '0.25rem' }}>
                                        <span className="memo-news-source">{item.source}</span>
                                        {item.publishedAt && (
                                            <>
                                                <span className="memo-news-dot">&middot;</span>
                                                <span
                                                    className="memo-news-date"
                                                    title={new Date(item.publishedAt).toLocaleString(language === 'kn' ? 'kn-IN' : 'en-US')}
                                                >
                                                    {formatNewsDate(item.publishedAt, t, formatNumber)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {/* Pagination / Status */}
                        <div className="memo-news-more-wrap">
                            {hasMoreNews ? (
                                <button
                                    type="button"
                                    className="memo-see-more-btn"
                                    onClick={handleSeeMoreNews}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? t('admin.news.loadingMore', 'Loading More Articles...') : t('admin.news.seeMoreNews', 'See More News')}
                                </button>
                            ) : (
                                <div className="memo-all-caught-up">
                                    {t('admin.news.allCaughtUp', "✓ You're all caught up on recent news.")}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    !error && (
                        <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.88rem', padding: '1.5rem 0', textAlign: 'center' }}>
                            {t('admin.news.empty', 'No news articles published in the last 24 hours.')}
                        </div>
                    )
                )}
            </main>
        </article>
    );
};

export default ExecutiveBriefing;
