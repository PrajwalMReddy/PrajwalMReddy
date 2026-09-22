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
    sectionTitle: '',
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
    const items = Array.isArray(data) ? data : (data?.research || data?.items || []);

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        if (language === 'kn') {
            return obj.kn || obj.en || fallback;
        }
        return obj.en || obj.kn || fallback;
    };

    const getItemSection = (item) => {
        const baseSec = (typeof item.sectionTitle === 'string' ? item.sectionTitle : '') ||
            (typeof item.group === 'string' ? item.group : '') || '';

        const rawSecEn = (typeof item.en?.sectionTitle === 'string' && item.en.sectionTitle.trim())
            ? item.en.sectionTitle.trim()
            : (item.sectionTitle?.en || item.group?.en || '');

        const rawSecKn = (typeof item.kn?.sectionTitle === 'string' && item.kn.sectionTitle.trim())
            ? item.kn.sectionTitle.trim()
            : (item.sectionTitle?.kn || item.group?.kn || '');

        const enVal = (rawSecEn || baseSec).trim();
        const knVal = (rawSecKn || baseSec).trim();
        const localized = language === 'kn' ? (knVal || enVal) : (enVal || knVal);
        const id = enVal || knVal || '';
        return {
            en: enVal,
            kn: knVal,
            localized: localized,
            id: id,
            key: id.toLowerCase(),
        };
    };

    const [search, setSearch] = useState('');
    const [selectedSection, setSelectedSection] = useState('all');
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

    const sections = useMemo(() => {
        const sectionMap = new Map();

        if (Array.isArray(data?.sections)) {
            data.sections.forEach((sec) => {
                const id = sec.id || sec.key || (typeof sec.title === 'string' ? sec.title : (sec.title?.en || sec.title?.kn || ''));
                if (id) {
                    const titleEn = typeof sec.title === 'object' ? sec.title?.en || '' : (sec.title || id);
                    const titleKn = typeof sec.title === 'object' ? sec.title?.kn || '' : (sec.title || id);
                    sectionMap.set(id.toLowerCase(), {
                        id: id,
                        title: { en: titleEn, kn: titleKn },
                    });
                }
            });
        }

        items.forEach((item) => {
            const secInfo = getItemSection(item);
            if (secInfo.id) {
                if (!sectionMap.has(secInfo.key)) {
                    sectionMap.set(secInfo.key, {
                        id: secInfo.id,
                        title: { en: secInfo.en || secInfo.kn, kn: secInfo.kn || secInfo.en },
                    });
                }
            }
        });

        return Array.from(sectionMap.values());
    }, [data, items, language]);

    const hasUngrouped = useMemo(() => {
        return items.some((item) => !getItemSection(item).id);
    }, [items, language]);

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const titleEn = item.en?.title || item.title?.en || item.title || '';
            const titleKn = item.kn?.title || item.title?.kn || '';
            const descEn = item.en?.description || item.description?.en || item.description || '';

            const secInfo = getItemSection(item);
            const secEn = secInfo.en;
            const secKn = secInfo.kn;

            const matchesSearch =
                !search ||
                titleEn.toLowerCase().includes(search.toLowerCase()) ||
                titleKn.toLowerCase().includes(search.toLowerCase()) ||
                descEn.toLowerCase().includes(search.toLowerCase()) ||
                secEn.toLowerCase().includes(search.toLowerCase()) ||
                secKn.toLowerCase().includes(search.toLowerCase()) ||
                (item.slug || '').toLowerCase().includes(search.toLowerCase());

            const matchesSection =
                selectedSection === 'all' ||
                (selectedSection === '__none__' && !secInfo.id) ||
                (secInfo.id && secInfo.id.toLowerCase() === selectedSection.toLowerCase()) ||
                (secInfo.en && secInfo.en.toLowerCase() === selectedSection.toLowerCase()) ||
                (secInfo.kn && secInfo.kn.toLowerCase() === selectedSection.toLowerCase());

            const matchesType = filterType === 'all' || item.type === filterType;
            const matchesVis = filterVis === 'all' || (item.visibility || 'public') === filterVis;

            return matchesSearch && matchesSection && matchesType && matchesVis;
        });
    }, [items, search, selectedSection, filterType, filterVis, language]);

    const handleOpenAddModal = () => {
        setEditingItem({
            ...DEFAULT_RESEARCH,
            slug: `research-${Date.now()}`,
            customDataString: '',
        });
        setMarkdownContent('# Research Article\n\nWrite research content here...\n');
        setActiveLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = async (item, index) => {
        const baseSec = (typeof item.sectionTitle === 'string' ? item.sectionTitle : '') ||
            (typeof item.group === 'string' ? item.group : '') || '';

        const rawSecEn = (typeof item.en?.sectionTitle === 'string' && item.en.sectionTitle.trim())
            ? item.en.sectionTitle.trim()
            : (item.sectionTitle?.en || item.group?.en || baseSec.trim());

        const rawSecKn = (typeof item.kn?.sectionTitle === 'string' && item.kn.sectionTitle.trim())
            ? item.kn.sectionTitle.trim()
            : (item.sectionTitle?.kn || item.group?.kn || baseSec.trim());

        const secEn = rawSecEn || '';
        const secKn = rawSecKn || '';

        const initialJson = item.customData !== undefined && item.customData !== null
            ? (typeof item.customData === 'string' ? item.customData : JSON.stringify(item.customData, null, 2))
            : (item.data !== undefined && item.data !== null ? (typeof item.data === 'string' ? item.data : JSON.stringify(item.data, null, 2)) : '');

        const normalized = {
            ...item,
            _index: index,
            _initialSecEn: secEn,
            _initialSecKn: secKn,
            slug: item.slug || '',
            component: item.component || '',
            url: item.url || '',
            customDataString: initialJson,
            sectionTitle: (secEn || secKn || '').trim(),
            en: {
                sectionTitle: secEn.trim(),
                title: item.en?.title || item.title?.en || item.title || '',
                description: item.en?.description || item.description?.en || item.description || '',
            },
            kn: {
                sectionTitle: secKn.trim(),
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
        const safeSlug = (editingItem.slug || '').trim();
        if (!safeSlug) {
            alert('Slug is required');
            return;
        }
        const titleEn = (editingItem.en?.title || '').trim();
        const titleKn = (editingItem.kn?.title || '').trim();
        if (!titleEn && !titleKn) {
            alert('A research title in English or Kannada is required');
            return;
        }

        const isNew = editingItem._index === undefined;

        if (items.some((it, idx) => (isNew || idx !== editingItem._index) && it.slug?.toLowerCase() === safeSlug.toLowerCase())) {
            alert('A research entry with this slug already exists.');
            return;
        }

        let secTitleEn = (editingItem.en?.sectionTitle || '').trim();
        let secTitleKn = (editingItem.kn?.sectionTitle || '').trim();

        // Cross-language synchronization for Section Title
        const origSecEn = (editingItem._initialSecEn || '').trim();
        const origSecKn = (editingItem._initialSecKn || '').trim();

        if (secTitleEn !== origSecEn && secTitleKn === origSecKn) {
            // User modified or cleared English; keep Kannada in sync
            secTitleKn = secTitleEn;
        } else if (secTitleKn !== origSecKn && secTitleEn === origSecEn) {
            // User modified or cleared Kannada; keep English in sync
            secTitleEn = secTitleKn;
        } else if (!secTitleEn && !secTitleKn) {
            secTitleEn = '';
            secTitleKn = '';
        }

        const topSecTitle = secTitleEn || secTitleKn || '';

        const itemData = {
            type: editingItem.type || 'article',
            slug: safeSlug,
            visibility: editingItem.visibility || 'public',
            image: editingItem.image || '',
            date: editingItem.date || '',
            sectionTitle: topSecTitle,
            content: editingItem.type === 'article' ? markdownContent : '',
            en: {
                sectionTitle: secTitleEn,
                title: titleEn || titleKn,
                description: (editingItem.en?.description || '').trim(),
            },
            kn: {
                sectionTitle: secTitleKn,
                title: titleKn || titleEn,
                description: (editingItem.kn?.description || '').trim(),
            },
        };

        if (editingItem.type === 'custom') {
            itemData.component = (editingItem.component || '').trim();
            if (editingItem.customDataString && editingItem.customDataString.trim()) {
                try {
                    itemData.customData = JSON.parse(editingItem.customDataString.trim());
                } catch (jsonErr) {
                    alert(`Custom Data must be valid JSON: ${jsonErr.message}`);
                    return;
                }
            } else {
                itemData.customData = null;
            }
        } else if (editingItem.type === 'external') {
            itemData.url = (editingItem.url || '').trim();
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

        try {
            await onSave(updatedItems, `Saved research entry "${itemData.en.title}"`);
            setIsEditModalOpen(false);
            setEditingItem(null);
        } catch (saveErr) {
            console.error('Save research entry failed:', saveErr);
            alert(`Failed to save research entry: ${saveErr.message || 'Unknown error'}`);
        }
    };

    const handleToggleVisibility = async (index) => {
        const item = items[index];
        if (!item) return;
        const currentVis = item.visibility || 'public';
        const newVis = currentVis === 'public' ? 'unlisted' : 'public';
        const updated = items.map((it, idx) => {
            if (idx === index) {
                return {
                    ...it,
                    visibility: newVis,
                };
            }
            return it;
        });
        const title = item.en?.title || item.title?.en || item.title || item.slug || 'Publication';
        await onSave(updated, `Updated visibility to ${newVis} for "${title}"`);
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
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="cms-select"
                    >
                        <option value="all">
                            {t('admin.filters.allSections', 'All Sections')} ({formatNumber(sections.length)})
                        </option>
                        {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {getLocalized(s.title, s.id)}
                            </option>
                        ))}
                        {hasUngrouped && (
                            <option value="__none__">
                                {t('admin.filters.noSection', 'No Section / Ungrouped')}
                            </option>
                        )}
                    </select>

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
                        const secInfo = getItemSection(item);
                        const displaySecTitle = secInfo.localized;

                        const displayTitle = language === 'kn' ? (titleKn || titleEn || 'Untitled Research') : (titleEn || titleKn || 'Untitled Research');
                        const displayDesc = language === 'kn' ? (descKn || descEn) : (descEn || descKn);

                        const targetUrl = item.type === 'external'
                            ? (item.url?.match(/^https?:\/\//i) ? item.url : `https://${item.url || ''}`)
                            : (item.slug ? `/research/${item.slug.replace(/^\/+/, '')}` : (item.url || '/research'));

                        let externalHost = '';
                        if (item.type === 'external' && item.url) {
                            try {
                                const parsed = new URL(item.url.match(/^https?:\/\//i) ? item.url : `https://${item.url}`);
                                externalHost = parsed.hostname;
                            } catch {
                                externalHost = item.url.replace(/^https?:\/\//i, '').split('/')[0];
                            }
                        }

                        return (
                            <div key={item.slug || item.url || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {displayTitle}
                                            </h4>
                                            <span className={`cms-tag ${item.type === 'custom' ? 'cms-tag-custom' : item.type === 'external' ? 'cms-tag-external' : 'cms-tag-source'}`}>
                                                {item.type || 'article'}
                                            </span>
                                            {displaySecTitle && (
                                                <button
                                                    type="button"
                                                    className="cms-tag cms-tag-section cms-tag-interactive"
                                                    title={t('admin.actions.filterBySection', 'Filter by this section')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedSection(secInfo.id || 'all');
                                                    }}
                                                >
                                                    {displaySecTitle}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className={`cms-tag ${item.visibility === 'public' ? 'cms-tag-public' : 'cms-tag-unlisted'} cms-tag-interactive`}
                                                title={t('admin.actions.toggleVisibility', 'Click to toggle visibility (public/unlisted)')}
                                                disabled={saving}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggleVisibility(originalIndex);
                                                }}
                                            >
                                                <span className={`cms-status-indicator ${item.visibility === 'public' ? 'public' : 'unlisted'}`} />
                                                {item.visibility === 'public' ? t('admin.filters.public', 'Public') : t('admin.filters.unlisted', 'Unlisted')}
                                            </button>
                                            {item.slug && item.type !== 'external' && (
                                                <span className="cms-item-slug" title={`/${item.slug.replace(/^\/+/, '')}`}>
                                                    /{item.slug.replace(/^\/+/, '')}
                                                </span>
                                            )}
                                        </div>

                                        {displayDesc && (
                                            <p className="cms-item-desc">
                                                {displayDesc}
                                            </p>
                                        )}

                                        {(item.date || externalHost) && (
                                            <div className="cms-item-meta-sub">
                                                {item.date && (
                                                    <span className="cms-item-date">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                            <line x1="16" y1="2" x2="16" y2="6" />
                                                            <line x1="8" y1="2" x2="8" y2="6" />
                                                            <line x1="3" y1="10" x2="21" y2="10" />
                                                        </svg>
                                                        <span>{item.date}</span>
                                                    </span>
                                                )}
                                                {item.date && externalHost && <span className="cms-meta-dot">•</span>}
                                                {externalHost && (
                                                    <span style={{ fontSize: '0.735rem', color: '#94a3b8' }}>
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
                                        title={t('admin.actions.moveUp', 'Move Up')}
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
                                        title={t('admin.actions.moveDown', 'Move Down')}
                                        disabled={originalIndex === items.length - 1 || saving}
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
                                        title={t('admin.actions.viewInNewTab', 'View in new tab')}
                                        aria-label={t('admin.actions.viewInNewTab', 'View in new tab')}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        <span>{t('admin.actions.view', 'View')}</span>
                                    </a>
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
                                    <>
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

                                        <div className="cms-form-group" style={{ marginTop: '0.85rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                <label className="cms-form-label" style={{ margin: 0 }}>
                                                    Custom Data (Optional JSON)
                                                </label>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    {editingItem.customDataString && editingItem.customDataString.trim() && (
                                                        (() => {
                                                            try {
                                                                JSON.parse(editingItem.customDataString.trim());
                                                                return <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Valid JSON</span>;
                                                            } catch (err) {
                                                                return <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>⚠ Invalid JSON</span>;
                                                            }
                                                        })()
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="cms-btn cms-btn-xs cms-btn-secondary"
                                                        onClick={() => {
                                                            if (!editingItem.customDataString?.trim()) return;
                                                            try {
                                                                const parsed = JSON.parse(editingItem.customDataString);
                                                                setEditingItem({ ...editingItem, customDataString: JSON.stringify(parsed, null, 2) });
                                                            } catch (err) {
                                                                alert('Cannot format invalid JSON: ' + err.message);
                                                            }
                                                        }}
                                                    >
                                                        Prettify JSON
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                className="cms-textarea"
                                                style={{ fontFamily: 'monospace', fontSize: '0.82rem', minHeight: '180px', whiteSpace: 'pre' }}
                                                value={editingItem.customDataString || ''}
                                                onChange={(e) =>
                                                    setEditingItem({ ...editingItem, customDataString: e.target.value })
                                                }
                                                placeholder={'// Optional JSON payload passed to component props (e.g. array of entries, config object)'}
                                            />
                                        </div>
                                    </>
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
                                                value={editingItem.en?.title || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...(editingItem.en || {}), title: e.target.value },
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
                                                list="research-sections-list-en"
                                                value={editingItem.en?.sectionTitle || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...(editingItem.en || {}), sectionTitle: e.target.value },
                                                    })
                                                }
                                                placeholder="e.g. Linguistics / Natural Language Processing"
                                            />
                                            <datalist id="research-sections-list-en">
                                                {sections.map((s) => (
                                                    <option key={s.id} value={s.title?.en || s.id} />
                                                ))}
                                            </datalist>
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingItem.en?.description || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        en: { ...(editingItem.en || {}), description: e.target.value },
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
                                                value={editingItem.kn?.title || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...(editingItem.kn || {}), title: e.target.value },
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
                                                list="research-sections-list-kn"
                                                value={editingItem.kn?.sectionTitle || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...(editingItem.kn || {}), sectionTitle: e.target.value },
                                                    })
                                                }
                                                placeholder="ವಿಭಾಗದ ಶೀರ್ಷಿಕೆ"
                                            />
                                            <datalist id="research-sections-list-kn">
                                                {sections.map((s) => (
                                                    <option key={s.id} value={s.title?.kn || s.title?.en || s.id} />
                                                ))}
                                            </datalist>
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.description', 'Description')}
                                            </label>
                                            <textarea
                                                className="cms-textarea"
                                                value={editingItem.kn?.description || ''}
                                                onChange={(e) =>
                                                    setEditingItem({
                                                        ...editingItem,
                                                        kn: { ...(editingItem.kn || {}), description: e.target.value },
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
