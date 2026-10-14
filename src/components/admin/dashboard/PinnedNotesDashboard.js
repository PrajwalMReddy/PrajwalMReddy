import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContent } from '../../../utils/ContentContext';
import { renderMarkdownWithFootnotes } from '../../../utils/markdownUtils';
import {
    NOTES_API,
    formatUpdatedAt,
    generateNoteContent,
} from '../notes/noteUtils';

const PinnedNotesDashboard = () => {
    const { t, formatNumber, language } = useContent();
    const navigate = useNavigate();
    const [pinnedNotes, setPinnedNotes] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [canExpand, setCanExpand] = useState(false);
    const contentRef = useRef(null);

    const loadPinnedNotes = useCallback(async () => {
        try {
            const response = await fetch(NOTES_API, {
                credentials: 'include',
            });
            if (!response.ok) return;
            const data = await response.json().catch(() => []);
            if (Array.isArray(data)) {
                const pinned = data.filter((n) => n.pinned === true && !n.archived);
                setPinnedNotes(pinned);
            }
        } catch (err) {
            console.error(t('logs.pinnedNotesError', 'Failed to load pinned notes for dashboard:'), err);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadPinnedNotes();
    }, [loadPinnedNotes]);

    const activeNote = useMemo(() => {
        if (!pinnedNotes.length) return null;
        return pinnedNotes[Math.min(activeIndex, pinnedNotes.length - 1)];
    }, [pinnedNotes, activeIndex]);

    const noteMarkdown = useMemo(() => {
        if (!activeNote) return '';
        if (Array.isArray(activeNote.blocks) && activeNote.blocks.length > 0) {
            return generateNoteContent(activeNote.blocks);
        }
        return activeNote.content || '';
    }, [activeNote]);

    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;

        const checkOverflow = () => {
            const hasOverflow = el.scrollHeight > 185;
            setCanExpand(hasOverflow);
        };

        checkOverflow();
        const rafId = requestAnimationFrame(checkOverflow);

        let resizeObserver;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                checkOverflow();
            });
            resizeObserver.observe(el);
        }

        window.addEventListener('resize', checkOverflow);
        return () => {
            cancelAnimationFrame(rafId);
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener('resize', checkOverflow);
        };
    }, [noteMarkdown, activeIndex]);

    if (loading || !pinnedNotes.length || !activeNote) {
        return null;
    }

    return (
        <article className={`briefing-memo-document admin-pinned-note-widget ${canExpand && isExpanded ? 'is-expanded' : 'is-compact'}`} aria-label={t('admin.notesSection.pinnedNote', 'Pinned Note')}>
            <header className="memo-masthead admin-pinned-header">
                <div className="memo-header-top admin-pinned-header-top">
                    <div className="admin-pinned-header-left">
                        <h2 className="memo-title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
                            {t('admin.notesSection.pinnedNotes', 'Pinned Notes')}
                        </h2>

                        {pinnedNotes.length === 1 ? (
                            <>
                                <span className="admin-pinned-header-separator" aria-hidden="true">·</span>
                                <span className="admin-pinned-active-title" title={activeNote.title || t('admin.notesSection.untitledNote', 'Untitled note')}>
                                    {activeNote.title || t('admin.notesSection.untitledNote', 'Untitled note')}
                                </span>
                            </>
                        ) : (
                            <div className="admin-events-view-toggle admin-pinned-tabs-toggle" role="tablist" aria-label="Pinned Notes Selector">
                                {pinnedNotes.map((note, idx) => (
                                    <button
                                        key={note.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={idx === activeIndex}
                                        className={`admin-view-toggle-btn admin-pinned-tab-btn ${idx === activeIndex ? 'active' : ''}`}
                                        onClick={() => setActiveIndex(idx)}
                                        title={note.title || `${t('admin.notesSection.untitledNote', 'Untitled note')} ${formatNumber(idx + 1)}`}
                                    >
                                        <span className="admin-pinned-tab-text">
                                            {note.title || `${t('admin.notesSection.untitledNote', 'Untitled note')} ${formatNumber(idx + 1)}`}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="memo-actions admin-pinned-header-actions">
                        {activeNote.folder && (
                            <span className="admin-pinned-folder-pill" title={`/${activeNote.folder}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                /{activeNote.folder}
                            </span>
                        )}
                        <span className="admin-pinned-updated-at">
                            {formatUpdatedAt(activeNote.updatedAt, language, formatNumber)}
                        </span>
                        <a
                            href={`/admin/notes/${activeNote.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="admin-view-toggle-btn admin-pinned-action-btn"
                            title={t('admin.notesSection.openInNotes', 'Open in Notes')}
                            aria-label={t('admin.notesSection.openInNotes', 'Open in Notes')}
                        >
                            <span>{t('admin.notesSection.openInNotes', 'Open in Notes')} ↗</span>
                        </a>
                    </div>
                </div>
            </header>

            <div className="admin-pinned-note-body">
                <div className={`admin-pinned-note-content-container ${canExpand ? (isExpanded ? 'is-expanded' : 'is-collapsed') : 'is-auto-fit'}`}>
                    <div className="admin-pinned-note-content" ref={contentRef}>
                        {noteMarkdown.trim() ? (
                            <div
                                className="admin-pinned-rendered-markdown"
                                dangerouslySetInnerHTML={{
                                    __html: renderMarkdownWithFootnotes(noteMarkdown),
                                }}
                            />
                        ) : (
                            <p className="admin-pinned-empty-text">
                                {t('admin.notesSection.widgetsDetail.emptyBlock', 'This note has no content yet.')}
                            </p>
                        )}
                    </div>
                    {canExpand && !isExpanded && <div className="admin-pinned-note-fade" aria-hidden="true" />}
                </div>

                {canExpand && (
                    <div className="admin-pinned-expand-footer">
                        <button
                            type="button"
                            className="admin-pinned-expand-footer-btn"
                            onClick={() => setIsExpanded((prev) => !prev)}
                        >
                            <span>{isExpanded ? `▴ ${t('admin.notesSection.showLess', 'Show less')}` : `▾ ${t('admin.notesSection.showMore', 'Show more')}`}</span>
                        </button>
                    </div>
                )}
            </div>
        </article>
    );
};

export default PinnedNotesDashboard;
