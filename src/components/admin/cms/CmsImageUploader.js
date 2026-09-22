import React, { useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

export function normalizeImageUrl(input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();

    // Auto-convert Google Drive sharing link to direct CDN image URL
    // e.g. https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    // or https://drive.google.com/open?id=FILE_ID
    const driveMatch =
        trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);

    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w2000`;
    }

    return trimmed;
}

const CmsImageUploader = ({
    value = '',
    onChange,
    label = 'Image URL (Link)',
    helpText = 'Paste any image link (e.g. Google Drive, Cloudinary, Imgur, Unsplash).',
}) => {
    const { t } = useContent();
    const [imageError, setImageError] = useState(false);

    const handleUrlChange = (rawUrl) => {
        setImageError(false);
        const normalized = normalizeImageUrl(rawUrl);
        onChange(normalized);
    };

    const trimmedValue = (typeof value === 'string' ? value.trim() : '');
    const hasValue = Boolean(trimmedValue);

    return (
        <div className="cms-uploader-container">
            <label className="cms-form-label">{label}</label>

            <div style={{ marginTop: '0.25rem' }}>
                <input
                    type="url"
                    className="cms-input"
                    placeholder="https://drive.google.com/file/d/... or https://res.cloudinary.com/..."
                    value={trimmedValue}
                    onChange={(e) => handleUrlChange(e.target.value)}
                />
            </div>

            {/* Current Selection / Preview Box */}
            {hasValue && (
                <div className="cms-image-preview-box" style={{ marginTop: '0.75rem' }}>
                    {!imageError ? (
                        <img
                            src={trimmedValue}
                            alt="Preview"
                            className="cms-image-preview-thumb"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div
                            className="cms-image-preview-thumb"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#f1f5f9',
                                color: '#64748b',
                                fontSize: '0.75rem',
                                textAlign: 'center',
                                padding: '0.25rem',
                            }}
                        >
                            No preview
                        </div>
                    )}
                    <div className="cms-image-preview-info">
                        <span className="cms-image-preview-filename" style={{ wordBreak: 'break-all' }}>
                            {trimmedValue}
                        </span>
                        <span className="cms-image-preview-size" style={{ color: imageError ? '#ef4444' : '#10b981' }}>
                            {imageError ? 'Could not load preview' : 'Direct Link'}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="cms-btn cms-btn-sm cms-btn-danger"
                        onClick={() => {
                            setImageError(false);
                            onChange('');
                        }}
                    >
                        {t('admin.actions.delete', 'Remove')}
                    </button>
                </div>
            )}

            {helpText && <p className="cms-form-help" style={{ marginTop: '0.4rem', fontSize: '0.82rem' }}>{helpText}</p>}
        </div>
    );
};

export default CmsImageUploader;
