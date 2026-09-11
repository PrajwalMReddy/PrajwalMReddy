import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import CmsProjects from './cms/CmsProjects';
import CmsExperiences from './cms/CmsExperiences';
import CmsBlog from './cms/CmsBlog';
import CmsResearch from './cms/CmsResearch';
import CmsPhotography from './cms/CmsPhotography';
import { useContent } from '../../utils/ContentContext';
import './cms/cms.css';

const TABS = [
    { id: 'projects', labelKey: 'admin.tabs.projects', defaultLabel: 'Projects' },
    { id: 'experiences', labelKey: 'admin.tabs.experiences', defaultLabel: 'Experiences' },
    { id: 'blog', labelKey: 'admin.tabs.blog', defaultLabel: 'Blog' },
    { id: 'research', labelKey: 'admin.tabs.research', defaultLabel: 'Research' },
    { id: 'photography', labelKey: 'admin.tabs.photography', defaultLabel: 'Photography' },
];

const CmsAdmin = () => {
    const { t, formatNumber } = useContent();
    const [activeTab, setActiveTab] = useState('projects');
    const [contentData, setContentData] = useState({
        projects: null,
        experiences: null,
        blog: null,
        quotes: null,
        research: null,
        photography: null,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    const loadAllContent = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [projRes, expRes, blogRes, quotesRes, resRes, photoRes] = await Promise.all([
                fetch('/api/cms/content?type=projects', { credentials: 'include' }),
                fetch('/api/cms/content?type=experiences', { credentials: 'include' }),
                fetch('/api/cms/content?type=blog', { credentials: 'include' }),
                fetch('/api/cms/content?type=quotes', { credentials: 'include' }),
                fetch('/api/cms/content?type=research', { credentials: 'include' }),
                fetch('/api/cms/content?type=photography', { credentials: 'include' }),
            ]);

            const [projects, experiences, blog, quotes, research, photography] = await Promise.all([
                projRes.ok ? projRes.json() : { sections: [], projects: [] },
                expRes.ok ? expRes.json() : { sections: [], experiences: [] },
                blogRes.ok ? blogRes.json() : [],
                quotesRes.ok ? quotesRes.json() : [],
                resRes.ok ? resRes.json() : [],
                photoRes.ok ? photoRes.json() : [],
            ]);

            setContentData({
                projects,
                experiences,
                blog,
                quotes,
                research,
                photography,
            });
        } catch (err) {
            console.error('Error loading CMS data:', err);
            setError(`Could not load CMS content: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllContent();
    }, [loadAllContent]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast((prev) => (prev?.message === message ? null : prev));
        }, 4000);
    };

    const handleSaveTabContent = async (updatedData, successMessage, targetType = activeTab) => {
        setSaving(true);
        setError('');
        try {
            const res = await fetch('/api/cms/content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: targetType,
                    data: updatedData,
                }),
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Failed to save content');
            }

            setContentData((prev) => ({
                ...prev,
                [targetType]: updatedData,
            }));

            // Notify live application context to refresh local metadata
            window.dispatchEvent(new Event('cms-content-updated'));

            showToast(successMessage || 'Changes saved successfully', 'success');
        } catch (err) {
            console.error(`Error saving ${targetType}:`, err);
            setError(err.message || 'Failed to save changes');
            showToast(`Save failed: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const getTabBadge = (tabId) => {
        if (!contentData[tabId]) return null;
        if (tabId === 'projects') {
            const count = contentData.projects?.projects?.length || 0;
            return count;
        }
        if (tabId === 'experiences') {
            const count = contentData.experiences?.experiences?.length || 0;
            return count;
        }
        if (tabId === 'blog') {
            return Array.isArray(contentData.blog) ? contentData.blog.length : 0;
        }
        if (tabId === 'research') {
            return Array.isArray(contentData.research) ? contentData.research.length : 0;
        }
        if (tabId === 'photography') {
            return Array.isArray(contentData.photography)
                ? contentData.photography.length
                : (contentData.photography?.en?.length || 0);
        }
        return null;
    };

    return (
        <AdminLayout title={t('admin.titles.cms', 'Content Management System')}>
            {/* Subtabs Bar matching Budget */}
            <div className="admin-tabs">
                {TABS.map((tab) => {
                    const badge = getTabBadge(tab.id);
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={activeTab === tab.id ? 'active' : ''}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {t(tab.labelKey, tab.defaultLabel)}
                            {badge !== null && (
                                <span
                                    style={{
                                        marginLeft: '0.45rem',
                                        fontSize: '0.75rem',
                                        padding: '0.1rem 0.45rem',
                                        borderRadius: '9999px',
                                        background: activeTab === tab.id ? '#0f172a' : '#f1f5f9',
                                        color: activeTab === tab.id ? '#ffffff' : '#64748b',
                                        fontWeight: 600,
                                    }}
                                >
                                    {formatNumber(badge)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Notification Toast */}
            {toast && (
                <div className={`cms-toast cms-toast-${toast.type}`}>
                    <span>{toast.message}</span>
                    <button
                        type="button"
                        onClick={() => setToast(null)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'inherit',
                            fontWeight: 700,
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {loading && <p className="admin-loading-text">{t('admin.messages.loading', 'Loading content from metadata files...')}</p>}
            {error && (
                <div style={{ margin: '0.5rem 0' }}>
                    <p className="admin-error">{error}</p>
                    <button
                        type="button"
                        className="cms-btn cms-btn-sm cms-btn-secondary"
                        onClick={loadAllContent}
                    >
                        {t('admin.actions.retry', 'Retry Loading')}
                    </button>
                </div>
            )}

            {!loading && (
                <>
                    {activeTab === 'projects' && (
                        <CmsProjects
                            data={contentData.projects}
                            onSave={handleSaveTabContent}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'experiences' && (
                        <CmsExperiences
                            data={contentData.experiences}
                            onSave={handleSaveTabContent}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'blog' && (
                        <CmsBlog
                            data={contentData.blog}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'blog')}
                            quotesData={contentData.quotes}
                            onSaveQuotes={(data, msg) => handleSaveTabContent(data, msg, 'quotes')}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'research' && (
                        <CmsResearch
                            data={contentData.research}
                            onSave={handleSaveTabContent}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'photography' && (
                        <CmsPhotography
                            data={contentData.photography}
                            onSave={handleSaveTabContent}
                            saving={saving}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
};

export default CmsAdmin;
