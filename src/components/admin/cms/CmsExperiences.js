import React, { useEffect, useMemo, useState } from 'react';
import CmsSectionsModal from './CmsSectionsModal';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_EXPERIENCE = {
    id: '',
    title: { en: '', kn: '' },
    company: { en: '', kn: '' },
    duration: { en: '', kn: '' },
    description: { en: '', kn: '' },
    notes: { label: '', text: '' },
    featured: false,
    section: 'professional',
};

const CmsExperiences = ({ data, onSave, saving }) => {
    const { t, language, formatNumber } = useContent();
    const sections = data?.sections || [];
    const experiences = data?.experiences || [];

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        if (language === 'kn') {
            return obj.kn || obj.en || fallback;
        }
        return obj.en || obj.kn || fallback;
    };

    const [search, setSearch] = useState('');
    const [selectedSection, setSelectedSection] = useState('all');
    const [filterFeatured, setFilterFeatured] = useState('all');

    // Modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingExperience, setEditingExperience] = useState(null);
    const [editLangTab, setEditLangTab] = useState('en');

    // Section modal
    const [isSectionsModalOpen, setIsSectionsModalOpen] = useState(false);

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

    const featuredCount = useMemo(() => {
        return experiences.filter((e) => e.featured).length;
    }, [experiences]);

    const filteredExperiences = useMemo(() => {
        return experiences.filter((e) => {
            const matchesSearch =
                !search ||
                (e.title?.en || '').toLowerCase().includes(search.toLowerCase()) ||
                (e.company?.en || '').toLowerCase().includes(search.toLowerCase()) ||
                (e.description?.en || '').toLowerCase().includes(search.toLowerCase());

            const matchesSection = selectedSection === 'all' || e.section === selectedSection;
            const matchesFeatured =
                filterFeatured === 'all' ||
                (filterFeatured === 'featured' && e.featured) ||
                (filterFeatured === 'unfeatured' && !e.featured);

            return matchesSearch && matchesSection && matchesFeatured;
        });
    }, [experiences, search, selectedSection, filterFeatured]);

    const handleToggleFeatured = async (expIndex, e) => {
        e.stopPropagation();
        const updated = experiences.map((item, idx) => {
            if (idx === expIndex) {
                return { ...item, featured: !item.featured };
            }
            return item;
        });
        await onSave({ sections, experiences: updated }, 'Experience featured status updated');
    };

    const handleMoveOrder = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= experiences.length) return;

        const updated = [...experiences];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        await onSave({ sections, experiences: updated }, 'Experiences reordered');
    };

    const handleDelete = async (index) => {
        const item = experiences[index];
        const title = item.title?.en || item.company?.en || 'this item';
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

        const updated = experiences.filter((_, idx) => idx !== index);
        await onSave({ sections, experiences: updated }, `Deleted "${title}"`);
    };

    const handleOpenAddModal = () => {
        setEditingExperience({
            ...DEFAULT_EXPERIENCE,
            id: `exp-${Date.now()}`,
            section: sections[0]?.id || 'professional',
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = (item, index) => {
        setEditingExperience({
            ...item,
            _index: index,
            title: typeof item.title === 'string' ? { en: item.title, kn: '' } : { en: '', kn: '', ...item.title },
            company: typeof item.company === 'string' ? { en: item.company, kn: '' } : { en: '', kn: '', ...item.company },
            duration: typeof item.duration === 'string' ? { en: item.duration, kn: '' } : { en: '', kn: '', ...item.duration },
            description: typeof item.description === 'string' ? { en: item.description, kn: '' } : { en: '', kn: '', ...item.description },
            notes: item.notes || { label: '', text: '' },
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleSaveExperienceModal = async (e) => {
        e.preventDefault();
        const hasTitle = Boolean(editingExperience.title?.en?.trim() || editingExperience.title?.kn?.trim());
        const hasCompany = Boolean(editingExperience.company?.en?.trim() || editingExperience.company?.kn?.trim());
        if (!hasTitle && !hasCompany) {
            alert('A title or company in English or Kannada is required');
            return;
        }

        const cleanExperience = {
            ...editingExperience,
            title: {
                en: (editingExperience.title?.en || editingExperience.title?.kn || '').trim(),
                kn: (editingExperience.title?.kn || editingExperience.title?.en || '').trim(),
            },
            company: {
                en: (editingExperience.company?.en || editingExperience.company?.kn || '').trim(),
                kn: (editingExperience.company?.kn || editingExperience.company?.en || '').trim(),
            },
            duration: {
                en: (editingExperience.duration?.en || editingExperience.duration?.kn || '').trim(),
                kn: (editingExperience.duration?.kn || editingExperience.duration?.en || '').trim(),
            },
            description: {
                en: (editingExperience.description?.en || editingExperience.description?.kn || '').trim(),
                kn: (editingExperience.description?.kn || editingExperience.description?.en || '').trim(),
            },
        };
        delete cleanExperience._index;

        let updated;
        if (editingExperience._index !== undefined) {
            updated = experiences.map((item, idx) => (idx === editingExperience._index ? cleanExperience : item));
        } else {
            updated = [cleanExperience, ...experiences];
        }

        setIsEditModalOpen(false);
        setEditingExperience(null);
        await onSave({ sections, experiences: updated }, 'Experience saved successfully');
    };

    const handleSaveSections = async (updatedSections, message) => {
        await onSave({ sections: updatedSections, experiences }, message);
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
                            placeholder={t('admin.placeholders.searchExperiences', 'Search experiences...')}
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
                        <option value="all">{t('admin.filters.allSections', 'All Sections')} ({formatNumber(sections.length)})</option>
                        {sections.map((s) => (
                            <option key={s.id} value={s.id}>
                                {getLocalized(s.title, s.id)}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        className={`cms-filter-pill ${filterFeatured === 'featured' ? 'active' : ''}`}
                        onClick={() => setFilterFeatured((prev) => (prev === 'featured' ? 'all' : 'featured'))}
                        title="Filter experiences featured on Home Page"
                    >
                        ★ {t('admin.filters.featured', 'Featured')} ({formatNumber(featuredCount)})
                    </button>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredExperiences.length)} {t('admin.messages.of', 'of')} {formatNumber(experiences.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-secondary"
                        onClick={() => setIsSectionsModalOpen(true)}
                    >
                        {t('admin.actions.sections', 'Sections')}
                    </button>

                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.addExperience', '+ Add Experience')}
                    </button>
                </div>
            </div>

            {/* Experience List View */}
            {filteredExperiences.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noExperiences', 'No experiences found')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new item.')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredExperiences.map((item) => {
                        const originalIndex = experiences.indexOf(item);
                        const secObj = sections.find((s) => s.id === item.section);

                        return (
                            <div
                                key={item.id || originalIndex}
                                className={`cms-item-row ${item.featured ? 'featured' : ''}`}
                            >
                                <div className="cms-item-main">
                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {getLocalized(item.title, getLocalized(item.company, 'Untitled'))}
                                            </h4>
                                            {(item.company?.en || item.company?.kn) && (
                                                <span className="cms-item-company">
                                                    &bull; {getLocalized(item.company)}
                                                </span>
                                            )}
                                            <span className="cms-tag cms-tag-section">
                                                {getLocalized(secObj?.title, item.section)}
                                            </span>
                                            {(item.duration?.en || item.duration?.kn) && (
                                                <span className="cms-date-tag">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                        <line x1="16" y1="2" x2="16" y2="6" />
                                                        <line x1="8" y1="2" x2="8" y2="6" />
                                                        <line x1="3" y1="10" x2="21" y2="10" />
                                                    </svg>
                                                    {getLocalized(item.duration)}
                                                </span>
                                            )}
                                            {item.notes?.label && (
                                                <span className="cms-tag cms-tag-source">
                                                    {item.notes.label}
                                                </span>
                                            )}
                                        </div>

                                        {(item.description?.en || item.description?.kn) && (
                                            <p className="cms-item-desc">
                                                {getLocalized(item.description)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className={`cms-star-btn ${item.featured ? 'active' : ''}`}
                                        onClick={(e) => handleToggleFeatured(originalIndex, e)}
                                        title={item.featured ? 'Featured on Home (click to unfeature)' : 'Feature on Home'}
                                    >
                                        ★ {item.featured ? t('admin.actions.featured', 'Featured') : t('admin.actions.feature', 'Feature')}
                                    </button>

                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        onClick={() => handleMoveOrder(originalIndex, -1)}
                                        disabled={originalIndex === 0}
                                        title={t('admin.actions.moveUp', 'Move Up')}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        onClick={() => handleMoveOrder(originalIndex, 1)}
                                        disabled={originalIndex === experiences.length - 1}
                                        title={t('admin.actions.moveDown', 'Move Down')}
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

            {/* Add / Edit Experience Modal */}
            {isEditModalOpen && editingExperience && (
                <div className="cms-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
                    <div className="cms-modal-content cms-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingExperience._index !== undefined
                                    ? t('admin.modals.editExperience', 'Edit Experience')
                                    : t('admin.modals.newExperience', 'Add New Experience')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveExperienceModal}>
                            <div className="cms-modal-body">
                                <div className="cms-lang-pills">
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${editLangTab === 'en' ? 'active' : ''}`}
                                        onClick={() => setEditLangTab('en')}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        className={`cms-lang-pill-btn ${editLangTab === 'kn' ? 'active' : ''}`}
                                        onClick={() => setEditLangTab('kn')}
                                    >
                                        ಕನ್ನಡ
                                    </button>
                                </div>

                                {editLangTab === 'en' && (
                                    <>
                                        <div className="cms-form-row">
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.role', 'Title / Role')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingExperience.title?.en || ''}
                                                    onChange={(e) =>
                                                        setEditingExperience({
                                                            ...editingExperience,
                                                            title: { ...editingExperience.title, en: e.target.value },
                                                        })
                                                    }
                                                    placeholder="Software Engineering Intern"
                                                />
                                            </div>
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.company', 'Company / Institution')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingExperience.company?.en || ''}
                                                    onChange={(e) =>
                                                        setEditingExperience({
                                                            ...editingExperience,
                                                            company: { ...editingExperience.company, en: e.target.value },
                                                        })
                                                    }
                                                    placeholder="Cornell University / Google"
                                                />
                                            </div>
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">{t('admin.labels.duration', 'Duration')}</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingExperience.duration?.en || ''}
                                                onChange={(e) =>
                                                    setEditingExperience({
                                                        ...editingExperience,
                                                        duration: { ...editingExperience.duration, en: e.target.value },
                                                    })
                                                }
                                                placeholder="e.g. May 2025 – Aug 2025"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">{t('admin.labels.description', 'Description')}</label>
                                            <textarea
                                                className="cms-textarea"
                                                style={{ minHeight: '130px' }}
                                                value={editingExperience.description?.en || ''}
                                                onChange={(e) =>
                                                    setEditingExperience({
                                                        ...editingExperience,
                                                        description: { ...editingExperience.description, en: e.target.value },
                                                    })
                                                }
                                                placeholder="• Responsibilities and key contributions..."
                                            />
                                        </div>
                                    </>
                                )}

                                {editLangTab === 'kn' && (
                                    <>
                                        <div className="cms-form-row">
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.role', 'Title / Role')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingExperience.title?.kn || ''}
                                                    onChange={(e) =>
                                                        setEditingExperience({
                                                            ...editingExperience,
                                                            title: { ...editingExperience.title, kn: e.target.value },
                                                        })
                                                    }
                                                    placeholder="ಪಾತ್ರದ ಹೆಸರು"
                                                />
                                            </div>
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.company', 'Company / Institution')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingExperience.company?.kn || ''}
                                                    onChange={(e) =>
                                                        setEditingExperience({
                                                            ...editingExperience,
                                                            company: { ...editingExperience.company, kn: e.target.value },
                                                        })
                                                    }
                                                    placeholder="ಸಂಸ್ಥೆಯ ಹೆಸರು"
                                                />
                                            </div>
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">{t('admin.labels.duration', 'Duration')}</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingExperience.duration?.kn || ''}
                                                onChange={(e) =>
                                                    setEditingExperience({
                                                        ...editingExperience,
                                                        duration: { ...editingExperience.duration, kn: e.target.value },
                                                    })
                                                }
                                                placeholder="ಅವಧಿ"
                                            />
                                        </div>

                                        <div className="cms-form-group">
                                            <label className="cms-form-label">{t('admin.labels.description', 'Description')}</label>
                                            <textarea
                                                className="cms-textarea"
                                                style={{ minHeight: '130px' }}
                                                value={editingExperience.description?.kn || ''}
                                                onChange={(e) =>
                                                    setEditingExperience({
                                                        ...editingExperience,
                                                        description: { ...editingExperience.description, kn: e.target.value },
                                                    })
                                                }
                                                placeholder="ವಿವರಣೆ..."
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.section', 'Section')}</label>
                                        <select
                                            className="cms-select"
                                            value={editingExperience.section}
                                            onChange={(e) =>
                                                setEditingExperience({ ...editingExperience, section: e.target.value })
                                            }
                                        >
                                            {sections.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {getLocalized(s.title, s.id)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.optionalNote', 'Optional Note (Label)')}</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            placeholder="e.g. Award / GPA"
                                            value={editingExperience.notes?.label || ''}
                                            onChange={(e) =>
                                                setEditingExperience({
                                                    ...editingExperience,
                                                    notes: { ...editingExperience.notes, label: e.target.value },
                                                })
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="cms-form-group">
                                    <label className="cms-checkbox-label">
                                        <input
                                            type="checkbox"
                                            className="cms-checkbox"
                                            checked={Boolean(editingExperience.featured)}
                                            onChange={(e) =>
                                                setEditingExperience({ ...editingExperience, featured: e.target.checked })
                                            }
                                        />
                                        <span>
                                            {t('admin.labels.featureOnHome', '★ Feature on Home Page')}{' '}
                                            <span className="cms-help-inline">
                                                {t('admin.labels.featureDescExp', '(Included in Featured Experience section)')}
                                            </span>
                                        </span>
                                    </label>
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
                                        : (editingExperience._index !== undefined
                                            ? t('admin.actions.save', 'Save Experience')
                                            : t('admin.actions.addExperience', 'Add Experience'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Sections Modal */}
            <CmsSectionsModal
                isOpen={isSectionsModalOpen}
                onClose={() => setIsSectionsModalOpen(false)}
                title="Manage Experience Sections"
                itemLabel="experiences"
                sections={sections}
                items={experiences}
                onSaveSections={handleSaveSections}
                saving={saving}
            />
        </div>
    );
};

export default CmsExperiences;
