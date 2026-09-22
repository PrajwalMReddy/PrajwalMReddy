import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import PersonModal from './networking/PersonModal';

const NETWORKING_API = '/api/networking/people';
const TODO_API = '/api/todo';

function normalizeLinkedInUrl(input = '') {
    let val = input.trim();
    if (!val) return '';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('linkedin.com')) return `https://${val}`;
    if (!val.includes('/')) return `https://linkedin.com/in/${val}`;
    return `https://${val}`;
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

function getFollowUpDisplay(person) {
    if (!person || person.followUpStatus === 'completed') return null;
    
    const scheduledDate = parseDateKey(person.followUpScheduledDate);
    const dueDate = parseDateKey(person.followUpDueDate || person.nextFollowUpAt);
    const hasFollowUpNotes = Boolean(person.followUpNotes && person.followUpNotes.trim());
    const isConfigured = Boolean(scheduledDate || dueDate || hasFollowUpNotes || (person.followUpStatus && person.followUpStatus !== 'none'));
    
    if (!isConfigured) return null;

    const todayStr = getTodayString();
    
    // 1. Scheduled date is when to show the task on the Todo list / networking card
    // If scheduled date is in the future (> todayStr), do NOT show it on the card yet
    if (scheduledDate && scheduledDate > todayStr) {
        return null;
    }

    const title = person.followUpNotes || `Follow up with ${person.name || 'contact'}`;

    // 2. Due by date is when I should do it by
    // If dueDate is in the past (< todayStr), it is OVERDUE
    if (dueDate && dueDate < todayStr) {
        return {
            isOverdue: true,
            label: 'Overdue',
            date: dueDate,
            title,
        };
    }

    // 3. If dueDate is today
    if (dueDate && dueDate === todayStr) {
        return {
            isOverdue: false,
            label: 'Due Today',
            date: dueDate,
            title,
        };
    }

    // 4. If dueDate is upcoming (and scheduled date is in past/today or blank)
    if (dueDate) {
        return {
            isOverdue: false,
            label: 'Due',
            date: dueDate,
            title,
        };
    }

    // 5. If no dueDate, but scheduledDate has arrived
    if (scheduledDate) {
        return {
            isOverdue: false,
            label: scheduledDate === todayStr ? 'Follow-up Today' : 'Follow-up',
            date: scheduledDate,
            title,
        };
    }

    // 6. If neither scheduledDate nor dueDate is set, but follow-up is active
    return {
        isOverdue: false,
        label: 'Follow-up',
        date: '',
        title,
    };
}

const NetworkingAdmin = () => {
    const { t } = useContent();
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [formError, setFormError] = useState('');
    const [search, setSearch] = useState('');

    // Form state (Add Person)
    const [formData, setFormData] = useState({
        name: '',
        linkedin: '',
        whereMet: '',
        notes: '',
    });

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

    // Filtered People by Search Query
    const searchFilteredPeople = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return people;

        return people.filter((person) => {
            const nameMatch = (person.name || '').toLowerCase().includes(query);
            const whereMetMatch = (person.whereMet || person.howMet || '').toLowerCase().includes(query);
            const notesMatch = (person.notes || '').toLowerCase().includes(query);
            const linkedinMatch = (person.linkedin || '').toLowerCase().includes(query);
            const followUpMatch = (person.followUpNotes || '').toLowerCase().includes(query);

            return nameMatch || whereMetMatch || notesMatch || linkedinMatch || followUpMatch;
        });
    }, [people, search]);

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

            const payload = {
                name: trimmedName,
                linkedin: normalizeLinkedInUrl(formData.linkedin),
                whereMet: formData.whereMet.trim(),
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
                linkedin: '',
                whereMet: '',
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
            linkedin: '',
            whereMet: '',
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
        const deleteMsg = t('admin.networkingSection.deleteConfirm', 'Are you sure you want to delete {name}?').replace('{name}', person.name);
        const confirmed = window.confirm(deleteMsg);
        if (!confirmed) return;

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

    const hasFormData = Boolean(formData.name || formData.linkedin || formData.whereMet || formData.notes);

    return (
        <AdminLayout title={t('admin.networkingSection.title', 'Networking Manager')}>
            <div className="admin-networking-page">
                {/* Add Person Card Form matching the reference screenshot */}
                <div className="admin-networking-form-card">
                    <form
                        ref={formRef}
                        className="admin-networking-form"
                        onSubmit={handleFormSubmit}
                    >
                        <h3 className="admin-networking-form-title">
                            {t('admin.networkingSection.addPerson', 'Add Person')}
                        </h3>

                        {/* Row 1: 3 Fields (Name, LinkedIn, Where Met) */}
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
                                <span>{t('admin.networkingSection.linkedin', 'LinkedIn')}</span>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.linkedinPlaceholder', 'e.g. linkedin.com/in/username')}
                                    value={formData.linkedin}
                                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
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

                {/* Full-width Search Bar */}
                <div className="admin-networking-search-bar">
                    <span className="admin-networking-search-icon" aria-hidden="true">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder={t('admin.networkingSection.searchPlaceholder', 'Search by name, LinkedIn, where met, notes...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape' && search) {
                                e.stopPropagation();
                                setSearch('');
                            }
                        }}
                        className="admin-networking-search-input"
                    />
                    {search && (
                        <button
                            type="button"
                            className="admin-networking-search-clear"
                            onClick={() => setSearch('')}
                            title={t('admin.networkingSection.clearSearch', 'Clear search')}
                        >
                            ✕
                        </button>
                    )}
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
                ) : searchFilteredPeople.length === 0 ? (
                    <div className="admin-networking-empty">
                        <p>
                            {search
                                ? t('admin.networkingSection.noMatch', 'No contacts match your current search.')
                                : t('admin.networkingSection.noContacts', 'No contacts yet. Add your first one above.')}
                        </p>
                    </div>
                ) : (
                    <div className="admin-networking-grid">
                        {searchFilteredPeople.map((person) => {
                            const whereMet = person.whereMet || person.howMet;
                            const followUpInfo = getFollowUpDisplay(person);

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

                                            {(person.linkedin || whereMet) && (
                                                <div className="admin-networking-card-meta-row">
                                                    {person.linkedin && (
                                                        <a
                                                            href={person.linkedin}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="admin-networking-linkedin-link"
                                                            title="LinkedIn"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.45 1.45 0 0 0 1.45-1.45 1.45 1.45 0 0 0-1.45-1.45 1.45 1.45 0 0 0-1.45 1.45c0 .8.65 1.45 1.45 1.45m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                                                            </svg>
                                                            LinkedIn
                                                        </a>
                                                    )}

                                                    {whereMet && (
                                                        <div className="admin-networking-met-badge">
                                                            <span className="admin-networking-met-prefix">Met:</span> {whereMet}
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
                                        {person.notes || <span className="admin-networking-notes-empty">No notes</span>}
                                    </div>

                                    {/* Bottom: Action Buttons Edit & Delete */}
                                    <div className="admin-networking-card-footer">
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
                                            {t('admin.networkingSection.editBtn', 'Edit')}
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
                                            {t('admin.networkingSection.deleteBtn', 'Delete')}
                                        </button>
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
                onClose={() => setSelectedPersonForModal(null)}
                onSave={handleSavePersonModal}
                onDelete={handleDeletePerson}
            />
        </AdminLayout>
    );
};

export default NetworkingAdmin;
