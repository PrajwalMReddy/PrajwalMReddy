import React, { useEffect, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

export function normalizeImageUrl(input) {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();

    // Auto-convert Google Drive sharing link to direct CDN image URL
    const driveMatch =
        trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
        trimmed.match(/drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/);

    if (driveMatch && driveMatch[1]) {
        return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w2000`;
    }

    return trimmed;
}

export function resolveImagePreviewUrl(value) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    // Direct URLs or Data URIs
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
    ) {
        return trimmed;
    }

    // Path starting with a slash: e.g. /photography/langkawi.jpg or /projects/pulsar.png
    if (trimmed.startsWith('/')) {
        return trimmed;
    }

    // Relative path: e.g. photography/langkawi.jpg -> /photography/langkawi.jpg
    return `/${trimmed}`;
}

const CmsImageUploader = ({
    value = '',
    onChange,
    folder = 'photography',
    label = 'Image Location or URL',
    helpText = 'Type the full source path (e.g. /projects/pulsar.png, /photography/farm-life-1.jpeg) or an external URL.',
}) => {
    const { t } = useContent();
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [libraryImages, setLibraryImages] = useState([]);
    const [loadingLibrary, setLoadingLibrary] = useState(false);
    const [activeFolderTab, setActiveFolderTab] = useState(folder);
    const [librarySearch, setLibrarySearch] = useState('');

    const trimmedValue = typeof value === 'string' ? value.trim() : '';
    const hasValue = Boolean(trimmedValue);
    const previewSrc = resolveImagePreviewUrl(trimmedValue);

    // Fetch images when library is opened or folder tab changes
    const fetchLibrary = async (targetFolder) => {
        setLoadingLibrary(true);
        try {
            const res = await fetch(`/api/cms/upload?folder=${encodeURIComponent(targetFolder || folder)}`, {
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                setLibraryImages(Array.isArray(data.images) ? data.images : []);
            } else {
                setLibraryImages([]);
            }
        } catch {
            setLibraryImages([]);
        } finally {
            setLoadingLibrary(false);
        }
    };

    useEffect(() => {
        if (isLibraryOpen) {
            fetchLibrary(activeFolderTab);
        }
    }, [isLibraryOpen, activeFolderTab]);

    const handleInputChange = (e) => {
        setImageError(false);
        const normalized = normalizeImageUrl(e.target.value);
        onChange(normalized);
    };

    const handleSelectImage = (img) => {
        setImageError(false);
        // Set the full source path: e.g. /projects/pulsar.png or /photography/farm-life-1.jpeg
        const fullSourcePath = img.url || `/${img.folder || folder}/${img.filename}`;
        onChange(fullSourcePath);
        setIsLibraryOpen(false);
    };

    const isLocalHosted =
        hasValue &&
        !trimmedValue.startsWith('http://') &&
        !trimmedValue.startsWith('https://') &&
        !trimmedValue.startsWith('data:');

    const filteredImages = libraryImages.filter((img) => {
        if (!librarySearch) return true;
        const q = librarySearch.toLowerCase();
        return (
            img.filename.toLowerCase().includes(q) ||
            (img.relativePath && img.relativePath.toLowerCase().includes(q))
        );
    });

    return (
        <div className="cms-uploader-container" style={{ margin: '0.4rem 0' }}>
            {/* Field Label and Library Toggle */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.45rem',
                }}
            >
                <label className="cms-form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>
                    {label}
                </label>
                <button
                    type="button"
                    className={`cms-btn cms-btn-sm ${isLibraryOpen ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                    onClick={() => {
                        const next = !isLibraryOpen;
                        setIsLibraryOpen(next);
                        if (next) fetchLibrary(activeFolderTab);
                    }}
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
                >
                    {isLibraryOpen ? 'Hide Library' : 'Browse Image Library'}
                </button>
            </div>

            {/* Direct Location / URL Input */}
            <div style={{ position: 'relative', marginBottom: hasValue ? '0.6rem' : '0.35rem' }}>
                <input
                    type="text"
                    className="cms-input"
                    placeholder="URL"
                    value={trimmedValue}
                    onChange={handleInputChange}
                    style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.88rem',
                        fontFamily: 'monospace',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                    }}
                />
            </div>

            {/* Live Image Preview Card */}
            {hasValue && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        marginBottom: '0.6rem',
                        gap: '0.75rem',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                        {!imageError && previewSrc ? (
                            <img
                                src={previewSrc}
                                alt="Selected preview"
                                style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '6px',
                                    objectFit: 'cover',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    flexShrink: 0,
                                }}
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div
                                style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '6px',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    flexShrink: 0,
                                    border: '1px solid #fca5a5',
                                    padding: '2px',
                                }}
                            >
                                No preview
                            </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                                style={{
                                    fontWeight: 600,
                                    fontSize: '0.86rem',
                                    color: '#1e293b',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                                title={trimmedValue}
                            >
                                {trimmedValue}
                            </div>
                            <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>
                                {imageError ? (
                                    <span style={{ color: '#ef4444' }}>
                                        Could not load preview from <code>{previewSrc}</code>
                                    </span>
                                ) : isLocalHosted ? (
                                    <span style={{ color: '#059669', fontWeight: 500 }}>
                                        ✓ Hosted image ({previewSrc})
                                    </span>
                                ) : (
                                    <span style={{ color: '#2563eb', fontWeight: 500 }}>
                                        ✓ External Image Link
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="cms-btn cms-btn-sm cms-btn-danger"
                        onClick={() => {
                            setImageError(false);
                            onChange('');
                        }}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                    >
                        {t('admin.actions.delete', 'Clear')}
                    </button>
                </div>
            )}

            {/* Expandable Image Library Browser */}
            {isLibraryOpen && (
                <div
                    style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        background: '#ffffff',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                        marginBottom: '0.6rem',
                    }}
                >
                    {/* Library Controls Bar */}
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            marginBottom: '0.65rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '1px solid #f1f5f9',
                        }}
                    >
                        {/* Folder Picker Tabs */}
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                                type="button"
                                className={`cms-btn cms-btn-sm ${activeFolderTab === 'projects' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                                onClick={() => setActiveFolderTab('projects')}
                                style={{ fontSize: '0.76rem', padding: '0.2rem 0.5rem' }}
                            >
                                Projects
                            </button>
                            <button
                                type="button"
                                className={`cms-btn cms-btn-sm ${activeFolderTab === 'photography' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                                onClick={() => setActiveFolderTab('photography')}
                                style={{ fontSize: '0.76rem', padding: '0.2rem 0.5rem' }}
                            >
                                Photography
                            </button>
                            <button
                                type="button"
                                className={`cms-btn cms-btn-sm ${activeFolderTab === 'all' ? 'cms-btn-primary' : 'cms-btn-secondary'}`}
                                onClick={() => setActiveFolderTab('all')}
                                style={{ fontSize: '0.76rem', padding: '0.2rem 0.5rem' }}
                            >
                                All Images
                            </button>
                        </div>

                        {/* Search Filter */}
                        <input
                            type="text"
                            placeholder="Filter by filename..."
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                            style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.8rem',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                width: '150px',
                            }}
                        />
                    </div>

                    {/* Grid of Hosted Images */}
                    {loadingLibrary ? (
                        <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>
                            Loading images...
                        </p>
                    ) : filteredImages.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.25rem', color: '#64748b', fontSize: '0.85rem' }}>
                            <p style={{ margin: 0 }}>No images found in <code>public/{activeFolderTab}/</code></p>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                Add images to <code>public/{activeFolderTab}/</code> in the source code or type any URL directly above.
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                                gap: '0.5rem',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                padding: '0.2rem',
                            }}
                        >
                            {filteredImages.map((img) => {
                                const fullSourcePath = img.url || `/${img.folder || folder}/${img.filename}`;
                                const isSelected =
                                    trimmedValue === fullSourcePath ||
                                    trimmedValue === fullSourcePath.replace(/^\//, '');

                                return (
                                    <div
                                        key={fullSourcePath}
                                        onClick={() => handleSelectImage(img)}
                                        title={`${fullSourcePath} (Click to select)`}
                                        style={{
                                            position: 'relative',
                                            cursor: 'pointer',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                            background: '#f8fafc',
                                            boxShadow: isSelected ? '0 0 0 2px rgba(37, 99, 235, 0.25)' : 'none',
                                            aspectRatio: '1',
                                            transition: 'transform 0.1s ease',
                                        }}
                                    >
                                        <img
                                            src={fullSourcePath}
                                            alt={img.filename}
                                            loading="lazy"
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                                display: 'block',
                                            }}
                                        />
                                        <div
                                            style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                color: '#ffffff',
                                                fontSize: '0.62rem',
                                                padding: '1px 3px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {img.filename}
                                        </div>
                                        {isSelected && (
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: 3,
                                                    right: 3,
                                                    background: '#2563eb',
                                                    color: '#ffffff',
                                                    borderRadius: '50%',
                                                    width: '16px',
                                                    height: '16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '10px',
                                                    fontWeight: 'bold',
                                                }}
                                            >
                                                ✓
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {helpText && (
                <p className="cms-form-help" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    {helpText}
                </p>
            )}
        </div>
    );
};

export default CmsImageUploader;
