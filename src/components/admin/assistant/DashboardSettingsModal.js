import React, { useState, useEffect } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { useContent } from '../../../utils/ContentContext';

const DashboardSettingsModal = ({ isOpen, onClose, initialTab = 'calendar', onSettingsSaved }) => {
    const { t } = useContent();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
    const [saveMessage, setSaveMessage] = useState('');
    const [testingCalendar, setTestingCalendar] = useState(false);
    const [calendarTestResult, setCalendarTestResult] = useState(null);
    const [showAdvancedCalendar, setShowAdvancedCalendar] = useState(false);

    // Weather location verification & GPS states
    const [verifyingLocation, setVerifyingLocation] = useState(false);
    const [locationTestResult, setLocationTestResult] = useState(null);
    const [detectingGps, setDetectingGps] = useState(false);

    // New custom feed form state
    const [newFeed, setNewFeed] = useState({ name: '', url: '', badge: '' });
    const [customFeedError, setCustomFeedError] = useState('');

    // Tag System state
    const [tagSearchTerm, setTagSearchTerm] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [tagError, setTagError] = useState('');

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setLoading(true);
        setSaveStatus(null);
        setCalendarTestResult(null);
        setLocationTestResult(null);

        assistantApi.getSettings({ fresh: 'true' })
            .then((data) => {
                if (isMounted) {
                    setSettings(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error('Failed to load dashboard settings:', err);
                    setSaveStatus('error');
                    setSaveMessage(err.message || 'Failed to load settings');
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setSaveStatus(null);

        try {
            const settingsToSave = {
                ...settings,
                calendar: {
                    ...settings.calendar,
                    enabled: true,
                },
                news: {
                    ...settings.news,
                    enabled: true,
                },
            };
            const res = await assistantApi.updateSettings(settingsToSave);
            setSaveStatus('success');
            setSaveMessage(t('admin.settings.saved', 'Settings saved successfully!'));
            if (res?.settings) {
                setSettings(res.settings);
            }
            if (onSettingsSaved) {
                onSettingsSaved(res?.settings || settingsToSave);
            }
            setTimeout(() => {
                setSaveStatus(null);
            }, 3000);
        } catch (err) {
            setSaveStatus('error');
            setSaveMessage(err.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };


    const handleTestCalendar = async () => {
        const icsUrl = settings?.calendar?.icsUrl;
        if (!icsUrl) {
            setCalendarTestResult({ success: false, error: 'Please enter an ICS URL first.' });
            return;
        }

        setTestingCalendar(true);
        setCalendarTestResult(null);

        try {
            const res = await assistantApi.testCalendarFeed(icsUrl);
            setCalendarTestResult(res);
        } catch (err) {
            setCalendarTestResult({ success: false, error: err.message || 'Test failed.' });
        } finally {
            setTestingCalendar(false);
        }
    };

    const handleAddCustomFeed = (e) => {
        e.preventDefault();
        setCustomFeedError('');

        if (!newFeed.name.trim() || !newFeed.url.trim()) {
            setCustomFeedError('Feed Name and URL are required.');
            return;
        }

        const customFeeds = Array.isArray(settings?.news?.customFeeds) ? [...settings.news.customFeeds] : [];
        customFeeds.push({
            id: `feed_${Date.now()}`,
            name: newFeed.name.trim(),
            url: newFeed.url.trim(),
            badge: (newFeed.badge || newFeed.name.slice(0, 6)).toUpperCase().trim(),
            enabled: true,
        });

        setSettings({
            ...settings,
            news: {
                ...settings.news,
                customFeeds,
            },
        });

        setNewFeed({ name: '', url: '', badge: '' });
    };

    const handleRemoveCustomFeed = (feedId) => {
        const customFeeds = (settings?.news?.customFeeds || []).filter((f) => f.id !== feedId);
        setSettings({
            ...settings,
            news: {
                ...settings.news,
                customFeeds,
            },
        });
    };

    const getEffectiveTags = () => {
        return Array.isArray(settings?.news?.tags) ? settings.news.tags : [];
    };

    const handleToggleTag = (tagId) => {
        const currentTags = getEffectiveTags();
        const updatedTags = currentTags.map((tag) => {
            if (tag.id === tagId) {
                return { ...tag, enabled: tag.enabled === false };
            }
            return tag;
        });

        setSettings({
            ...settings,
            news: {
                ...settings?.news,
                tags: updatedTags,
            },
        });
    };

    const handleAddTag = (e) => {
        e.preventDefault();
        setTagError('');

        const trimmed = newTagName.trim();
        if (!trimmed) {
            setTagError(t('admin.settings.news.tagRequired', 'Tag name is required.'));
            return;
        }

        const currentTags = [...getEffectiveTags()];
        if (currentTags.some((t) => (t.label || t.name || '').toLowerCase() === trimmed.toLowerCase())) {
            setTagError(t('admin.settings.news.tagExists', 'A tag with this name already exists.'));
            return;
        }

        const id = `tag_${Date.now()}`;
        currentTags.push({
            id,
            label: trimmed,
            enabled: true,
            query: trimmed,
        });

        setSettings({
            ...settings,
            news: {
                ...settings?.news,
                tags: currentTags,
            },
        });

        setNewTagName('');
    };

    const handleRemoveTag = (tagId) => {
        const currentTags = getEffectiveTags();
        const updatedTags = currentTags.filter((tag) => tag.id !== tagId);

        setSettings({
            ...settings,
            news: {
                ...settings?.news,
                tags: updatedTags,
            },
        });
    };

    const handleEnableAllTags = () => {
        const currentTags = getEffectiveTags();
        const updatedTags = currentTags.map((tag) => ({ ...tag, enabled: true }));

        setSettings({
            ...settings,
            news: {
                ...settings?.news,
                tags: updatedTags,
            },
        });
    };

    const handleDisableAllTags = () => {
        const currentTags = getEffectiveTags();
        const updatedTags = currentTags.map((tag) => ({ ...tag, enabled: false }));

        setSettings({
            ...settings,
            news: {
                ...settings?.news,
                tags: updatedTags,
            },
        });
    };



    const handleVerifyLocation = async (overrideLoc) => {
        const rawLoc = overrideLoc !== undefined ? overrideLoc : (settings?.weather?.defaultLocation || '');
        const locToTest = rawLoc.trim();
        if (!locToTest) {
            setLocationTestResult({
                success: false,
                error: t('admin.settings.weather.locationEmptyError', 'Please enter a city or location name to verify.'),
            });
            return;
        }

        setVerifyingLocation(true);
        setLocationTestResult(null);

        try {
            const res = await assistantApi.testLocation(locToTest);
            if (res?.success) {
                setLocationTestResult({
                    success: true,
                    location: res.location,
                    latitude: res.latitude,
                    longitude: res.longitude,
                    country: res.country,
                    countryCode: res.countryCode,
                });
            } else {
                setLocationTestResult({
                    success: false,
                    error: res?.error || t('admin.settings.weather.locationNotFound', `Could not find any location matching "${locToTest}". Check the spelling or try adding a state/country.`),
                });
            }
        } catch (err) {
            setLocationTestResult({
                success: false,
                error: err.message || t('admin.settings.weather.locationError', 'Failed to verify location. Please try again.'),
            });
        } finally {
            setVerifyingLocation(false);
        }
    };



    const handleClearCoordinates = () => {
        setSettings({
            ...settings,
            weather: {
                ...settings?.weather,
                latitude: null,
                longitude: null,
            },
        });
    };

    const handleDetectGps = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        setDetectingGps(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const roundedLat = Math.round(latitude * 10000) / 10000;
                const roundedLon = Math.round(longitude * 10000) / 10000;

                let detectedCity = null;
                try {
                    const res = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${roundedLat}&longitude=${roundedLon}&localityLanguage=en`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        const parts = [data.city || data.locality, data.principalSubdivision, data.countryCode].filter(Boolean);
                        if (parts.length > 0) {
                            detectedCity = parts.join(', ');
                        }
                    }
                } catch (_) {}

                setSettings((prev) => ({
                    ...prev,
                    weather: {
                        ...prev.weather,
                        latitude: roundedLat,
                        longitude: roundedLon,
                        defaultLocation: detectedCity || prev.weather?.defaultLocation || '',
                    },
                }));

                setLocationTestResult({
                    success: true,
                    location: detectedCity ? `${detectedCity} (Detected from browser)` : `GPS Coordinates: ${roundedLat}, ${roundedLon}`,
                    latitude: roundedLat,
                    longitude: roundedLon,
                });
                setDetectingGps(false);
            },
            (err) => {
                setDetectingGps(false);
                alert(`Could not detect location: ${err.message}`);
            },
            { timeout: 10000 }
        );
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div
                className="admin-settings-modal-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <header className="admin-settings-modal-header">
                    <div>
                        <h2 className="admin-settings-modal-title">
                            {t('admin.settings.title', 'Data Sources Settings')}
                        </h2>
                        <p className="admin-settings-modal-subtitle">
                            {t('admin.settings.subtitle', 'Customize live Calendar, News feeds, and Weather sources without code changes.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="admin-settings-close-btn"
                        onClick={onClose}
                        aria-label={t('admin.settings.close', 'Close')}
                    >
                        &times;
                    </button>
                </header>

                {/* Tabs Navigation */}
                <div className="admin-settings-tabs-row" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'calendar'}
                        className={`admin-settings-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        <span>{t('admin.settings.tabs.calendar', 'Calendar (.ics)')}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'news'}
                        className={`admin-settings-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
                        onClick={() => setActiveTab('news')}
                    >
                        <span>{t('admin.settings.tabs.news', 'News & Topics')}</span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'weather'}
                        className={`admin-settings-tab-btn ${activeTab === 'weather' ? 'active' : ''}`}
                        onClick={() => setActiveTab('weather')}
                    >
                        <span>{t('admin.settings.tabs.weather', 'Weather')}</span>
                    </button>
                </div>

                {/* Status Notifications */}
                {saveStatus && (
                    <div className={`admin-settings-alert ${saveStatus === 'success' ? 'is-success' : 'is-error'}`}>
                        <span>{saveMessage}</span>
                    </div>
                )}

                {/* Body Content */}
                <div className="admin-settings-modal-body">
                    {loading ? (
                        <div style={{ padding: '3rem 0', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #e2e8f0', borderTopColor: '#0284c7', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                            <div>Loading settings...</div>
                        </div>
                    ) : settings ? (
                        <>
                            {/* TAB 1: CALENDAR */}
                            {activeTab === 'calendar' && (
                                <div className="admin-settings-section">
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4 className="admin-settings-card-title">
                                                {t('admin.settings.calendar.cardTitle', 'Calendar Feed Integration')}
                                            </h4>
                                        </div>

                                        <div className="admin-settings-field-group">
                                            <label className="admin-settings-label">
                                                {t('admin.settings.calendar.icsUrlLabel', 'Calendar Subscription URL (.ics)')}
                                                <span style={{ color: '#ef4444' }}> *</span>
                                            </label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="url"
                                                    className="admin-settings-input"
                                                    placeholder="https://outlook.office365.com/.../calendar.ics or Google Calendar secret address"
                                                    value={settings.calendar?.icsUrl || ''}
                                                    onChange={(e) =>
                                                        setSettings({
                                                            ...settings,
                                                            calendar: { ...settings.calendar, icsUrl: e.target.value },
                                                        })
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    className="admin-settings-btn-secondary"
                                                    onClick={handleTestCalendar}
                                                    disabled={testingCalendar || !settings.calendar?.icsUrl?.trim()}
                                                >
                                                    {testingCalendar ? t('admin.settings.testing', 'Testing...') : t('admin.settings.test', 'Test Feed')}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Test Result Indicator */}
                                        {calendarTestResult && (
                                            <div className={`admin-settings-test-pill ${calendarTestResult.success ? 'is-success' : 'is-error'}`}>
                                                {calendarTestResult.success ? (
                                                    <span>✓ {calendarTestResult.message || `Feed verified (${calendarTestResult.eventCount} events found)`}</span>
                                                ) : (
                                                    <span>✕ {calendarTestResult.error || 'Failed to load feed'}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Advanced Option Toggle (collapsible for web URL override) */}
                                        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                            <button
                                                type="button"
                                                className="admin-settings-advanced-link"
                                                onClick={() => setShowAdvancedCalendar(!showAdvancedCalendar)}
                                                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 550 }}
                                            >
                                                <span>{showAdvancedCalendar ? '▾' : '▸'}</span>
                                                <span>{showAdvancedCalendar ? t('admin.settings.calendar.advancedToggleHide', 'Hide advanced options') : t('admin.settings.calendar.advancedToggleShow', 'Show advanced web link options (optional)')}</span>
                                            </button>

                                            {showAdvancedCalendar && (
                                                <div className="admin-settings-field-group" style={{ marginTop: '0.75rem' }}>
                                                    <label className="admin-settings-label">
                                                        {t('admin.settings.calendar.htmlUrlLabel', 'Custom Web Calendar Link (optional)')}
                                                    </label>
                                                    <input
                                                        type="url"
                                                        className="admin-settings-input"
                                                        placeholder="Leave blank to auto-detect from .ics URL"
                                                        value={settings.calendar?.htmlUrl || ''}
                                                        onChange={(e) =>
                                                            setSettings({
                                                                ...settings,
                                                                calendar: { ...settings.calendar, htmlUrl: e.target.value },
                                                            })
                                                        }
                                                    />
                                                    <p className="admin-settings-help-text">
                                                        {t('admin.settings.calendar.htmlUrlHelp', 'Destination opened by the "Open Calendar" button. If left blank, this is automatically generated from your .ics link.')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: NEWS */}
                            {activeTab === 'news' && (() => {
                                const effectiveTags = getEffectiveTags();
                                const activeCount = effectiveTags.filter((t) => t.enabled !== false).length;

                                // Filter tags by search term
                                const filteredTags = effectiveTags.filter((tag) => {
                                    if (!tagSearchTerm.trim()) return true;
                                    const term = tagSearchTerm.toLowerCase().trim();
                                    return (tag.label || tag.name || '').toLowerCase().includes(term);
                                });

                                return (
                                <div className="admin-settings-section">
                                    {/* Card 1: Topic Tags & Interests */}
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <div className="admin-settings-card-header-left">
                                                <h4 className="admin-settings-card-title">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0284c7' }}>
                                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                                    </svg>
                                                    {t('admin.settings.news.tagsTitle', 'Topic Tags & Interests')}
                                                </h4>
                                                <p className="admin-settings-help-text" style={{ margin: '0.25rem 0 0 0' }}>
                                                    {t('admin.settings.news.tagsHelp', 'Add topic tags to tailor your live dashboard news briefing.')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Tag Toolbar (only shown when tags exist) */}
                                        {effectiveTags.length > 0 && (
                                            <div className="admin-settings-tag-toolbar">
                                                <div className="admin-settings-tag-search-box">
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="11" cy="11" r="8" />
                                                        <path d="m21 21-4.3-4.3" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        className="admin-settings-tag-search-input"
                                                        placeholder={t('admin.settings.news.searchTags', 'Search tags...')}
                                                        value={tagSearchTerm}
                                                        onChange={(e) => setTagSearchTerm(e.target.value)}
                                                    />
                                                    {tagSearchTerm && (
                                                        <button
                                                            type="button"
                                                            className="admin-settings-tag-search-clear"
                                                            onClick={() => setTagSearchTerm('')}
                                                            aria-label="Clear search"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="admin-settings-tag-toolbar-actions">
                                                    <span className={`admin-settings-tag-count-badge ${activeCount > 0 ? 'has-active' : ''}`}>
                                                        <span className="admin-settings-tag-count-dot" />
                                                        {activeCount} / {effectiveTags.length} {t('admin.settings.news.tagsActive', 'active')}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="admin-settings-tag-action-btn"
                                                        onClick={handleEnableAllTags}
                                                        disabled={effectiveTags.length === 0}
                                                        title={t('admin.settings.news.selectAllHelp', 'Enable all tags')}
                                                    >
                                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="20 6 9 17 4 12" />
                                                        </svg>
                                                        {t('admin.settings.news.selectAll', 'Select All')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-settings-tag-action-btn"
                                                        onClick={handleDisableAllTags}
                                                        disabled={effectiveTags.length === 0}
                                                        title={t('admin.settings.news.clearAllHelp', 'Disable all tags')}
                                                    >
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                        </svg>
                                                        {t('admin.settings.news.clearAll', 'Clear All')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Interactive Tag Cloud OR Clean Empty State */}
                                        {effectiveTags.length === 0 ? (
                                            <div className="admin-settings-tag-empty-state">
                                                <div className="admin-settings-tag-empty-icon">
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                                        <line x1="7" y1="7" x2="7.01" y2="7" />
                                                    </svg>
                                                </div>
                                                <div className="admin-settings-tag-empty-text">
                                                    <h5 className="admin-settings-tag-empty-title">
                                                        {t('admin.settings.news.noTagsTitle', 'No Topic Tags Yet')}
                                                    </h5>
                                                    <p className="admin-settings-tag-empty-desc">
                                                        {t('admin.settings.news.noTagsHelp', 'Add your custom topic tags below (e.g. Artificial Intelligence, Startups, Space) to personalize your live news briefing.')}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="admin-settings-tag-cloud">
                                                {filteredTags.map((tag) => {
                                                    const isEnabled = tag.enabled !== false;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={tag.id}
                                                            className={`admin-settings-tag-chip ${isEnabled ? 'is-active' : 'is-inactive'}`}
                                                            onClick={() => handleToggleTag(tag.id)}
                                                            title={isEnabled ? t('admin.settings.news.clickToDisableTag', 'Click to disable tag') : t('admin.settings.news.clickToEnableTag', 'Click to enable tag')}
                                                            aria-pressed={isEnabled}
                                                        >
                                                            <span className="admin-settings-tag-chip-indicator">
                                                                {isEnabled ? (
                                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                        <line x1="12" y1="5" x2="12" y2="19" />
                                                                        <line x1="5" y1="12" x2="19" y2="12" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            <span className="admin-settings-tag-chip-label">
                                                                #{tag.label || tag.name}
                                                            </span>
                                                            <span
                                                                role="button"
                                                                tabIndex={0}
                                                                className="admin-settings-tag-chip-del"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveTag(tag.id);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                                        e.stopPropagation();
                                                                        handleRemoveTag(tag.id);
                                                                    }
                                                                }}
                                                                title={`Remove #${tag.label || tag.name}`}
                                                                aria-label={`Remove #${tag.label || tag.name}`}
                                                            >
                                                                &times;
                                                            </span>
                                                        </button>
                                                    );
                                                })}

                                                {filteredTags.length === 0 && tagSearchTerm && (
                                                    <div className="admin-settings-tag-empty">
                                                        {t('admin.settings.news.noTagsMatch', 'No tags matching "{term}".').replace('{term}', tagSearchTerm)}
                                                        <button
                                                            type="button"
                                                            className="admin-settings-tag-clear-filter-link"
                                                            onClick={() => setTagSearchTerm('')}
                                                        >
                                                            Clear search
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Add Custom Tag Bar */}
                                        <form className="admin-settings-add-tag-bar" onSubmit={handleAddTag}>
                                            <div className="admin-settings-add-tag-input-wrap">
                                                <span className="admin-settings-add-tag-hash">#</span>
                                                <input
                                                    type="text"
                                                    className="admin-settings-add-tag-input"
                                                    placeholder={t('admin.settings.news.newTagPlaceholder', 'Add custom topic tag (e.g. Quantum Computing, SpaceX, Tesla)...')}
                                                    value={newTagName}
                                                    onChange={(e) => setNewTagName(e.target.value)}
                                                />
                                            </div>
                                            <button type="submit" className="admin-settings-add-tag-btn">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                {t('admin.settings.news.addTagBtn', 'Add Tag')}
                                            </button>
                                        </form>

                                        {tagError && (
                                            <div className="admin-settings-tag-error">
                                                {tagError}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card 2: Custom RSS Feeds */}
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <div className="admin-settings-card-header-left">
                                                <h4 className="admin-settings-card-title">
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f59e0b' }}>
                                                        <path d="M4 11a9 9 0 0 1 9 9" />
                                                        <path d="M4 4a16 16 0 0 1 16 16" />
                                                        <circle cx="5" cy="19" r="1" />
                                                    </svg>
                                                    {t('admin.settings.news.customFeedsTitle', 'Custom RSS Feeds')}
                                                </h4>
                                                <p className="admin-settings-help-text" style={{ margin: '0.25rem 0 0 0' }}>
                                                    {t('admin.settings.news.customFeedsHelp', 'Add arbitrary RSS/Atom feeds from any publication.')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Existing Custom Feeds List */}
                                        {(settings.news?.customFeeds || []).length > 0 ? (
                                            <div className="admin-settings-custom-feeds-list">
                                                {settings.news.customFeeds.map((feed) => (
                                                    <div key={feed.id} className="admin-settings-feed-item">
                                                        <div className="admin-settings-feed-info">
                                                            <div className="admin-settings-feed-name">{feed.name}</div>
                                                            <div className="admin-settings-feed-url">{feed.url}</div>
                                                        </div>
                                                        <div className="admin-settings-feed-actions">
                                                            <span className="admin-settings-category-badge">{feed.badge}</span>
                                                            <button
                                                                type="button"
                                                                className="admin-settings-feed-del-btn"
                                                                onClick={() => handleRemoveCustomFeed(feed.id)}
                                                                title={`Remove ${feed.name}`}
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="admin-settings-feed-empty-hint">
                                                {t('admin.settings.news.noCustomFeeds', 'No custom RSS feeds added yet.')}
                                            </p>
                                        )}

                                        {/* Add New Custom Feed Form */}
                                        <form className="admin-settings-add-feed-form" onSubmit={handleAddCustomFeed}>
                                            <div className="admin-settings-add-feed-grid">
                                                <div>
                                                    <label className="admin-settings-label">
                                                        {t('admin.settings.news.feedName', 'Feed Name')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="admin-settings-input"
                                                        placeholder={t('admin.settings.news.feedNamePlaceholder', 'Feed Name (e.g. Ars Technica)')}
                                                        value={newFeed.name}
                                                        onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="admin-settings-label">
                                                        {t('admin.settings.news.feedUrl', 'RSS Feed URL')}
                                                    </label>
                                                    <input
                                                        type="url"
                                                        className="admin-settings-input"
                                                        placeholder={t('admin.settings.news.feedUrlPlaceholder', 'https://example.com/rss.xml')}
                                                        value={newFeed.url}
                                                        onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="admin-settings-label">
                                                        {t('admin.settings.news.feedBadge', 'Badge')}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="admin-settings-input"
                                                        placeholder={t('admin.settings.news.feedBadgePlaceholder', 'Tech')}
                                                        value={newFeed.badge}
                                                        onChange={(e) => setNewFeed({ ...newFeed, badge: e.target.value })}
                                                    />
                                                </div>
                                                <div className="admin-settings-add-feed-btn-col">
                                                    <button type="submit" className="admin-settings-btn-secondary">
                                                        + {t('admin.settings.news.addFeed', 'Add Feed')}
                                                    </button>
                                                </div>
                                            </div>
                                            {customFeedError && (
                                                <p className="admin-settings-feed-error">{customFeedError}</p>
                                            )}
                                        </form>
                                    </div>
                                </div>
                                );
                            })()}

                            {/* TAB 3: WEATHER */}
                            {activeTab === 'weather' && (
                                <div className="admin-settings-section">
                                    {/* Card 1: Location & Verification */}
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <h4 className="admin-settings-card-title">
                                                {t('admin.settings.weather.locationLabel', 'Weather Location')}
                                                <span style={{ color: '#ef4444' }}> *</span>
                                            </h4>
                                            {settings.weather?.defaultLocation && (
                                                <span className="admin-settings-field-tag">
                                                    {settings.weather.defaultLocation}
                                                </span>
                                            )}
                                        </div>
                                        <p className="admin-settings-help-text" style={{ marginTop: 0, marginBottom: '0.65rem' }}>
                                            {t('admin.settings.weather.locationHelp', 'City, region or country used when opening the dashboard.')}
                                        </p>

                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                type="text"
                                                className="admin-settings-input"
                                                placeholder={t('admin.settings.weather.locationPlaceholder', 'e.g. Ithaca, NY or Seattle, WA or Bengaluru, India')}
                                                value={settings.weather?.defaultLocation || ''}
                                                onChange={(e) => {
                                                    setSettings({
                                                        ...settings,
                                                        weather: { ...settings.weather, defaultLocation: e.target.value },
                                                    });
                                                    if (locationTestResult) setLocationTestResult(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleVerifyLocation();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="admin-settings-btn-secondary"
                                                onClick={() => handleVerifyLocation()}
                                                disabled={verifyingLocation || !settings.weather?.defaultLocation?.trim()}
                                            >
                                                {verifyingLocation ? t('admin.settings.weather.verifying', 'Checking...') : t('admin.settings.weather.verifyBtn', 'Verify Location')}
                                            </button>
                                        </div>

                                        {/* Standard Test Result Indicator (Success or Error Message) */}
                                        {locationTestResult && (
                                            <div
                                                className={`admin-settings-test-pill ${locationTestResult.success ? 'is-success' : 'is-error'}`}
                                                style={{ marginTop: '0.65rem' }}
                                            >
                                                {locationTestResult.success ? (
                                                    <span>✓ {t('admin.settings.weather.locationVerified', 'Location verified')}: {locationTestResult.location}</span>
                                                ) : (
                                                    <span>✕ {locationTestResult.error || t('admin.settings.weather.locationNotFound', 'Location not found')}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Card 2: Temperature Unit Compact Toggle */}
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header" style={{ marginBottom: 0, alignItems: 'center' }}>
                                            <div className="admin-settings-card-header-left">
                                                <h4 className="admin-settings-card-title">
                                                    {t('admin.settings.weather.unitLabel', 'Temperature Unit')}
                                                </h4>
                                                <p className="admin-settings-help-text" style={{ margin: '0.2rem 0 0 0' }}>
                                                    {t('admin.settings.weather.unitHelp', 'Display temperatures in Fahrenheit (°F) or Celsius (°C).')}
                                                </p>
                                            </div>
                                            <div className="admin-settings-unit-toggle-compact" role="radiogroup" aria-label="Temperature Unit">
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={settings.weather?.defaultUnit !== 'C'}
                                                    className={`admin-settings-unit-toggle-compact-btn ${settings.weather?.defaultUnit !== 'C' ? 'active' : ''}`}
                                                    onClick={() =>
                                                        setSettings({
                                                            ...settings,
                                                            weather: { ...settings.weather, defaultUnit: 'F' },
                                                        })
                                                    }
                                                    title={t('admin.settings.weather.fahrenheit', 'Fahrenheit (°F)')}
                                                >
                                                    °F
                                                </button>
                                                <button
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={settings.weather?.defaultUnit === 'C'}
                                                    className={`admin-settings-unit-toggle-compact-btn ${settings.weather?.defaultUnit === 'C' ? 'active' : ''}`}
                                                    onClick={() =>
                                                        setSettings({
                                                            ...settings,
                                                            weather: { ...settings.weather, defaultUnit: 'C' },
                                                        })
                                                    }
                                                    title={t('admin.settings.weather.celsius', 'Celsius (°C)')}
                                                >
                                                    °C
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: GPS Coordinates */}
                                    <div className="admin-settings-card">
                                        <div className="admin-settings-card-header">
                                            <div className="admin-settings-card-header-left">
                                                <h4 className="admin-settings-card-title">
                                                    {t('admin.settings.weather.coordsLabel', 'GPS Coordinates')}
                                                    <span className="admin-settings-field-tag">
                                                        {t('admin.settings.weather.optional', 'Optional')}
                                                    </span>
                                                </h4>
                                                <p className="admin-settings-help-text" style={{ margin: '0.25rem 0 0 0' }}>
                                                    {t('admin.settings.weather.coordsHelp', 'Fine-tune exact coordinates for pinpoint hyper-local weather. Leave blank to rely entirely on the city name above.')}
                                                </p>
                                            </div>
                                            <div className="admin-settings-card-header-actions">
                                                {(settings.weather?.latitude != null || settings.weather?.longitude != null) && (
                                                    <button
                                                        type="button"
                                                        className="admin-settings-btn-link-danger"
                                                        onClick={handleClearCoordinates}
                                                        title="Clear manual GPS coordinates"
                                                    >
                                                        {t('admin.settings.weather.clearCoords', 'Clear')}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="admin-settings-btn-detect"
                                                    onClick={handleDetectGps}
                                                    disabled={detectingGps}
                                                    title={t('admin.settings.weather.detectGpsTitle', 'Detect GPS coordinates from your browser')}
                                                >
                                                    {detectingGps ? (
                                                        <>
                                                            <span className="admin-settings-spinner-sm" />
                                                            <span>{t('admin.settings.weather.detecting', 'Detecting...')}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                width="14"
                                                                height="14"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                aria-hidden="true"
                                                            >
                                                                <circle cx="12" cy="12" r="3" />
                                                                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                                                            </svg>
                                                            <span>{t('admin.settings.weather.detectGps', 'Detect from Browser')}</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="admin-settings-coords-grid">
                                            <div className="admin-settings-coord-group">
                                                <label className="admin-settings-coord-label">
                                                    <span>{t('admin.settings.weather.lat', 'Latitude')}</span>
                                                    <span className="admin-settings-coord-hint">(-90 to 90)</span>
                                                </label>
                                                <div className="admin-settings-input-wrapper">
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        className="admin-settings-input"
                                                        placeholder="42.4406"
                                                        value={settings.weather?.latitude ?? ''}
                                                        onChange={(e) =>
                                                            setSettings({
                                                                ...settings,
                                                                weather: {
                                                                    ...settings.weather,
                                                                    latitude: e.target.value === '' ? null : parseFloat(e.target.value),
                                                                },
                                                            })
                                                        }
                                                    />
                                                    <span className="admin-settings-input-suffix">°N/S</span>
                                                </div>
                                            </div>
                                            <div className="admin-settings-coord-group">
                                                <label className="admin-settings-coord-label">
                                                    <span>{t('admin.settings.weather.lon', 'Longitude')}</span>
                                                    <span className="admin-settings-coord-hint">(-180 to 180)</span>
                                                </label>
                                                <div className="admin-settings-input-wrapper">
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        className="admin-settings-input"
                                                        placeholder="-76.4966"
                                                        value={settings.weather?.longitude ?? ''}
                                                        onChange={(e) =>
                                                            setSettings({
                                                                ...settings,
                                                                weather: {
                                                                    ...settings.weather,
                                                                    longitude: e.target.value === '' ? null : parseFloat(e.target.value),
                                                                },
                                                            })
                                                        }
                                                    />
                                                    <span className="admin-settings-input-suffix">°E/W</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status row explaining active coordinate mode */}
                                        {(settings.weather?.latitude != null && settings.weather?.longitude != null) ? (
                                            <div className="admin-settings-coords-status is-active">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                <span>
                                                    {t('admin.settings.weather.coordsActive', 'Custom coordinates active')}: {settings.weather.latitude}°, {settings.weather.longitude}°
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="admin-settings-coords-status">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="16" x2="12" y2="12" />
                                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                                </svg>
                                                <span>
                                                    {t('admin.settings.weather.coordsInactive', 'No coordinate overrides — weather resolves via city name above.')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Modal Footer */}
                <footer className="admin-settings-modal-footer" style={{ justifyContent: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <button
                            type="button"
                            className="admin-settings-btn-secondary"
                            onClick={onClose}
                            disabled={saving}
                        >
                            {t('admin.settings.close', 'Close')}
                        </button>
                        <button
                            type="button"
                            className="admin-settings-btn-primary"
                            onClick={handleSave}
                            disabled={saving || loading}
                        >
                            {saving ? t('admin.settings.saving', 'Saving...') : t('admin.settings.save', 'Save Changes')}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default DashboardSettingsModal;
