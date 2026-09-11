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
    const [activeLangTab, setActiveLangTab] = useState('en');
    const [newSection, setNewSection] = useState({ id: '', title: { en: '', kn: '' } });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        if (language === 'kn') {
            return obj.kn || obj.en || fallback;
        }
        return obj.en || obj.kn || fallback;
    };

    if (!isOpen) return null;

    const handleAddSection = async (e) => {
        e.preventDefault();
        setError('');

        const id = newSection.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        if (!id) {
            setError('Section ID is required');
            return;
        }

        if (sections.some((s) => s.id === id)) {
            setError(`A section with ID "${id}" already exists`);
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

        await onSaveSections(updated, `Added section "${titleEn}"`);
        setNewSection({ id: '', title: { en: '', kn: '' } });
    };

    const handleDeleteSection = async (sectionId) => {
        const count = items.filter((item) => item.section === sectionId).length;
        if (count > 0) {
            alert(`Cannot delete this section because ${count} ${itemLabel} are currently assigned to it.`);
            return;
        }

        if (!window.confirm(`Are you sure you want to delete section "${sectionId}"?`)) return;

        const updated = sections.filter((s) => s.id !== sectionId);
        await onSaveSections(updated, `Deleted section "${sectionId}"`);
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
                        aria-label="Close"
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
                                            title={count > 0 ? `Cannot delete while ${itemLabel} are in this section` : 'Delete Section'}
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
                                    className={`cms-lang-pill-btn ${activeLangTab === 'en' ? 'active' : ''}`}
                                    onClick={() => setActiveLangTab('en')}
                                    aria-label="Switch to English"
                                >
                                    English
                                </button>
                                <button
                                    type="button"
                                    className={`cms-lang-pill-btn ${activeLangTab === 'kn' ? 'active' : ''}`}
                                    onClick={() => setActiveLangTab('kn')}
                                    aria-label="Switch to Kannada"
                                >
                                    ಕನ್ನಡ
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
                                    {t('admin.labels.title', 'Title')} ({activeLangTab === 'kn' ? 'ಕನ್ನಡ' : 'English'}) <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="cms-input"
                                    placeholder={activeLangTab === 'kn' ? 'ಉದಾ: ಮೊಬೈಲ್ ಆ್ಯಪ್‌ಗಳು' : 'e.g. Mobile Apps'}
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
                                {saving ? t('admin.actions.adding', 'Adding...') : t('admin.actions.addSection', '+ Add Section')}
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
