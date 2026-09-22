import React, { useState, useEffect } from 'react';
import { useContent } from '../../../utils/ContentContext';

function normalizeLinkedInUrl(input = '') {
    let val = input.trim();
    if (!val) return '';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('linkedin.com')) return `https://${val}`;
    if (!val.includes('/')) return `https://linkedin.com/in/${val}`;
    return `https://${val}`;
}

function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const PersonModal = ({ person, isOpen, onClose, onSave, onDelete }) => {
    const { t } = useContent();

    const [draft, setDraft] = useState({
        name: '',
        linkedin: '',
        whereMet: '',
        lastContacted: '',
        notes: '',
        followUpTitle: '',
        followUpScheduledDate: '',
        followUpDueDate: '',
        syncTodo: true,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (person) {
            const hasExistingSync = person.syncTodo !== undefined ? Boolean(person.syncTodo) : Boolean(person.todoId);
            setDraft({
                name: person.name || '',
                linkedin: person.linkedin || '',
                whereMet: person.whereMet || person.howMet || '',
                lastContacted: person.lastContacted || person.dateMet || '',
                notes: person.notes || '',
                followUpTitle: person.followUpNotes || (person.name ? `Follow up with ${person.name}` : ''),
                followUpScheduledDate: person.followUpScheduledDate || '',
                followUpDueDate: person.followUpDueDate || person.nextFollowUpAt || '',
                syncTodo: hasExistingSync,
            });
        }
        setError('');
    }, [person, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, draft, onClose]);

    if (!isOpen || !person) return null;

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const trimmedName = draft.name.trim();
        if (!trimmedName) {
            setError(t('admin.networkingSection.nameRequiredError', 'Please enter a name.'));
            return;
        }

        try {
            setSubmitting(true);
            setError('');

            const followUpDueVal = draft.followUpDueDate ? draft.followUpDueDate.trim() : null;
            const followUpScheduledVal = draft.followUpScheduledDate ? draft.followUpScheduledDate.trim() : null;
            const followUpTitleVal = draft.followUpTitle.trim();

            const isFollowUpConfigured = Boolean(followUpDueVal || followUpScheduledVal || followUpTitleVal);

            const payload = {
                name: trimmedName,
                linkedin: normalizeLinkedInUrl(draft.linkedin),
                whereMet: draft.whereMet.trim(),
                notes: draft.notes.trim(),
                lastContacted: draft.lastContacted ? draft.lastContacted.trim() : null,
                dateMet: draft.lastContacted ? draft.lastContacted.trim() : null,
                lastInteractionAt: draft.lastContacted ? draft.lastContacted.trim() : null,
                nextFollowUpAt: isFollowUpConfigured ? (followUpDueVal || followUpScheduledVal || null) : null,
                followUpDueDate: isFollowUpConfigured ? followUpDueVal : null,
                followUpScheduledDate: isFollowUpConfigured ? followUpScheduledVal : null,
                followUpNotes: isFollowUpConfigured ? (followUpTitleVal || `Follow up with ${trimmedName}`) : '',
                followUpStatus: isFollowUpConfigured ? (person.followUpStatus && person.followUpStatus !== 'none' ? person.followUpStatus : 'pending') : 'none',
                syncTodo: Boolean(draft.syncTodo && isFollowUpConfigured),
            };

            await onSave(person.id, payload);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to update contact');
        } finally {
            setSubmitting(false);
        }
    };

    const handleClearFollowUp = () => {
        setDraft((prev) => ({
            ...prev,
            followUpTitle: '',
            followUpScheduledDate: '',
            followUpDueDate: '',
            syncTodo: false,
        }));
    };

    const handleDelete = async () => {
        const confirmMsg = t('admin.networkingSection.deleteConfirm', 'Are you sure you want to delete {name}?').replace('{name}', person.name);
        if (window.confirm(confirmMsg)) {
            await onDelete(person);
            onClose();
        }
    };

    const displayName = draft.name || person.name || t('admin.networkingSection.personDetails', 'Contact Details');

    return (
        <div className="admin-todo-modal-overlay" onClick={onClose}>
            <div className="admin-todo-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header without Avatar */}
                <div className="admin-todo-modal-header" style={{ alignItems: 'center' }}>
                    <h3 className="admin-todo-modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                    </h3>
                    <button
                        type="button"
                        className="admin-todo-modal-close"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="admin-todo-modal-body">
                    <form className="admin-todo-modal-form" onSubmit={handleSave}>
                        {/* Row 1: Name & LinkedIn */}
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.name', 'Name *')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.namePlaceholder', 'e.g. John Doe')}
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.linkedin', 'LinkedIn')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.linkedinPlaceholder', 'e.g. linkedin.com/in/username')}
                                    value={draft.linkedin}
                                    onChange={(e) => setDraft({ ...draft, linkedin: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Row 2: Where Met & Last Contacted */}
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.whereMet', 'Where I Met Them')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.whereMetPlaceholder', 'e.g. Tech Summit, mutual friend')}
                                    value={draft.whereMet}
                                    onChange={(e) => setDraft({ ...draft, whereMet: e.target.value })}
                                />
                            </div>

                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.lastContacted', 'Last Contacted')}</label>
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                    <input
                                        type="date"
                                        value={draft.lastContacted}
                                        onChange={(e) => setDraft({ ...draft, lastContacted: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="admin-networking-today-btn"
                                        onClick={() => setDraft({ ...draft, lastContacted: getTodayString() })}
                                        title={t('admin.networkingSection.today', 'Today')}
                                    >
                                        {t('admin.networkingSection.today', 'Today')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Notes Field */}
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.networkingSection.notes', 'Notes')}</label>
                            <textarea
                                rows={3}
                                placeholder={t('admin.networkingSection.notesPlaceholder', 'Notes, background, or discussion topics...')}
                                value={draft.notes}
                                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            />
                        </div>

                        {/* Cleaned-up Follow-up Section */}
                        <div className="admin-networking-followup-card">
                            <div className="admin-networking-followup-header">
                                <div className="admin-networking-followup-title-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-networking-followup-icon">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <h4 className="admin-networking-followup-title">
                                        {t('admin.networkingSection.followUpSectionTitle', 'Follow-up & Next Steps')}
                                    </h4>
                                </div>
                                {Boolean(draft.followUpTitle || draft.followUpScheduledDate || draft.followUpDueDate) && (
                                    <button
                                        type="button"
                                        className="admin-networking-followup-clear-btn"
                                        onClick={handleClearFollowUp}
                                    >
                                        {t('admin.networkingSection.clearFollowUp', 'Clear Follow-up')}
                                    </button>
                                )}
                            </div>

                            <div className="admin-todo-modal-field" style={{ marginTop: '0.75rem' }}>
                                <label>{t('admin.networkingSection.taskTitle', 'Follow-up Task Name')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.taskTitlePlaceholder', 'e.g. Follow up with {name}').replace('{name}', draft.name || 'contact')}
                                    value={draft.followUpTitle}
                                    onChange={(e) => setDraft({ ...draft, followUpTitle: e.target.value })}
                                />
                            </div>

                            <div className="admin-todo-modal-row" style={{ marginTop: '0.75rem' }}>
                                <div className="admin-todo-modal-field">
                                    <label>{t('admin.networkingSection.scheduledDate', 'Scheduled Date (When to show task)')}</label>
                                    <input
                                        type="date"
                                        value={draft.followUpScheduledDate}
                                        onChange={(e) => setDraft({ ...draft, followUpScheduledDate: e.target.value })}
                                    />
                                </div>
                                <div className="admin-todo-modal-field">
                                    <label>{t('admin.networkingSection.dueDate', 'Due Date (When to do by)')}</label>
                                    <input
                                        type="date"
                                        value={draft.followUpDueDate}
                                        onChange={(e) => setDraft({ ...draft, followUpDueDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <label className="admin-networking-followup-sync">
                                <input
                                    type="checkbox"
                                    checked={draft.syncTodo}
                                    onChange={(e) => setDraft({ ...draft, syncTodo: e.target.checked })}
                                />
                                <span>{t('admin.networkingSection.syncWithTodo', 'Sync / Add to To-Do List')}</span>
                            </label>
                        </div>

                        {error && (
                            <p className="admin-error" style={{ color: '#dc2626', margin: 0 }}>{error}</p>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="admin-todo-modal-footer">
                    <button
                        type="button"
                        className="admin-todo-modal-btn"
                        onClick={handleDelete}
                        disabled={submitting}
                        style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#dc2626',
                            marginRight: 'auto',
                        }}
                    >
                        {t('admin.networkingSection.deleteBtn', 'Delete')}
                    </button>
                    <button
                        type="button"
                        className="admin-todo-modal-btn admin-todo-modal-btn-cancel"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        {t('admin.networkingSection.cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        className="admin-todo-modal-btn admin-todo-modal-btn-save"
                        onClick={handleSave}
                        disabled={submitting}
                    >
                        {submitting ? t('admin.networkingSection.saving', 'Saving...') : t('admin.networkingSection.saveChanges', 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonModal;
