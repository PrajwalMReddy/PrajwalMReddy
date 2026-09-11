import React, { useEffect, useMemo, useState } from 'react';
import CmsMarkdownEditor from './CmsMarkdownEditor';
import CmsImageUploader from './CmsImageUploader';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_RESEARCH = {
    type: 'article', // 'article' | 'custom' | 'external'
    slug: '',
    component: '',
    image: '',
    visibility: 'public',
    date: '',
    url: '',
    en: {
        sectionTitle: '',
        title: '',
        description: '',
    },
    kn: {
        sectionTitle: '',
        title: '',
        description: '',
    },
};

const CmsResearch = ({ data = [], onSave, saving }) => {
    const { t, language, formatNumber } = useContent();
    const items = Array.isArray(data) ? data : [];

    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterVis, setFilterVis] = useState('all');

    // Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [markdownContent, setMarkdownContent] = useState('');
    const [loadingMarkdown, setLoadingMarkdown] = useState(false);
    const [activeLangTab, setActiveLangTab] = useState('en');

    useEffect(() => {
        if (!isEditModalOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsEditModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditModalOpen]);

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const titleEn = item.en?.title || item.title?.en || item.title || '';
            const titleKn = item.kn?.title || item.title?.kn || '';
            const descEn = item.en?.description || item.description?.en || item.description || '';

            const matchesSearch =
                !search ||
                titleEn.toLowerCase().includes(search.toLowerCase()) ||
                titleKn.toLowerCase().includes(search.toLowerCase()) ||
                descEn.toLowerCase().includes(search.toLowerCase()) ||
                (item.slug || '').toLowerCase().includes(search.toLowerCase());

            const matchesType = filterType === 'all' || item.type === filterType;
            const matchesVis = filterVis === 'all' || (item.visibility || 'public') === filterVis;

            return matchesSearch && matchesType && matchesVis;
        });
    }, [items, search, filterType, filterVis]);

    const handleOpenAddModal = () => {
        setEditingItem({
            ...DEFAULT_RESEARCH,
            slug: `research-${Date.now()}`,
        });
        setMarkdownContent('# Research Article\n\nWrite research content here...\n');
        setActiveLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = async (item, index) => {
        const normalized = {
            ...item,
            _index: index,
            en: {
                sectionTitle: item.en?.sectionTitle || item.sectionTitle?.en || item.sectionTitle || '',
                title: item.en?.title || item.title?.en || item.title || '',
                description: item.en?.description || item.description?.en || item.description || '',
            },
            kn: {
                sectionTitle: item.kn?.sectionTitle || item.sectionTitle?.kn || '',
                title: item.kn?.title || item.title?.kn || '',
                description: item.kn?.description || item.description?.kn || '',
            },
        };

        setEditingItem(normalized);
        setActiveLangTab('en');
        setIsEditModalOpen(true);

        if (normalized.content !== undefined && normalized.content !== '') {
            setMarkdownContent(normalized.content);
        } else if (normalized.type === 'article' && normalized.slug) {
            setLoadingMarkdown(true);
            try {
                const res = await fetch(
                    `/api/cms/markdown?type=research&slug=${encodeURIComponent(normalized.slug)}`,
                    { credentials: 'include' }
                );
                if (res.ok) {
                    const data = await res.json();
                    setMarkdownContent(data.content || '');
                }
            } catch (err) {
                console.warn('Could not load research markdown:', err);
            } finally {
                setLoadingMarkdown(false);
            }
        } else {
            setMarkdownContent('');
        }
    };

    const handleSaveItemModal = async (e) => {
        e.preventDefault();
        const safeSlug = editingItem.slug.trim();
        if (!safeSlug) {
            alert('Slug is required');
            return;
        }
        if (!editingItem.en.title.trim() && !editingItem.kn.title.trim()) {
            alert('A research title in English or Kannada is required');
            return;
        }

        const isNew = editingItem._index === undefined;

        if (isNew && items.some((it) => it.slug?.toLowerCase() === safeSlug.toLowerCase())) {
            alert('A research entry with this slug already exists.');
            return;
        }

        const itemData = {
            type: editingItem.type,
            slug: safeSlug,
            visibility: editingItem.visibility || 'public',
            image: editingItem.image || '',
            date: editingItem.date || '',
            content: editingItem.type === 'article' ? markdownContent : '',
            en: {
                sectionTitle: (editingItem.en.sectionTitle || editingItem.kn.sectionTitle || '').trim(),
                title: (editingItem.en.title || editingItem.kn.title || '').trim(),
                description: (editingItem.en.description || editingItem.kn.description || '').trim(),
            },
            kn: {
                sectionTitle: (editingItem.kn.sectionTitle || editingItem.en.sectionTitle || '').trim(),
                title: (editingItem.kn.title || editingItem.en.title || '').trim(),
                description: (editingItem.kn.description || editingItem.en.description || '').trim(),
            },
        };

        if (editingItem.type === 'custom') {
            itemData.component = editingItem.component.trim();
        } else if (editingItem.type === 'external') {
            itemData.url = editingItem.url.trim();
        }

        let updatedItems;
        if (!isNew) {
            updatedItems = items.map((it, idx) => {
                if (idx === editingItem._index) {
                    return itemData;
                }
                return it;
            });
        } else {
            updatedItems = [...items, itemData];
        }

        setIsEditModalOpen(false);
        setEditingItem(null);
        await onSave(updatedItems, `Saved research entry "${itemData.en.title}"`);
    };

    const handleDelete = async (index) => {
        const item = items[index];
        const title = item.en?.title || item.title?.en || item.title || item.slug;
        if (!window.confirm(`Are you sure you want to delete research item "${title}"?`)) return;

        const updated = items.filter((_, idx) => idx !== index);
        await onSave(updated, `Deleted research entry "${title}"`);
    };

    const handleMoveOrder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= items.length) return;

        const updated = [...items];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        await onSave(updated, 'Research items reordered');
    };

    return (
        <div className="cms-container">
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
                            placeholder={t('admin.placeholders.searchResearch', 'Search research publications...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allTypes', 'All Types')}</option>
                        <option value="article">{t('admin.filters.articleMarkdown', 'Article (Markdown)')}</option>
                        <option value="custom">{t('admin.filters.customComponent', 'Custom Component')}</option>
                        <option value="external">{t('admin.filters.external', 'External Link')}</option>
                    </select>

                    <select
                        value={filterVis}
                        onChange={(e) => setFilterVis(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">{t('admin.filters.allVisibility', 'All Visibility')}</option>
                        <option value="public">{t('admin.filters.public', 'Public')}</option>
                        <option value="unlisted">{t('admin.filters.unlisted', 'Unlisted')}</option>
                    </select>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredItems.length)} {t('admin.messages.of', 'of')} {formatNumber(items.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.newPublication', '+ New Publication')}
                    </button>
                </div>
            </div>

            {/* Research List */}
            {filteredItems.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noResearch', 'No research publications found')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new item.')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredItems.map((item) => {
                        const originalIndex = items.indexOf(item);
                        const titleEn = item.en?.title || item.title?.en || item.title || '';
                        const titleKn = item.kn?.title || item.title?.kn || '';
                        const descEn = item.en?.description || item.description?.en || item.description || '';
                        const descKn = item.kn?.description || item.description?.kn || '';
                        const secTitleEn = item.en?.sectionTitle || item.sectionTitle?.en || item.sectionTitle || '';
                        const secTitleKn = item.kn?.sectionTitle || item.sectionTitle?.kn || '';

                        const displayTitle = language === 'kn' ? (titleKn || titleEn || 'Untitled Research') : (titleEn || titleKn || 'Untitled Research');
                        const displaySecTitle = language === 'kn' ? (secTitleKn || secTitleEn) : (secTitleEn || secTitleKn);
                        const displayDesc = language === 'kn' ? (descKn || descEn) : (descEn || descKn);

                        return (
                            <div key={item.slug || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <div className="cms-item-thumb-placeholder">🔬</div>

                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {displayTitle}
                                            </h4>
                                            <span className="cms-tag cms-tag-source">
                                                {item.type}
                                            </span>
                                            {displaySecTitle && (
                                                <span className="cms-tag cms-tag-section">
                                                    {displaySecTitle}
                                                </span>
                                            )}
                                            <span className={`cms-tag ${item.visibility === 'public' ? 'cms-tag-public' : 'cms-tag-unlisted'}`}>
                                                {item.visibility || 'public'}
                                            </span>
                                            {item.slug && (
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                    <code>/{item.slug}</code>
                                                </span>
                                            )}
                                        </div>

                                        {displayDesc && (
                                            <p className="cms-item-desc">
                                                {displayDesc}
                                            </p>
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
                                        disabled={originalIndex === items.length - 1 || saving}
                                        onClick={() => handleMoveOrder(originalIndex, 1)}
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEditModal(item, originalIndex)}
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

            {/* Add / Edit Research Modal */}
            {isEditModalOpen && editingItem && (
                <div className="cms-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
                    <div className="cms-modal-content cms-modal-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingItem._index !== undefined
                                    ? t('admin.modals.editPublication', 'Edit Publication')
                                    : t('admin.modals.newPublication', 'New Publication')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveItemModal}>
                            <div className="cms-modal-body">
                                {/* Always visible base configuration */}
                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.type', 'Type')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingItem.type}
                                            onChange={(e) => {
                                                const nextType = e.target.value;
                                                setEditingItem({ ...editingItem, type: nextType });
                                                if (nextType === 'article' && !markdownContent.trim()) {
                                                    setMarkdownContent(`# ${editingItem.en?.title || 'Research Article'}\n\nWrite research content here...\n`);
                                                }
                                            }}
                                        >
                                            <option value="article">{t('admin.labels.articleMarkdownContent', 'Article (Markdown content)')}</option>
                                            <option value="custom">{t('admin.labels.customReactComponent', 'Custom React Component')}</option>
                                            <option value="external">{t('admin.filters.external', 'External Link')}</option>
                                        </select>
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            {t('admin.labels.slug', 'Slug')} <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingItem.slug}
                                            onChange={(e) =>
                                                setEditingItem({ ...editingItem, slug: e.target.value })
                                            }
                                            placeholder="e.g. bengaluru-telugu-dictionary"
                                            required
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.visibility', 'Visibility')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingItem.visibility}
                                            onChange={(e) =>
                                                setEditingItem({ ...editingItem, visibility: e.target.value })
                                            }
                                        >
                                            <option value="public">{t('admin.filters.public', 'Public')}</option>
                                            <option value="unlisted">{t('admin.filters.unlisted', 'Unlisted')}</option>
                                        </select>
                                    </div>
                                </div>

                                {editingItem.type === 'custom' && (
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            Component Name <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            value={editingItem.component || ''}
                                            onChange={(e) =>
                                                setEditingItem({ ...editingItem, component: e.target.value })
                                            }
                                            placeholder="e.g. BengaluruTeluguDictionary"
                                            required
                                        />
                                    </div>
                                )}

                                {editingItem.type === 'external' && (
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">
                                            External URL <span className="required">*</span>
                                        </label>
                                        <input
                                            type="url"
                                            className="cms-input"
                                            value={editingItem.url || ''}
                                            onChange={(e) =>
                                                setEditingItem({ ...editingItem, url: e.target.value })
                                            }
                                            placeholder="https://..."
                                            required
                                        />
                                    </div>
                                )}

                                {editingItem.type === 'article' && (
                                    <div className="cms-form-group" style={{ marginTop: '0.85rem' }}>
                                        <label className="cms-form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
                                            {t('admin.labels.contentMarkdown', 'Article Markdown Content')} <span className="required">*</span>
                                        </label>
                                        {loadingMarkdown ? (
                                            <p className="admin-loading-text">{t('admin.messages.loadingMarkdown', 'Loading markdown...')}</p>
                                        ) : (
                                            <CmsMarkdownEditor
                                                value={markdownContent}
                                                onChange={setMarkdownContent}
                                                placeholder={t('admin.placeholders.writeArticleMarkdown', 'Write research article markdown here...')}
                                            />
                                        )}
                                    </div>
                                )}

                                <div className="cms-lang-pills" style={{ marginTop: '0.85rem' }}>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${activeLangTab === 'en' ? 'active' : ''}`}
                                        onClick={() => setActiveLangTab('en')}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${activeLangTab === 'kn' ? 'active' : ''}`}
                                        onClick={() => setActiveLangTab('kn')}
                                    >
                                        ಕನ್ನಡ
                                    </button>
                                </div>

                                {activeLangTab === 'en' && (
                                    <>
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.title', 'Title')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingItem.en.title}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...editingItem.en, title: e.target.value },
                                                    })
                                                }
                                                placeholder="Research Paper Title"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.sectionTitleGroup', 'Section Title / Group')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingItem.en.sectionTitle}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...editingItem.en, sectionTitle: e.target.value },
                                                    })
                                                }
                                                placeholder="e.g. Linguistics / Natural Language Processing"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingItem.en.description}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...editingItem.en, description: e.target.value },
                                                    })
                                                }
                                                placeholder="Summary of research..."
                                            />
                                        </div>
                                    </>
                                )}

                                {activeLangTab === 'kn' && (
                                    <>
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.title', 'Title')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingItem.kn.title}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...editingItem.kn, title: e.target.value },
                                                    })
                                                }
                                                placeholder="ಸಂಶೋಧನಾ ಶೀರ್ಷಿಕೆ"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.sectionTitleGroup', 'Section Title / Group')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingItem.kn.sectionTitle}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...editingItem.kn, sectionTitle: e.target.value },
                                                    })
                                                }
                                                placeholder="ವಿಭಾಗದ ಶೀರ್ಷಿಕೆ"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingItem.kn.description}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...editingItem.kn, description: e.target.value },
                                                    })
                                                }
                                                placeholder="ಸಂಶೋಧನೆಯ ಸಾರಾಂಶ..."
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="cms-form-group">
                                    <CmsImageUploader
                                        folder="img"
                                        label="Thumbnail Image (Optional)"
                                        value={editingItem.image || ''}
                                        onChange={(imgVal) =>
                                            setEditingItem({ ...editingItem, image: imgVal })
                                        }
                                        helpText="Thumbnail image for the research card."
                                    />
                                </div>
                            </div>

                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    className="cms-btn cms-btn-secondary"
                                    onClick={() => setIsEditModalOpen(false)}
                                >
                                    {t('admin.actions.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="cms-btn cms-btn-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? t('admin.actions.saving', 'Saving...')
                                        : (editingItem._index !== undefined
                                            ? t('admin.actions.save', 'Save Research Item')
                                            : t('admin.actions.newPublication', 'Add Research Item'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmsResearch;
