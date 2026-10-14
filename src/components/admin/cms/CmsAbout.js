import React, { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_ABOUT_DATA = {
    heading: { en: 'About Me', kn: 'ನನ್ನ ಬಗ್ಗೆ' },
    homeHeading: { en: 'Contact Me', kn: 'ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಿ' },
    intro: { en: '', kn: '' },
    subheading: { en: 'Find Me Here', kn: 'ನಾನು ಇಲ್ಲಿ ಸಿಗಬಹುದು' },
    notice: {
        en: 'Feel free to reach out with any questions, thoughts, or just to say hello!',
        kn: 'ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು, ಅನಿಸಿಕೆಗಳು, ಅಥವಾ ವಂದನೆಗಳು ಹೇಳಲು ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಲು ಹಿಂಜರಿಯಬೇಡಿ!',
    },
    links: [
        {
            id: 'email',
            label: { en: 'Email: ', kn: 'ಮಿನ್ನಂಚೆ: ' },
            text: { en: 'prajwalmsreddy AT gmail DOT com', kn: 'gmail ಚುಕ್ಕೆ com ಅಲ್ಲಿ prajwalmsreddy' },
            url: 'mailto:prajwalmsreddy@gmail.com',
            isLink: false,
            isInternal: false,
            showOnHome: true,
        },
        {
            id: 'github',
            label: { en: 'GitHub: ', kn: 'ಗಿಟ್‌ಹಬ್: ' },
            text: { en: 'github.com/PrajwalMReddy', kn: 'github.com/PrajwalMReddy' },
            url: 'https://github.com/PrajwalMReddy',
            isLink: true,
            isInternal: false,
            showOnHome: true,
        },
        {
            id: 'linkedin',
            label: { en: 'LinkedIn: ', kn: 'ಲಿಂಕ್ಡ್ಇನ್: ' },
            text: { en: 'linkedin.com/in/prajwalmreddy', kn: 'linkedin.com/in/prajwalmreddy' },
            url: 'https://www.linkedin.com/in/prajwalmreddy',
            isLink: true,
            isInternal: false,
            showOnHome: true,
        },
        {
            id: 'calendar',
            label: { en: 'Calendar: ', kn: 'ಹೊತ್ತುಪಟ್ಟಿ: ' },
            text: { en: 'book a short meeting with me...', kn: 'ನನ್ನೊಂದಿಗೆ ಸಣ್ಣ ಸಭೆಯನ್ನು ಸೇರಿಸಲು...' },
            url: 'https://calendly.com/pmr93-cornell',
            isLink: true,
            isInternal: false,
            showOnHome: false,
        },
        {
            id: 'blog',
            label: { en: 'Blog: ', kn: 'ಮಿಂಬರಹ: ' },
            text: { en: 'read some of my thoughts here...', kn: 'ನನ್ನ ಕೆಲವು ಯೋಚನೆಗಳನ್ನು ಇಲ್ಲಿ ಓದಿ...' },
            url: '/blog',
            isLink: true,
            isInternal: true,
            showOnHome: false,
        },
    ],
};

const DEFAULT_LINK = {
    id: '',
    label: { en: '', kn: '' },
    text: { en: '', kn: '' },
    url: '',
    isLink: true,
    isInternal: false,
    showOnHome: true,
};

const CmsAbout = ({ data, onSave, saving }) => {
    const { t, language, formatNumber } = useContent();

    const [formState, setFormState] = useState(() => {
        if (data && (data.heading || data.links)) {
            return {
                heading: { en: data.heading?.en ?? DEFAULT_ABOUT_DATA.heading.en, kn: data.heading?.kn ?? DEFAULT_ABOUT_DATA.heading.kn },
                homeHeading: { en: data.homeHeading?.en ?? DEFAULT_ABOUT_DATA.homeHeading.en, kn: data.homeHeading?.kn ?? DEFAULT_ABOUT_DATA.homeHeading.kn },
                intro: { en: data.intro?.en ?? '', kn: data.intro?.kn ?? '' },
                subheading: { en: data.subheading?.en ?? DEFAULT_ABOUT_DATA.subheading.en, kn: data.subheading?.kn ?? DEFAULT_ABOUT_DATA.subheading.kn },
                notice: { en: data.notice?.en ?? DEFAULT_ABOUT_DATA.notice.en, kn: data.notice?.kn ?? DEFAULT_ABOUT_DATA.notice.kn },
                links: Array.isArray(data.links) ? data.links : DEFAULT_ABOUT_DATA.links,
            };
        }
        return DEFAULT_ABOUT_DATA;
    });

    const [langTab, setLangTab] = useState(language || 'en');

    // Sync tab when global language changes
    useEffect(() => {
        if (language) {
            setLangTab(language);
        }
    }, [language]);

    // Links state
    const [searchLinks, setSearchLinks] = useState('');
    const [filterHome, setFilterHome] = useState('all'); // 'all' | 'home' | 'about-only'
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [editingLinkIdx, setEditingLinkIdx] = useState(null);
    const [linkState, setLinkState] = useState(DEFAULT_LINK);
    const [linkModalLang, setLinkModalLang] = useState(language || 'en');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsLinkModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (data && (data.heading || data.links)) {
            setFormState({
                heading: { en: data.heading?.en ?? DEFAULT_ABOUT_DATA.heading.en, kn: data.heading?.kn ?? DEFAULT_ABOUT_DATA.heading.kn },
                homeHeading: { en: data.homeHeading?.en ?? DEFAULT_ABOUT_DATA.homeHeading.en, kn: data.homeHeading?.kn ?? DEFAULT_ABOUT_DATA.homeHeading.kn },
                intro: { en: data.intro?.en ?? '', kn: data.intro?.kn ?? '' },
                subheading: { en: data.subheading?.en ?? DEFAULT_ABOUT_DATA.subheading.en, kn: data.subheading?.kn ?? DEFAULT_ABOUT_DATA.subheading.kn },
                notice: { en: data.notice?.en ?? DEFAULT_ABOUT_DATA.notice.en, kn: data.notice?.kn ?? DEFAULT_ABOUT_DATA.notice.kn },
                links: Array.isArray(data.links) ? data.links : DEFAULT_ABOUT_DATA.links,
            });
        }
    }, [data]);

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        const current = langTab || language;
        const alt = current === 'kn' ? 'en' : 'kn';
        return obj[current] || obj[alt] || Object.values(obj).find((v) => typeof v === 'string' && v.trim() !== '') || fallback;
    };

    const handleTextChange = (field, lang, value) => {
        setFormState((prev) => ({
            ...prev,
            [field]: {
                ...prev[field],
                [lang]: value,
            },
        }));
    };

    const handleSaveHeadings = async (e) => {
        if (e) e.preventDefault();
        await onSave(formState, t('admin.messages.saveSuccess', 'About & contact headings updated'));
    };

    // --- Links Handlers ---
    const filteredLinks = useMemo(() => {
        return formState.links.filter((link) => {
            const labelEn = typeof link.label === 'object' ? link.label.en || '' : link.label || '';
            const labelKn = typeof link.label === 'object' ? link.label.kn || '' : '';
            const textEn = typeof link.text === 'object' ? link.text.en || '' : link.text || '';
            const textKn = typeof link.text === 'object' ? link.text.kn || '' : '';
            const url = link.url || '';

            const matchesSearch =
                !searchLinks ||
                labelEn.toLowerCase().includes(searchLinks.toLowerCase()) ||
                labelKn.toLowerCase().includes(searchLinks.toLowerCase()) ||
                textEn.toLowerCase().includes(searchLinks.toLowerCase()) ||
                textKn.toLowerCase().includes(searchLinks.toLowerCase()) ||
                url.toLowerCase().includes(searchLinks.toLowerCase());

            const matchesHome =
                filterHome === 'all' ||
                (filterHome === 'home' && link.showOnHome) ||
                (filterHome === 'about-only' && !link.showOnHome);

            return matchesSearch && matchesHome;
        });
    }, [formState.links, searchLinks, filterHome]);

    const homeCount = useMemo(() => formState.links.filter((l) => l.showOnHome).length, [formState.links]);

    const handleToggleShowOnHome = async (idx, e) => {
        if (e) e.stopPropagation();
        const updated = formState.links.map((link, i) => {
            if (i === idx) return { ...link, showOnHome: !link.showOnHome };
            return link;
        });

        const newAbout = { ...formState, links: updated };
        setFormState(newAbout);
        await onSave(newAbout, 'Display on home status updated');
    };

    const handleMoveLink = async (idx, direction) => {
        const targetIdx = idx + direction;
        if (targetIdx < 0 || targetIdx >= formState.links.length) return;

        const updated = [...formState.links];
        const [moved] = updated.splice(idx, 1);
        updated.splice(targetIdx, 0, moved);

        const newAbout = { ...formState, links: updated };
        setFormState(newAbout);
        await onSave(newAbout, 'Links reordered');
    };

    const handleDeleteLink = async (idx) => {
        const link = formState.links[idx];
        const label = getLocalized(link.label, getLocalized(link.text, 'this item'));
        if (!window.confirm(`${t('admin.messages.confirmDelete', 'Are you sure you want to delete this item?')} (${label})`)) return;

        const updated = formState.links.filter((_, i) => i !== idx);
        const newAbout = { ...formState, links: updated };
        setFormState(newAbout);
        await onSave(newAbout, `Deleted "${label}"`);
    };

    const handleOpenAddLink = () => {
        setEditingLinkIdx(null);
        setLinkState({
            id: `link-${Date.now()}`,
            label: { en: '', kn: '' },
            text: { en: '', kn: '' },
            url: '',
            isLink: true,
            isInternal: false,
            showOnHome: true,
        });
        setLinkModalLang(langTab || language || 'kn');
        setIsLinkModalOpen(true);
    };

    const handleOpenEditLink = (link, idx) => {
        setEditingLinkIdx(idx);
        setLinkState({
            id: link.id || `link-${idx}`,
            label: {
                en: typeof link.label === 'object' ? (link.label.en ?? '') : (link.label ?? ''),
                kn: typeof link.label === 'object' ? (link.label.kn ?? '') : '',
            },
            text: {
                en: typeof link.text === 'object' ? (link.text.en ?? '') : (link.text ?? ''),
                kn: typeof link.text === 'object' ? (link.text.kn ?? '') : '',
            },
            url: link.url || '',
            isLink: link.isLink !== false && Boolean(link.url),
            isInternal: Boolean(link.isInternal),
            showOnHome: link.showOnHome !== false,
        });
        setLinkModalLang(langTab || language || 'kn');
        setIsLinkModalOpen(true);
    };

    const handleSaveLinkModal = async (e) => {
        e.preventDefault();
        const hasLabel = Boolean(linkState.label.en.trim() || linkState.label.kn.trim());
        const hasText = Boolean(linkState.text.en.trim() || linkState.text.kn.trim());
        if (!hasLabel && !hasText) {
            alert(language === 'kn' ? 'ದಯವಿಟ್ಟು ಲೇಬಲ್ ಅಥವಾ ಪ್ರದರ್ಶನ ಪಠ್ಯವನ್ನು ನಮೂದಿಸಿ.' : 'Please provide a label or display text for the link.');
            return;
        }

        const cleanLink = {
            id: linkState.id || `link-${Date.now()}`,
            label: {
                en: (linkState.label.en || linkState.label.kn || '').trim(),
                kn: (linkState.label.kn || linkState.label.en || '').trim(),
            },
            text: {
                en: (linkState.text.en || linkState.text.kn || '').trim(),
                kn: (linkState.text.kn || linkState.text.en || '').trim(),
            },
            url: linkState.url.trim(),
            isLink: Boolean(linkState.isLink && linkState.url.trim()),
            isInternal: Boolean(linkState.isInternal),
            showOnHome: Boolean(linkState.showOnHome),
        };

        let updated;
        if (editingLinkIdx !== null) {
            updated = formState.links.map((l, idx) => (idx === editingLinkIdx ? cleanLink : l));
        } else {
            updated = [...formState.links, cleanLink];
        }

        const newAbout = { ...formState, links: updated };
        setFormState(newAbout);
        setIsLinkModalOpen(false);
        await onSave(newAbout, editingLinkIdx !== null ? 'Link updated' : 'Link added');
    };

    return (
        <div className="cms-container">
            {/* Action Bar */}
            <div className="cms-action-bar">
                <div className="cms-action-bar-left">
                    <div className="cms-lang-pills">
                        <button
                            type="button"
                            className={`cms-lang-pill-btn ${langTab === 'en' ? 'active' : ''}`}
                            onClick={() => setLangTab('en')}
                        >
                            {t('admin.labels.english', 'English')}
                        </button>
                        <button
                            type="button"
                            className={`cms-lang-pill-btn ${langTab === 'kn' ? 'active' : ''}`}
                            onClick={() => setLangTab('kn')}
                        >
                            {t('admin.labels.kannada', 'ಕನ್ನಡ')}
                        </button>
                    </div>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleSaveHeadings}
                        disabled={saving}
                    >
                        {saving ? t('admin.actions.saving', 'Saving...') : t('admin.actions.save', 'Save Changes')}
                    </button>
                </div>
            </div>

            {/* SECTION 1: PAGE HEADINGS & NOTICE */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    <h3 className="cms-form-heading" style={{ fontSize: '1.05rem', margin: 0 }}>
                        {t('admin.about.headingsTitle', 'Page Headings & Notice')} ({langTab === 'en' ? t('admin.labels.english', 'English') : t('admin.labels.kannada', 'Kannada')})
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                        {t('admin.about.headingsDesc', 'Configure headings and closing message for the dedicated /about page and homepage contact block')}
                    </p>
                </div>

                <div className="cms-form-row" style={{ marginBottom: '0.85rem' }}>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.about.dedicatedPageTitle', 'Dedicated Page Title (/about)')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.heading[langTab] || ''}
                            onChange={(e) => handleTextChange('heading', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? 'e.g. About Me' : 'ಉದಾ: ನನ್ನ ಬಗ್ಗೆ'}
                        />
                    </div>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.about.homeSectionTitle', 'Homepage Section Title')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.homeHeading[langTab] || ''}
                            onChange={(e) => handleTextChange('homeHeading', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? 'e.g. Contact Me' : 'ಉದಾ: ನನ್ನನ್ನು ಸಂಪರ್ಕಿಸಿ'}
                        />
                    </div>
                </div>

                <div className="cms-form-row" style={{ marginBottom: '0.85rem' }}>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.about.findMeHereLabel', 'Subheading ("Find Me Here")')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.subheading[langTab] || ''}
                            onChange={(e) => handleTextChange('subheading', langTab, e.target.value)}
                            placeholder={langTab === 'en' ? 'e.g. Find Me Here' : 'ಉದಾ: ನಾನು ಇಲ್ಲಿ ಸಿಗಬಹುದು'}
                        />
                    </div>
                    <div className="cms-form-group">
                        <label className="cms-form-label">{t('admin.labels.optionalNote', 'Intro Subtext (Optional)')}</label>
                        <input
                            type="text"
                            className="cms-input"
                            value={formState.intro[langTab] || ''}
                            onChange={(e) => handleTextChange('intro', langTab, e.target.value)}
                            placeholder="Optional intro description before links"
                        />
                    </div>
                </div>

                <div className="cms-form-group">
                    <label className="cms-form-label">{t('admin.about.closingNoticeLabel', 'Closing Notice Message')}</label>
                    <input
                        type="text"
                        className="cms-input"
                        value={formState.notice[langTab] || ''}
                        onChange={(e) => handleTextChange('notice', langTab, e.target.value)}
                        placeholder={langTab === 'en' ? 'e.g. Feel free to reach out with any questions, thoughts, or just to say hello!' : 'ಯಾವುದೇ ಪ್ರಶ್ನೆಗಳು, ಅನಿಸಿಕೆಗಳು...'}
                    />
                </div>
            </div>

            {/* SECTION 2: CONTACT & SOCIAL LINKS */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                        <h3 className="cms-form-heading" style={{ fontSize: '1.05rem', margin: 0 }}>
                            {t('admin.about.linksHeading', 'Contact & Social Channels')} ({formatNumber(formState.links.length)})
                        </h3>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            {t('admin.about.linksDesc', 'Manage contact channels and toggle "Display on Home" for what appears on the homepage vs. dedicated about page')}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddLink}
                    >
                        {t('admin.actions.addLink', '+ Add Contact Link')}
                    </button>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div className="cms-search-wrap" style={{ maxWidth: '300px' }}>
                        <span className="cms-search-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.placeholders.searchLinks', 'Search contact links...')}
                            value={searchLinks}
                            onChange={(e) => setSearchLinks(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                            type="button"
                            className={`cms-filter-pill ${filterHome === 'home' ? 'active' : ''}`}
                            onClick={() => setFilterHome((prev) => (prev === 'home' ? 'all' : 'home'))}
                            title="Filter items displayed on Home Page"
                        >
                            ★ {t('admin.about.showOnHome', 'On Home')} ({formatNumber(homeCount)})
                        </button>

                        <button
                            type="button"
                            className={`cms-filter-pill ${filterHome === 'about-only' ? 'active' : ''}`}
                            onClick={() => setFilterHome((prev) => (prev === 'about-only' ? 'all' : 'about-only'))}
                            title="Filter items shown on About page only"
                        >
                            {language === 'kn' ? 'ನನ್ನ ಬಗ್ಗೆ ಮಾತ್ರ' : 'About Only'} ({formatNumber(formState.links.length - homeCount)})
                        </button>

                        <span className="cms-meta-summary">
                            {formatNumber(filteredLinks.length)} {t('admin.messages.of', 'of')} {formatNumber(formState.links.length)}
                        </span>
                    </div>
                </div>

                {filteredLinks.length === 0 ? (
                    <div className="cms-empty-state">
                        <p className="cms-empty-title">{t('admin.messages.noLinks', 'No contact links found')}</p>
                        <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new item.')}</p>
                    </div>
                ) : (
                    <div className="cms-list">
                        {filteredLinks.map((link) => {
                            const originalIdx = formState.links.indexOf(link);
                            const labelText = getLocalized(link.label, '');
                            const textVal = getLocalized(link.text, '');

                            return (
                                <div key={link.id || originalIdx} className={`cms-item-row ${link.showOnHome ? 'featured' : ''}`}>
                                    <div className="cms-item-main">
                                        <div className="cms-item-content">
                                            <div className="cms-item-header">
                                                <h4 className="cms-item-title">
                                                    {labelText} {textVal}
                                                </h4>
                                                {link.url && (
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="cms-item-link"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {link.url} ↗
                                                    </a>
                                                )}
                                                {link.isInternal && (
                                                    <span className="cms-tag cms-tag-section">Internal Route</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="cms-item-actions">
                                        <button
                                            type="button"
                                            className={`cms-star-btn ${link.showOnHome ? 'active' : ''}`}
                                            onClick={(e) => handleToggleShowOnHome(originalIdx, e)}
                                            title={link.showOnHome ? 'Displayed on Home Page (Click to hide from Home)' : 'Hidden from Home (Click to show on Home)'}
                                        >
                                            ★ {link.showOnHome ? (language === 'kn' ? 'ಮುಖಪುಟದಲ್ಲಿದೆ' : 'On Home') : (language === 'kn' ? 'ನನ್ನ ಬಗ್ಗೆ ಮಾತ್ರ' : 'About Only')}
                                        </button>

                                        <button
                                            type="button"
                                            className="cms-btn-icon"
                                            onClick={() => handleMoveLink(originalIdx, -1)}
                                            disabled={originalIdx === 0}
                                            title={t('admin.actions.moveUp', 'Move Up')}
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn-icon"
                                            onClick={() => handleMoveLink(originalIdx, 1)}
                                            disabled={originalIdx === formState.links.length - 1}
                                            title={t('admin.actions.moveDown', 'Move Down')}
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn cms-btn-sm cms-btn-secondary"
                                            onClick={() => handleOpenEditLink(link, originalIdx)}
                                        >
                                            {t('admin.actions.edit', 'Edit')}
                                        </button>
                                        <button
                                            type="button"
                                            className="cms-btn cms-btn-sm cms-btn-danger"
                                            onClick={() => handleDeleteLink(originalIdx)}
                                        >
                                            {t('admin.actions.delete', 'Delete')}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: Add / Edit Contact Link */}
            {isLinkModalOpen && (
                <div className="cms-modal-backdrop" onClick={() => setIsLinkModalOpen(false)}>
                    <div className="cms-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">{editingLinkIdx !== null ? t('admin.modals.editLink', 'Edit Contact Link') : t('admin.modals.newLink', 'Add Contact Link')}</h3>
                            <button type="button" className="cms-modal-close-btn" onClick={() => setIsLinkModalOpen(false)}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveLinkModal}>
                            <div className="cms-modal-body">
                                <div className="cms-lang-pills" style={{ marginBottom: '1.25rem' }}>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${linkModalLang === 'en' ? 'active' : ''}`}
                                        onClick={() => setLinkModalLang('en')}
                                    >
                                        {t('admin.labels.english', 'English')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${linkModalLang === 'kn' ? 'active' : ''}`}
                                        onClick={() => setLinkModalLang('kn')}
                                    >
                                        {t('admin.labels.kannada', 'ಕನ್ನಡ')}
                                    </button>
                                </div>

                                {linkModalLang === 'en' ? (
                                    <>
                                        <div className="cms-form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="cms-form-label">{t('admin.labels.label', 'Label')} ({t('admin.labels.english', 'English')})</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={linkState.label.en}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, label: { ...prev.label, en: e.target.value } }))}
                                                placeholder="e.g. GitHub: "
                                            />
                                        </div>
                                        <div className="cms-form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="cms-form-label">{t('admin.labels.displayText', 'Display Text')} ({t('admin.labels.english', 'English')})</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={linkState.text.en}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, text: { ...prev.text, en: e.target.value } }))}
                                                placeholder="e.g. github.com/PrajwalMReddy"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="cms-form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="cms-form-label">{t('admin.labels.label', 'Label')} ({t('admin.labels.kannada', 'Kannada')})</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={linkState.label.kn}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, label: { ...prev.label, kn: e.target.value } }))}
                                                placeholder="ಉದಾ: ಗಿಟ್‌ಹಬ್: "
                                            />
                                        </div>
                                        <div className="cms-form-group" style={{ marginBottom: '0.75rem' }}>
                                            <label className="cms-form-label">{t('admin.labels.displayText', 'Display Text')} ({t('admin.labels.kannada', 'Kannada')})</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={linkState.text.kn}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, text: { ...prev.text, kn: e.target.value } }))}
                                                placeholder="ಉದಾ: github.com/PrajwalMReddy"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="cms-form-group" style={{ marginBottom: '0.75rem' }}>
                                    <label className="cms-form-label">{t('admin.labels.url', 'URL / Destination')}</label>
                                    <input
                                        type="text"
                                        className="cms-input"
                                        value={linkState.url}
                                        onChange={(e) => setLinkState((prev) => ({ ...prev, url: e.target.value }))}
                                        placeholder="e.g. https://github.com/PrajwalMReddy or /blog"
                                    />
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                                    <label className="cms-checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="cms-checkbox"
                                            checked={linkState.showOnHome}
                                            onChange={(e) => setLinkState((prev) => ({ ...prev, showOnHome: e.target.checked }))}
                                        />
                                        <span>{t('admin.about.displayOnHomeToggle', 'Display on Homepage')}</span>
                                    </label>

                                    <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.15rem' }}>
                                        <label className="cms-checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="cms-checkbox"
                                                checked={linkState.isLink}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, isLink: e.target.checked }))}
                                            />
                                            <span>{language === 'kn' ? 'ಕ್ಲಿಕ್ ಮಾಡಬಹುದಾದ ಕೊಂಡಿ' : 'Clickable Link'}</span>
                                        </label>

                                        <label className="cms-checkbox-label">
                                            <input
                                                type="checkbox"
                                                className="cms-checkbox"
                                                checked={linkState.isInternal}
                                                onChange={(e) => setLinkState((prev) => ({ ...prev, isInternal: e.target.checked }))}
                                            />
                                            <span>{language === 'kn' ? 'ಆಂತರಿಕ ಮಾರ್ಗ (/blog)' : 'Internal Router Link (/blog)'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="cms-modal-footer">
                                <button type="button" className="cms-btn cms-btn-secondary" onClick={() => setIsLinkModalOpen(false)}>
                                    {t('admin.actions.cancel', 'Cancel')}
                                </button>
                                <button type="submit" className="cms-btn cms-btn-primary">
                                    {editingLinkIdx !== null ? t('admin.actions.save', 'Save Changes') : t('admin.actions.addLink', '+ Add Link')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmsAbout;
