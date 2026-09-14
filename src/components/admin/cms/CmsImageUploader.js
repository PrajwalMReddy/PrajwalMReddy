import React, { useEffect, useRef, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

const CmsImageUploader = ({
    value = '',
    onChange,
    folder = 'photography',
    label = 'Image',
    helpText = 'Select or upload an image file.',
}) => {
    const { t } = useContent();
    const [viewMode, setViewMode] = useState(() => {
        if (value && (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//'))) {
            return 'url';
        }
        return 'upload';
    }); // 'upload' | 'library' | 'url'
    const [uploading, setUploading] = useState(false);
    const [existingImages, setExistingImages] = useState([]);
    const [loadingLibrary, setLoadingLibrary] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const loadLibrary = async () => {
        setLoadingLibrary(true);
        setError('');
        try {
            const res = await fetch(`/api/cms/upload?folder=${encodeURIComponent(folder)}`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setExistingImages(data.images || []);
            }
        } catch (err) {
            console.error('Error loading image library:', err);
            setError(t('admin.labels.couldNotLoadImages', 'Could not load images list'));
        } finally {
            setLoadingLibrary(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'library') {
            loadLibrary();
        }
    }, [viewMode, folder]);

    const uploadFile = async (file) => {
        if (!file) return;

        setError('');
        setUploading(true);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64Data = event.target.result;
            try {
                const res = await fetch('/api/cms/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        folder,
                        filename: file.name,
                        data: base64Data,
                    }),
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Upload failed');
                }

                // Value can be filename or relative URL depending on folder
                if (folder === 'photography') {
                    onChange(data.filename);
                } else {
                    onChange(data.url || data.filename);
                }
            } catch (err) {
                console.error('Error uploading image:', err);
                setError(err.message || 'Failed to upload image');
            } finally {
                setUploading(false);
            }
        };

        reader.onerror = () => {
            setError('Could not read file from disk');
            setUploading(false);
        };

        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadFile(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) uploadFile(file);
    };

    const previewUrl = value
        ? value.startsWith('/') || value.startsWith('http') || value.startsWith('data:')
            ? value
            : folder === 'photography'
                ? `/photography/${value}`
                : `/img/${value}`
        : null;

    return (
        <div className="cms-uploader-container">
            <div className="cms-uploader-top">
                <label className="cms-form-label">{label}</label>
                <div className="cms-uploader-modes">
                    <button
                        type="button"
                        className={`cms-btn cms-btn-sm ${viewMode === 'url' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                        onClick={() => setViewMode('url')}
                    >
                        {t('admin.labels.imageUrl', 'Image URL')}
                    </button>
                    <button
                        type="button"
                        className={`cms-btn cms-btn-sm ${viewMode === 'upload' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                        onClick={() => setViewMode('upload')}
                    >
                        {t('admin.labels.uploadFile', 'Upload File')}
                    </button>
                    <button
                        type="button"
                        className={`cms-btn cms-btn-sm ${viewMode === 'library' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                        onClick={() => setViewMode('library')}
                    >
                        {t('admin.labels.imageLibrary', 'Image Library')}
                    </button>
                </div>
            </div>

            {error && <p className="admin-error" style={{ margin: '0.25rem 0' }}>{error}</p>}

            {/* Current Selection / Preview Box */}
            {previewUrl && (
                <div className="cms-image-preview-box">
                    <img
                        src={previewUrl}
                        alt="Selected image"
                        className="cms-image-preview-thumb"
                        onError={(e) => {
                            e.target.style.display = 'none';
                        }}
                    />
                    <div className="cms-image-preview-info">
                        <span className="cms-image-preview-filename">{value}</span>
                        <span className="cms-image-preview-size">{folder}/{value}</span>
                    </div>
                    <button
                        type="button"
                        className="cms-btn cms-btn-sm cms-btn-danger"
                        onClick={() => onChange('')}
                    >
                        {t('admin.actions.delete', 'Remove')}
                    </button>
                </div>
            )}

            {/* Image URL Mode */}
            {viewMode === 'url' && (
                <div style={{ marginTop: '0.75rem' }}>
                    <input
                        type="url"
                        className="cms-input"
                        placeholder="https://images.unsplash.com/... or https://res.cloudinary.com/..."
                        value={value.startsWith('http') || value.startsWith('/') ? value : ''}
                        onChange={(e) => onChange(e.target.value.trim())}
                    />
                    <p className="cms-help-text" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                        {t('admin.labels.pasteImageUrlHelp', 'Paste any external image URL.')}
                    </p>
                </div>
            )}

            {/* Upload Mode */}
            {viewMode === 'upload' && (
                <div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
                        style={{ display: 'none' }}
                    />
                    <div
                        className={`cms-dropzone ${isDragging ? 'dragging' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(false);
                        }}
                        onDrop={handleDrop}
                    >
                        <svg className="cms-dropzone-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p className="cms-dropzone-text">
                            {uploading
                                ? t('admin.messages.uploadingImage', 'Uploading image...')
                                : t('admin.labels.clickOrDropImage', 'Click or drop an image file here to upload')}
                        </p>
                        <p className="cms-dropzone-sub">
                            JPEG, PNG, WebP, SVG
                        </p>
                    </div>
                </div>
            )}

            {/* Library Mode */}
            {viewMode === 'library' && (
                <div>
                    {loadingLibrary ? (
                        <p className="admin-loading-text">{t('admin.messages.loadingImages', 'Loading images...')}</p>
                    ) : existingImages.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                            {t('admin.labels.noImagesFound', 'No images found')}
                        </p>
                    ) : (
                        <div className="cms-existing-images-grid">
                            {existingImages.map((img) => {
                                const isSelected = value === img.filename || value === img.url;
                                return (
                                    <div
                                        key={img.filename}
                                        className={`cms-existing-image-item ${isSelected ? 'selected' : ''}`}
                                        onClick={() => {
                                            if (folder === 'photography') {
                                                onChange(img.filename);
                                            } else {
                                                onChange(img.url);
                                            }
                                        }}
                                        title={`${img.filename} (${(img.size / 1024).toFixed(1)} KB)`}
                                    >
                                        <img src={img.url} alt={img.filename} loading="lazy" />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {helpText && <p className="cms-form-help">{helpText}</p>}
        </div>
    );
};

export default CmsImageUploader;
