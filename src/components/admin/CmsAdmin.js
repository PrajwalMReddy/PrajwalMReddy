import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import CmsHome from './cms/CmsHome';
import CmsAbout from './cms/CmsAbout';
import CmsProjects from './cms/CmsProjects';
import CmsExperiences from './cms/CmsExperiences';
import CmsBlog from './cms/CmsBlog';
import CmsResearch from './cms/CmsResearch';
import CmsPhotography from './cms/CmsPhotography';
import { useContent } from '../../utils/ContentContext';
import '../../cms.css';

const TABS = [
    { id: 'home', labelKey: 'admin.tabs.home', defaultLabel: 'Home' },
    { id: 'about', labelKey: 'admin.tabs.about', defaultLabel: 'About' },
    { id: 'projects', labelKey: 'admin.tabs.projects', defaultLabel: 'Projects' },
    { id: 'experiences', labelKey: 'admin.tabs.experiences', defaultLabel: 'Experiences' },
    { id: 'blog', labelKey: 'admin.tabs.blog', defaultLabel: 'Blog' },
    { id: 'research', labelKey: 'admin.tabs.research', defaultLabel: 'Research' },
    { id: 'photography', labelKey: 'admin.tabs.photography', defaultLabel: 'Photography' },
];

const VALID_TAB_IDS = TABS.map((t) => t.id);

const CmsAdmin = () => {
    const { t, formatNumber } = useContent();
    const { tab: urlTab } = useParams();
    const navigate = useNavigate();

    const initialTab = urlTab && VALID_TAB_IDS.includes(urlTab.toLowerCase()) ? urlTab.toLowerCase() : 'home';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [contentData, setContentData] = useState({
        home: null,
        about: null,
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
            const [homeRes, aboutRes, projRes, expRes, blogRes, quotesRes, resRes, photoRes] = await Promise.all([
                fetch('/api/cms/content?type=home', { credentials: 'include' }),
                fetch('/api/cms/content?type=about', { credentials: 'include' }),
                fetch('/api/cms/content?type=projects', { credentials: 'include' }),
                fetch('/api/cms/content?type=experiences', { credentials: 'include' }),
                fetch('/api/cms/content?type=blog', { credentials: 'include' }),
                fetch('/api/cms/content?type=quotes', { credentials: 'include' }),
                fetch('/api/cms/content?type=research', { credentials: 'include' }),
                fetch('/api/cms/content?type=photography', { credentials: 'include' }),
            ]);

            const [home, about, projects, experiences, blog, quotes, research, photography] = await Promise.all([
                homeRes.ok ? homeRes.json() : null,
                aboutRes.ok ? aboutRes.json() : null,
                projRes.ok ? projRes.json() : { sections: [], projects: [] },
                expRes.ok ? expRes.json() : { sections: [], experiences: [] },
                blogRes.ok ? blogRes.json() : [],
                quotesRes.ok ? quotesRes.json() : [],
                resRes.ok ? resRes.json() : [],
                photoRes.ok ? photoRes.json() : [],
            ]);

            setContentData({
                home,
                about,
                projects,
                experiences,
                blog,
                quotes,
                research,
                photography,
            });
        } catch (err) {
            console.error(t('logs.cmsLoadError', 'Error loading CMS data:'), err);
            setError(`Could not load CMS content: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        document.title = t('pageTitles.adminCms', 'CMS | Admin | Prajwal Reddy');
    }, [t]);

    useEffect(() => {
        loadAllContent();
    }, [loadAllContent]);

    useEffect(() => {
        if (urlTab && VALID_TAB_IDS.includes(urlTab.toLowerCase())) {
            setActiveTab(urlTab.toLowerCase());
        } else if (!urlTab) {
            setActiveTab('home');
        }
    }, [urlTab]);

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
        setError('');
        navigate(`/admin/cms/${tabId}`);
    };

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
            console.error((t('logs.cmsSaveError', 'Error saving {type}:') || '').replace('{type}', targetType), err);
            setError(err.message || 'Failed to save changes');
            showToast(`Save failed: ${err.message}`, 'error');
            throw err;
        } finally {
            setSaving(false);
        }
    };

    const getTabBadge = (tabId) => {
        if (!contentData[tabId]) return null;
        if (tabId === 'home') {
            const count = contentData.home?.skills?.length || 0;
            return count;
        }
        if (tabId === 'about') {
            const count = contentData.about?.links?.length || 0;
            return count;
        }
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
            {/* Subtabs Bar matching Budget & Todo */}
            <div className="admin-tabs">
                {TABS.map((tab) => {
                    const badge = getTabBadge(tab.id);
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={activeTab === tab.id ? 'active' : ''}
                            onClick={() => handleTabClick(tab.id)}
                        >
                            <span>{t(tab.labelKey, tab.defaultLabel)}</span>
                            {badge !== null && (
                                <span className="admin-tab-badge">
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
                    {activeTab === 'home' && (
                        <CmsHome
                            data={contentData.home}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'home')}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'about' && (
                        <CmsAbout
                            data={contentData.about}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'about')}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'projects' && (
                        <CmsProjects
                            data={contentData.projects}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'projects')}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'experiences' && (
                        <CmsExperiences
                            data={contentData.experiences}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'experiences')}
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
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'research')}
                            saving={saving}
                        />
                    )}
                    {activeTab === 'photography' && (
                        <CmsPhotography
                            data={contentData.photography}
                            onSave={(data, msg) => handleSaveTabContent(data, msg, 'photography')}
                            saving={saving}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
};

export default CmsAdmin;
