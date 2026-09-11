import React, { useEffect, useMemo, useState } from 'react';
import CmsImageUploader from './CmsImageUploader';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_PHOTO = {
    filename: '',
    title: { en: '', kn: '' },
    date: { en: '', kn: '' },
    location: {
        place: { en: '', kn: '' },
        lat: '',
        lng: '',
    },
};

const CmsPhotography = ({ data, onSave, saving }) => {
    const { t, language, formatNumber } = useContent();

    const getLocalized = (obj, fallback = '') => {
        if (!obj) return fallback;
        if (typeof obj === 'string') return obj;
        if (language === 'kn') {
            return obj.kn || obj.en || fallback;
        }
        return obj.en || obj.kn || fallback;
    };

    const [search, setSearch] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPhoto, setEditingPhoto] = useState(null);
    const [editLangTab, setEditLangTab] = useState('en');
    const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

    useEffect(() => {
        if (!isEditModalOpen && !fullscreenPhoto) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (fullscreenPhoto) {
                    setFullscreenPhoto(null);
                } else if (isEditModalOpen) {
                    setIsEditModalOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditModalOpen, fullscreenPhoto]);

    // Unified photo list
    const photos = useMemo(() => {
        if (Array.isArray(data)) {
            return data.map((item, idx) => ({
                id: item.id || (item.filename ? item.filename.replace(/\.[^/.]+$/, '') : `photo-${idx}`),
                filename: item.filename || '',
                title: {
                    en: typeof item.title === 'object' ? item.title.en || '' : item.title || '',
                    kn: typeof item.title === 'object' ? item.title.kn || '' : '',
                },
                date: {
                    en: typeof item.date === 'object' ? item.date.en || '' : item.date || '',
                    kn: typeof item.date === 'object' ? item.date.kn || '' : '',
                },
                location: {
                    place: {
                        en: typeof item.location?.place === 'object' ? item.location?.place?.en || '' : item.location?.place || '',
                        kn: typeof item.location?.place === 'object' ? item.location?.place?.kn || '' : '',
                    },
                    lat: item.location?.lat ?? '',
                    lng: item.location?.lng ?? '',
                },
                _originalIndex: idx,
            }));
        }

        // Backwards compatibility fallback for { en: [], kn: [] }
        const enList = data?.en || [];
        const knList = data?.kn || [];
        return enList.map((enItem, idx) => {
            const knItem = knList.find((k) => k.filename === enItem.filename) || knList[idx] || {};
            return {
                id: enItem.id || (enItem.filename ? enItem.filename.replace(/\.[^/.]+$/, '') : `photo-${idx}`),
                filename: enItem.filename || '',
                title: { en: enItem.title || '', kn: knItem.title || '' },
                date: { en: enItem.date || '', kn: knItem.date || '' },
                location: {
                    place: {
                        en: enItem.location?.place || '',
                        kn: knItem.location?.place || '',
                    },
                    lat: enItem.location?.lat ?? knItem.location?.lat ?? '',
                    lng: enItem.location?.lng ?? knItem.location?.lng ?? '',
                },
                _originalIndex: idx,
            };
        });
    }, [data]);

    const filteredPhotos = useMemo(() => {
        return photos.filter((p) => {
            if (!search) return true;
            const query = search.toLowerCase();
            return (
                p.filename.toLowerCase().includes(query) ||
                p.title.en.toLowerCase().includes(query) ||
                p.title.kn.toLowerCase().includes(query) ||
                p.location.place.en.toLowerCase().includes(query) ||
                p.location.place.kn.toLowerCase().includes(query)
            );
        });
    }, [photos, search]);



    const handleDelete = async (index) => {
        const photo = photos[index];
        const label = photo.title.en || photo.filename;
        if (!window.confirm(`Are you sure you want to delete photo "${label}"?`)) return;

        try {
            await fetch(
                `/api/cms/upload?folder=photography&filename=${encodeURIComponent(photo.filename)}`,
                { method: 'DELETE', credentials: 'include' }
            );
        } catch {
            // ignore
        }

        const updated = photos
            .filter((_, idx) => idx !== index)
            .map(({ _originalIndex, ...clean }) => clean);

        await onSave(updated, `Deleted photo "${label}"`);
    };

    const handleOpenAddModal = () => {
        const today = new Date();
        const formattedDate = today.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        setEditingPhoto({
            ...DEFAULT_PHOTO,
            date: { en: formattedDate, kn: '' },
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = (photo, index) => {
        setEditingPhoto({
            ...photo,
            _index: index,
        });
        setEditLangTab('en');
        setIsEditModalOpen(true);
    };

    const handleSavePhotoModal = async (e) => {
        e.preventDefault();
        if (!editingPhoto.filename.trim()) {
            alert('Please select or upload an image file');
            return;
        }
        if (!editingPhoto.title.en.trim() && !editingPhoto.title.kn.trim()) {
            alert('A photo title in English or Kannada is required');
            return;
        }

        const photoItem = {
            id: editingPhoto.id || editingPhoto.filename.trim().replace(/\.[^/.]+$/, ''),
            filename: editingPhoto.filename.trim(),
            title: {
                en: (editingPhoto.title.en || editingPhoto.title.kn).trim(),
                kn: (editingPhoto.title.kn || editingPhoto.title.en).trim(),
            },
            date: {
                en: (editingPhoto.date.en || editingPhoto.date.kn).trim(),
                kn: (editingPhoto.date.kn || editingPhoto.date.en).trim(),
            },
            location: {
                place: {
                    en: (editingPhoto.location.place.en || editingPhoto.location.place.kn).trim(),
                    kn: (editingPhoto.location.place.kn || editingPhoto.location.place.en).trim(),
                },
                lat: editingPhoto.location.lat !== '' && editingPhoto.location.lat !== null ? Number(editingPhoto.location.lat) : null,
                lng: editingPhoto.location.lng !== '' && editingPhoto.location.lng !== null ? Number(editingPhoto.location.lng) : null,
            },
        };

        const cleanPhotos = photos.map(({ _originalIndex, ...clean }) => clean);
        let updatedPhotos;

        if (editingPhoto._index !== undefined) {
            updatedPhotos = cleanPhotos.map((item, idx) => (idx === editingPhoto._index ? photoItem : item));
        } else {
            updatedPhotos = [photoItem, ...cleanPhotos];
        }

        setIsEditModalOpen(false);
        setEditingPhoto(null);
        await onSave(updatedPhotos, `Saved photo "${photoItem.title.en}"`);
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
                            placeholder={t('admin.placeholders.searchPhotos', 'Search photos...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredPhotos.length)} {t('admin.messages.of', 'of')} {formatNumber(photos.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAddModal}
                    >
                        {t('admin.actions.uploadPhoto', '+ Upload Photo')}
                    </button>
                </div>
            </div>

            {filteredPhotos.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noPhotos', 'No photos found')}</p>
                    <p className="cms-empty-text">{t('admin.messages.adjustSearch', 'Try adjusting your search or add a new item.')}</p>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredPhotos.map((photo) => {
                        const originalIndex = photo._originalIndex;
                        const imgUrl = photo.filename && (photo.filename.startsWith('http://') || photo.filename.startsWith('https://') || photo.filename.startsWith('/'))
                            ? photo.filename
                            : `/photography/${photo.filename}`;

                        return (
                            <div key={photo.filename || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <img
                                        src={imgUrl}
                                        alt={photo.title.en || photo.filename}
                                        className="cms-item-thumb"
                                        style={{ objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => setFullscreenPhoto(photo)}
                                        onError={(e) => {
                                            e.target.style.opacity = '0.3';
                                        }}
                                    />

                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {getLocalized(photo.title, photo.filename)}
                                            </h4>
                                            {(photo.location?.place?.en || photo.location?.place?.kn) && (
                                                <span className="cms-tag cms-tag-section">
                                                    📍 {getLocalized(photo.location?.place)}
                                                </span>
                                            )}
                                            {(photo.date?.en || photo.date?.kn) && (
                                                <span className="cms-date-tag">
                                                    📅 {getLocalized(photo.date)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="cms-item-desc" style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                                            {photo.filename}
                                        </p>
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className="cms-btn cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEditModal(photo, originalIndex)}
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

            {/* Add / Edit Photo Modal */}
            {isEditModalOpen && editingPhoto && (
                <div className="cms-modal-backdrop" onClick={() => setIsEditModalOpen(false)}>
                    <div className="cms-modal-content cms-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingPhoto._index !== undefined
                                    ? t('admin.modals.editPhoto', 'Edit Photo')
                                    : t('admin.modals.uploadPhoto', 'Upload Photo')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsEditModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSavePhotoModal}>
                            <div className="cms-modal-body">
                                <div className="cms-form-group">
                                    <CmsImageUploader
                                        folder="photography"
                                        label={t('admin.labels.photoFile', 'Photo Image File')}
                                        value={editingPhoto.filename}
                                        onChange={(newFilename) =>
                                            setEditingPhoto({ ...editingPhoto, filename: newFilename })
                                        }
                                        helpText="Select from existing images or upload a new photo."
                                    />
                                </div>

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
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">
                                                {t('admin.labels.photoTitle', 'Photo Title')}
                                            </label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingPhoto.title.en}
                                                onChange={(e) =>
                                                    setEditingPhoto({
                                                        ...editingPhoto,
                                                        title: { ...editingPhoto.title, en: e.target.value },
                                                    })
                                                }
                                                placeholder="e.g. Farm Life"
                                            />
                                        </div>

                                        <div className="cms-form-row">
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.locationPlace', 'Location / Place')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingPhoto.location.place.en}
                                                    onChange={(e) =>
                                                        setEditingPhoto({
                                                            ...editingPhoto,
                                                            location: {
                                                                ...editingPhoto.location,
                                                                place: {
                                                                    ...editingPhoto.location.place,
                                                                    en: e.target.value,
                                                                },
                                                            },
                                                        })
                                                    }
                                                    placeholder="Bengaluru, Karnataka"
                                                />
                                            </div>

                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.date', 'Date')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingPhoto.date.en}
                                                    onChange={(e) =>
                                                        setEditingPhoto({
                                                            ...editingPhoto,
                                                            date: { ...editingPhoto.date, en: e.target.value },
                                                        })
                                                    }
                                                    placeholder="December 16, 2023"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {editLangTab === 'kn' && (
                                    <>
                                        <div className="cms-form-group">
                                            <label className="cms-form-label">{t('admin.labels.photoTitle', 'Photo Title')}</label>
                                            <input
                                                type="text"
                                                className="cms-input"
                                                value={editingPhoto.title.kn}
                                                onChange={(e) =>
                                                    setEditingPhoto({
                                                        ...editingPhoto,
                                                        title: { ...editingPhoto.title, kn: e.target.value },
                                                    })
                                                }
                                                placeholder="ಹಳ್ಳಿ ಜೀವನ"
                                            />
                                        </div>

                                        <div className="cms-form-row">
                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.locationPlace', 'Location / Place')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingPhoto.location.place.kn}
                                                    onChange={(e) =>
                                                        setEditingPhoto({
                                                            ...editingPhoto,
                                                            location: {
                                                                ...editingPhoto.location,
                                                                place: {
                                                                    ...editingPhoto.location.place,
                                                                    kn: e.target.value,
                                                                },
                                                            },
                                                        })
                                                    }
                                                    placeholder="ಬೆಂಗಳೂರು, ಕರ್ನಾಟಕ"
                                                />
                                            </div>

                                            <div className="cms-form-group">
                                                <label className="cms-form-label">{t('admin.labels.date', 'Date')}</label>
                                                <input
                                                    type="text"
                                                    className="cms-input"
                                                    value={editingPhoto.date.kn}
                                                    onChange={(e) =>
                                                        setEditingPhoto({
                                                            ...editingPhoto,
                                                            date: { ...editingPhoto.date, kn: e.target.value },
                                                        })
                                                    }
                                                    placeholder="ಡಿಸೆಂಬರ್ ೧೬, ೨೦೨೩"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.latitude', 'Latitude')} (Optional)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="cms-input"
                                            placeholder="e.g. 40.7128"
                                            value={editingPhoto.location.lat}
                                            onChange={(e) =>
                                                setEditingPhoto({
                                                    ...editingPhoto,
                                                    location: { ...editingPhoto.location, lat: e.target.value },
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.longitude', 'Longitude')} (Optional)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            className="cms-input"
                                            placeholder="e.g. -74.0060"
                                            value={editingPhoto.location.lng}
                                            onChange={(e) =>
                                                setEditingPhoto({
                                                    ...editingPhoto,
                                                    location: { ...editingPhoto.location, lng: e.target.value },
                                                })
                                            }
                                        />
                                    </div>
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
                                        : (editingPhoto._index !== undefined
                                            ? t('admin.actions.save', 'Save Photo')
                                            : t('admin.actions.uploadPhoto', 'Upload Photo'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Fullscreen Photo Zoom Modal */}
            {fullscreenPhoto && (
                <div className="cms-photo-fullscreen-modal" onClick={() => setFullscreenPhoto(null)}>
                    <div
                        style={{
                            maxWidth: '90vw',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            position: 'relative',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="cms-modal-close-btn"
                            style={{ position: 'absolute', top: -36, right: 0, color: '#ffffff' }}
                            onClick={() => setFullscreenPhoto(null)}
                        >
                            ✕ Close
                        </button>
                        <img
                            src={fullscreenPhoto.filename && (fullscreenPhoto.filename.startsWith('http://') || fullscreenPhoto.filename.startsWith('https://') || fullscreenPhoto.filename.startsWith('/'))
                                ? fullscreenPhoto.filename
                                : `/photography/${fullscreenPhoto.filename}`}
                            alt={fullscreenPhoto.title.en}
                            className="cms-photo-fullscreen-img"
                        />
                        <div
                            style={{
                                marginTop: '1rem',
                                color: '#ffffff',
                                textAlign: 'center',
                                background: 'rgba(15, 23, 42, 0.85)',
                                padding: '0.5rem 1.2rem',
                                borderRadius: '9999px',
                                fontSize: '0.85rem',
                            }}
                        >
                            <strong>{fullscreenPhoto.title.en}</strong>
                            {fullscreenPhoto.location.place.en && (
                                <span> &bull; 📍 {fullscreenPhoto.location.place.en}</span>
                            )}
                            {fullscreenPhoto.date.en && <span> &bull; 📅 {fullscreenPhoto.date.en}</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmsPhotography;
