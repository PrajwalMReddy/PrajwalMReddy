import React, { useEffect, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

const CmsSectionsModal = ({
    isOpen,
    onClose,
    title,
    itemLabel = 'items',
    sections = [],
    items = [],
    onSaveSections,
    saving = false,
}) => {
    const { t, language, formatNumber } = useContent();
    const [activeLangTab, setActiveLangTab] = useState(language || 'kn');
    const [newSection, setNewSection] = useState({ id: '', title: { en: '', kn: '' } });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setActiveLangTab(language || 'kn');
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, language]);

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        const current = activeLangTab || language;
        const alt = current === 'kn' ? 'en' : 'kn';
        return obj[current] || obj[alt] || Object.values(obj).find((v) => typeof v === 'string' && v.trim() !== '') || fallback;
    };

    if (!isOpen) return null;

    const handleAddSection = async (e) => {
        e.preventDefault();
        setError('');

        const id = newSection.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!id) {
            setError(t('admin.messages.sectionIdRequired', 'Section ID is required'));
            return;
        }

        if (sections.some((s) => s.id === id)) {
            setError((t('admin.messages.sectionIdExists') || 'A section with ID "{id}" already exists').replace('{id}', id));
            return;
        }

        const titleEn = (newSection.title.en || newSection.title.kn || id).trim();
        const titleKn = (newSection.title.kn || newSection.title.en || id).trim();

        const updated = [
            ...sections,
            {
                id,
                title: {
                    en: titleEn,
                    kn: titleKn,
                },
            },
        ];

        const sectionDisplayName = getLocalized(newSection.title, id);
        await onSaveSections(updated, (t('admin.messages.addedSection') || 'Added section "{title}"').replace('{title}', sectionDisplayName));
        setNewSection({ id: '', title: { en: '', kn: '' } });
    };

    const handleDeleteSection = async (sectionId) => {
        const count = items.filter((item) => item.section === sectionId).length;
        if (count > 0) {
            alert((t('admin.messages.cannotDeleteSectionWithItems') || 'Cannot delete this section because {count} {itemLabel} are currently assigned to it.').replace('{count}', formatNumber(count)).replace('{itemLabel}', itemLabel));
            return;
        }

        if (!window.confirm(`${t('admin.messages.confirmDelete', 'Are you sure you want to delete this item?')} (${sectionId})`)) return;

        const updated = sections.filter((s) => s.id !== sectionId);
        await onSaveSections(updated, (t('admin.messages.deletedSection') || 'Deleted section "{id}"').replace('{id}', sectionId));
    };

    return (
        <div className="cms-modal-backdrop" onClick={onClose}>
            <div className="cms-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="cms-modal-header">
                    <h3 className="cms-modal-title">{title || t('admin.modals.manageSections', 'Manage Sections')}</h3>
                    <button
                        type="button"
                        className="cms-modal-close-btn"
                        onClick={onClose}
                        aria-label={t('admin.actions.close', 'Close')}
                    >
                        ✕
                    </button>
                </div>

                <div className="cms-modal-body">
                    {error && <p className="admin-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <label className="cms-form-label">{t('admin.labels.existingSections', 'Existing Sections')}</label>
                        {sections.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                {t('admin.messages.noSections', 'No sections defined yet.')}
                            </p>
                        ) : (
                            sections.map((s) => {
                                const count = items.filter((item) => item.section === s.id).length;
                                return (
                                    <div key={s.id} className="cms-section-item">
                                        <div>
                                            <strong>
                                                {getLocalized(s.title, s.id)}
                                            </strong>
                                            <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.45rem' }}>
                                                ({s.id}) &bull; {formatNumber(count)} {itemLabel}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            className="cms-btn cms-btn-sm cms-btn-danger"
                                            onClick={() => handleDeleteSection(s.id)}
                                            disabled={count > 0}
                                            title={count > 0 ? (t('admin.messages.cannotDeleteWhileItemsInSection') || 'Cannot delete while {itemLabel} are in this section').replace('{itemLabel}', itemLabel) : t('admin.actions.delete', 'Delete')}
                                        >
                                            {t('admin.actions.delete', 'Delete')}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <form onSubmit={handleAddSection} className="cms-section-form">
                        <div className="cms-section-form-header">
                            <h4 className="cms-form-heading">
                                {t('admin.labels.addNewSection', 'Add New Section')}
                            </h4>
                            <div className="cms-lang-pills">
                                <button
                                    type="button"
                                    className={`cms-lang-pill-btn ${activeLangTab === 'kn' ? 'active' : ''}`}
                                    onClick={() => setActiveLangTab('kn')}
                                    aria-label={t('admin.labels.kannada', 'ಕನ್ನಡ')}
                                >
                                    {t('admin.labels.kannada', 'ಕನ್ನಡ')}
                                </button>
                                <button
                                    type="button"
                                    className={`cms-lang-pill-btn ${activeLangTab === 'en' ? 'active' : ''}`}
                                    onClick={() => setActiveLangTab('en')}
                                    aria-label={t('admin.labels.english', 'English')}
                                >
                                    {t('admin.labels.english', 'English')}
                                </button>
                            </div>
                        </div>

                        <div className="cms-form-row">
                            <div className="cms-form-group">
                                <label className="cms-form-label">
                                    {t('admin.labels.sectionId', 'Section ID')} <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="cms-input"
                                    placeholder={t('admin.placeholders.sectionId', 'Section ID (e.g. mobile-apps)')}
                                    value={newSection.id}
                                    onChange={(e) => setNewSection({ ...newSection, id: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="cms-form-group">
                                <label className="cms-form-label">
                                    {t('admin.labels.title', 'Title')} ({activeLangTab === 'kn' ? t('admin.labels.kannada', 'ಕನ್ನಡ') : t('admin.labels.english', 'English')}) <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="cms-input"
                                    placeholder={activeLangTab === 'kn' ? t('admin.placeholders.sectionTitleKn', 'ಉದಾ: ಮೊಬೈಲ್ ಆ್ಯಪ್‌ಗಳು') : t('admin.placeholders.sectionTitleEn', 'e.g. Mobile Apps')}
                                    value={newSection.title[activeLangTab] || ''}
                                    onChange={(e) =>
                                        setNewSection({
                                            ...newSection,
                                            title: { ...newSection.title, [activeLangTab]: e.target.value },
                                        })
                                    }
                                />
                            </div>
                        </div>

                        <div className="cms-section-form-actions">
                            <button type="submit" className="cms-btn cms-btn-primary" disabled={saving}>
                                {saving ? t('admin.actions.saving', 'Saving...') : t('admin.actions.addSection', '+ Add Section')}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="cms-modal-footer">
                    <button
                        type="button"
                        className="cms-btn cms-btn-secondary"
                        onClick={onClose}
                    >
                        {t('admin.actions.close', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CmsSectionsModal;
