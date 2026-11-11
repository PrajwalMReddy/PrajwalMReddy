import React, { useState, useEffect, useRef, useMemo } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { useContent } from '../../../utils/ContentContext';

const DataSettingsTab = () => {
    const { t } = useContent();

    // Storage stats state
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [statsError, setStatsError] = useState('');

    // Backup export state
    const [downloadingBackup, setDownloadingBackup] = useState(false);
    const [includeSensitive, setIncludeSensitive] = useState(true);
    const [backupMessage, setBackupMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    // Backup restore state
    const [dragActive, setDragActive] = useState(false);
    const [backupFile, setBackupFile] = useState(null);
    const [parsedBackup, setParsedBackup] = useState(null);
    const [restorePreview, setRestorePreview] = useState(null);
    const [fileError, setFileError] = useState('');
    const [restoreMode, setRestoreMode] = useState('merge'); // 'merge' | 'replace'
    const [selectedCollections, setSelectedCollections] = useState({}); // { [name]: boolean }
    const [replaceConfirmText, setReplaceConfirmText] = useState('');
    const [restoring, setRestoring] = useState(false);
    const [restoreResult, setRestoreResult] = useState(null);

    // Collection explorer sorting
    const [sortField, setSortField] = useState('storageSize'); // 'name' | 'category' | 'documents' | 'dataSize' | 'storageSize'
    const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

    const fileInputRef = useRef(null);

    // Fetch live storage metrics
    const fetchStats = async () => {
        setLoadingStats(true);
        setStatsError('');
        try {
            const data = await assistantApi.getDatabaseStats();
            setStats(data);
        } catch (err) {
            console.error('Failed to load database stats:', err);
            setStatsError(err.message || 'Failed to load database storage metrics');
        } finally {
            setLoadingStats(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Handle backup download
    const handleDownloadBackup = async () => {
        setDownloadingBackup(true);
        setBackupMessage(null);
        try {
            const result = await assistantApi.downloadDatabaseBackup(includeSensitive);
            setBackupMessage({
                type: 'success',
                text: t('admin.settings.data.downloadSuccess', 'Backup downloaded successfully: {filename}', {
                    filename: result.filename,
                    size: formatSize(result.sizeBytes),
                }),
            });
        } catch (err) {
            console.error('Download backup failed:', err);
            setBackupMessage({
                type: 'error',
                text: err.message || 'Failed to download database backup.',
            });
        } finally {
            setDownloadingBackup(false);
        }
    };

    // Helper to format bytes
    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Process selected backup file
    const processFile = (file) => {
        setFileError('');
        setRestoreResult(null);
        setParsedBackup(null);
        setRestorePreview(null);
        setReplaceConfirmText('');

        if (!file) {
            setBackupFile(null);
            return;
        }

        if (!file.name.endsWith('.json') && file.type !== 'application/json' && file.type !== '') {
            setFileError(t('admin.settings.data.invalidJsonError', 'Please upload a valid .json database backup file.'));
            return;
        }

        setBackupFile(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const json = JSON.parse(text);

                // Support both { manifest, collections } and { collections } or direct map
                const collectionsMap = json.collections || (json.manifest ? null : json);
                if (!collectionsMap || typeof collectionsMap !== 'object' || Array.isArray(collectionsMap)) {
                    throw new Error(t('admin.settings.data.noCollectionsError', 'No collections found in this backup file.'));
                }

                // If backup has top-level settings but no dashboard_settings collection, normalize it
                if (!collectionsMap.dashboard_settings && json.settings) {
                    collectionsMap.dashboard_settings = [
                        {
                            _id: 'data_sources',
                            calendar: json.settings.calendar || {},
                            news: json.settings.news || {},
                            weather: json.settings.weather || {},
                            updatedAt: json.settings.updatedAt || new Date().toISOString(),
                        },
                    ];
                }

                const collectionNames = Object.keys(collectionsMap).filter((k) => Array.isArray(collectionsMap[k]));
                if (collectionNames.length === 0) {
                    throw new Error(t('admin.settings.data.noCollectionsError', 'No valid collection arrays found in backup file.'));
                }

                let totalDocs = 0;
                const summary = {};
                const initialSelected = {};

                collectionNames.forEach((name) => {
                    const count = collectionsMap[name].length;
                    summary[name] = count;
                    totalDocs += count;
                    initialSelected[name] = true;
                });

                setParsedBackup(json);
                setSelectedCollections(initialSelected);
                setRestorePreview({
                    version: json.manifest?.version || 1,
                    exportedAt: json.manifest?.exportedAt ? new Date(json.manifest.exportedAt).toLocaleString() : 'Unknown date',
                    database: json.manifest?.database || 'personal_dashboard',
                    collectionsCount: collectionNames.length,
                    totalDocuments: totalDocs,
                    summary,
                });
            } catch (err) {
                console.error('Error parsing backup file:', err);
                setFileError(err.message || t('admin.settings.data.invalidJsonError', 'Failed to parse backup JSON file.'));
                setBackupFile(null);
            }
        };
        reader.onerror = () => {
            setFileError('Failed to read file from disk.');
            setBackupFile(null);
        };
        reader.readAsText(file);
    };

    // File input change
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    // Drag and drop handlers
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) processFile(file);
    };

    const clearFile = () => {
        setBackupFile(null);
        setParsedBackup(null);
        setRestorePreview(null);
        setFileError('');
        setRestoreResult(null);
        setReplaceConfirmText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Toggle collection selection
    const handleToggleCollection = (colName) => {
        setSelectedCollections((prev) => ({
            ...prev,
            [colName]: !prev[colName],
        }));
    };

    const handleSelectAllCollections = (select) => {
        if (!restorePreview) return;
        const updated = {};
        Object.keys(restorePreview.summary).forEach((col) => {
            updated[col] = select;
        });
        setSelectedCollections(updated);
    };

    // Restore execution
    const handleRestore = async () => {
        if (!parsedBackup || !restorePreview) return;

        const colsToRestore = Object.keys(selectedCollections).filter((c) => selectedCollections[c]);
        if (colsToRestore.length === 0) {
            setFileError('Please select at least one collection to restore.');
            return;
        }

        if (restoreMode === 'replace' && replaceConfirmText.trim().toUpperCase() !== 'RESTORE') {
            setFileError('Please type RESTORE in the confirmation field to proceed with complete replacement.');
            return;
        }

        setRestoring(true);
        setFileError('');
        setRestoreResult(null);

        try {
            const res = await assistantApi.restoreDatabase({
                backup: parsedBackup,
                mode: restoreMode,
                selectedCollections: colsToRestore,
            });

            setRestoreResult({
                type: 'success',
                message: t('admin.settings.data.restoreSuccess', 'Database restored successfully! {cols} collections and {docs} documents restored.', {
                    cols: res.collectionsRestored,
                    docs: res.totalDocumentsRestored,
                }),
                details: res.details,
            });

            // Automatically refresh stats after restore
            fetchStats();
        } catch (err) {
            console.error('Database restore error:', err);
            setRestoreResult({
                type: 'error',
                message: err.message || t('admin.settings.data.restoreFailed', 'Database restore failed.'),
            });
        } finally {
            setRestoring(false);
        }
    };

    // Sort collections based on sortField and sortDirection
    const sortedCollections = useMemo(() => {
        if (!stats?.collections) return [];
        const list = [...stats.collections];
        list.sort((a, b) => {
            let res = 0;
            switch (sortField) {
                case 'name': {
                    const nameA = (a.label || a.name || '').toLowerCase();
                    const nameB = (b.label || b.name || '').toLowerCase();
                    res = nameA.localeCompare(nameB);
                    break;
                }
                case 'category': {
                    const catA = (a.category || '').toLowerCase();
                    const catB = (b.category || '').toLowerCase();
                    res = catA.localeCompare(catB);
                    break;
                }
                case 'documents':
                    res = (a.count || 0) - (b.count || 0);
                    break;
                case 'dataSize':
                    res = (a.sizeBytes || 0) - (b.sizeBytes || 0);
                    break;
                case 'storageSize':
                default:
                    res = (a.storageSizeBytes || 0) - (b.storageSizeBytes || 0);
                    break;
            }
            return sortDirection === 'asc' ? res : -res;
        });
        return list;
    }, [stats?.collections, sortField, sortDirection]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'name' || field === 'category' ? 'asc' : 'desc');
        }
    };

    const renderSortIcon = (field) => {
        if (sortField !== field) {
            return (
                <svg className="admin-data-sort-icon-neutral" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="7 15 12 20 17 15" />
                    <polyline points="7 9 12 4 17 9" />
                </svg>
            );
        }
        if (sortDirection === 'asc') {
            return (
                <svg className="admin-data-sort-icon-active" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="18 15 12 9 6 15" />
                </svg>
            );
        }
        return (
            <svg className="admin-data-sort-icon-active" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
            </svg>
        );
    };

    // Meter color calculation based on percentage used
    const getMeterColor = (pct) => {
        if (pct >= 90) return 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
        if (pct >= 75) return 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)';
        return 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    };

    const selectedColsCount = useMemo(() => {
        return Object.values(selectedCollections).filter(Boolean).length;
    }, [selectedCollections]);

    return (
        <div className="admin-settings-section admin-data-settings">
            {/* CARD 1: MONGODB STORAGE QUOTA & METRICS */}
            <div className="admin-settings-card admin-data-card">
                <div className="admin-settings-card-header">
                    <div className="admin-settings-card-header-left">
                        <div className="admin-data-title-row">
                            <h4 className="admin-settings-card-title">
                                {t('admin.settings.data.storageCardTitle', 'MongoDB Cloud Storage Quota')}
                            </h4>
                            <span className="admin-data-tier-badge">
                                {t('admin.settings.data.m0TierBadge', 'Atlas M0 Free Tier (512 MB)')}
                            </span>
                        </div>
                        <p className="admin-settings-help-text">
                            {t('admin.settings.data.subtitle', 'Monitor live MongoDB usage, export verified backups, and restore database collections.')}
                        </p>
                    </div>
                </div>

                {statsError && (
                    <div className="admin-settings-alert is-error">
                        <span>{statsError}</span>
                    </div>
                )}

                {loadingStats && !stats ? (
                    <div className="admin-settings-loading">
                        <div className="admin-settings-loading-spinner" />
                        <div>{t('admin.settings.loading', 'Loading storage metrics...')}</div>
                    </div>
                ) : stats ? (
                    <>
                        {/* Storage Progress Meter */}
                        <div className="admin-data-meter-container">
                            <div className="admin-data-meter-header">
                                <div className="admin-data-meter-label-left">
                                    <span className="admin-data-meter-title">
                                        {t('admin.settings.data.storageUsed', 'Storage Used')}
                                    </span>
                                    <span className="admin-data-meter-percent">
                                        {stats.usedPercentage}%
                                    </span>
                                    <span className="admin-data-meter-sub">
                                        ({stats.totalUsedFormatted} / {stats.limitFormatted})
                                    </span>
                                </div>
                                <div className="admin-data-meter-label-right">
                                    <span className="admin-data-meter-remaining">
                                        {t('admin.settings.data.remainingSpace', '{remaining} remaining', { remaining: stats.remainingFormatted })}
                                    </span>
                                </div>
                            </div>

                            <div className="admin-data-meter-bar" role="progressbar" aria-valuenow={stats.usedPercentage} aria-valuemin="0" aria-valuemax="100">
                                <div
                                    className="admin-data-meter-fill"
                                    style={{
                                        width: `${Math.max(stats.usedPercentage, 0.8)}%`,
                                        background: getMeterColor(stats.usedPercentage),
                                    }}
                                />
                            </div>

                            <div className="admin-data-meter-footer">
                                <span>
                                    <strong>Database:</strong> {stats.database}
                                </span>
                            </div>
                        </div>

                        {/* 4 Stat Tiles */}
                        <div className="admin-data-stats-grid">
                            <div className="admin-data-stat-card">
                                <div className="admin-data-stat-label">
                                    {t('admin.settings.data.totalCollections', 'Collections')}
                                </div>
                                <div className="admin-data-stat-value">{stats.collectionsCount}</div>
                                <div className="admin-data-stat-hint">Active Mongo collections</div>
                            </div>

                            <div className="admin-data-stat-card">
                                <div className="admin-data-stat-label">
                                    {t('admin.settings.data.totalDocuments', 'Documents')}
                                </div>
                                <div className="admin-data-stat-value">{stats.totalDocuments.toLocaleString()}</div>
                                <div className="admin-data-stat-hint">Across all collections</div>
                            </div>

                            <div className="admin-data-stat-card">
                                <div className="admin-data-stat-label">
                                    {t('admin.settings.data.dataSize', 'Data Size')}
                                </div>
                                <div className="admin-data-stat-value">{stats.dataSizeFormatted}</div>
                                <div className="admin-data-stat-hint">Uncompressed JSON payload</div>
                            </div>

                            <div className="admin-data-stat-card">
                                <div className="admin-data-stat-label">
                                    {t('admin.settings.data.storageSize', 'Allocated Disk')}
                                </div>
                                <div className="admin-data-stat-value">{stats.totalUsedFormatted}</div>
                                <div className="admin-data-stat-hint">Storage: {stats.storageSizeFormatted} | Index: {stats.indexSizeFormatted}</div>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            {/* CARD 2: DOWNLOAD BACKUP (EXPORT) */}
            <div className="admin-settings-card admin-data-card">
                <div className="admin-settings-card-header">
                    <div className="admin-settings-card-header-left">
                        <h4 className="admin-settings-card-title">
                            {t('admin.settings.data.backupCardTitle', 'Download Database Backup')}
                        </h4>
                        <p className="admin-settings-help-text">
                            {t('admin.settings.data.backupCardHelp', 'Export an exact JSON snapshot of all collections and documents. The backup retains ObjectIds, dates, and schema definitions for 100% fidelity restoration.')}
                        </p>
                    </div>
                </div>

                <div className="admin-data-backup-content">
                    <label className="admin-data-checkbox-label">
                        <input
                            type="checkbox"
                            checked={includeSensitive}
                            onChange={(e) => setIncludeSensitive(e.target.checked)}
                        />
                        <span>{t('admin.settings.data.includeSensitive', 'Include session tokens and cached alerts in backup')}</span>
                    </label>

                    <div className="admin-data-action-row">
                        <button
                            type="button"
                            className="admin-settings-btn-primary admin-data-backup-btn"
                            onClick={handleDownloadBackup}
                            disabled={downloadingBackup}
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>
                                {downloadingBackup
                                    ? t('admin.settings.data.downloading', 'Preparing Snapshot...')
                                    : t('admin.settings.data.downloadBtn', 'Download Full Backup (.json)')}
                            </span>
                        </button>
                    </div>

                    {backupMessage && (
                        <div className={`admin-settings-alert ${backupMessage.type === 'success' ? 'is-success' : 'is-error'} admin-data-alert`}>
                            <span>{backupMessage.text}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* CARD 3: RESTORE DATABASE FROM BACKUP (IMPORT) */}
            <div className="admin-settings-card admin-data-card">
                <div className="admin-settings-card-header">
                    <div className="admin-settings-card-header-left">
                        <h4 className="admin-settings-card-title">
                            {t('admin.settings.data.restoreCardTitle', 'Restore Site from Backup')}
                        </h4>
                        <p className="admin-settings-help-text">
                            {t('admin.settings.data.restoreCardHelp', 'Upload a previously exported backup (.json) file to restore database collections and documents.')}
                        </p>
                    </div>
                </div>

                {/* Dropzone Area */}
                {!backupFile ? (
                    <div
                        className={`admin-data-dropzone ${dragActive ? 'is-dragover' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json,application/json"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <div className="admin-data-dropzone-icon">
                            <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <div className="admin-data-dropzone-text">
                            <strong>{t('admin.settings.data.selectFileBtn', 'Select Backup File')}</strong>
                            <span>{t('admin.settings.data.dropzoneText', 'or drag and drop your backup JSON file here')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="admin-data-file-selected-box">
                        <div className="admin-data-file-info-row">
                            <div className="admin-data-file-badge">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                    <polyline points="10 9 9 9 8 9" />
                                </svg>
                                <span>{backupFile.name} ({formatSize(backupFile.size)})</span>
                            </div>
                            <button
                                type="button"
                                className="admin-data-clear-file-btn"
                                onClick={clearFile}
                                disabled={restoring}
                            >
                                {t('admin.settings.data.clearFile', 'Clear file')}
                            </button>
                        </div>

                        {/* Backup Preview Banner */}
                        {restorePreview && (
                            <div className="admin-data-preview-card">
                                <div className="admin-data-preview-header">
                                    <strong>{t('admin.settings.data.backupPreviewTitle', 'Backup Snapshot Details')}</strong>
                                </div>
                                <div className="admin-data-preview-grid">
                                    <div>
                                        <span className="admin-data-preview-label">{t('admin.settings.data.exportedOn', 'Exported on')}:</span>{' '}
                                        <span className="admin-data-preview-val">{restorePreview.exportedAt}</span>
                                    </div>
                                    <div>
                                        <span className="admin-data-preview-label">{t('admin.settings.data.databaseLabel', 'Database')}:</span>{' '}
                                        <span className="admin-data-preview-val">{restorePreview.database}</span>
                                    </div>
                                    <div>
                                        <span className="admin-data-preview-label">{t('admin.settings.data.totalCollections', 'Collections')}:</span>{' '}
                                        <span className="admin-data-preview-val">{restorePreview.collectionsCount} collections</span>
                                    </div>
                                    <div>
                                        <span className="admin-data-preview-label">{t('admin.settings.data.totalDocuments', 'Documents')}:</span>{' '}
                                        <span className="admin-data-preview-val">{restorePreview.totalDocuments.toLocaleString()} documents</span>
                                    </div>
                                </div>

                                {/* Collection Checkbox Selector */}
                                <div className="admin-data-col-selector-section">
                                    <div className="admin-data-col-selector-header">
                                        <span>Select Collections to Restore ({selectedColsCount} of {restorePreview.collectionsCount} selected):</span>
                                        <div className="admin-data-selector-actions">
                                            <button
                                                type="button"
                                                className="admin-data-link-btn"
                                                onClick={() => handleSelectAllCollections(true)}
                                                disabled={restoring}
                                            >
                                                Select All
                                            </button>
                                            <span className="admin-data-divider">/</span>
                                            <button
                                                type="button"
                                                className="admin-data-link-btn"
                                                onClick={() => handleSelectAllCollections(false)}
                                                disabled={restoring}
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                    </div>
                                    <div className="admin-data-col-chips-grid">
                                        {Object.keys(restorePreview.summary).map((colName) => {
                                            const isSelected = Boolean(selectedCollections[colName]);
                                            const count = restorePreview.summary[colName];
                                            return (
                                                <button
                                                    key={colName}
                                                    type="button"
                                                    className={`admin-data-col-chip ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => handleToggleCollection(colName)}
                                                    disabled={restoring}
                                                >
                                                    <span className="admin-data-chip-check">
                                                        {isSelected ? (
                                                            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        ) : (
                                                            '+'
                                                        )}
                                                    </span>
                                                    <span className="admin-data-chip-name">{colName === 'dashboard_settings' ? t('admin.settings.title', 'Dashboard Settings') : colName}</span>
                                                    <span className="admin-data-chip-count">({count})</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Mode Selection */}
                                <div className="admin-data-mode-section">
                                    <label className="admin-settings-label">
                                        {t('admin.settings.data.restoreModeTitle', 'Restore Mode')}
                                    </label>
                                    <div className="admin-data-modes-row">
                                        <div
                                            className={`admin-data-mode-card ${restoreMode === 'merge' ? 'is-active' : ''}`}
                                            onClick={() => setRestoreMode('merge')}
                                        >
                                            <div className="admin-data-mode-card-radio">
                                                <input
                                                    type="radio"
                                                    name="restoreMode"
                                                    value="merge"
                                                    checked={restoreMode === 'merge'}
                                                    onChange={() => setRestoreMode('merge')}
                                                />
                                            </div>
                                            <div className="admin-data-mode-card-content">
                                                <strong>{t('admin.settings.data.modeMerge', 'Safe Merge / Upsert (Recommended)')}</strong>
                                                <p>{t('admin.settings.data.modeMergeDesc', 'Updates matching documents by ID and adds new ones. Does not wipe existing data.')}</p>
                                            </div>
                                        </div>

                                        <div
                                            className={`admin-data-mode-card ${restoreMode === 'replace' ? 'is-active is-replace' : ''}`}
                                            onClick={() => setRestoreMode('replace')}
                                        >
                                            <div className="admin-data-mode-card-radio">
                                                <input
                                                    type="radio"
                                                    name="restoreMode"
                                                    value="replace"
                                                    checked={restoreMode === 'replace'}
                                                    onChange={() => setRestoreMode('replace')}
                                                />
                                            </div>
                                            <div className="admin-data-mode-card-content">
                                                <strong>{t('admin.settings.data.modeReplace', 'Complete Collection Replace')}</strong>
                                                <p>{t('admin.settings.data.modeReplaceDesc', 'Completely clears chosen collections and replaces them with the backup version.')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Confirmation guard for Replace mode */}
                                    {restoreMode === 'replace' && (
                                        <div className="admin-data-replace-warning-box">
                                            <div className="admin-data-warning-header">
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                                    <line x1="12" y1="9" x2="12" y2="13" />
                                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                                </svg>
                                                <span>{t('admin.settings.data.replaceWarning', 'Warning: Complete Replace will overwrite existing documents in selected collections.')}</span>
                                            </div>
                                            <div className="admin-data-replace-confirm-field">
                                                <label className="admin-settings-label">
                                                    {t('admin.settings.data.typeRestoreConfirm', 'Type RESTORE below to confirm complete replacement:')}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="admin-settings-input"
                                                    placeholder="RESTORE"
                                                    value={replaceConfirmText}
                                                    onChange={(e) => setReplaceConfirmText(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Execute Restore Action */}
                                <div className="admin-data-execute-restore-row">
                                    <button
                                        type="button"
                                        className={`admin-settings-btn-primary ${restoreMode === 'replace' ? 'is-danger' : ''}`}
                                        onClick={handleRestore}
                                        disabled={
                                            restoring ||
                                            selectedColsCount === 0 ||
                                            (restoreMode === 'replace' && replaceConfirmText.trim().toUpperCase() !== 'RESTORE')
                                        }
                                    >
                                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="23 4 23 10 17 10" />
                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                        </svg>
                                        <span>
                                            {restoring
                                                ? t('admin.settings.data.restoring', 'Restoring Database...')
                                                : t('admin.settings.data.restoreBtn', 'Restore Database')}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {fileError && (
                    <div className="admin-settings-alert is-error admin-data-alert">
                        <span>{fileError}</span>
                    </div>
                )}

                {restoreResult && (
                    <div className={`admin-settings-alert ${restoreResult.type === 'success' ? 'is-success' : 'is-error'} admin-data-alert`}>
                        <span>{restoreResult.message}</span>
                    </div>
                )}
            </div>

            {/* CARD 4: COLLECTION-BY-COLLECTION STORAGE BREAKDOWN */}
            {stats && stats.collections && stats.collections.length > 0 && (
                <div className="admin-settings-card admin-data-card">
                    <div className="admin-settings-card-header">
                        <div className="admin-settings-card-header-left">
                            <h4 className="admin-settings-card-title">
                                {t('admin.settings.data.collectionsBreakdownTitle', 'Collection-by-Collection Storage Breakdown')}
                            </h4>
                            <p className="admin-settings-help-text">
                                Detailed size and document distributions across all {stats.collectionsCount} collections.
                            </p>
                        </div>
                    </div>

                    {/* Collections Table */}
                    <div className="admin-data-table-container">
                        <table className="admin-data-table">
                            <thead>
                                <tr>
                                    <th
                                        className={`admin-data-th-sortable ${sortField === 'name' ? 'is-sorted' : ''}`}
                                        onClick={() => handleSort('name')}
                                        role="columnheader"
                                        aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort('name');
                                            }
                                        }}
                                        title={`Sort by Collection (${sortField === 'name' && sortDirection === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="admin-data-th-inner">
                                            <span>{t('admin.settings.data.colName', 'Collection')}</span>
                                            {renderSortIcon('name')}
                                        </div>
                                    </th>
                                    <th
                                        className={`admin-data-th-sortable ${sortField === 'category' ? 'is-sorted' : ''}`}
                                        onClick={() => handleSort('category')}
                                        role="columnheader"
                                        aria-sort={sortField === 'category' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort('category');
                                            }
                                        }}
                                        title={`Sort by Category (${sortField === 'category' && sortDirection === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="admin-data-th-inner">
                                            <span>{t('admin.settings.data.colCategory', 'Category')}</span>
                                            {renderSortIcon('category')}
                                        </div>
                                    </th>
                                    <th
                                        className={`admin-data-th-sortable ${sortField === 'documents' ? 'is-sorted' : ''}`}
                                        onClick={() => handleSort('documents')}
                                        role="columnheader"
                                        aria-sort={sortField === 'documents' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort('documents');
                                            }
                                        }}
                                        title={`Sort by Documents (${sortField === 'documents' && sortDirection === 'desc' ? 'Ascending' : 'Descending'})`}
                                    >
                                        <div className="admin-data-th-inner">
                                            <span>{t('admin.settings.data.colDocuments', 'Documents')}</span>
                                            {renderSortIcon('documents')}
                                        </div>
                                    </th>
                                    <th
                                        className={`admin-data-th-sortable ${sortField === 'dataSize' ? 'is-sorted' : ''}`}
                                        onClick={() => handleSort('dataSize')}
                                        role="columnheader"
                                        aria-sort={sortField === 'dataSize' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort('dataSize');
                                            }
                                        }}
                                        title={`Sort by Data Size (${sortField === 'dataSize' && sortDirection === 'desc' ? 'Ascending' : 'Descending'})`}
                                    >
                                        <div className="admin-data-th-inner">
                                            <span>{t('admin.settings.data.colDataSize', 'Data Size')}</span>
                                            {renderSortIcon('dataSize')}
                                        </div>
                                    </th>
                                    <th
                                        className={`admin-data-th-sortable ${sortField === 'storageSize' ? 'is-sorted' : ''}`}
                                        onClick={() => handleSort('storageSize')}
                                        role="columnheader"
                                        aria-sort={sortField === 'storageSize' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort('storageSize');
                                            }
                                        }}
                                        title={`Sort by Storage Size (${sortField === 'storageSize' && sortDirection === 'desc' ? 'Ascending' : 'Descending'})`}
                                    >
                                        <div className="admin-data-th-inner">
                                            <span>{t('admin.settings.data.colStorageSize', 'Storage Size')}</span>
                                            {renderSortIcon('storageSize')}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCollections.length > 0 ? (
                                    sortedCollections.map((col) => (
                                        <tr key={col.name}>
                                            <td className="admin-data-td-name">
                                                <span className="admin-data-col-name">{col.name}</span>
                                                <span className="admin-data-col-friendly">{col.label}</span>
                                            </td>
                                            <td className="admin-data-td-center">
                                                <span className={`admin-data-cat-tag is-${col.category.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                                                    {col.category}
                                                </span>
                                            </td>
                                            <td className="admin-data-td-center font-mono">{col.count.toLocaleString()}</td>
                                            <td className="admin-data-td-center font-mono">{col.sizeFormatted}</td>
                                            <td className="admin-data-td-center font-mono">{col.storageSizeFormatted}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="admin-data-empty-td">
                                            {t('admin.settings.data.noCollections', 'No collections found.')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataSettingsTab;
