import React, { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';
import CmsMarkdownEditor from './CmsMarkdownEditor';
import CmsQuotes from './CmsQuotes';

const DEFAULT_POST = {
    slug: '',
    title: '',
    description: '',
    date: '',
    language: 'en',
    visibility: 'public',
    source: 'local',
    type: 'article',
    component: '',
    customDataString: '',
    externalUrl: '',
};

const CmsBlog = ({
    data = [],
    onSave,
    quotesData = [],
    onSaveQuotes,
    saving,
    initialSection = 'posts',
}) => {
    const { t, formatNumber } = useContent();
    const posts = Array.isArray(data) ? data : [];
    const quotes = Array.isArray(quotesData) ? quotesData : [];

    const [currentSection, setCurrentSection] = useState(initialSection || 'posts');

    const [search, setSearch] = useState('');
    const [filterLang, setFilterLang] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all');
    const [filterSource, setFilterSource] = useState('all');

    // Modal / Editor state
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [markdownContent, setMarkdownContent] = useState('');
    const [loadingMarkdown, setLoadingMarkdown] = useState(false);

    useEffect(() => {
        if (!isEditorOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsEditorOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditorOpen]);

    const filteredPosts = useMemo(() => {
        return posts.filter((p) => {
            const matchesSearch =
                !search ||
                (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.slug || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.description || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.externalUrl || '').toLowerCase().includes(search.toLowerCase()) ||
                (p.component || '').toLowerCase().includes(search.toLowerCase());

            const matchesLang = filterLang === 'all' || p.language === filterLang;
            const matchesVis = filterVisibility === 'all' || p.visibility === filterVisibility;
            const isCustom = p.source === 'custom' || p.type === 'custom' || Boolean(p.component);
            const isExt = !isCustom && (p.source === 'external' || p.source === 'substack' || p.type === 'external' || Boolean(p.externalUrl));
            const matchesSource =
                filterSource === 'all' ||
                (filterSource === 'custom' && isCustom) ||
                (filterSource === 'external' && isExt) ||
                (filterSource === 'local' && !isCustom && !isExt);

            return matchesSearch && matchesLang && matchesVis && matchesSource;
        });
    }, [posts, search, filterLang, filterVisibility, filterSource]);

    const handleOpenAddModal = () => {
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        setEditingPost({
            ...DEFAULT_POST,
            date: formattedDate,
            customDataString: '',
        });
        setMarkdownContent('# New Post\n\nWrite your blog post content here...\n');
        setIsEditorOpen(true);
    };

    const handleOpenEditModal = async (post, index) => {
        const isCustom = post.type === 'custom' || post.source === 'custom' || Boolean(post.component);
        const isExt = !isCustom && (post.source === 'external' || post.source === 'substack' || post.type === 'external' || Boolean(post.externalUrl));
        const initialJson = post.customData !== undefined && post.customData !== null
            ? (typeof post.customData === 'string' ? post.customData : JSON.stringify(post.customData, null, 2))
            : (post.data !== undefined && post.data !== null ? (typeof post.data === 'string' ? post.data : JSON.stringify(post.data, null, 2)) : '');

        setEditingPost({
            ...post,
            _index: index,
            source: isCustom ? 'custom' : (isExt ? 'external' : 'local'),
            type: isCustom ? 'custom' : (isExt ? 'external' : 'article'),
            slug: isExt ? '' : (post.slug || ''),
            component: post.component || '',
            customDataString: initialJson,
            externalUrl: post.externalUrl || '',
        });
        setIsEditorOpen(true);
        // Load markdown content directly from post or fetch if missing
        if (post.content) {
            setMarkdownContent(post.content);
        } else if (post.slug && !isExt && !isCustom) {
            setLoadingMarkdown(true);
            try {
                const res = await fetch(
                    `/api/cms/markdown?type=blog&slug=${encodeURIComponent(post.slug)}`,
                    { credentials: 'include' }
                );
                if (res.ok) {
                    const data = await res.json();
                    setMarkdownContent(data.content || '');
                }
            } catch (err) {
                console.warn(t('logs.blogMarkdownError'), err);
            } finally {
                setLoadingMarkdown(false);
            }
        } else {
            setMarkdownContent('');
        }
    };

    const handleTitleChange = (val) => {
        const isNew = editingPost._index === undefined;
        const isExternal = editingPost.source === 'external' || editingPost.type === 'external';
        if (isNew && !isExternal) {
            const autoSlug = val
                .toLowerCase()
                .trim()
                .replace(/[^\w\s\u0C80-\u0CFF-]/g, '')
                .replace(/[\s_-]+/g, '-');
            setEditingPost({ ...editingPost, title: val, slug: autoSlug });
        } else {
            setEditingPost({ ...editingPost, title: val, ...(isExternal ? { slug: '' } : {}) });
        }
    };

    const handleSavePost = async (e) => {
        e.preventDefault();
        const isCustom = editingPost.source === 'custom' || editingPost.type === 'custom';
        const isExternal = !isCustom && (editingPost.source === 'external' || editingPost.type === 'external');

        if (!editingPost.title.trim()) {
            alert(t('admin.ui.cmsBlog.titleIsRequired'));
            return;
        }

        let safeSlug = '';
        if (!isExternal) {
            safeSlug = (editingPost.slug || '').trim();
            if (!safeSlug) {
                alert(t('admin.ui.cmsBlog.slugIsRequired'));
                return;
            }

            const isNew = editingPost._index === undefined;
            if (
                isNew &&
                posts.some((p) => p.slug && p.slug.toLowerCase() === safeSlug.toLowerCase())
            ) {
                alert(t('admin.ui.cmsBlog.aPostWithThisSlugAlready'));
                return;
            }
        }

        if (isExternal && !(editingPost.externalUrl || '').trim()) {
            alert(t('admin.ui.cmsBlog.externalUrlIsRequiredForExternal'));
            return;
        }

        if (isCustom && !(editingPost.component || '').trim()) {
            alert(t('admin.ui.cmsBlog.componentNameIsRequiredForCustom'));
            return;
        }

        const isNew = editingPost._index === undefined;

        const postMetadata = {
            title: editingPost.title.trim(),
            description: (editingPost.description || '').trim(),
            date: (editingPost.date || '').trim(),
            language: editingPost.language || 'en',
            visibility: editingPost.visibility || 'public',
            source: isCustom ? 'custom' : (isExternal ? 'external' : 'local'),
            type: isCustom ? 'custom' : (isExternal ? 'external' : 'article'),
            content: (isExternal || isCustom) ? '' : markdownContent,
        };

        if (!isExternal) {
            postMetadata.slug = safeSlug;
        }

        if (isExternal) {
            postMetadata.externalUrl = (editingPost.externalUrl || '').trim();
        }
        if (isCustom) {
            postMetadata.component = (editingPost.component || '').trim();
            if (editingPost.customDataString && editingPost.customDataString.trim()) {
                try {
                    postMetadata.customData = JSON.parse(editingPost.customDataString.trim());
                } catch (jsonErr) {
                    alert(t('admin.ui.cmsBlog.customDataMustBeValidJson', { p0: jsonErr.message }));
                    return;
                }
            } else {
                postMetadata.customData = null;
            }
        }

        let updatedPosts;
        if (!isNew) {
            updatedPosts = posts.map((p, idx) => {
                if (idx === editingPost._index) {
                    return postMetadata;
                }
                return p;
            });
        } else {
            updatedPosts = [postMetadata, ...posts];
        }

        setIsEditorOpen(false);
        setEditingPost(null);
        await onSave(updatedPosts, `Saved blog post "${postMetadata.title}"`);
    };

    const handleDelete = async (index) => {
        const post = posts[index];
        const postDesc = post.slug ? `"${post.title}" (${post.slug})` : `"${post.title}"`;
        if (!window.confirm(t('admin.ui.cmsBlog.areYouSureYouWantTo', { p0: postDesc }))) return;

        const updated = posts.filter((_, idx) => idx !== index);
        await onSave(updated, `Deleted post "${post.title}"`);
    };

    const handleMoveOrder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= posts.length) return;

        const updated = [...posts];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        await onSave(updated, 'Blog posts reordered');
    };

    const handleToggleVisibility = async (index) => {
        const post = posts[index];
        if (!post) return;
        const currentVis = post.visibility || 'public';
        const newVis = currentVis === 'public' ? 'unlisted' : 'public';
        const updated = posts.map((p, idx) => {
            if (idx === index) {
                return {
                    ...p,
                    visibility: newVis,
                };
            }
            return p;
        });
        await onSave(updated, `Updated visibility to ${newVis} for "${post.title || post.slug}"`);
    };

    return (
        <div className="cms-container">
            {/* Clean Sub-navigation Pills without captions */}
            <div className="cms-subnav-header">
                <div className="cms-subnav">
                    <button
                        type="button"
                        className={`cms-subnav-btn ${currentSection === 'posts' ? 'active' : ''}`}
                        onClick={() => setCurrentSection('posts')}
                    >
                        <span>{t('admin.tabs.blog')}</span>
                        <span className="cms-subnav-badge">{formatNumber(posts.length)}</span>
                    </button>
                    <button
                        type="button"
                        className={`cms-subnav-btn ${currentSection === 'quotes' ? 'active' : ''}`}
                        onClick={() => setCurrentSection('quotes')}
                    >
                        <span>{t('admin.tabs.quotes')}</span>
                        <span className="cms-subnav-badge">{formatNumber(quotes.length)}</span>
                    </button>
                </div>
            </div>

            {currentSection === 'quotes' ? (
                <CmsQuotes
                    data={quotes}
                    onSave={onSaveQuotes}
                    saving={saving}
                />
            ) : (
                <>
                    {/* Ergonomic Action Bar */}
                    <div className="cms-action-bar">
                <div className="cms-action-bar-left">
                    <div className="cms-search-wrap">
                        <span className="cms-search-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.placeholders.searchBlog')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <select
                        value={filterLang}
                        onChange={(e) => setFilterLang(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allLanguages')}</option>
                        <option value="en">{t('admin.ui.cmsBlog.english')}</option>
                        <option value="kn">ಕನ್ನಡ</option>
                    </select>

                    <select
                        value={filterVisibility}
                        onChange={(e) => setFilterVisibility(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allVisibility')}</option>
                        <option value="public">{t('admin.filters.public')}</option>
                        <option value="unlisted">{t('admin.filters.unlisted')}</option>
                    </select>

                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allSources')}</option>
                        <option value="local">{t('admin.filters.markdown')}</option>
                        <option value="custom">{t('admin.filters.customComponent')}</option>
                        <option value="external">{t('admin.filters.external')}</option>
                    </select>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredPosts.length)} {t('admin.messages.of')} {formatNumber(posts.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.newPost')}
                    </button>
                </div>
            </div>

            {/* Posts List */}
            {filteredPosts.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noPosts')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredPosts.map((post) => {
                        const originalIndex = posts.indexOf(post);
                        const isCustom = post.type === 'custom' || post.source === 'custom' || Boolean(post.component);
                        const isExternal = !isCustom && (post.source === 'external' || post.source === 'substack' || post.type === 'external' || Boolean(post.externalUrl));
                        
                        let targetUrl = '/blog';
                        if (isExternal && post.externalUrl) {
                            targetUrl = /^https?:\/\//i.test(post.externalUrl) ? post.externalUrl : `https://${post.externalUrl}`;
                        } else if (post.slug) {
                            targetUrl = `/blog/${post.slug}`;
                        }

                        let externalHost = '';
                        if (isExternal && post.externalUrl) {
                            try {
                                externalHost = new URL(targetUrl).hostname.replace(/^www\./, '');
                            } catch {
                                externalHost = '';
                            }
                        }

                        return (
                            <div key={post.slug || post.externalUrl || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">{post.title || t('admin.ui.cmsBlog.untitledPost')}</h4>
                                            
                                            {isCustom && (
                                                <span className="cms-tag cms-tag-custom">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                                                        <polyline points="16 18 22 12 16 6" />
                                                        <polyline points="8 6 2 12 8 18" />
                                                    </svg>
                                                    {post.component || t('admin.filters.customComponent')}
                                                </span>
                                            )}

                                            {isExternal ? (
                                                <span className="cms-tag cms-tag-external">
                                                    ↗ {t('admin.filters.external')}
                                                </span>
                                            ) : post.slug ? (
                                                <span className="cms-item-slug" title={`/${post.slug}`}>
                                                    /{post.slug}
                                                </span>
                                            ) : null}

                                            <button
                                                type="button"
                                                className={`cms-tag ${post.visibility === 'public' ? 'cms-tag-public' : 'cms-tag-unlisted'} cms-tag-interactive`}
                                                title={t('admin.actions.toggleVisibility')}
                                                disabled={saving}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleVisibility(originalIndex);
                                                }}
                                            >
                                                <span className={`cms-status-indicator ${post.visibility === 'public' ? 'public' : 'unlisted'}`} />
                                                {post.visibility === 'public' ? t('admin.filters.public') : t('admin.filters.unlisted')}
                                            </button>

                                            <span className="cms-tag cms-tag-lang">
                                                {post.language === 'kn' ? t('admin.kannada') : t('admin.english')}
                                            </span>
                                        </div>

                                        {post.description && (
                                            <p className="cms-item-desc">{post.description}</p>
                                        )}

                                        {(post.date || externalHost) && (
                                            <div className="cms-item-meta-sub">
                                                {post.date && (
                                                    <span className="cms-item-date">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                            <line x1="16" y1="2" x2="16" y2="6" />
                                                            <line x1="8" y1="2" x2="8" y2="6" />
                                                            <line x1="3" y1="10" x2="21" y2="10" />
                                                        </svg>
                                                        <span>{post.date}</span>
                                                    </span>
                                                )}

                                                {post.date && externalHost && <span className="cms-meta-dot">•</span>}

                                                {externalHost && (
                                                    <span style={{ fontSize: '0.735rem', color: 'var(--ui-text-muted, #5e748d)' }}>
                                                        {externalHost}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveUp')}
                                        disabled={originalIndex === 0 || saving}
                                        onClick={() => handleMoveOrder(originalIndex, -1)}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="18 15 12 9 6 15" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveDown')}
                                        disabled={originalIndex === posts.length - 1 || saving}
                                        onClick={() => handleMoveOrder(originalIndex, 1)}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>
                                    <a
                                        href={targetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cms-btn cms-btn-sm cms-btn-view"
                                        title={t('admin.actions.viewInNewTab')}
                                        aria-label={t('admin.actions.viewInNewTab')}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        <span>{t('admin.actions.view')}</span>
                                    </a>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEditModal(post, originalIndex)}
                                    >
                                        {t('admin.actions.edit')}
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-danger"
                                        onClick={() => handleDelete(originalIndex)}
                                    >
                                        {t('admin.actions.delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Post Editor Modal */}
            {isEditorOpen && editingPost && (
                <div className="cms-modal-backdrop" onClick={() => setIsEditorOpen(false)}>
                    <div className="cms-modal-content cms-modal-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingPost._index !== undefined
                                    ? `${t('admin.actions.edit')}: ${editingPost.title}`
                                    : t('admin.modals.newPost')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsEditorOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSavePost}>
                            <div className="cms-modal-body">
                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            {t('admin.labels.title')} <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingPost.title}
                                            onChange={(e) => handleTitleChange(e.target.value)}
                                            placeholder={t('admin.ui.cmsBlog.examplePlaceholder1')}
                                            required
                                        />
                                    </div>

                                    {editingPost.source !== 'external' && editingPost.type !== 'external' && (
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.slug')} <span className="required">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingPost.slug}
                                                onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
                                                placeholder="great-quotes"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="cms-form-group">
                                    <label className="cms-form-label">{t('admin.labels.description')}</label>
                                    <input
                                        type="text"
                                        className="cms-input"
                                        value={editingPost.description}
                                        onChange={(e) => setEditingPost({ ...editingPost, description: e.target.value })}
                                        placeholder={t('admin.ui.cmsBlog.briefSummaryShownOnBlogList')}
                                    />
                                </div>

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.date')}</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingPost.date}
                                            onChange={(e) => setEditingPost({ ...editingPost, date: e.target.value })}
                                            placeholder={t('admin.ui.cmsBlog.examplePlaceholder2')}
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.language')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.language}
                                            onChange={(e) => setEditingPost({ ...editingPost, language: e.target.value })}
                                        >
                                            <option value="en">{t('admin.ui.cmsBlog.english')}</option>
                                            <option value="kn">ಕನ್ನಡ</option>
                                        </select>
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.visibility')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.visibility}
                                            onChange={(e) => setEditingPost({ ...editingPost, visibility: e.target.value })}
                                        >
                                            <option value="public">{t('admin.filters.public')}</option>
                                            <option value="unlisted">{t('admin.filters.unlisted')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.postType')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.source || 'local'}
                                            onChange={(e) => {
                                                const nextSource = e.target.value;
                                                const isNextExt = nextSource === 'external';
                                                let nextSlug = editingPost.slug || '';
                                                if (isNextExt) {
                                                    nextSlug = '';
                                                } else if (!nextSlug && editingPost.title) {
                                                    nextSlug = editingPost.title
                                                        .toLowerCase()
                                                        .trim()
                                                        .replace(/[^\w\s\u0C80-\u0CFF-]/g, '')
                                                        .replace(/[\s_-]+/g, '-');
                                                }
                                                setEditingPost({
                                                    ...editingPost,
                                                    source: nextSource,
                                                    type: nextSource === 'custom' ? 'custom' : (isNextExt ? 'external' : 'article'),
                                                    slug: nextSlug,
                                                    ...(nextSource === 'local' ? { externalUrl: '', component: '' } : {}),
                                                    ...(nextSource === 'custom' ? { externalUrl: '' } : {}),
                                                    ...(isNextExt ? { component: '' } : {}),
                                                });
                                                if (nextSource === 'local' && !markdownContent.trim()) {
                                                    setMarkdownContent(`# ${editingPost.title || 'New Post'}\n\nWrite your blog post content here...\n`);
                                                }
                                            }}
                                        >
                                            <option value="local">{t('admin.filters.markdown')}</option>
                                            <option value="custom">{t('admin.labels.customReactComponent')}</option>
                                            <option value="external">{t('admin.filters.external')}</option>
                                        </select>
                                    </div>

                                    {editingPost.source === 'custom' && (
                                        <>
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">
                                                    {t('admin.labels.componentName')} <span className="required">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingPost.component || ''}
                                                    onChange={(e) => setEditingPost({ ...editingPost, component: e.target.value })}
                                                    placeholder={t('admin.ui.cmsBlog.examplePlaceholder3')}
                                                    required
                                                />
                                            </div>

                                            <div className="cms-form-group" style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                    <label className="cms-form-label" style={{ marginBottom: 0 }}>
                                                        {t('admin.labels.customDataJson')}
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        {Boolean(editingPost.customDataString?.trim()) && (
                                                            (() => {
                                                                try {
                                                                    JSON.parse(editingPost.customDataString);
                                                                    return <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>{t('admin.ui.cmsBlog.validJson')}</span>;
                                                                } catch (err) {
                                                                    return <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>{t('admin.ui.cmsBlog.invalidJson')}</span>;
                                                                }
                                                            })()
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="cms-btn cms-btn-xs cms-btn-secondary"
                                                            onClick={() => {
                                                                if (!editingPost.customDataString?.trim()) return;
                                                                try {
                                                                    const parsed = JSON.parse(editingPost.customDataString);
                                                                    setEditingPost({ ...editingPost, customDataString: JSON.stringify(parsed, null, 2) });
                                                                } catch (err) {
                                                                    alert(t('admin.ui.cmsBlog.cannotFormatInvalidJson', { p0: err.message }));
                                                                }
                                                            }}
                                                        >
                                                            {t('admin.ui.cmsBlog.prettifyJson')}
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    className="cms-textarea"
                                                    style={{ fontFamily: 'monospace', fontSize: '0.82rem', minHeight: '160px', whiteSpace: 'pre' }}
                                                    value={editingPost.customDataString || ''}
                                                    onChange={(e) =>
                                                        setEditingPost({ ...editingPost, customDataString: e.target.value })
                                                    }
                                                    placeholder={t('admin.ui.cmsBlog.optionalJsonPayloadPassedToComponent')}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {editingPost.source === 'external' && (
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.externalUrl')} <span className="required">*</span>
                                            </label>
                                            <input
                                                type="url"
                                                className="cms-input"
                                                value={editingPost.externalUrl || ''}
                                                onChange={(e) => setEditingPost({ ...editingPost, externalUrl: e.target.value })}
                                                placeholder="https://example.com/article"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>

                                {editingPost.source !== 'external' && editingPost.source !== 'custom' && (
                                    <div className="cms-form-group" style={{ marginTop: '0.85rem' }}>
                                        <label className="cms-form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
                                            {t('admin.labels.contentMarkdown')}
                                        </label>
                                        {loadingMarkdown ? (
                                            <p className="admin-loading-text">{t('admin.messages.loadingMarkdown')}</p>
                                        ) : (
                                            <CmsMarkdownEditor
                                                value={markdownContent}
                                                onChange={setMarkdownContent}
                                                placeholder={t('admin.placeholders.writeArticleMarkdown')}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    className="cms-btn cms-btn-secondary"
                                    onClick={() => setIsEditorOpen(false)}
                                >
                                    {t('admin.actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="cms-btn cms-btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? t('admin.actions.saving') : t('admin.actions.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default CmsBlog;
