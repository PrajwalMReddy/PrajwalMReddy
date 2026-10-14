import React, { useState, useEffect } from 'react';
import { useContent } from '../../../utils/ContentContext';

const INTERACTION_TYPES = [
    { value: 'meeting' },
    { value: 'call' },
    { value: 'email' },
    { value: 'event' },
    { value: 'message' },
    { value: 'lunch' },
    { value: 'other' },
];

const renderInteractionIcon = (type) => {
    switch (type) {
        case 'meeting':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            );
        case 'call':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
            );
        case 'email':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                </svg>
            );
        case 'event':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
            );
        case 'message':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
            );
        case 'lunch':
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="1" x2="6" y2="4" />
                    <line x1="10" y1="1" x2="10" y2="4" />
                    <line x1="14" y1="1" x2="14" y2="4" />
                </svg>
            );
        default:
            return (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
            );
    }
};

function getInitials(name = '') {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PersonDetailDrawer = ({
    person,
    interactions = [],
    isOpen,
    onClose,
    onEdit,
    onDelete,
    onAddInteraction,
    onDeleteInteraction,
    onUpdatePerson,
}) => {
    const { t, language, formatNumber, formatDate } = useContent();
    const [showLogForm, setShowLogForm] = useState(false);
    const [logData, setLogData] = useState({
        date: new Date().toISOString().slice(0, 10),
        type: 'meeting',
        summary: '',
        notes: '',
        followUpNotes: '',
        nextFollowUpAt: '',
    });
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    const formatDisplayDate = (val) => formatDate(val);

    useEffect(() => {
        if (!isOpen) {
            setShowLogForm(false);
            return;
        }
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !person) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdue = person.nextFollowUpAt && person.nextFollowUpAt < todayStr && person.followUpStatus !== 'completed';
    const isUpcoming = person.nextFollowUpAt && person.nextFollowUpAt >= todayStr && person.followUpStatus !== 'completed';

    const handleLogSubmit = async (e) => {
        e.preventDefault();
        if (!logData.summary.trim()) return;

        try {
            setIsSubmittingLog(true);
            await onAddInteraction({
                personId: person.id,
                ...logData,
            });
            setLogData({
                date: new Date().toISOString().slice(0, 10),
                type: 'meeting',
                summary: '',
                notes: '',
                followUpNotes: '',
                nextFollowUpAt: '',
            });
            setShowLogForm(false);
        } catch (err) {
            alert(err.message || t('cms.messages.saveFailed', 'Failed to save changes'));
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const handleCompleteFollowUp = async () => {
        if (onUpdatePerson) {
            await onUpdatePerson(person.id, {
                followUpStatus: 'completed',
            });
        }
    };

    const handleClearFollowUp = async () => {
        if (onUpdatePerson) {
            await onUpdatePerson(person.id, {
                nextFollowUpAt: null,
                followUpDueDate: null,
                followUpScheduledDate: null,
                followUpStatus: 'none',
                followUpNotes: '',
                syncTodo: false,
            });
        }
    };


    return (
        <div className="admin-networking-drawer-overlay" onClick={onClose}>
            <div className="admin-networking-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="admin-networking-drawer-header">
                    <div className="admin-networking-drawer-header-left">
                        <div className="admin-networking-drawer-avatar">
                            {person.avatar ? (
                                <img src={person.avatar} alt={person.name} />
                            ) : (
                                getInitials(person.name)
                            )}
                        </div>
                        <div className="admin-networking-drawer-title">
                            <h2>{person.name}</h2>
                            <p>
                                {person.role}
                                {person.role && person.company ? ' · ' : ''}
                                {person.company}
                            </p>
                            {person.location && (
                                <div className="admin-networking-location">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    {person.location}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-networking-drawer-actions">
                        <button
                            type="button"
                            className="admin-networking-icon-btn"
                            onClick={() => onEdit(person)}
                            title={t('networkingSection.editContact')}
                            aria-label={t('networkingSection.editContact')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className="admin-networking-icon-btn danger"
                            onClick={() => onDelete(person)}
                            title={t('networkingSection.deleteContact')}
                            aria-label={t('networkingSection.deleteContact')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            className="admin-networking-icon-btn"
                            onClick={onClose}
                            title={t('networkingSection.closeDrawer')}
                            aria-label={t('networkingSection.closeDrawer')}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="admin-networking-drawer-body">
                    {/* Contact Channels */}
                    {(person.email || person.phone || person.linkedin || person.website) && (
                        <div className="admin-networking-contact-links">
                            {person.email && (
                                <a
                                    href={`mailto:${person.email}`}
                                    className="admin-networking-contact-link"
                                    title={t('networkingSection.sendEmail')}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                    {person.email}
                                </a>
                            )}
                            {person.phone && (
                                <a
                                    href={`tel:${person.phone}`}
                                    className="admin-networking-contact-link"
                                    title={t('networkingSection.call')}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    {formatNumber(person.phone)}
                                </a>
                            )}
                            {person.linkedin && (
                                <a
                                    href={person.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-networking-contact-link"
                                    title={t('networkingSection.linkedinProfile')}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                        <rect x="2" y="9" width="4" height="12" />
                                        <circle cx="4" cy="4" r="2" />
                                    </svg>
                                    {t('networkingSection.linkedin')}
                                </a>
                            )}
                            {person.website && (
                                <a
                                    href={person.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="admin-networking-contact-link"
                                    title={t('networkingSection.websitePortfolio')}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                    </svg>
                                    {t('networkingSection.website')}
                                </a>
                            )}
                        </div>
                    )}

                    {/* Follow-up Banner */}
                    {person.nextFollowUpAt && (
                        <div className={`admin-networking-followup-box ${isOverdue ? 'overdue' : ''}`}>
                            <div className="admin-networking-followup-header">
                                <span className={`admin-networking-badge ${isOverdue ? 'overdue' : isUpcoming ? 'upcoming' : 'completed'}`}>
                                    {isOverdue ? t('networkingSection.overdueFollowUp') : isUpcoming ? t('networkingSection.scheduledFollowUp') : t('networkingSection.completedFollowUp')}
                                </span>
                                <span className="admin-networking-followup-date">
                                    {formatDisplayDate(person.nextFollowUpAt)}
                                </span>
                            </div>
                            {person.followUpNotes && (
                                <div style={{ fontSize: '0.825rem', color: 'var(--text)' }}>
                                    {person.followUpNotes}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                {person.followUpStatus !== 'completed' && (
                                    <button
                                        type="button"
                                        className="admin-networking-btn-primary"
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                                        onClick={handleCompleteFollowUp}
                                    >
                                        {t('networkingSection.markComplete')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="admin-networking-btn-secondary"
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                                    onClick={handleClearFollowUp}
                                >
                                    {t('networkingSection.dismissReminder')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Relationship Context */}
                    <div className="admin-networking-drawer-section">
                        <h4 className="admin-networking-drawer-section-title">{t('networkingSection.relationshipContext')}</h4>
                        <div className="admin-networking-meta-grid">
                            {person.howMet && (
                                <div className="admin-networking-meta-item">
                                    <strong>{t('networkingSection.howMetTitle')}</strong>
                                    <span>{person.howMet}</span>
                                </div>
                            )}
                            {person.whereMet && (
                                <div className="admin-networking-meta-item">
                                    <strong>{t('networkingSection.whereMetTitle')}</strong>
                                    <span>{person.whereMet}</span>
                                </div>
                            )}
                            {person.lastInteractionAt && (
                                <div className="admin-networking-meta-item">
                                    <strong>{t('networkingSection.lastContacted')}</strong>
                                    <span>{formatDisplayDate(person.lastInteractionAt)}</span>
                                </div>
                            )}
                            {person.category && (
                                <div className="admin-networking-meta-item">
                                    <strong>{t('networkingSection.categoryTitle')}</strong>
                                    <span>{person.category}</span>
                                </div>
                            )}
                            {person.mutualConnections && (
                                <div className="admin-networking-meta-item" style={{ gridColumn: '1 / -1' }}>
                                    <strong>{t('networkingSection.mutualConnectionsTitle')}</strong>
                                    <span>{person.mutualConnections}</span>
                                </div>
                            )}
                        </div>

                        {Array.isArray(person.tags) && person.tags.length > 0 && (
                            <div style={{ marginTop: '0.25rem' }}>
                                <div className="admin-networking-card-tags">
                                    {person.tags.map((tag) => (
                                        <span key={tag} className="admin-networking-tag">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes & Conversation Topics */}
                    {person.notes && (
                        <div className="admin-networking-drawer-section">
                            <h4 className="admin-networking-drawer-section-title">{t('networkingSection.backgroundNotesTitle')}</h4>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text)', whiteSpace: 'pre-line', lineHeight: 1.55 }}>
                                {person.notes}
                            </div>
                        </div>
                    )}

                    {/* Interaction Timeline */}
                    <div className="admin-networking-drawer-section">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h4 className="admin-networking-drawer-section-title" style={{ margin: 0 }}>
                                {t('networkingSection.interactionHistoryTitle')} ({formatNumber(interactions.length)})
                            </h4>
                            <button
                                type="button"
                                className="admin-networking-btn-primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                                onClick={() => setShowLogForm(!showLogForm)}
                            >
                                {showLogForm ? t('networkingSection.cancel') : t('networkingSection.logInteractionBtn')}
                            </button>
                        </div>

                        {/* Inline Interaction Log Form */}
                        {showLogForm && (
                            <form onSubmit={handleLogSubmit} className="admin-networking-log-form">
                                <div className="admin-networking-log-form-row">
                                    <input
                                        type="date"
                                        required
                                        value={logData.date}
                                        onChange={(e) => setLogData({ ...logData, date: e.target.value })}
                                        style={{ flex: 1 }}
                                    />
                                    <select
                                        value={logData.type}
                                        onChange={(e) => setLogData({ ...logData, type: e.target.value })}
                                        style={{ flex: 1 }}
                                    >
                                        {INTERACTION_TYPES.map((tItem) => (
                                            <option key={tItem.value} value={tItem.value}>
                                                {t(`networkingSection.interactionTypes.${tItem.value}`, tItem.value)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder={t('networkingSection.summaryPlaceholder')}
                                    value={logData.summary}
                                    onChange={(e) => setLogData({ ...logData, summary: e.target.value })}
                                    autoFocus
                                />
                                <textarea
                                    placeholder={t('networkingSection.detailedNotesPlaceholder')}
                                    value={logData.notes}
                                    onChange={(e) => setLogData({ ...logData, notes: e.target.value })}
                                />
                                <div className="admin-networking-log-form-row">
                                    <input
                                        type="date"
                                        placeholder={t('networkingSection.nextFollowUpDate')}
                                        value={logData.nextFollowUpAt}
                                        onChange={(e) => setLogData({ ...logData, nextFollowUpAt: e.target.value })}
                                        style={{ flex: 1 }}
                                        title={t('networkingSection.scheduleFollowUpTitle')}
                                    />
                                    <input
                                        type="text"
                                        placeholder={t('networkingSection.followUpActionPlaceholder')}
                                        value={logData.followUpNotes}
                                        onChange={(e) => setLogData({ ...logData, followUpNotes: e.target.value })}
                                        style={{ flex: 2 }}
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        className="admin-networking-btn-secondary"
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                                        onClick={() => setShowLogForm(false)}
                                    >
                                        {t('networkingSection.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="admin-networking-btn-primary"
                                        style={{ padding: '0.35rem 0.85rem', fontSize: '0.775rem' }}
                                        disabled={isSubmittingLog}
                                    >
                                        {isSubmittingLog ? t('networkingSection.saving') : t('networkingSection.saveInteraction')}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Timeline List */}
                        {interactions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {t('networkingSection.interactionLoggedEmpty')}
                            </div>
                        ) : (
                            <div className="admin-networking-timeline">
                                {interactions.map((interaction) => (
                                    <div key={interaction.id} className="admin-networking-timeline-item">
                                        <div className="admin-networking-timeline-dot" />
                                        <div className="admin-networking-timeline-card">
                                            <div className="admin-networking-timeline-card-header">
                                                <span className="admin-networking-type-pill">
                                                    {renderInteractionIcon(interaction.type)}
                                                    <span>{t(`networkingSection.interactionTypes.${interaction.type}`, interaction.type || 'Interaction')}</span>
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span className="admin-networking-timeline-date">
                                                        {formatDisplayDate(interaction.date)}
                                                    </span>
                                                    {onDeleteInteraction && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm(t('networkingSection.deleteInteractionConfirm'))) {
                                                                    onDeleteInteraction(interaction.id);
                                                                }
                                                            }}
                                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                                            title={t('networkingSection.deleteLogTooltip')}
                                                            aria-label={t('networkingSection.deleteLogTooltip')}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                                <line x1="6" y1="6" x2="18" y2="18" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="admin-networking-timeline-summary">
                                                {interaction.summary}
                                            </div>
                                            {interaction.notes && (
                                                <div className="admin-networking-timeline-notes">
                                                    {interaction.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PersonDetailDrawer;

