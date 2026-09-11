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
        });
        setMarkdownContent('# New Post\n\nWrite your blog post content here...\n');
        setIsEditorOpen(true);
    };

    const handleOpenEditModal = async (post, index) => {
        const isCustom = post.type === 'custom' || post.source === 'custom' || Boolean(post.component);
        const isExt = !isCustom && (post.source === 'external' || post.source === 'substack' || post.type === 'external' || Boolean(post.externalUrl));
        setEditingPost({
            ...post,
            _index: index,
            source: isCustom ? 'custom' : (isExt ? 'external' : 'local'),
            type: isCustom ? 'custom' : (isExt ? 'external' : 'article'),
            component: post.component || '',
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
                console.warn('Could not load blog markdown:', err);
            } finally {
                setLoadingMarkdown(false);
            }
        } else {
            setMarkdownContent('');
        }
    };

    const handleTitleChange = (val) => {
        const isNew = editingPost._index === undefined;
        // Auto-generate slug if it's a new post
        if (isNew) {
            const autoSlug = val
                .toLowerCase()
                .trim()
                .replace(/[^\w\s\u0C80-\u0CFF-]/g, '')
                .replace(/[\s_-]+/g, '-');
            setEditingPost({ ...editingPost, title: val, slug: autoSlug });
        } else {
            setEditingPost({ ...editingPost, title: val });
        }
    };

    const handleSavePost = async (e) => {
        e.preventDefault();
        const safeSlug = editingPost.slug.trim();
        if (!safeSlug) {
            alert('Slug is required');
            return;
        }
        if (!editingPost.title.trim()) {
            alert('Title is required');
            return;
        }

        const isNew = editingPost._index === undefined;

        if (
            isNew &&
            posts.some((p) => p.slug.toLowerCase() === safeSlug.toLowerCase())
        ) {
            alert('A post with this slug already exists. Please choose a unique slug.');
            return;
        }

        const isCustom = editingPost.source === 'custom' || editingPost.type === 'custom';
        const isExternal = !isCustom && (editingPost.source === 'external' || editingPost.type === 'external');

        if (isExternal && !(editingPost.externalUrl || '').trim()) {
            alert('External URL is required for External Link posts.');
            return;
        }

        if (isCustom && !(editingPost.component || '').trim()) {
            alert('Component Name is required for Custom React Component posts.');
            return;
        }

        const postMetadata = {
            slug: safeSlug,
            title: editingPost.title.trim(),
            description: (editingPost.description || '').trim(),
            date: (editingPost.date || '').trim(),
            language: editingPost.language || 'en',
            visibility: editingPost.visibility || 'public',
            source: isCustom ? 'custom' : (isExternal ? 'external' : 'local'),
            type: isCustom ? 'custom' : (isExternal ? 'external' : 'article'),
            content: (isExternal || isCustom) ? '' : markdownContent,
        };

        if (isExternal) {
            postMetadata.externalUrl = (editingPost.externalUrl || '').trim();
        }
        if (isCustom) {
            postMetadata.component = (editingPost.component || '').trim();
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
        if (!window.confirm(`Are you sure you want to delete post "${post.title}" (${post.slug})?`)) return;

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
                        <span>📝 {t('admin.tabs.blog', 'Blog Posts')}</span>
                        <span className="cms-subnav-badge">{formatNumber(posts.length)}</span>
                    </button>
                    <button
                        type="button"
                        className={`cms-subnav-btn ${currentSection === 'quotes' ? 'active' : ''}`}
                        onClick={() => setCurrentSection('quotes')}
                    >
                        <span>💬 {t('admin.tabs.quotes', 'Quotes')}</span>
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
                            placeholder={t('admin.placeholders.searchBlog', 'Search posts...')}
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
                        <option value="all">{t('admin.filters.allLanguages', 'All Languages')}</option>
                        <option value="en">English</option>
                        <option value="kn">ಕನ್ನಡ</option>
                    </select>

                    <select
                        value={filterVisibility}
                        onChange={(e) => setFilterVisibility(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allVisibility', 'All Visibility')}</option>
                        <option value="public">{t('admin.filters.public', 'Public')}</option>
                        <option value="unlisted">{t('admin.filters.unlisted', 'Unlisted')}</option>
                    </select>

                    <select
                        value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allSources', 'All Sources')}</option>
                        <option value="local">{t('admin.filters.markdown', 'Markdown File')}</option>
                        <option value="custom">{t('admin.filters.customComponent', 'Custom Component')}</option>
                        <option value="external">{t('admin.filters.external', 'External Link')}</option>
                    </select>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredPosts.length)} {t('admin.messages.of', 'of')} {formatNumber(posts.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.newPost', '+ New Post')}
                    </button>
                </div>
            </div>

            {/* Posts List */}
            {filteredPosts.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noPosts', 'No blog posts found')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Create your first blog post using the button above.')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredPosts.map((post) => {
                        const originalIndex = posts.indexOf(post);
                        const isCustom = post.type === 'custom' || post.source === 'custom' || Boolean(post.component);
                        const isExternal = !isCustom && (post.source === 'external' || post.source === 'substack' || post.type === 'external' || Boolean(post.externalUrl));

                        return (
                            <div key={post.slug || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <div className="cms-item-thumb-placeholder">
                                        {isCustom ? '⚛' : (isExternal ? '↗' : '📝')}
                                    </div>

                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">{post.title || 'Untitled Post'}</h4>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                <code>/{post.slug}</code>
                                            </span>
                                            <span className="cms-tag cms-tag-lang">
                                                {post.language === 'kn' ? 'ಕನ್ನಡ' : 'English'}
                                            </span>
                                            <span className={`cms-tag ${post.visibility === 'public' ? 'cms-tag-public' : 'cms-tag-unlisted'}`}>
                                                {post.visibility === 'public' ? t('admin.filters.public', 'Public') : t('admin.filters.unlisted', 'Unlisted')}
                                            </span>
                                            <span className="cms-tag cms-tag-source">
                                                {isCustom
                                                    ? `⚛ ${post.component || t('admin.filters.customComponent', 'Custom Component')}`
                                                    : isExternal
                                                    ? `↗ ${t('admin.filters.external', 'External Link')}`
                                                    : t('admin.filters.markdown', 'Markdown')}
                                            </span>
                                            {post.date && (
                                                <span className="cms-date-tag">
                                                    📅 {post.date}
                                                </span>
                                            )}
                                        </div>

                                        {post.description && (
                                            <p className="cms-item-desc">{post.description}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveUp', 'Move Up')}
                                        disabled={originalIndex === 0 || saving}
                                        onClick={() => handleMoveOrder(originalIndex, -1)}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveDown', 'Move Down')}
                                        disabled={originalIndex === posts.length - 1 || saving}
                                        onClick={() => handleMoveOrder(originalIndex, 1)}
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEditModal(post, originalIndex)}
                                    >
                                        {t('admin.actions.edit', 'Edit')}
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-danger"
                                        onClick={() => handleDelete(originalIndex)}
                                    >
                                        {t('admin.actions.delete', 'Delete')}
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
                                    ? `${t('admin.actions.edit', 'Edit')}: ${editingPost.title}`
                                    : t('admin.modals.newPost', 'Create Blog Post')}
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
                                            {t('admin.labels.title', 'Post Title')} <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingPost.title}
                                            onChange={(e) => handleTitleChange(e.target.value)}
                                            placeholder="e.g. Great Quotes"
                                            required
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            {t('admin.labels.slug', 'URL Slug')} <span className="required">*</span>
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
                                </div>

                                <div className="cms-form-group">
                                    <label className="cms-form-label">{t('admin.labels.description', 'Short Description / Subtitle')}</label>
                                    <input
                                        type="text"
                                        className="cms-input"
                                        value={editingPost.description}
                                        onChange={(e) => setEditingPost({ ...editingPost, description: e.target.value })}
                                        placeholder="Brief summary shown on blog list..."
                                    />
                                </div>

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.date', 'Publication Date')}</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingPost.date}
                                            onChange={(e) => setEditingPost({ ...editingPost, date: e.target.value })}
                                            placeholder="e.g. July 16, 2025"
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.language', 'Language')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.language}
                                            onChange={(e) => setEditingPost({ ...editingPost, language: e.target.value })}
                                        >
                                            <option value="en">English</option>
                                            <option value="kn">ಕನ್ನಡ</option>
                                        </select>
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.visibility', 'Visibility')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.visibility}
                                            onChange={(e) => setEditingPost({ ...editingPost, visibility: e.target.value })}
                                        >
                                            <option value="public">{t('admin.filters.public', 'Public')}</option>
                                            <option value="unlisted">{t('admin.filters.unlisted', 'Unlisted')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.postType', 'Source Type')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingPost.source || 'local'}
                                            onChange={(e) => {
                                                const nextSource = e.target.value;
                                                setEditingPost({
                                                    ...editingPost,
                                                    source: nextSource,
                                                    type: nextSource === 'custom' ? 'custom' : (nextSource === 'external' ? 'external' : 'article'),
                                                    ...(nextSource === 'local' ? { externalUrl: '', component: '' } : {}),
                                                    ...(nextSource === 'custom' ? { externalUrl: '' } : {}),
                                                    ...(nextSource === 'external' ? { component: '' } : {}),
                                                });
                                                if (nextSource === 'local' && !markdownContent.trim()) {
                                                    setMarkdownContent(`# ${editingPost.title || 'New Post'}\n\nWrite your blog post content here...\n`);
                                                }
                                            }}
                                        >
                                            <option value="local">{t('admin.filters.markdown', 'Markdown File')}</option>
                                            <option value="custom">{t('admin.labels.customReactComponent', 'Custom React Component')}</option>
                                            <option value="external">{t('admin.filters.external', 'External Link')}</option>
                                        </select>
                                    </div>

                                    {editingPost.source === 'custom' && (
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.componentName', 'Component Name')} <span className="required">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingPost.component || ''}
                                                onChange={(e) => setEditingPost({ ...editingPost, component: e.target.value })}
                                                placeholder="e.g. BengaluruTeluguDictionary"
                                                required
                                            />
                                        </div>
                                    )}

                                    {editingPost.source === 'external' && (
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.externalUrl', 'External URL')} <span className="required">*</span>
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
                                            {t('admin.labels.contentMarkdown', 'Markdown Content')}
                                        </label>
                                        {loadingMarkdown ? (
                                            <p className="admin-loading-text">{t('admin.messages.loadingMarkdown', 'Loading markdown...')}</p>
                                        ) : (
                                            <CmsMarkdownEditor
                                                value={markdownContent}
                                                onChange={setMarkdownContent}
                                                placeholder={t('admin.placeholders.writeArticleMarkdown', 'Write your article in markdown format...')}
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
                                    {t('admin.actions.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="cms-btn cms-btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? t('admin.actions.saving', 'Saving...') : t('admin.actions.save', 'Save Blog Post')}
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
