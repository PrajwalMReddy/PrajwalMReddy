import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import PersonModal from './networking/PersonModal';

const NETWORKING_API = '/api/networking/people';
const TODO_API = '/api/todo';

function normalizeWebsiteUrl(input = '') {
    let val = input.trim();
    if (!val) return '';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('linkedin.com')) return `https://${val}`;
    return `https://${val}`;
}

function extractPersonTags(person) {
    if (!person) return [];
    const raw = person.tags;
    if (Array.isArray(raw)) {
        return raw
            .flatMap((t) => String(t || '').split(','))
            .map((s) => s.trim().replace(/^#/, ''))
            .filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw
            .split(',')
            .map((s) => s.trim().replace(/^#/, ''))
            .filter(Boolean);
    }
    return [];
}

function parseDateKey(val) {
    if (!val) return null;
    if (val instanceof Date) {
        return val.toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    if (!str) return null;
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[1]}-${match[2]}-${match[3]}`;
    }
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
    }
    return null;
}

function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getFollowUpDisplay(person, t, formatDate) {
    if (!person || person.followUpStatus === 'completed' || person.followUpStatus === 'none') return null;
    
    const scheduledDate = parseDateKey(person.followUpScheduledDate);
    const dueDate = parseDateKey(person.followUpDueDate || person.nextFollowUpAt);
    const rawNotes = (person.followUpNotes || '').trim();
    const isDefaultTitle = rawNotes.toLowerCase() === `follow up with ${person.name || ''}`.trim().toLowerCase();
    const hasCustomFollowUpNotes = Boolean(rawNotes && !isDefaultTitle);
    const isConfigured = Boolean(scheduledDate || dueDate || hasCustomFollowUpNotes || person.followUpStatus === 'pending');
    
    if (!isConfigured) return null;

    const todayStr = getTodayString();
    
    // 1. Scheduled date is when to show the task on the Todo list / networking card
    // If scheduled date is in the future (> todayStr), do NOT show it on the card yet
    if (scheduledDate && scheduledDate > todayStr) {
        return null;
    }

    const defaultTitle = t('admin.networkingSection.taskTitlePlaceholder', 'Follow up with {name}').replace('{name}', person.name || t('admin.networkingSection.contactFallback', 'contact'));
    const title = person.followUpNotes || defaultTitle;

    // 2. Due by date is when I should do it by
    // If dueDate is in the past (< todayStr), it is OVERDUE
    if (dueDate && dueDate < todayStr) {
        return {
            isOverdue: true,
            label: t('admin.networkingSection.overdue', 'Overdue'),
            date: formatDate ? formatDate(dueDate) : dueDate,
            title,
        };
    }

    // 3. If dueDate is today
    if (dueDate && dueDate === todayStr) {
        return {
            isOverdue: false,
            label: t('admin.networkingSection.dueToday', 'Due Today'),
            date: formatDate ? formatDate(dueDate) : dueDate,
            title,
        };
    }

    // 4. If dueDate is upcoming (and scheduled date is in past/today or blank)
    if (dueDate) {
        return {
            isOverdue: false,
            label: t('admin.networkingSection.dueDateLabel', 'Due:').replace(/:$/, ''),
            date: formatDate ? formatDate(dueDate) : dueDate,
            title,
        };
    }

    // 5. If no dueDate, but scheduledDate has arrived
    if (scheduledDate) {
        return {
            isOverdue: false,
            label: scheduledDate === todayStr ? t('admin.networkingSection.followUpToday', 'Follow-up Today') : t('admin.networkingSection.followUpBadge', 'Follow-up'),
            date: formatDate ? formatDate(scheduledDate) : scheduledDate,
            title,
        };
    }

    // 6. If neither scheduledDate nor dueDate is set, but follow-up is active
    return {
        isOverdue: false,
        label: t('admin.networkingSection.followUpBadge', 'Follow-up'),
        date: '',
        title,
    };
}

const SELECTED_TAGS_KEY = 'admin_networking_selected_tags';

const NetworkingAdmin = () => {
    const { t, formatDate, formatNumber } = useContent();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [search, setSearch] = useState('');

    // Form state (Add Person)
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        whereMet: '',
        tags: '',
        notes: '',
    });

    // Tag filter state
    const [selectedTags, setSelectedTags] = useState(() => {
        try {
            const saved = localStorage.getItem(SELECTED_TAGS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return new Set(parsed.map((s) => String(s).toLowerCase()));
                }
            }
        } catch {
            // ignore localStorage parse error
        }
        return new Set();
    });
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [tagFilterSearch, setTagFilterSearch] = useState('');
    const tagDropdownRef = useRef(null);

    // Person Modal state (Edit Person & Follow-up)
    const [selectedPersonForModal, setSelectedPersonForModal] = useState(null);
    const formRef = useRef(null);

    const loadPeople = useCallback(async () => {
        try {
            setError('');
            const res = await fetch(NETWORKING_API, {
                credentials: 'include',
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || t('admin.networkingSection.loadingContacts', 'Failed to load networking contacts'));
            }

            const rawPeople = Array.isArray(data.people) ? data.people : [];
            setPeople(rawPeople);
        } catch (err) {
            setError(err.message || t('admin.networkingSection.loadingContacts', 'Error fetching contacts'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        document.title = t('pageTitles.adminNetworking', 'Networking | Admin | Prajwal Reddy');
    }, [t]);

    useEffect(() => {
        loadPeople();
    }, [loadPeople]);

    // Persist selected tags to localStorage
    useEffect(() => {
        try {
            localStorage.setItem(
                SELECTED_TAGS_KEY,
                JSON.stringify(Array.from(selectedTags))
            );
        } catch {
            // ignore storage error
        }
    }, [selectedTags]);

    // Close tag dropdown on click outside or Escape
    useEffect(() => {
        if (!isTagDropdownOpen) return;
        const handleClickOutside = (e) => {
            if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
                setIsTagDropdownOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsTagDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isTagDropdownOpen]);

    // Available tags aggregated from all people
    const allAvailableTags = useMemo(() => {
        const tagMap = new Map();
        people.forEach((person) => {
            const personTags = extractPersonTags(person);
            personTags.forEach((tag) => {
                const lower = tag.toLowerCase();
                if (tagMap.has(lower)) {
                    tagMap.get(lower).count += 1;
                } else {
                    tagMap.set(lower, {
                        key: lower,
                        label: tag,
                        count: 1,
                    });
                }
            });
        });
        return Array.from(tagMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [people]);

    const filteredDropdownTags = useMemo(() => {
        const q = tagFilterSearch.trim().toLowerCase();
        if (!q) return allAvailableTags;
        return allAvailableTags.filter((t) => t.label.toLowerCase().includes(q));
    }, [allAvailableTags, tagFilterSearch]);

    const toggleTag = useCallback((tagKey) => {
        setSelectedTags((prev) => {
            const next = new Set(prev);
            if (next.has(tagKey)) {
                next.delete(tagKey);
            } else {
                next.add(tagKey);
            }
            return next;
        });
    }, []);

    const selectAllTags = useCallback(() => {
        const allKeys = new Set(allAvailableTags.map((t) => t.key));
        setSelectedTags(allKeys);
    }, [allAvailableTags]);

    const clearAllTags = useCallback(() => {
        setSelectedTags(new Set());
    }, []);

    // Filtered People by Search Query & Selected Tags
    const searchFilteredPeople = useMemo(() => {
        const query = search.trim().toLowerCase();

        return people.filter((person) => {
            const personTags = extractPersonTags(person);

            if (selectedTags.size > 0) {
                const lowerTags = personTags.map((t) => t.toLowerCase());
                const hasMatchingTag = lowerTags.some((t) => selectedTags.has(t));
                if (!hasMatchingTag) {
                    return false;
                }
            }

            if (!query) return true;

            const nameMatch = (person.name || '').toLowerCase().includes(query);
            const whereMetMatch = (person.whereMet || person.howMet || '').toLowerCase().includes(query);
            const notesMatch = (person.notes || '').toLowerCase().includes(query);
            const websiteMatch = (person.website || person.linkedin || '').toLowerCase().includes(query);
            const roleMatch = (person.role || '').toLowerCase().includes(query);
            const companyMatch = (person.company || '').toLowerCase().includes(query);
            const emailMatch = (person.email || '').toLowerCase().includes(query);
            const locationMatch = (person.location || '').toLowerCase().includes(query);
            const followUpMatch = (person.followUpNotes || '').toLowerCase().includes(query);
            const contactedMatch = (person.lastInteractionAt || '').toLowerCase().includes(query);
            const tagMatch = personTags.some((t) => t.toLowerCase().includes(query));

            return (
                nameMatch ||
                whereMetMatch ||
                notesMatch ||
                websiteMatch ||
                roleMatch ||
                companyMatch ||
                emailMatch ||
                locationMatch ||
                followUpMatch ||
                contactedMatch ||
                tagMatch
            );
        });
    }, [people, search, selectedTags]);

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = formData.name.trim();
        if (!trimmedName) {
            setFormError(t('admin.networkingSection.nameRequiredError', 'Please enter a name.'));
            return;
        }

        try {
            setSubmitting(true);
            setFormError('');

            const normalizedUrl = normalizeWebsiteUrl(formData.website);
            const parsedTags = typeof formData.tags === 'string'
                ? formData.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean)
                : (Array.isArray(formData.tags) ? formData.tags : []);

            const payload = {
                name: trimmedName,
                website: normalizedUrl,
                linkedin: normalizedUrl,
                whereMet: formData.whereMet.trim(),
                tags: parsedTags,
                notes: formData.notes.trim(),
            };

            const res = await fetch(NETWORKING_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save contact');
            }

            // Reset form
            setFormData({
                name: '',
                website: '',
                whereMet: '',
                tags: '',
                notes: '',
            });
            await loadPeople();
        } catch (err) {
            setFormError(err.message || 'Failed to save contact');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResetForm = () => {
        setFormData({
            name: '',
            website: '',
            whereMet: '',
            tags: '',
            notes: '',
        });
        setFormError('');
    };

    const handleSavePersonModal = async (id, payload) => {
        try {
            const res = await fetch(`${NETWORKING_API}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update contact');
            }

            setSelectedPersonForModal(null);
            await loadPeople();
        } catch (err) {
            alert(err.message || 'Failed to update contact');
        }
    };

    const handleDeletePerson = async (person) => {
        if (!person) return;
        const confirmMsg = t('admin.networkingSection.deleteConfirm', 'Are you sure you want to delete {name}?').replace('{name}', person.name || 'this contact');
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch(`${NETWORKING_API}/${person.id}`, {
                method: 'DELETE',
                credentials: 'include',
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to delete contact');
            }

            setSelectedPersonForModal(null);
            await loadPeople();
        } catch (err) {
            alert(err.message || 'Failed to delete contact');
        }
    };

    const hasFormData = Boolean(formData.name || formData.website || formData.whereMet || formData.tags || formData.notes);

    return (
        <AdminLayout title={t('admin.networkingSection.title', 'Networking Manager')}>
            <div className="admin-networking-page">
                {/* Add Person Card Form */}
                <div className="admin-networking-form-card">
                    <form
                        ref={formRef}
                        className="admin-networking-form"
                        onSubmit={handleFormSubmit}
                    >
                        <h3 className="admin-networking-form-title">
                            {t('admin.networkingSection.addPerson', 'Add Person')}
                        </h3>

                        {/* Row 1: 4 Fields (Name, Website, Where Met, Tags) */}
                        <div className="admin-networking-form-row">
                            <label className="admin-networking-form-field">
                                <span>{t('admin.networkingSection.name', 'Name *')}</span>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.namePlaceholder', 'e.g. Aditya Reddy')}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </label>

                            <label className="admin-networking-form-field">
                                <span>{t('admin.networkingSection.website', 'Website')}</span>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.websitePlaceholder', 'e.g. example.com')}
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                />
                            </label>

                            <label className="admin-networking-form-field">
                                <span>{t('admin.networkingSection.whereMet', 'Where I Met Them')}</span>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.whereMetPlaceholder', 'e.g. House, Tech Summit')}
                                    value={formData.whereMet}
                                    onChange={(e) => setFormData({ ...formData, whereMet: e.target.value })}
                                />
                            </label>

                            <label className="admin-networking-form-field">
                                <span>{t('admin.networkingSection.tags', 'Tags')}</span>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.tagsPlaceholder', 'e.g. alumni, ai, mentor')}
                                    value={formData.tags}
                                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                    autoComplete="off"
                                />
                            </label>
                        </div>

                        {/* Row 2: Notes Field with Add Person next to it */}
                        <div className="admin-networking-form-bottom-row">
                            <label className="admin-networking-form-field admin-networking-form-field-notes">
                                <span>{t('admin.networkingSection.notes', 'Notes')}</span>
                                <textarea
                                    rows={2}
                                    placeholder={t('admin.networkingSection.notesPlaceholder', 'Notes, background, or discussion topics...')}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </label>

                            <div className="admin-networking-form-actions-inline">
                                {hasFormData && (
                                    <button
                                        type="button"
                                        className="admin-networking-btn-cancel"
                                        onClick={handleResetForm}
                                    >
                                        {t('admin.networkingSection.cancel', 'Cancel')}
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="admin-networking-btn-submit"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? t('admin.networkingSection.saving', 'Saving...')
                                        : t('admin.networkingSection.addPersonBtn', 'Add Person')}
                                </button>
                            </div>
                        </div>

                        {formError && <p className="admin-error" style={{ marginTop: '0.5rem' }}>{formError}</p>}
                    </form>
                </div>

                {/* Controls Group: Search Bar & Tag Filter Dropdown */}
                <div className="admin-todo-controls-group admin-networking-controls-group">
                    <div className="admin-todo-search-wrap">
                        <span className="admin-todo-search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.networkingSection.searchPlaceholder', 'Search contacts...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape' && search) {
                                    e.stopPropagation();
                                    setSearch('');
                                }
                            }}
                            className="admin-todo-search-input"
                            aria-label={t('admin.networkingSection.searchAriaLabel', 'Search contacts')}
                        />
                        {search && (
                            <button
                                type="button"
                                className="admin-todo-search-clear"
                                onClick={() => setSearch('')}
                                aria-label={t('admin.networkingSection.clearSearch', 'Clear search')}
                                title={t('admin.networkingSection.clearSearch', 'Clear search')}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Tag Filter Dropdown Button & Popover */}
                    <div className="admin-todo-tag-filter-wrap" ref={tagDropdownRef}>
                        <button
                            type="button"
                            className={`admin-todo-tag-filter-btn ${selectedTags.size > 0 ? 'has-active' : ''} ${isTagDropdownOpen ? 'is-open' : ''}`}
                            onClick={() => setIsTagDropdownOpen((prev) => !prev)}
                            aria-expanded={isTagDropdownOpen}
                            title={t('admin.networkingSection.filterByTags', 'Filter by Tags')}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                <line x1="7" y1="7" x2="7.01" y2="7" />
                            </svg>
                            <span>{t('admin.networkingSection.tags', 'Tags')}</span>
                            {selectedTags.size > 0 && (
                                <span className="admin-todo-tag-filter-badge">
                                    {formatNumber(selectedTags.size)}
                                </span>
                            )}
                            <svg className={`admin-todo-tag-filter-arrow ${isTagDropdownOpen ? 'rotated' : ''}`} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isTagDropdownOpen && (
                            <div className="admin-todo-tag-dropdown-menu">
                                <div className="admin-todo-tag-dropdown-header">
                                    <span className="admin-todo-tag-dropdown-title">
                                        {t('admin.networkingSection.filterByTags', 'Filter by Tags')}
                                    </span>
                                </div>

                                {allAvailableTags.length > 5 && (
                                    <div className="admin-todo-tag-dropdown-search">
                                        <input
                                            type="text"
                                            placeholder={t('admin.networkingSection.searchTagsPlaceholder', 'Search tags...')}
                                            value={tagFilterSearch}
                                            onChange={(e) => setTagFilterSearch(e.target.value)}
                                            className="admin-todo-tag-dropdown-search-input"
                                            autoFocus
                                        />
                                    </div>
                                )}

                                <div className="admin-todo-tag-dropdown-list">
                                    {allAvailableTags.length === 0 ? (
                                        <div className="admin-todo-tag-dropdown-empty">
                                            {t('admin.networkingSection.noTagsFound', 'No tags created yet')}
                                        </div>
                                    ) : filteredDropdownTags.length === 0 ? (
                                        <div className="admin-todo-tag-dropdown-empty">
                                            {t('admin.networkingSection.noMatchingTags', 'No matching tags')}
                                        </div>
                                    ) : (
                                        filteredDropdownTags.map((tag) => {
                                            const isSelected = selectedTags.has(tag.key);
                                            return (
                                                <button
                                                    key={tag.key}
                                                    type="button"
                                                    className={`admin-todo-tag-dropdown-item ${isSelected ? 'is-selected' : ''}`}
                                                    onClick={() => toggleTag(tag.key)}
                                                >
                                                    <span className={`admin-todo-tag-checkbox ${isSelected ? 'checked' : ''}`}>
                                                        {isSelected && (
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                    <span className="admin-todo-tag-dropdown-item-name">
                                                        {tag.label}
                                                    </span>
                                                    <span className="admin-todo-tag-dropdown-item-count">
                                                        {formatNumber(tag.count)}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {allAvailableTags.length > 0 && (
                                    <div className="admin-todo-tag-dropdown-footer">
                                        <span className="admin-todo-tag-dropdown-summary">
                                            {t('admin.networkingSection.selectedCount', '{count} selected').replace('{count}', formatNumber(selectedTags.size))}
                                        </span>
                                        <div className="admin-todo-tag-dropdown-footer-actions">
                                            {selectedTags.size < allAvailableTags.length && (
                                                <button
                                                    type="button"
                                                    className="admin-todo-tag-dropdown-select-all-btn"
                                                    onClick={selectAllTags}
                                                >
                                                    {t('admin.networkingSection.selectAllTags', 'Select All')}
                                                </button>
                                            )}
                                            {selectedTags.size > 0 && (
                                                <button
                                                    type="button"
                                                    className="admin-todo-tag-dropdown-clear-btn"
                                                    onClick={clearAllTags}
                                                >
                                                    {t('admin.networkingSection.clearTags', 'Clear')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{ color: '#dc2626', background: 'rgba(239,68,68,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                {/* Contact Cards Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
                        {t('admin.networkingSection.loadingContacts', 'Loading contacts...')}
                    </div>
                ) : people.length === 0 ? (
                    <p className="admin-empty">
                        {t('admin.networkingSection.noContacts', 'No contacts yet. Add your first one above.')}
                    </p>
                ) : searchFilteredPeople.length === 0 ? (
                    <p className="admin-empty">
                        {selectedTags.size > 0 && search
                            ? t('admin.networkingSection.noMatchingFilterContacts', 'No contacts match your search and tag filters.')
                            : selectedTags.size > 0
                            ? t('admin.networkingSection.noMatchingTagContacts', 'No contacts match this tag filter.')
                            : t('admin.networkingSection.noMatch', 'No contacts match your current search.')}
                    </p>
                ) : (
                    <div className="admin-networking-grid">
                        {searchFilteredPeople.map((person) => {
                            const whereMet = person.whereMet || person.howMet;
                            const followUpInfo = getFollowUpDisplay(person, t, formatDate);

                            return (
                                <div
                                    key={person.id}
                                    className={`admin-networking-card ${followUpInfo?.isOverdue ? 'has-overdue' : followUpInfo ? 'has-followup' : ''}`}
                                >
                                    {/* Top: Name, LinkedIn & Met on the same line */}
                                    <div className="admin-networking-card-top">
                                        <div className="admin-networking-card-header-info">
                                            <h4 className="admin-networking-card-name">
                                                {person.name}
                                            </h4>

                                            {(person.website || person.linkedin || whereMet || person.lastInteractionAt) && (
                                                <div className="admin-networking-card-meta-row">
                                                    {(person.website || person.linkedin) && (
                                                        <a
                                                            href={person.website || person.linkedin}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="admin-networking-website-link admin-networking-linkedin-link"
                                                            title={t('admin.networkingSection.website', 'Website')}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="2" y1="12" x2="22" y2="12" />
                                                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                                            </svg>
                                                            {t('admin.networkingSection.website', 'Website')}
                                                        </a>
                                                    )}

                                                    {person.lastInteractionAt && (
                                                        <div className="admin-networking-met-badge">
                                                            <span className="admin-networking-met-prefix">{t('admin.networkingSection.contactedLabel', 'Contacted:')}</span> {formatDate(person.lastInteractionAt)}
                                                        </div>
                                                    )}

                                                    {whereMet && (
                                                        <div className="admin-networking-met-badge">
                                                            <span className="admin-networking-met-prefix">{t('admin.networkingSection.metLabel', 'Met:')}</span> {whereMet}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Follow-up / Overdue Banner (Visible once scheduled date is reached) */}
                                    {followUpInfo && (
                                        <div
                                            className={followUpInfo.isOverdue ? 'admin-networking-card-overdue' : 'admin-networking-card-followup'}
                                            onClick={() => setSelectedPersonForModal(person)}
                                            title={t('admin.networkingSection.editBtn', 'Edit')}
                                        >
                                            <span className={followUpInfo.isOverdue ? 'admin-networking-card-overdue-badge' : 'admin-networking-card-followup-badge'}>
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    {followUpInfo.isOverdue ? (
                                                        <>
                                                            <circle cx="12" cy="12" r="10" />
                                                            <line x1="12" y1="8" x2="12" y2="12" />
                                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <circle cx="12" cy="12" r="10" />
                                                            <polyline points="12 6 12 12 16 14" />
                                                        </>
                                                    )}
                                                </svg>
                                                {followUpInfo.label}{followUpInfo.date ? ` (${followUpInfo.date})` : ''}
                                            </span>
                                            <span className={followUpInfo.isOverdue ? 'admin-networking-card-overdue-title' : 'admin-networking-card-followup-title'}>
                                                {followUpInfo.title}
                                            </span>
                                        </div>
                                    )}

                                    {/* Middle: Notes box */}
                                    <div className="admin-networking-notes-box">
                                        {person.notes || <span className="admin-networking-notes-empty">{t('admin.networkingSection.noNotesEmpty', 'No notes')}</span>}
                                    </div>

                                    {/* Bottom: Tags on left, Edit & Delete on right */}
                                    <div className="admin-networking-card-footer">
                                        <div className="admin-networking-card-tags">
                                            {extractPersonTags(person).map((tagStr, idx) => {
                                                const isTagSelected = selectedTags.has(tagStr.toLowerCase());
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        className={`admin-networking-tag-badge ${isTagSelected ? 'is-active' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTag(tagStr.toLowerCase());
                                                        }}
                                                        title={isTagSelected ? `Active tag filter: ${tagStr}` : `Filter by tag: ${tagStr}`}
                                                    >
                                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                                                            <line x1="7" y1="7" x2="7.01" y2="7" />
                                                        </svg>
                                                        <span>{tagStr}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="admin-networking-card-actions">
                                            <button
                                                type="button"
                                                className="admin-networking-card-btn admin-networking-card-btn-edit"
                                                onClick={() => setSelectedPersonForModal(person)}
                                                title={t('admin.networkingSection.editBtn', 'Edit')}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                                <span>{t('admin.networkingSection.editBtn', 'Edit')}</span>
                                            </button>

                                            <button
                                                type="button"
                                                className="admin-networking-card-btn admin-networking-card-btn-delete"
                                                onClick={() => handleDeletePerson(person)}
                                                title={t('admin.networkingSection.deleteBtn', 'Delete')}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                                <span>{t('admin.networkingSection.deleteBtn', 'Delete')}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Full View Modal for Editing Person & Follow-up */}
            <PersonModal
                person={selectedPersonForModal}
                isOpen={Boolean(selectedPersonForModal)}
                onClose={() => {
                    setSelectedPersonForModal(null);
                    loadPeople();
                }}
                onSave={handleSavePersonModal}
                onDelete={handleDeletePerson}
            />
        </AdminLayout>
    );
};

export default NetworkingAdmin;
