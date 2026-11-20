import React, { useState, useEffect } from 'react';
import { useContent } from '../../../utils/ContentContext';

function normalizeWebsiteUrl(input = '') {
    let val = input.trim();
    if (!val) return '';
    if (val.startsWith('http://') || val.startsWith('https://')) return val;
    if (val.startsWith('linkedin.com')) return `https://${val}`;
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
        website: '',
        whereMet: '',
        tags: [],
        notes: '',
        followUpTitle: '',
        followUpScheduledDate: '',
        followUpDueDate: '',
        syncTodo: true,
    });
    const [tagInput, setTagInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Interaction History state
    const [interactions, setInteractions] = useState([]);
    const [loadingInteractions, setLoadingInteractions] = useState(false);
    const [interactionDate, setInteractionDate] = useState(getTodayString());
    const [interactionText, setInteractionText] = useState('');
    const [addingInteraction, setAddingInteraction] = useState(false);

    useEffect(() => {
        if (person) {
            const isFollowUpActive = person.followUpStatus && person.followUpStatus !== 'none';
            const hasDates = Boolean(person.followUpScheduledDate || person.followUpDueDate || person.nextFollowUpAt);
            const rawNotes = (person.followUpNotes || '').trim();
            const isDefaultTitle = rawNotes.toLowerCase() === `follow up with ${person.name || ''}`.trim().toLowerCase();
            const followUpTitleToUse = (isFollowUpActive || hasDates || (!isDefaultTitle && rawNotes)) ? rawNotes : '';

            const hasExistingSync = person.syncTodo !== undefined ? Boolean(person.syncTodo) : Boolean(person.todoId);

            const rawTags = Array.isArray(person.tags)
                ? [...person.tags]
                : (typeof person.tags === 'string' ? person.tags.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean) : []);

            setDraft({
                name: person.name || '',
                website: person.website || person.linkedin || '',
                whereMet: person.whereMet || person.howMet || '',
                tags: rawTags,
                notes: person.notes || '',
                followUpTitle: followUpTitleToUse,
                followUpScheduledDate: (isFollowUpActive || hasDates) ? (person.followUpScheduledDate || '') : '',
                followUpDueDate: (isFollowUpActive || hasDates) ? (person.followUpDueDate || person.nextFollowUpAt || '') : '',
                syncTodo: (isFollowUpActive || hasDates) ? hasExistingSync : false,
            });
            setTagInput('');
        }
        setError('');
    }, [person, isOpen]);

    useEffect(() => {
        if (isOpen && person?.id) {
            setLoadingInteractions(true);
            fetch(`/api/networking/interactions?personId=${person.id}`, {
                credentials: 'include',
            })
                .then((res) => res.json())
                .then((data) => {
                    if (Array.isArray(data)) {
                        setInteractions(data);
                    } else {
                        setInteractions([]);
                    }
                })
                .catch(() => setInteractions([]))
                .finally(() => setLoadingInteractions(false));
        } else {
            setInteractions([]);
        }
        setInteractionDate(getTodayString());
        setInteractionText('');
    }, [person?.id, isOpen]);

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

    const handleAddTag = () => {
        const trimmed = tagInput.trim().replace(/^#/, '');
        if (!trimmed) return;
        const currentTags = Array.isArray(draft.tags) ? draft.tags : [];
        if (!currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
            setDraft({ ...draft, tags: [...currentTags, trimmed] });
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove) => {
        const currentTags = Array.isArray(draft.tags) ? draft.tags : [];
        setDraft({ ...draft, tags: currentTags.filter((t) => t !== tagToRemove) });
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleAddInteraction = async () => {
        const trimmed = interactionText.trim();
        if (!trimmed || !person?.id) return;

        try {
            setAddingInteraction(true);
            const dateVal = interactionDate ? interactionDate.trim() : getTodayString();
            const res = await fetch('/api/networking/interactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    personId: person.id,
                    date: dateVal,
                    summary: trimmed,
                    type: 'meeting',
                }),
            });
            const newDoc = await res.json();
            if (!res.ok) {
                throw new Error(newDoc.error || 'Failed to add interaction');
            }
            setInteractions((prev) => [newDoc, ...prev]);
            setInteractionText('');
            setInteractionDate(getTodayString());
        } catch (err) {
            setError(err.message || 'Failed to add interaction');
        } finally {
            setAddingInteraction(false);
        }
    };

    const handleDeleteInteraction = async (interactionId) => {
        if (!interactionId) return;
        try {
            const res = await fetch(`/api/networking/interactions/${interactionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (res.ok) {
                setInteractions((prev) => prev.filter((item) => item.id !== interactionId));
            }
        } catch (err) {
            console.error(t('logs.interactionDeleteError'), err);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        const trimmedName = draft.name.trim();
        if (!trimmedName) {
            setError(t('admin.networkingSection.nameRequiredError'));
            return;
        }

        try {
            setSubmitting(true);
            setError('');

            const followUpDueVal = draft.followUpDueDate ? draft.followUpDueDate.trim() : null;
            const followUpScheduledVal = draft.followUpScheduledDate ? draft.followUpScheduledDate.trim() : null;
            const followUpTitleVal = draft.followUpTitle.trim();

            const isFollowUpConfigured = Boolean(followUpDueVal || followUpScheduledVal || followUpTitleVal);

            const normalizedUrl = normalizeWebsiteUrl(draft.website);
            const parsedTags = Array.isArray(draft.tags)
                ? draft.tags.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean)
                : [];

            const payload = {
                name: trimmedName,
                website: normalizedUrl,
                linkedin: normalizedUrl,
                whereMet: draft.whereMet.trim(),
                tags: parsedTags,
                notes: draft.notes.trim(),
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

    const handleDelete = () => {
        if (person && onDelete) {
            onDelete(person);
        }
    };

    const displayName = draft.name || person.name || t('admin.networkingSection.personDetails');

    if (!isOpen || !person) return null;

    return (
        <div className="admin-todo-modal-overlay" onClick={onClose}>
            <div className="admin-todo-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="admin-todo-modal-header" style={{ alignItems: 'center' }}>
                    <h3 className="admin-todo-modal-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {displayName}
                    </h3>
                    <button
                        type="button"
                        className="admin-todo-modal-close"
                        onClick={onClose}
                        aria-label={t('admin.ui.personModal.closeModal')}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="admin-todo-modal-body">
                    <form className="admin-todo-modal-form" onSubmit={handleSave}>
                        {error && (
                            <div className="admin-error-banner" style={{ padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}

                        {/* Row 1: Name & Website */}
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.name')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.namePlaceholder')}
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="admin-todo-modal-field">
                                <label>{t('admin.networkingSection.website')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.websitePlaceholder')}
                                    value={draft.website}
                                    onChange={(e) => setDraft({ ...draft, website: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Row 2: Where Met */}
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.networkingSection.whereMet')}</label>
                            <input
                                type="text"
                                placeholder={t('admin.networkingSection.whereMetPlaceholder')}
                                value={draft.whereMet}
                                onChange={(e) => setDraft({ ...draft, whereMet: e.target.value })}
                            />
                        </div>

                        {/* Tags Section matching TodoModal */}
                        <div className="admin-todo-tags-section">
                            <label className="admin-todo-tags-label">
                                {t('admin.networkingSection.tags')} <span className="admin-todo-optional">({t('admin.networkingSection.optional')})</span>
                            </label>
                            <div className="admin-todo-tag-input-row">
                                <input
                                    type="text"
                                    className="admin-todo-tag-input"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder={t('admin.networkingSection.addTagPlaceholder')}
                                />
                                <button
                                    type="button"
                                    className="admin-todo-tag-add-btn"
                                    onClick={handleAddTag}
                                >
                                    {t('admin.networkingSection.addTagBtn')}
                                </button>
                            </div>
                            {Array.isArray(draft.tags) && draft.tags.length > 0 && (
                                <div className="admin-todo-tag-pills">
                                    {draft.tags.map((tag, idx) => (
                                        <span key={idx} className="admin-todo-tag-pill">
                                            {tag}
                                            <button
                                                type="button"
                                                className="admin-todo-tag-remove"
                                                onClick={() => handleRemoveTag(tag)}
                                                aria-label={t('admin.ui.personModal.removeTag', { p0: tag })}
                                                title={t('admin.ui.personModal.removeTag2')}
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Notes Field */}
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.networkingSection.notes')}</label>
                            <textarea
                                rows={3}
                                placeholder={t('admin.networkingSection.notesPlaceholder')}
                                value={draft.notes}
                                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            />
                        </div>

                        {/* Interaction History Section */}
                        <div className="admin-networking-interactions-card">
                            <div className="admin-networking-interactions-header">
                                <div className="admin-networking-interactions-title-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-networking-interactions-icon">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <h4 className="admin-networking-interactions-title">
                                        {t('admin.networkingSection.interactionHistoryTitle')}
                                    </h4>
                                </div>
                                {interactions.length > 0 && (
                                    <span className="admin-networking-interactions-count">{interactions.length}</span>
                                )}
                            </div>

                            {/* One-liner input with attached date */}
                            <div className="admin-networking-interaction-add-row">
                                <input
                                    type="date"
                                    className="admin-networking-interaction-date-input"
                                    value={interactionDate}
                                    onChange={(e) => setInteractionDate(e.target.value)}
                                    title={t('admin.ui.personModal.interactionDate')}
                                />
                                <input
                                    type="text"
                                    className="admin-networking-interaction-text-input"
                                    placeholder={t('admin.networkingSection.addInteractionPlaceholder')}
                                    value={interactionText}
                                    onChange={(e) => setInteractionText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleAddInteraction();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="admin-networking-interaction-add-btn"
                                    onClick={handleAddInteraction}
                                    disabled={addingInteraction || !interactionText.trim()}
                                >
                                    {addingInteraction ? '...' : t('admin.networkingSection.addInteractionBtn')}
                                </button>
                            </div>

                            {/* Interaction List */}
                            <div className="admin-networking-interactions-list">
                                {loadingInteractions ? (
                                    <p className="admin-networking-interactions-empty">
                                        {t('admin.networkingSection.loadingContacts')}
                                    </p>
                                ) : interactions.length === 0 ? (
                                    <p className="admin-networking-interactions-empty">
                                        {t('admin.networkingSection.noInteractions')}
                                    </p>
                                ) : (
                                    interactions.map((item) => (
                                        <div key={item.id} className="admin-networking-interaction-item">
                                            <span className="admin-networking-interaction-date-badge">
                                                {item.date || t('admin.ui.personModal.noDate')}
                                            </span>
                                            <span className="admin-networking-interaction-summary" title={item.summary}>
                                                {item.summary}
                                            </span>
                                            <button
                                                type="button"
                                                className="admin-networking-interaction-del-btn"
                                                onClick={() => handleDeleteInteraction(item.id)}
                                                title={t('admin.networkingSection.deleteInteractionTooltip')}
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Follow-up Section */}
                        <div className="admin-networking-followup-card">
                            <div className="admin-networking-followup-header">
                                <div className="admin-networking-followup-title-wrap">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="admin-networking-followup-icon">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <h4 className="admin-networking-followup-title">
                                        {t('admin.networkingSection.followUpSectionTitle')}
                                    </h4>
                                </div>
                                {Boolean(draft.followUpTitle || draft.followUpScheduledDate || draft.followUpDueDate) && (
                                    <button
                                        type="button"
                                        className="admin-networking-followup-clear-btn"
                                        onClick={handleClearFollowUp}
                                    >
                                        {t('admin.networkingSection.clearFollowUp')}
                                    </button>
                                )}
                            </div>

                            <div className="admin-todo-modal-field" style={{ marginTop: '0.75rem' }}>
                                <label>{t('admin.networkingSection.taskTitle')}</label>
                                <input
                                    type="text"
                                    placeholder={t('admin.networkingSection.taskTitlePlaceholder').replace('{name}', draft.name || 'contact')}
                                    value={draft.followUpTitle}
                                    onChange={(e) => setDraft({ ...draft, followUpTitle: e.target.value })}
                                />
                            </div>

                            <div className="admin-todo-modal-row" style={{ marginTop: '0.75rem' }}>
                                <div className="admin-todo-modal-field">
                                    <label>{t('admin.networkingSection.scheduledDate')}</label>
                                    <input
                                        type="date"
                                        value={draft.followUpScheduledDate}
                                        onChange={(e) => setDraft({ ...draft, followUpScheduledDate: e.target.value })}
                                    />
                                </div>
                                <div className="admin-todo-modal-field">
                                    <label>{t('admin.networkingSection.dueDate')}</label>
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
                                <span>{t('admin.networkingSection.syncWithTodo')}</span>
                            </label>
                        </div>

                        {error && (
                            <p className="admin-error" style={{ margin: 0 }}>{error}</p>
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
                        {t('admin.networkingSection.deleteBtn')}
                    </button>
                    <button
                        type="button"
                        className="admin-todo-modal-btn admin-todo-modal-btn-cancel"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        {t('admin.networkingSection.cancel')}
                    </button>
                    <button
                        type="button"
                        className="admin-todo-modal-btn admin-todo-modal-btn-save"
                        onClick={handleSave}
                        disabled={submitting}
                    >
                        {submitting ? t('admin.networkingSection.saving') : t('admin.networkingSection.saveChanges')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PersonModal;
