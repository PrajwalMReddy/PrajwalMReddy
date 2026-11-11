import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import {
    BLOCK_TYPES,
    MAX_GRID_ROWS,
    MIN_GRID_ROWS,
    NOTES_API,
    TEXT_STYLES,
    TEXT_LIST_STYLES,
    TEXT_SIZE_OPTIONS,
    blocksFromNote,
    createBlock,
    findFreePosition,
    generateNoteContent,
    normalizeBlockSpan,
    FOLDERS_STORAGE_KEY,
    EXPANDED_FOLDERS_KEY,
    getBacklinks,
    rectanglesOverlap,
    normalizeFolder,
} from './notes/noteUtils';
import { NoteBlock } from './notes/NoteWidgets';
import NoteSidebar from './notes/NoteSidebar';

const NotesAdmin = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, formatNumber } = useContent();
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    useEffect(() => {
        document.title = t('pageTitles.adminNotes', 'Notes | Admin | Prajwal Reddy');
    }, [t]);

    const [draft, setDraft] = useState({
        title: '',
        content: '',
        folder: '',
        blocks: [],
        pinned: false,
        canvasRows: MIN_GRID_ROWS,
    });
    const [search, setSearch] = useState('');
    const [noteView, setNoteView] = useState('active');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showMoreWidgets, setShowMoreWidgets] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [editingNoteLinkId, setEditingNoteLinkId] = useState(null);
    const [editingEquationId, setEditingEquationId] = useState(null);
    const [editingFlashcardId, setEditingFlashcardId] = useState(null);
    const [editingImageId, setEditingImageId] = useState(null);
    const [imageErrors, setImageErrors] = useState({});
    const [activeTextBlockId, setActiveTextBlockId] = useState(null);
    const [textSizeLevel, setTextSizeLevel] = useState(0);
    const textSelectionRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const countdownBeepedRef = useRef(new Set());
    const countdownAudioRef = useRef(null);
    const linkClickTimerRef = useRef(null);
    const [draggingBlockId, setDraggingBlockId] = useState(null);
    const [dropPreview, setDropPreview] = useState(null);
    const [groupedBlockIds, setGroupedBlockIds] = useState(new Set());
    const [marqueeBox, setMarqueeBox] = useState(null);
    const [groupDropPreviews, setGroupDropPreviews] = useState(null);
    const marqueeStartRef = useRef(null);
    const isMarqueeActiveRef = useRef(false);
    const marqueeBaseSelectionRef = useRef(new Set());
    const boardRef = useRef(null);
    const resizeSessionRef = useRef(null);
    const dragBottomHoldStartRef = useRef(0);
    const lastRowExpandTimeRef = useRef(0);

    // History & Clipboard state and refs
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const [, setHistoryVersion] = useState(0);
    const draftsCacheRef = useRef({});
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const selectedIdRef = useRef(selectedId);
    selectedIdRef.current = selectedId;
    const draftBeforeDragRef = useRef(null);
    const draftBeforeResizeRef = useRef(null);
    const typingBeforeDraftRef = useRef(null);
    const typingTimerRef = useRef(null);
    const titleBeforeDraftRef = useRef(null);
    const titleTimerRef = useRef(null);
    const arrowMoveBeforeDraftRef = useRef(null);
    const arrowMoveTimerRef = useRef(null);
    const [toastMessage, setToastMessage] = useState('');
    const toastTimerRef = useRef(null);
    const [hasClipboard, setHasClipboard] = useState(() => {
        try {
            return Boolean(localStorage.getItem('admin_notes_clipboard'));
        } catch {
            return false;
        }
    });

    const showToast = useCallback((msg) => {
        if (!msg) return;
        setToastMessage(msg);
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
            toastTimerRef.current = null;
        }, 2200);
    }, []);

    const recordHistory = useCallback((beforeDraft, afterDraft, description, noteId = selectedIdRef.current, noteTitle = draftRef.current.title) => {
        if (!beforeDraft || !afterDraft) return;
        if (JSON.stringify(beforeDraft) === JSON.stringify(afterDraft)) return;

        undoStackRef.current.push({
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            noteId: noteId || null,
            noteTitle: noteTitle || t('admin.notesSection.untitledNote', 'Untitled note'),
            beforeDraft: JSON.parse(JSON.stringify(beforeDraft)),
            afterDraft: JSON.parse(JSON.stringify(afterDraft)),
            description,
            timestamp: Date.now(),
        });

        if (undoStackRef.current.length > 100) {
            undoStackRef.current.shift();
        }

        redoStackRef.current = [];
        setHistoryVersion((v) => v + 1);
    }, [t]);

    const flushPendingHistory = useCallback(() => {
        if (typingTimerRef.current) {
            clearTimeout(typingTimerRef.current);
            typingTimerRef.current = null;
        }
        if (typingBeforeDraftRef.current) {
            if (JSON.stringify(typingBeforeDraftRef.current) !== JSON.stringify(draftRef.current)) {
                recordHistory(
                    typingBeforeDraftRef.current,
                    draftRef.current,
                    'Edit text',
                    selectedIdRef.current,
                    draftRef.current.title
                );
            }
            typingBeforeDraftRef.current = null;
        }
        if (titleTimerRef.current) {
            clearTimeout(titleTimerRef.current);
            titleTimerRef.current = null;
        }
        if (titleBeforeDraftRef.current) {
            if (JSON.stringify(titleBeforeDraftRef.current) !== JSON.stringify(draftRef.current)) {
                recordHistory(
                    titleBeforeDraftRef.current,
                    draftRef.current,
                    'Change title',
                    selectedIdRef.current,
                    draftRef.current.title
                );
            }
            titleBeforeDraftRef.current = null;
        }
        if (arrowMoveTimerRef.current) {
            clearTimeout(arrowMoveTimerRef.current);
            arrowMoveTimerRef.current = null;
        }
        if (arrowMoveBeforeDraftRef.current) {
            if (JSON.stringify(arrowMoveBeforeDraftRef.current) !== JSON.stringify(draftRef.current)) {
                recordHistory(
                    arrowMoveBeforeDraftRef.current,
                    draftRef.current,
                    'Move widget',
                    selectedIdRef.current,
                    draftRef.current.title
                );
            }
            arrowMoveBeforeDraftRef.current = null;
        }
    }, [recordHistory]);

    const handleUndo = useCallback(() => {
        flushPendingHistory();

        if (undoStackRef.current.length === 0) {
            showToast(t('admin.notesSection.nothingToUndo', 'Nothing to undo'));
            return;
        }

        const entry = undoStackRef.current.pop();
        redoStackRef.current.push(entry);
        setHistoryVersion((v) => v + 1);

        const currentIdStr = String(selectedIdRef.current || '');
        const targetIdStr = String(entry.noteId || '');
        const isCurrentNote = currentIdStr === targetIdStr;

        if (isCurrentNote) {
            setDraft(entry.beforeDraft);
            if (entry.noteId) {
                draftsCacheRef.current[entry.noteId] = entry.beforeDraft;
            }
            showToast(`${t('admin.notesSection.undone', 'Undone')}: ${entry.description}`);
        } else {
            if (selectedIdRef.current) {
                draftsCacheRef.current[selectedIdRef.current] = draftRef.current;
            }

            if (entry.noteId) {
                const targetNote = notes.find((n) => String(n.id) === String(entry.noteId));
                setSelectedId(entry.noteId);
                setDraft(entry.beforeDraft);
                draftsCacheRef.current[entry.noteId] = entry.beforeDraft;
                if (targetNote?.folder) {
                    setExpandedFolders((curr) => new Set([...curr, targetNote.folder]));
                }
                navigate(`/admin/notes/${entry.noteId}`, { replace: true });
            } else {
                setSelectedId(null);
                setDraft(entry.beforeDraft);
                navigate('/admin/notes', { replace: true });
            }

            const title = entry.noteTitle || t('admin.notesSection.untitledNote', 'Untitled note');
            showToast(`${t('admin.notesSection.undone', 'Undone')} (${title}): ${entry.description}`);
        }
    }, [flushPendingHistory, notes, navigate, t, showToast]);

    const handleRedo = useCallback(() => {
        flushPendingHistory();

        if (redoStackRef.current.length === 0) {
            showToast(t('admin.notesSection.nothingToRedo', 'Nothing to redo'));
            return;
        }

        const entry = redoStackRef.current.pop();
        undoStackRef.current.push(entry);
        setHistoryVersion((v) => v + 1);

        const currentIdStr = String(selectedIdRef.current || '');
        const targetIdStr = String(entry.noteId || '');
        const isCurrentNote = currentIdStr === targetIdStr;

        if (isCurrentNote) {
            setDraft(entry.afterDraft);
            if (entry.noteId) {
                draftsCacheRef.current[entry.noteId] = entry.afterDraft;
            }
            showToast(`${t('admin.notesSection.redone', 'Redone')}: ${entry.description}`);
        } else {
            if (selectedIdRef.current) {
                draftsCacheRef.current[selectedIdRef.current] = draftRef.current;
            }

            if (entry.noteId) {
                const targetNote = notes.find((n) => String(n.id) === String(entry.noteId));
                setSelectedId(entry.noteId);
                setDraft(entry.afterDraft);
                draftsCacheRef.current[entry.noteId] = entry.afterDraft;
                if (targetNote?.folder) {
                    setExpandedFolders((curr) => new Set([...curr, targetNote.folder]));
                }
                navigate(`/admin/notes/${entry.noteId}`, { replace: true });
            } else {
                setSelectedId(null);
                setDraft(entry.afterDraft);
                navigate('/admin/notes', { replace: true });
            }

            const title = entry.noteTitle || t('admin.notesSection.untitledNote', 'Untitled note');
            showToast(`${t('admin.notesSection.redone', 'Redone')} (${title}): ${entry.description}`);
        }
    }, [flushPendingHistory, notes, navigate, t, showToast]);

    const handleCut = useCallback(async () => {
        if (groupedBlockIds.size === 0) return;
        const current = draftRef.current;
        const blocksToCut = current.blocks.filter((b) => groupedBlockIds.has(b.id));
        if (blocksToCut.length === 0) return;

        const clipData = {
            type: 'notes/blocks',
            version: 1,
            sourceNoteId: selectedIdRef.current,
            blocks: JSON.parse(JSON.stringify(blocksToCut)),
        };

        try {
            localStorage.setItem('admin_notes_clipboard', JSON.stringify(clipData));
            setHasClipboard(true);
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(JSON.stringify(clipData, null, 2)).catch(() => {});
            }
        } catch (e) { }

        const nextBlocks = current.blocks.filter((b) => !groupedBlockIds.has(b.id));
        const nextDraft = { ...current, blocks: nextBlocks };

        const count = blocksToCut.length;
        const desc = `Cut ${count} widget${count > 1 ? 's' : ''}`;
        recordHistory(current, nextDraft, desc, selectedIdRef.current, current.title);

        setDraft(nextDraft);
        setGroupedBlockIds(new Set());
        showToast(desc);
    }, [groupedBlockIds, recordHistory, showToast]);

    const handleCopy = useCallback(async () => {
        if (groupedBlockIds.size === 0) return;
        const current = draftRef.current;
        const blocksToCopy = current.blocks.filter((b) => groupedBlockIds.has(b.id));
        if (blocksToCopy.length === 0) return;

        const clipData = {
            type: 'notes/blocks',
            version: 1,
            sourceNoteId: selectedIdRef.current,
            blocks: JSON.parse(JSON.stringify(blocksToCopy)),
        };

        try {
            localStorage.setItem('admin_notes_clipboard', JSON.stringify(clipData));
            setHasClipboard(true);
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(JSON.stringify(clipData, null, 2)).catch(() => {});
            }
        } catch (e) { }

        const count = blocksToCopy.length;
        showToast(`Copied ${count} widget${count > 1 ? 's' : ''}`);
    }, [groupedBlockIds, showToast]);

    const handlePaste = useCallback(async () => {
        let clipBlocks = null;
        let sourceNoteId = null;

        try {
            if (navigator?.clipboard?.readText) {
                const text = await navigator.clipboard.readText();
                if (text) {
                    try {
                        const parsed = JSON.parse(text);
                        if (parsed?.type === 'notes/blocks' && Array.isArray(parsed.blocks)) {
                            clipBlocks = parsed.blocks;
                            sourceNoteId = parsed.sourceNoteId;
                        }
                    } catch { }
                }
            }
        } catch (e) { }

        if (!clipBlocks) {
            try {
                const saved = localStorage.getItem('admin_notes_clipboard');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        clipBlocks = parsed;
                    } else if (parsed?.type === 'notes/blocks' && Array.isArray(parsed.blocks)) {
                        clipBlocks = parsed.blocks;
                        sourceNoteId = parsed.sourceNoteId;
                    }
                }
            } catch (e) { }
        }

        if (!clipBlocks || clipBlocks.length === 0) {
            showToast(t('admin.notesSection.clipboardEmpty', 'Clipboard is empty'));
            return;
        }

        const current = draftRef.current;
        const isSameNote = String(sourceNoteId || '') === String(selectedIdRef.current || '');
        const currentRows = current.canvasRows || MIN_GRID_ROWS;
        const currentBlocks = current.blocks || [];

        const minCol = Math.min(...clipBlocks.map((b) => b.position?.col || 1));
        const minRow = Math.min(...clipBlocks.map((b) => b.position?.row || 1));

        let offsetCol = 0;
        let offsetRow = 0;

        if (isSameNote) {
            const lowestRow = currentBlocks.reduce((max, b) => {
                const r = b?.position?.row || 1;
                const h = b?.height || BLOCK_TYPES[b?.type]?.height || 4;
                return Math.max(max, r + h);
            }, 1);
            offsetRow = Math.max(2, lowestRow - minRow + 1);
        } else {
            const wouldOverlap = clipBlocks.some((cb) => {
                const cbWidth = Math.min(normalizeBlockSpan(cb.span, cb.type), 12);
                const cbHeight = cb.height || BLOCK_TYPES[cb.type]?.height || 4;
                const cand = {
                    col: cb.position?.col || 1,
                    row: cb.position?.row || 1,
                    width: cbWidth,
                    height: cbHeight,
                };
                return currentBlocks.some((eb) => {
                    const ebWidth = Math.min(normalizeBlockSpan(eb.span, eb.type), 12);
                    const ebHeight = eb.height || BLOCK_TYPES[eb.type]?.height || 4;
                    return rectanglesOverlap(cand, {
                        col: eb.position?.col || 1,
                        row: eb.position?.row || 1,
                        width: ebWidth,
                        height: ebHeight,
                    });
                });
            });

            if (wouldOverlap) {
                const lowestRow = currentBlocks.reduce((max, b) => {
                    const r = b?.position?.row || 1;
                    const h = b?.height || BLOCK_TYPES[b?.type]?.height || 4;
                    return Math.max(max, r + h);
                }, 1);
                offsetRow = Math.max(0, lowestRow - minRow + 1);
            }
        }

        const newBlockIds = [];
        const clonedBlocks = clipBlocks.map((b) => {
            const newId = `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const cloned = JSON.parse(JSON.stringify(b));
            cloned.id = newId;

            const span = Math.min(normalizeBlockSpan(cloned.span, cloned.type), 12);
            const rawCol = (b.position?.col || 1) + offsetCol;
            const col = Math.max(1, Math.min(13 - span, rawCol));
            const height = cloned.height || BLOCK_TYPES[cloned.type]?.height || 4;
            const rawRow = (b.position?.row || 1) + offsetRow;
            const row = Math.max(1, Math.min(MAX_GRID_ROWS - height + 1, rawRow));

            cloned.position = { col, row };

            if (Array.isArray(cloned.todos)) {
                cloned.todos = cloned.todos.map((item, idx) => ({
                    ...item,
                    id: `todo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
                }));
            }
            if (Array.isArray(cloned.timelineEvents)) {
                cloned.timelineEvents = cloned.timelineEvents.map((ev, idx) => ({
                    ...ev,
                    id: `timeline-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
                }));
            }
            newBlockIds.push(newId);
            return cloned;
        });

        const pastedLowest = clonedBlocks.reduce((max, b) => {
            const r = b?.position?.row || 1;
            const h = b?.height || BLOCK_TYPES[b?.type]?.height || 4;
            return Math.max(max, r + h - 1);
        }, 0);
        const neededRows = Math.min(MAX_GRID_ROWS, Math.max(currentRows, pastedLowest));

        const nextDraft = {
            ...current,
            canvasRows: neededRows,
            blocks: [...current.blocks, ...clonedBlocks],
        };

        const count = clonedBlocks.length;
        const desc = `Paste ${count} widget${count > 1 ? 's' : ''}`;
        recordHistory(current, nextDraft, desc, selectedIdRef.current, current.title);

        setDraft(nextDraft);
        setGroupedBlockIds(new Set(newBlockIds));
        showToast(desc);
    }, [recordHistory, showToast, t]);

    const handleDeleteSelectedBlocks = useCallback(() => {
        if (groupedBlockIds.size === 0) return;
        const current = draftRef.current;
        const blocksToDelete = current.blocks.filter((b) => groupedBlockIds.has(b.id));
        if (blocksToDelete.length === 0) return;

        const nextBlocks = current.blocks.filter((b) => !groupedBlockIds.has(b.id));
        const nextDraft = { ...current, blocks: nextBlocks };

        const count = blocksToDelete.length;
        const desc = `Delete ${count} widget${count > 1 ? 's' : ''}`;
        recordHistory(current, nextDraft, desc, selectedIdRef.current, current.title);

        setDraft(nextDraft);
        setGroupedBlockIds(new Set());
        showToast(desc);
    }, [groupedBlockIds, recordHistory, showToast]);

    const handleTitleChange = useCallback((event) => {
        const newTitle = event.target.value;
        const current = draftRef.current;
        if (!titleBeforeDraftRef.current) {
            titleBeforeDraftRef.current = current;
        }
        if (titleTimerRef.current) {
            clearTimeout(titleTimerRef.current);
        }
        titleTimerRef.current = setTimeout(() => {
            if (titleBeforeDraftRef.current && draftRef.current) {
                recordHistory(
                    titleBeforeDraftRef.current,
                    draftRef.current,
                    'Change title',
                    selectedIdRef.current,
                    draftRef.current.title
                );
            }
            titleBeforeDraftRef.current = null;
            titleTimerRef.current = null;
        }, 600);

        setDraft((prev) => ({ ...prev, title: newTitle }));
    }, [recordHistory]);

    const [customFolders, setCustomFolders] = useState(() => {
        try {
            const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [expandedFolders, setExpandedFolders] = useState(() => {
        try {
            const saved = localStorage.getItem(EXPANDED_FOLDERS_KEY);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingToolbarFolder, setIsCreatingToolbarFolder] = useState(false);
    const [toolbarFolderName, setToolbarFolderName] = useState('');
    const [isCreatingDropdownFolder, setIsCreatingDropdownFolder] = useState(false);
    const [dropdownFolderName, setDropdownFolderName] = useState('');
    const [renamingFolder, setRenamingFolder] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
    const folderDropdownRef = useRef(null);

    useEffect(() => {
        if (!isFolderDropdownOpen) {
            setIsCreatingDropdownFolder(false);
            setDropdownFolderName('');
            return undefined;
        }
        const handleClickOutside = (e) => {
            if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target)) {
                setIsFolderDropdownOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsFolderDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFolderDropdownOpen]);

    useEffect(() => {
        try {
            localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(customFolders));
        } catch (e) {
            // ignore
        }
    }, [customFolders]);

    useEffect(() => {
        try {
            localStorage.setItem(
                EXPANDED_FOLDERS_KEY,
                JSON.stringify(Array.from(expandedFolders))
            );
        } catch (e) {
            // ignore
        }
    }, [expandedFolders]);

    const widgetOrder = [
        'text',
        'heading',
        'date',
        'link',
        'callout',
        'list',
        'todo',
        'divider',
        'table',
        'code',
        'note_link',
        'image',
        'quote',
        'habit',
        'status',
        'progress',
        'counter',
        'countdown',
        'timeline',
        'flashcards',
        'chart',
        'equation',
        'picker',
        'rating',
    ];
    const primaryWidgetTypes = widgetOrder.slice(0, 10);
    const secondaryWidgetTypes = widgetOrder.slice(primaryWidgetTypes.length);
    const activeBacklinks = useMemo(
        () => getBacklinks(selectedId, notes),
        [selectedId, notes]
    );

    useEffect(() => {
        const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!isFullScreen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setIsFullScreen(false);
        };
        document.body.classList.add('admin-notes-full-screen-active');
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.classList.remove('admin-notes-full-screen-active');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullScreen]);

    useEffect(() => {
        draft.blocks
            .filter((block) => block.type === 'countdown' && block.dateTime)
            .forEach((block) => {
                const finished = new Date(block.dateTime).getTime() <= currentTime;
                if (!finished) {
                    countdownBeepedRef.current.delete(block.id);
                    return;
                }
                if (countdownBeepedRef.current.has(block.id)) return;
                countdownBeepedRef.current.add(block.id);
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContextClass) return;
                    const audioContext = countdownAudioRef.current || new AudioContextClass();
                    countdownAudioRef.current = audioContext;
                    audioContext.resume?.();
                    [0, 0.18, 0.36, 1.1, 1.28, 1.46, 2.2, 2.38, 2.56].forEach((offset) => {
                        const oscillator = audioContext.createOscillator();
                        const gain = audioContext.createGain();
                        oscillator.frequency.value = 880;
                        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
                        gain.gain.exponentialRampToValueAtTime(
                            0.16,
                            audioContext.currentTime + offset + 0.01
                        );
                        gain.gain.exponentialRampToValueAtTime(
                            0.0001,
                            audioContext.currentTime + offset + 0.12
                        );
                        oscillator.connect(gain).connect(audioContext.destination);
                        oscillator.start(audioContext.currentTime + offset);
                        oscillator.stop(audioContext.currentTime + offset + 0.13);
                    });
                } catch (error) {
                    return null;
                }
            });
    }, [currentTime, draft.blocks]);

    const request = useCallback(async (url, options = {}) => {
        const hasBody = options.body !== undefined;
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers,
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
    }, []);

    const loadNotes = useCallback(async () => {
        try {
            setError('');
            const data = await request(NOTES_API);
            setNotes(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [request]);

    useEffect(() => {
        loadNotes();
    }, [loadNotes]);

    const visibleNotes = useMemo(
        () =>
            notes.filter((note) =>
                noteView === 'archived' ? note.archived : !note.archived
            ),
        [notes, noteView]
    );

    const allFolders = useMemo(() => {
        const fromNotes = notes
            .filter((n) => !n.archived)
            .map((n) => normalizeFolder(n.folder))
            .filter(Boolean);
        const normalizedCustom = customFolders
            .map(normalizeFolder)
            .filter(Boolean);
        const combined = Array.from(new Set([...normalizedCustom, ...fromNotes]));
        return combined.sort((a, b) => a.localeCompare(b));
    }, [customFolders, notes]);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return visibleNotes;
        return visibleNotes.filter((note) => {
            const preview = note.content || '';
            const folderText = normalizeFolder(note.folder);
            return `${note.title} ${folderText} ${note.content || ''} ${preview}`
                .toLowerCase()
                .includes(term);
        });
    }, [search, visibleNotes]);

    const rootNotes = useMemo(() => {
        return filteredNotes.filter((note) => !normalizeFolder(note.folder));
    }, [filteredNotes]);

    const folderNotesMap = useMemo(() => {
        const map = {};
        allFolders.forEach((f) => {
            map[f] = filteredNotes.filter((note) => normalizeFolder(note.folder) === f);
        });
        return map;
    }, [allFolders, filteredNotes]);

    useEffect(() => {
        if (search.trim()) {
            const matchingFolders = new Set();
            filteredNotes.forEach((n) => {
                const folderName = normalizeFolder(n.folder);
                if (folderName) matchingFolders.add(folderName);
            });
            if (matchingFolders.size > 0) {
                setExpandedFolders((current) => new Set([...current, ...matchingFolders]));
            }
        }
    }, [search, filteredNotes]);

    const toggleFolder = (folderName) => {
        setExpandedFolders((current) => {
            const next = new Set(current);
            if (next.has(folderName)) {
                next.delete(folderName);
            } else {
                next.add(folderName);
            }
            return next;
        });
    };

    const handleCreateFolder = (name) => {
        const trimmed = name.trim().replace(/^\/+|\/+$/g, '');
        if (!trimmed) return;
        if (!allFolders.includes(trimmed)) {
            setCustomFolders((current) => [...current, trimmed]);
        }
        setExpandedFolders((current) => new Set([...current, trimmed]));
        setIsCreatingFolder(false);
        setNewFolderName('');
    };

    const startRenamingFolder = (folderName) => {
        setRenamingFolder(folderName);
        setRenameValue(folderName);
    };

    const handleRenameFolder = async (oldName, newName) => {
        const trimmed = newName.trim().replace(/^\/+|\/+$/g, '');
        setRenamingFolder(null);
        if (!trimmed || trimmed === oldName) return;

        setCustomFolders((current) => current.map((f) => (f === oldName ? trimmed : f)));
        setExpandedFolders((current) => {
            const next = new Set(current);
            if (next.has(oldName)) {
                next.delete(oldName);
                next.add(trimmed);
            }
            return next;
        });

        if (draft.folder === oldName) {
            setDraft((current) => ({ ...current, folder: trimmed }));
        }

        const affectedNotes = notes.filter((n) => n.folder === oldName);
        for (const note of affectedNotes) {
            try {
                await request(`${NOTES_API}/${note.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ folder: trimmed }),
                });
            } catch (err) {
                console.error(t('logs.folderRenameError', 'Failed to rename note folder:'), err);
            }
        }
        setNotes((current) =>
            current.map((n) => (n.folder === oldName ? { ...n, folder: trimmed } : n))
        );
    };

    const handleDeleteFolder = async (folderName) => {
        const confirmMsg = t(
            'admin.notesSection.deleteConfirmFolder',
            'Delete folder "{name}"? Notes in this folder will be moved to / (root).'
        ).replace('{name}', folderName);
        if (!window.confirm(confirmMsg)) return;

        setCustomFolders((current) => current.filter((f) => f !== folderName));
        setExpandedFolders((current) => {
            const next = new Set(current);
            next.delete(folderName);
            return next;
        });

        if (draft.folder === folderName) {
            setDraft((current) => ({ ...current, folder: '' }));
        }

        const affectedNotes = notes.filter((n) => n.folder === folderName);
        for (const note of affectedNotes) {
            try {
                await request(`${NOTES_API}/${note.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ folder: '' }),
                });
            } catch (err) {
                console.error(t('logs.folderDeleteError', 'Failed to clear note folder on delete:'), err);
            }
        }
        setNotes((current) =>
            current.map((n) => (n.folder === folderName ? { ...n, folder: '' } : n))
        );
    };

    const handleFolderChange = async (targetFolder) => {
        const trimmed = normalizeFolder(targetFolder);
        setDraft((current) => ({ ...current, folder: trimmed }));
        if (trimmed) {
            setExpandedFolders((current) => new Set([...current, trimmed]));
        }
        const activeId = selectedId || id || selectedIdRef.current;
        if (activeId && draftsCacheRef.current[activeId]) {
            draftsCacheRef.current[activeId] = {
                ...draftsCacheRef.current[activeId],
                folder: trimmed,
            };
        }
        if (activeId) {
            setSaving(true);
            try {
                const updated = await request(`${NOTES_API}/${activeId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ folder: trimmed }),
                });
                const updatedFolder = normalizeFolder(
                    updated && updated.folder !== undefined ? updated.folder : trimmed
                );
                const updatedNote = {
                    ...updated,
                    folder: updatedFolder,
                };
                setNotes((current) =>
                    current.map((n) =>
                        String(n.id) === String(activeId)
                            ? { ...n, ...updatedNote, folder: updatedFolder }
                            : n
                    )
                );
            } catch (err) {
                console.error(t('logs.folderChangeError', 'Failed to change folder:'), err);
                setError(t('admin.notesSection.folderChangeError', 'Failed to update folder location'));
            } finally {
                setSaving(false);
            }
        }
    };

    const selectNote = useCallback((note) => {
        if (note) {
            flushPendingHistory();

            if (selectedIdRef.current) {
                draftsCacheRef.current[selectedIdRef.current] = draftRef.current;
            }

            const noteFolder = normalizeFolder(note.folder);
            const cached = draftsCacheRef.current[note.id];
            if (cached) {
                setSelectedId(note.id);
                selectedIdRef.current = note.id;
                setDraft(cached);
                setGroupedBlockIds(new Set());
                if (noteFolder) {
                    setExpandedFolders((current) => new Set([...current, noteFolder]));
                }
                if (note.archived) {
                    setNoteView('archived');
                }
                setError('');
                return;
            }

            const blocks = blocksFromNote(note);
            const lowest = (blocks || []).reduce((max, b) => {
                const row = Number(b?.position?.row) || 1;
                const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
                return Math.max(max, row + height - 1);
            }, 0);
            const initialCanvasRows = Math.max(
                MIN_GRID_ROWS,
                typeof note.canvasRows === 'number' ? note.canvasRows : MIN_GRID_ROWS,
                lowest
            );
            setSelectedId(note.id);
            selectedIdRef.current = note.id;
            setDraft({
                title: note.title,
                content: note.content,
                folder: noteFolder,
                pinned: Boolean(note.pinned),
                blocks,
                canvasRows: initialCanvasRows,
            });
            setGroupedBlockIds(new Set());
            if (noteFolder) {
                setExpandedFolders((current) => new Set([...current, noteFolder]));
            }
            if (note.archived) {
                setNoteView('archived');
            }
            setError('');
        }
    }, [flushPendingHistory]);

    const selectNoteAndNavigate = useCallback((note) => {
        if (note) {
            selectNote(note);
            if (String(id) !== String(note.id)) {
                navigate(`/admin/notes/${note.id}`);
            }
        }
    }, [selectNote, id, navigate]);

    const startNewNote = useCallback((folder = '') => {
        flushPendingHistory();
        if (selectedIdRef.current) {
            draftsCacheRef.current[selectedIdRef.current] = draftRef.current;
        }
        const cleanFolder = normalizeFolder(folder);
        setSelectedId(null);
        selectedIdRef.current = null;
        setDraft({
            title: '',
            content: '',
            folder: cleanFolder,
            pinned: false,
            blocks: [],
            canvasRows: MIN_GRID_ROWS,
        });
        setGroupedBlockIds(new Set());
        if (cleanFolder) {
            setExpandedFolders((current) => new Set([...current, cleanFolder]));
        }
        setError('');
        if (id) {
            navigate('/admin/notes');
        }
    }, [id, navigate, flushPendingHistory]);

    useEffect(() => {
        if (!loading) {
            if (id) {
                if (String(selectedId) !== String(id)) {
                    const target = notes.find((n) => String(n.id) === String(id));
                    if (target) {
                        selectNote(target);
                    } else {
                        navigate('/admin/notes', { replace: true });
                    }
                }
            } else if (selectedId !== null) {
                setSelectedId(null);
                setDraft({ title: '', content: '', folder: '', pinned: false, blocks: [] });
                setError('');
            }
        }
    }, [id, notes, loading, selectedId, selectNote, navigate]);

    const handleSave = useCallback(async (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (!draft.title.trim()) {
            setError('Give the note a title before saving.');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const content = generateNoteContent(draft.blocks);
            const folderValue = normalizeFolder(draft.folder);
            const lowest = (draft.blocks || []).reduce((max, b) => {
                const row = Number(b?.position?.row) || 1;
                const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
                return Math.max(max, row + height - 1);
            }, 0);
            const currentEffectiveRows = Math.max(
                MIN_GRID_ROWS,
                typeof draft.canvasRows === 'number' ? draft.canvasRows : MIN_GRID_ROWS,
                lowest
            );
            const bodyData = {
                ...draft,
                canvasRows: currentEffectiveRows,
                pinned: Boolean(draft.pinned),
                folder: folderValue,
                content,
            };
            const targetId = selectedId || id || selectedIdRef.current;
            const saved = await request(
                targetId ? `${NOTES_API}/${targetId}` : NOTES_API,
                {
                    method: targetId ? 'PUT' : 'POST',
                    body: JSON.stringify(bodyData),
                }
            );
            const savedId = String(saved?.id || targetId || '');
            const savedNote = {
                ...saved,
                id: savedId,
                pinned:
                    saved && saved.pinned !== undefined
                        ? saved.pinned
                        : Boolean(draft.pinned),
                folder:
                    saved && saved.folder !== undefined
                        ? normalizeFolder(saved.folder)
                        : folderValue,
            };
            setNotes((current) => {
                const withoutSaved = current.filter((note) => String(note.id) !== savedId);
                return [savedNote, ...withoutSaved];
            });
            setSelectedId(savedId);
            selectedIdRef.current = savedId;
            delete draftsCacheRef.current[savedId];
            setDraft({
                title: savedNote.title,
                content: savedNote.content,
                folder: savedNote.folder || '',
                pinned: Boolean(savedNote.pinned),
                blocks: blocksFromNote(savedNote),
                canvasRows: savedNote.canvasRows || currentEffectiveRows,
            });
            if (savedNote.folder) {
                setExpandedFolders((current) => new Set([...current, savedNote.folder]));
            }
            if (String(id) !== savedId) {
                navigate(`/admin/notes/${savedId}`, { replace: true });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }, [draft, selectedId, request, id, navigate]);

    const handleDelete = async () => {
        if (
            !selectedId ||
            !window.confirm(
                t('admin.notesSection.deleteConfirmNote', 'Delete this note?')
            )
        )
            return;

        setSaving(true);
        setError('');
        try {
            await request(`${NOTES_API}/${selectedId}`, { method: 'DELETE' });
            setNotes((current) => current.filter((note) => note.id !== selectedId));
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePin = async () => {
        const nextPinned = !draft.pinned;
        setDraft((prev) => ({ ...prev, pinned: nextPinned }));
        if (!selectedId) return;
        setSaving(true);
        setError('');
        try {
            const updated = await request(`${NOTES_API}/${selectedId}`, {
                method: 'PUT',
                body: JSON.stringify({ pinned: nextPinned }),
            });
            setNotes((current) =>
                current.map((note) =>
                    note.id === selectedId
                        ? {
                            ...note,
                            pinned: nextPinned,
                            updatedAt: updated?.updatedAt || note.updatedAt,
                        }
                        : note
                )
            );
        } catch (err) {
            setError(err.message);
            setDraft((prev) => ({ ...prev, pinned: !nextPinned }));
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async () => {
        const selectedNote = notes.find((note) => note.id === selectedId);
        if (!selectedNote) return;

        const archived = !selectedNote.archived;
        setSaving(true);
        setError('');
        try {
            await request(`${NOTES_API}/${selectedId}`, {
                method: 'PUT',
                body: JSON.stringify({ archived }),
            });
            setNotes((current) =>
                current.map((note) =>
                    note.id === selectedId ? { ...note, archived } : note
                )
            );
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateBlock = useCallback((blockId, changes) => {
        const current = draftRef.current;
        const nextBlocks = current.blocks.map((block) =>
            block.id === blockId ? { ...block, ...changes } : block
        );
        const nextDraft = { ...current, blocks: nextBlocks };

        const isTextEdit = 'text' in changes || 'label' in changes;
        if (isTextEdit) {
            if (!typingBeforeDraftRef.current) {
                typingBeforeDraftRef.current = current;
            }
            if (typingTimerRef.current) {
                clearTimeout(typingTimerRef.current);
            }
            typingTimerRef.current = setTimeout(() => {
                if (typingBeforeDraftRef.current && draftRef.current) {
                    recordHistory(
                        typingBeforeDraftRef.current,
                        draftRef.current,
                        'Edit text',
                        selectedIdRef.current,
                        draftRef.current.title
                    );
                }
                typingBeforeDraftRef.current = null;
                typingTimerRef.current = null;
            }, 600);
        } else {
            flushPendingHistory();
            recordHistory(current, nextDraft, 'Update widget', selectedIdRef.current, current.title);
        }

        setDraft(nextDraft);
    }, [recordHistory, flushPendingHistory]);

    const saveTextSelection = (blockId = activeTextBlockId) => {
        const selection = window.getSelection();
        const editor = document.querySelector(`[data-text-editor-id="${blockId}"]`);
        if (
            selection?.rangeCount &&
            editor &&
            editor.contains(selection.anchorNode) &&
            editor.contains(selection.focusNode)
        ) {
            textSelectionRef.current = {
                blockId,
                range: selection.getRangeAt(0).cloneRange(),
            };
            const selectionElement =
                selection.anchorNode.nodeType === Node.ELEMENT_NODE
                    ? selection.anchorNode
                    : selection.anchorNode.parentElement;
            const blockElement = selectionElement?.closest('h1, h2, h3, h4, h5, h6, p');
            const sizeIndex = TEXT_SIZE_OPTIONS.findIndex(
                (option) => option.tag === blockElement?.tagName?.toLowerCase()
            );
            setTextSizeLevel(sizeIndex < 0 ? 0 : sizeIndex);
        }
    };

    const getActiveTextEditor = () => {
        const blockId = textSelectionRef.current?.blockId || activeTextBlockId;
        return (
            document.querySelector(`[data-text-editor-id="${blockId}"]`) ||
            document.querySelector('.admin-note-text-editor')
        );
    };

    const restoreTextSelection = (editor) => {
        editor.focus();
        const savedSelection = textSelectionRef.current;
        if (savedSelection?.blockId !== editor.dataset.textEditorId) return;
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedSelection.range);
    };

    const applyTextStyle = (style) => {
        const editor = getActiveTextEditor();
        if (!editor) return;
        restoreTextSelection(editor);
        document.execCommand(style.command, false);
        updateBlock(editor.dataset.textEditorId, { text: editor.innerHTML });
    };

    const applyTextSize = (nextSize) => {
        const editor = getActiveTextEditor();
        if (!editor) return;
        const clampedSize = Math.max(0, Math.min(TEXT_SIZE_OPTIONS.length - 1, nextSize));
        restoreTextSelection(editor);
        document.execCommand('formatBlock', false, TEXT_SIZE_OPTIONS[clampedSize].tag);
        setTextSizeLevel(clampedSize);
        updateBlock(editor.dataset.textEditorId, { text: editor.innerHTML });
    };

    const addBlock = (type, afterId = null) => {
        const current = draftRef.current;
        const next = createBlock(type);
        const currentRows = current.canvasRows || MIN_GRID_ROWS;
        next.position = findFreePosition(current.blocks, next, currentRows);
        const nextHeight = next.height || BLOCK_TYPES[next.type]?.height || 4;
        const neededRows = (next.position?.row || 1) + nextHeight - 1;
        const updatedCanvasRows = Math.min(
            MAX_GRID_ROWS,
            Math.max(currentRows, neededRows)
        );
        const index = afterId
            ? current.blocks.findIndex((block) => block.id === afterId) + 1
            : current.blocks.length;
        if (type === 'link') setEditingLinkId(next.id);
        if (type === 'note_link') setEditingNoteLinkId(next.id);
        if (type === 'flashcards') setEditingFlashcardId(next.id);
        if (type === 'image') setEditingImageId(next.id);
        const nextDraft = {
            ...current,
            canvasRows: updatedCanvasRows,
            blocks: [
                ...current.blocks.slice(0, index),
                next,
                ...current.blocks.slice(index),
            ],
        };
        recordHistory(current, nextDraft, `Add ${BLOCK_TYPES[type]?.label || type}`);
        setDraft(nextDraft);
    };

    const removeBlock = (blockId) => {
        const current = draftRef.current;
        const blockToRemove = current.blocks.find((b) => b.id === blockId);
        const nextDraft = {
            ...current,
            blocks: current.blocks.filter((block) => block.id !== blockId),
        };
        const label = blockToRemove ? (BLOCK_TYPES[blockToRemove.type]?.label || 'widget') : 'widget';
        recordHistory(current, nextDraft, `Remove ${label}`);
        setDraft(nextDraft);
        setGroupedBlockIds((prev) => {
            if (prev.has(blockId)) {
                const next = new Set(prev);
                next.delete(blockId);
                return next;
            }
            return prev;
        });
    };

    const placeBlock = (blockId, col, row) =>
        setDraft((current) => {
            const block = (current.blocks || []).find((b) => b.id === blockId);
            const height = block?.height || BLOCK_TYPES[block?.type]?.height || 4;
            const targetBottom = row + height - 1;
            const currentRows = current.canvasRows || MIN_GRID_ROWS;
            const nextRows = targetBottom > currentRows ? Math.min(MAX_GRID_ROWS, targetBottom) : currentRows;
            return {
                ...current,
                canvasRows: nextRows,
                blocks: (current.blocks || []).map((b) =>
                    b.id === blockId ? { ...b, position: { col, row } } : b
                ),
            };
        });

    const getBoardMetrics = () => {
        if (!boardRef.current) return null;
        const board = boardRef.current;
        const bounds = board.getBoundingClientRect();
        const styles = window.getComputedStyle(board);
        const paddingX = parseFloat(styles.paddingLeft) || 0;
        const paddingY = parseFloat(styles.paddingTop) || 0;
        const columnGap = parseFloat(styles.columnGap) || parseFloat(styles.gap) || 10.4;
        const rowGap = parseFloat(styles.rowGap) || parseFloat(styles.gap) || 10.4;
        const contentWidth = bounds.width - paddingX - (parseFloat(styles.paddingRight) || 0);
        return {
            bounds,
            paddingX,
            paddingY,
            gap: columnGap,
            columnGap,
            rowGap,
            cellWidth: Math.max(10, (contentWidth - 11 * columnGap) / 12),
            rowHeight: 38 + rowGap,
            scrollLeft: board.scrollLeft || 0,
            scrollTop: board.scrollTop || 0,
        };
    };

    const startBlockResize = (event, block) => {
        if (window.innerWidth <= 768) return;
        event.stopPropagation();
        event.preventDefault();
        draftBeforeResizeRef.current = draftRef.current;
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (e) { }
        const metrics = getBoardMetrics();
        const startCol = block.position?.col || 1;
        const currentSpan = normalizeBlockSpan(block.span, block.type);
        const blockEl = event.currentTarget.closest('.admin-note-block');
        const blockBounds = blockEl ? blockEl.getBoundingClientRect() : null;
        const columnGap = metrics?.columnGap || 10.4;
        const rowGap = metrics?.rowGap || 10.4;
        const cellWidth = metrics?.cellWidth || 40;
        const blockLeft = blockBounds
            ? blockBounds.left
            : event.clientX - (currentSpan * (cellWidth + columnGap) - columnGap);
        const blockTop = blockBounds
            ? blockBounds.top
            : event.clientY - ((block.height || 4) * (38 + rowGap) - rowGap);

        resizeSessionRef.current = {
            id: block.id,
            blockLeft,
            blockTop,
            startScrollLeft: metrics?.scrollLeft || 0,
            startScrollTop: metrics?.scrollTop || 0,
            maxSpan: 13 - startCol,
            minSpan: block.type === 'divider' ? 1 : 2,
            minHeight: block.type === 'divider' ? 1 : 2,
            cellWidth,
            rowHeight: 38,
            columnGap,
            rowGap,
        };
    };

    const updateBlockResize = (event, block) => {
        const session = resizeSessionRef.current;
        if (!session || session.id !== block.id) return;
        event.stopPropagation();
        const scrollLeft = boardRef.current ? boardRef.current.scrollLeft : 0;
        const scrollTop = boardRef.current ? boardRef.current.scrollTop : 0;
        const currentX = event.clientX - session.blockLeft + (scrollLeft - session.startScrollLeft);
        const currentY = event.clientY - session.blockTop + (scrollTop - session.startScrollTop);
        const newSpan = Math.round((currentX + session.columnGap) / (session.cellWidth + session.columnGap));
        const newHeight = Math.round((currentY + session.rowGap) / (session.rowHeight + session.rowGap));
        const clampedSpan = Math.max(session.minSpan, Math.min(session.maxSpan, newSpan));
        const currentRows = draft.canvasRows || MIN_GRID_ROWS;
        const maxAllowedHeight = Math.min(30, Math.max(session.minHeight, currentRows - (block.position?.row || 1) + 2));
        const clampedHeight = Math.max(session.minHeight, Math.min(maxAllowedHeight, newHeight));
        if (clampedSpan !== block.span || clampedHeight !== block.height) {
            const blockBottom = (block.position?.row || 1) + clampedHeight - 1;
            const now = Date.now();
            if (blockBottom > currentRows && currentRows < MAX_GRID_ROWS && now - lastRowExpandTimeRef.current >= 450) {
                lastRowExpandTimeRef.current = now;
                setDraft((current) => ({
                    ...current,
                    canvasRows: Math.min(MAX_GRID_ROWS, blockBottom),
                    blocks: current.blocks.map((b) =>
                        b.id === block.id ? { ...b, span: clampedSpan, height: clampedHeight } : b
                    ),
                }));
            } else if (blockBottom <= currentRows) {
                updateBlock(block.id, { span: clampedSpan, height: clampedHeight });
            }
        }
    };

    const finishBlockResize = (event) => {
        if (draftBeforeResizeRef.current && JSON.stringify(draftBeforeResizeRef.current) !== JSON.stringify(draftRef.current)) {
            recordHistory(draftBeforeResizeRef.current, draftRef.current, 'Resize widget');
        }
        draftBeforeResizeRef.current = null;

        if (event?.currentTarget) {
            try {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }
            } catch (e) { }
        }
        resizeSessionRef.current = null;
    };

    const startBlockDrag = (event, blockId) => {
        if (
            event.pointerType === 'touch' ||
            window.innerWidth <= 768 ||
            event.target.closest(
                'a, input, textarea, select, button, label, .admin-note-todo-check-btn, .admin-note-todo-custom-check, .admin-note-flashcard, .admin-note-image-display, .admin-note-text-editor, .admin-note-table-wrap, .admin-note-block-resize'
            )
        ) {
            return;
        }

        // Shift or Ctrl click toggles grouping of this element
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            event.stopPropagation();
            setGroupedBlockIds((prev) => {
                const next = new Set(prev);
                if (next.has(blockId)) {
                    next.delete(blockId);
                } else {
                    next.add(blockId);
                }
                return next;
            });
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingBlockId(blockId);
        draftBeforeDragRef.current = draftRef.current;
        dragBottomHoldStartRef.current = 0;
        lastRowExpandTimeRef.current = 0;

        // If block is NOT in current group, make it the sole grouped/selected block
        if (!groupedBlockIds.has(blockId)) {
            setGroupedBlockIds(new Set([blockId]));
        }

        const block = draft.blocks.find((b) => b.id === blockId);
        if (block) {
            setDropPreview(block.position || { col: 1, row: 1 });
        }
    };

    const finishBlockDrag = (event, blockId) => {
        if (draggingBlockId === blockId) {
            const isGroup = groupedBlockIds.has(blockId) && groupedBlockIds.size > 1;
            const current = draftRef.current;
            let nextDraft = current;

            if (isGroup && groupDropPreviews) {
                const currentRows = current.canvasRows || MIN_GRID_ROWS;
                let neededRows = currentRows;

                const updatedBlocks = (current.blocks || []).map((b) => {
                    const preview = groupDropPreviews[b.id];
                    if (preview) {
                        const bottom = preview.row + preview.height - 1;
                        if (bottom > neededRows) neededRows = bottom;
                        return {
                            ...b,
                            position: { col: preview.col, row: preview.row },
                        };
                    }
                    return b;
                });

                nextDraft = {
                    ...current,
                    canvasRows: Math.min(MAX_GRID_ROWS, neededRows),
                    blocks: updatedBlocks,
                };
            } else if (dropPreview) {
                const block = (current.blocks || []).find((b) => b.id === blockId);
                const height = block?.height || BLOCK_TYPES[block?.type]?.height || 4;
                const targetBottom = dropPreview.row + height - 1;
                const currentRows = current.canvasRows || MIN_GRID_ROWS;
                const nextRows = targetBottom > currentRows ? Math.min(MAX_GRID_ROWS, targetBottom) : currentRows;
                nextDraft = {
                    ...current,
                    canvasRows: nextRows,
                    blocks: (current.blocks || []).map((b) =>
                        b.id === blockId ? { ...b, position: { col: dropPreview.col, row: dropPreview.row } } : b
                    ),
                };
            }

            if (draftBeforeDragRef.current && JSON.stringify(draftBeforeDragRef.current) !== JSON.stringify(nextDraft)) {
                recordHistory(draftBeforeDragRef.current, nextDraft, 'Move widget');
            }
            draftBeforeDragRef.current = null;
            setDraft(nextDraft);

            if (event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
                try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                } catch (e) { }
            }
            setDraggingBlockId(null);
            setDropPreview(null);
            setGroupDropPreviews(null);
            dragBottomHoldStartRef.current = 0;
            lastRowExpandTimeRef.current = 0;
        }
    };

    const updateDropPreview = (event) => {
        if (!draggingBlockId || !boardRef.current) return;
        const anchorBlock = draft.blocks.find((b) => b.id === draggingBlockId);
        if (!anchorBlock) return;
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const { bounds, paddingX, paddingY, gap, cellWidth, rowHeight, scrollLeft, scrollTop } = metrics;

        const isGroup = groupedBlockIds.has(draggingBlockId) && groupedBlockIds.size > 1;
        const rawCol = Math.floor((event.clientX - bounds.left + scrollLeft - paddingX) / (cellWidth + gap)) + 1;
        const rawRow = Math.floor((event.clientY - bounds.top + scrollTop - paddingY) / rowHeight) + 1;
        const currentRows = draft.canvasRows || MIN_GRID_ROWS;

        if (!isGroup) {
            const width = Math.min(normalizeBlockSpan(anchorBlock.span, anchorBlock.type), 12);
            const height = Math.min(anchorBlock.height || BLOCK_TYPES[anchorBlock.type]?.height || 4, 30);
            const col = Math.max(1, Math.min(rawCol, 13 - width));
            const maxAllowedRow = Math.min(MAX_GRID_ROWS - height + 1, Math.max(1, currentRows - height + 2));
            const row = Math.max(1, Math.min(rawRow, maxAllowedRow));

            const isAtBottom = rawRow + height - 1 >= currentRows;
            const now = Date.now();

            if (isAtBottom && currentRows < MAX_GRID_ROWS) {
                if (dragBottomHoldStartRef.current === 0) {
                    dragBottomHoldStartRef.current = now;
                } else {
                    const holdDuration = now - dragBottomHoldStartRef.current;
                    const timeSinceLastExpand = now - lastRowExpandTimeRef.current;
                    if (holdDuration >= 400 && timeSinceLastExpand >= 550) {
                        lastRowExpandTimeRef.current = now;
                        const nextRows = Math.min(MAX_GRID_ROWS, currentRows + 1);
                        setDraft((current) => ({
                            ...current,
                            canvasRows: nextRows,
                        }));
                    }
                }
            } else {
                dragBottomHoldStartRef.current = 0;
            }

            setGroupDropPreviews(null);
            setDropPreview((current) =>
                current && current.col === col && current.row === row ? current : { col, row }
            );
        } else {
            // Group drag calculation
            const anchorOrigCol = anchorBlock.position?.col || 1;
            const anchorOrigRow = anchorBlock.position?.row || 1;
            const desiredDeltaCol = rawCol - anchorOrigCol;
            const desiredDeltaRow = rawRow - anchorOrigRow;

            const activeGroupedBlocks = draft.blocks.filter((b) => groupedBlockIds.has(b.id));

            let minDeltaCol = -Infinity;
            let maxDeltaCol = Infinity;
            let minDeltaRow = -Infinity;
            let maxDeltaRow = Infinity;

            activeGroupedBlocks.forEach((b) => {
                const bCol = b.position?.col || 1;
                const bSpan = Math.min(normalizeBlockSpan(b.span, b.type), 12);
                const bRow = b.position?.row || 1;
                const bHeight = Math.min(b.height || BLOCK_TYPES[b.type]?.height || 4, 30);

                minDeltaCol = Math.max(minDeltaCol, 1 - bCol);
                maxDeltaCol = Math.min(maxDeltaCol, 13 - bSpan - bCol);
                minDeltaRow = Math.max(minDeltaRow, 1 - bRow);
                maxDeltaRow = Math.min(MAX_GRID_ROWS - bHeight + 1 - bRow, maxDeltaRow);
            });

            const deltaCol = Math.max(minDeltaCol, Math.min(maxDeltaCol, desiredDeltaCol));
            const deltaRow = Math.max(minDeltaRow, Math.min(maxDeltaRow, desiredDeltaRow));

            const maxBottom = Math.max(
                ...activeGroupedBlocks.map((b) => (b.position?.row || 1) + deltaRow + (b.height || BLOCK_TYPES[b.type]?.height || 4) - 1)
            );
            const isAtBottom = maxBottom >= currentRows;
            const now = Date.now();
            if (isAtBottom && currentRows < MAX_GRID_ROWS) {
                if (dragBottomHoldStartRef.current === 0) {
                    dragBottomHoldStartRef.current = now;
                } else {
                    const holdDuration = now - dragBottomHoldStartRef.current;
                    const timeSinceLastExpand = now - lastRowExpandTimeRef.current;
                    if (holdDuration >= 400 && timeSinceLastExpand >= 550) {
                        lastRowExpandTimeRef.current = now;
                        const nextRows = Math.min(MAX_GRID_ROWS, currentRows + 1);
                        setDraft((current) => ({
                            ...current,
                            canvasRows: nextRows,
                        }));
                    }
                }
            } else {
                dragBottomHoldStartRef.current = 0;
            }

            const previews = {};
            activeGroupedBlocks.forEach((b) => {
                const bSpan = Math.min(normalizeBlockSpan(b.span, b.type), 12);
                const bHeight = Math.min(b.height || BLOCK_TYPES[b.type]?.height || 4, 30);
                previews[b.id] = {
                    col: (b.position?.col || 1) + deltaCol,
                    row: (b.position?.row || 1) + deltaRow,
                    span: bSpan,
                    height: bHeight,
                };
            });

            setGroupDropPreviews(previews);
            setDropPreview({
                col: (anchorBlock.position?.col || 1) + deltaCol,
                row: (anchorBlock.position?.row || 1) + deltaRow,
            });
        }
    };

    const handleBoardPointerDown = (event) => {
        if (event.pointerType === 'touch') return;
        if (window.innerWidth <= 768) return;

        const isBlock = event.target.closest('.admin-note-block');
        const isInteractive = event.target.closest(
            'a, input, textarea, select, button, label, .admin-note-todo-check-btn, .admin-note-todo-custom-check, .admin-note-flashcard, .admin-note-image-display, .admin-note-text-editor, .admin-note-table-wrap, .admin-note-block-resize'
        );
        if (isInteractive) return;

        // If clicking directly on a block without Shift and without marquee mode, let block drag handle it
        if (isBlock && !event.shiftKey && !event.altKey) {
            return;
        }

        event.preventDefault();
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch (e) { }

        marqueeStartRef.current = { x: event.clientX, y: event.clientY };
        isMarqueeActiveRef.current = true;
        marqueeBaseSelectionRef.current = event.shiftKey ? new Set(groupedBlockIds) : new Set();
    };

    const handleBoardPointerMove = (event) => {
        if (!isMarqueeActiveRef.current || !marqueeStartRef.current) return;
        const start = marqueeStartRef.current;
        const current = { x: event.clientX, y: event.clientY };
        const dist = Math.hypot(current.x - start.x, current.y - start.y);

        if (dist >= 4) {
            const left = Math.min(start.x, current.x);
            const top = Math.min(start.y, current.y);
            const width = Math.abs(current.x - start.x);
            const height = Math.abs(current.y - start.y);
            const right = left + width;
            const bottom = top + height;

            setMarqueeBox({ left, top, width, height });

            const nextSelected = new Set(marqueeBaseSelectionRef.current);
            if (boardRef.current) {
                const blockElements = boardRef.current.querySelectorAll('.admin-note-block');
                blockElements.forEach((el) => {
                    const id = el.getAttribute('data-block-id');
                    if (!id) return;
                    const bRect = el.getBoundingClientRect();
                    const overlaps = !(
                        bRect.right < left ||
                        bRect.left > right ||
                        bRect.bottom < top ||
                        bRect.top > bottom
                    );
                    if (overlaps) {
                        nextSelected.add(id);
                    }
                });
            }
            setGroupedBlockIds(nextSelected);
        }
    };

    const handleBoardPointerUp = (event) => {
        if (event.currentTarget && event.currentTarget.hasPointerCapture(event.pointerId)) {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch (e) { }
        }
        if (isMarqueeActiveRef.current && marqueeStartRef.current) {
            const dist = Math.hypot(
                event.clientX - marqueeStartRef.current.x,
                event.clientY - marqueeStartRef.current.y
            );
            if (dist < 4 && !event.target.closest('.admin-note-block')) {
                setGroupedBlockIds(new Set());
            }
        }
        isMarqueeActiveRef.current = false;
        marqueeStartRef.current = null;
        setMarqueeBox(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const targetTag = e.target.tagName ? e.target.tagName.toLowerCase() : '';
            const isInput = targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable;

            const hasTextSelection = () => {
                if (isInput && (targetTag === 'input' || targetTag === 'textarea')) {
                    return e.target.selectionStart !== e.target.selectionEnd;
                }
                const sel = window.getSelection();
                return sel && !sel.isCollapsed && sel.toString().length > 0;
            };

            // Save: Ctrl+S
            if (isCtrlOrCmd && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handleSave();
                return;
            }

            // Select All: Ctrl+A / Cmd+A (Select all widgets on the notes interface)
            if (isCtrlOrCmd && (e.key === 'a' || e.key === 'A')) {
                if (!e.target.closest('.admin-notes-list')) {
                    const blocks = draftRef.current?.blocks || [];
                    if (blocks.length > 0) {
                        let shouldSelectAllBlocks = !isInput;

                        if (isInput) {
                            if (targetTag === 'input' || targetTag === 'textarea') {
                                const isAllInputTextSelected =
                                    e.target.selectionStart === 0 &&
                                    e.target.selectionEnd === (e.target.value || '').length;
                                if (isAllInputTextSelected) {
                                    shouldSelectAllBlocks = true;
                                }
                            } else if (e.target.isContentEditable) {
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) {
                                    const range = sel.getRangeAt(0);
                                    const textLen = (e.target.textContent || '').length;
                                    const isAllContentSelected =
                                        textLen === 0 ||
                                        (range.toString().length >= textLen &&
                                            (range.commonAncestorContainer === e.target ||
                                                e.target.contains(range.commonAncestorContainer)));
                                    if (isAllContentSelected) {
                                        shouldSelectAllBlocks = true;
                                    }
                                }
                            }
                        }

                        if (shouldSelectAllBlocks) {
                            e.preventDefault();
                            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                                document.activeElement.blur();
                            }
                            const allIds = new Set(blocks.map((b) => b.id));
                            setGroupedBlockIds(allIds);
                            const count = allIds.size;
                            const msg = count === 1
                                ? t('admin.notesSection.singleWidgetSelected', '1 widget selected')
                                : t('admin.notesSection.groupSelected', '{count} elements grouped').replace('{count}', formatNumber ? formatNumber(count) : count);
                            showToast(msg);
                            return;
                        }
                    }
                }
            }

            // Undo: Ctrl+Z (without shift)
            if (isCtrlOrCmd && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
                if (!isInput) {
                    e.preventDefault();
                    handleUndo();
                    return;
                }
            }

            // Redo: Ctrl+Y OR Ctrl+Shift+Z
            if (
                (isCtrlOrCmd && (e.key === 'y' || e.key === 'Y')) ||
                (isCtrlOrCmd && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
            ) {
                if (!isInput) {
                    e.preventDefault();
                    handleRedo();
                    return;
                }
            }

            // Cut: Ctrl+X
            if (isCtrlOrCmd && (e.key === 'x' || e.key === 'X')) {
                if (!isInput || !hasTextSelection()) {
                    if (groupedBlockIds.size > 0) {
                        e.preventDefault();
                        handleCut();
                        return;
                    }
                }
            }

            // Copy: Ctrl+C
            if (isCtrlOrCmd && (e.key === 'c' || e.key === 'C')) {
                if (!isInput || !hasTextSelection()) {
                    if (groupedBlockIds.size > 0) {
                        e.preventDefault();
                        handleCopy();
                        return;
                    }
                }
            }

            // Paste: Ctrl+V
            if (isCtrlOrCmd && (e.key === 'v' || e.key === 'V')) {
                if (!isInput) {
                    e.preventDefault();
                    handlePaste();
                    return;
                }
            }

            // Delete / Backspace
            if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
                if (groupedBlockIds.size > 0) {
                    e.preventDefault();
                    handleDeleteSelectedBlocks();
                    return;
                }
            }

            // Escape
            if (e.key === 'Escape') {
                if (groupedBlockIds.size > 0) {
                    setGroupedBlockIds(new Set());
                    return;
                }
            }

            // Arrow key block nudging
            if (!isInput && groupedBlockIds.size > 0) {
                let deltaCol = 0;
                let deltaRow = 0;
                if (e.key === 'ArrowLeft') deltaCol = -1;
                else if (e.key === 'ArrowRight') deltaCol = 1;
                else if (e.key === 'ArrowUp') deltaRow = -1;
                else if (e.key === 'ArrowDown') deltaRow = 1;

                if (deltaCol !== 0 || deltaRow !== 0) {
                    e.preventDefault();
                    const current = draftRef.current;
                    const activeBlocks = (current.blocks || []).filter((b) => groupedBlockIds.has(b.id));
                    if (activeBlocks.length === 0) return;

                    let canMove = true;
                    activeBlocks.forEach((b) => {
                        const nextCol = (b.position?.col || 1) + deltaCol;
                        const span = Math.min(normalizeBlockSpan(b.span, b.type), 12);
                        const nextRow = (b.position?.row || 1) + deltaRow;
                        const height = b.height || BLOCK_TYPES[b.type]?.height || 4;
                        if (nextCol < 1 || nextCol + span - 1 > 12) canMove = false;
                        if (nextRow < 1 || nextRow + height - 1 > MAX_GRID_ROWS) canMove = false;
                    });

                    if (!canMove) return;

                    if (!arrowMoveBeforeDraftRef.current) {
                        arrowMoveBeforeDraftRef.current = current;
                    }

                    let neededRows = current.canvasRows || MIN_GRID_ROWS;
                    const updated = (current.blocks || []).map((b) => {
                        if (groupedBlockIds.has(b.id)) {
                            const newCol = (b.position?.col || 1) + deltaCol;
                            const newRow = (b.position?.row || 1) + deltaRow;
                            const height = b.height || BLOCK_TYPES[b.type]?.height || 4;
                            if (newRow + height - 1 > neededRows) {
                                neededRows = newRow + height - 1;
                            }
                            return { ...b, position: { col: newCol, row: newRow } };
                        }
                        return b;
                    });

                    const nextDraft = {
                        ...current,
                        canvasRows: Math.min(MAX_GRID_ROWS, neededRows),
                        blocks: updated,
                    };

                    if (arrowMoveTimerRef.current) {
                        clearTimeout(arrowMoveTimerRef.current);
                    }
                    arrowMoveTimerRef.current = setTimeout(() => {
                        if (arrowMoveBeforeDraftRef.current && draftRef.current) {
                            recordHistory(
                                arrowMoveBeforeDraftRef.current,
                                draftRef.current,
                                'Move widget',
                                selectedIdRef.current,
                                draftRef.current.title
                            );
                        }
                        arrowMoveBeforeDraftRef.current = null;
                        arrowMoveTimerRef.current = null;
                    }, 400);

                    setDraft(nextDraft);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        groupedBlockIds,
        handleSave,
        handleUndo,
        handleRedo,
        handleCut,
        handleCopy,
        handlePaste,
        handleDeleteSelectedBlocks,
        recordHistory,
        showToast,
        t,
        formatNumber,
    ]);

    const lowestBlockRow = useMemo(() => {
        return (draft.blocks || []).reduce((max, b) => {
            const row = Number(b?.position?.row) || 1;
            const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
            return Math.max(max, row + height - 1);
        }, 0);
    }, [draft.blocks]);

    const minAllowedRows = Math.max(MIN_GRID_ROWS, lowestBlockRow);
    const effectiveRows = Math.max(
        typeof draft.canvasRows === 'number' ? draft.canvasRows : MIN_GRID_ROWS,
        minAllowedRows
    );

    const addRows = useCallback((count = 5) => {
        const curr = draftRef.current;
        const lowest = (curr.blocks || []).reduce((max, b) => {
            const row = Number(b?.position?.row) || 1;
            const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
            return Math.max(max, row + height - 1);
        }, 0);
        const currentRows = Math.max(
            MIN_GRID_ROWS,
            typeof curr.canvasRows === 'number' ? curr.canvasRows : MIN_GRID_ROWS,
            lowest
        );
        const nextRows = Math.min(MAX_GRID_ROWS, currentRows + count);
        if (nextRows !== curr.canvasRows) {
            const nextDraft = { ...curr, canvasRows: nextRows };
            recordHistory(curr, nextDraft, `Add ${count} rows`);
            setDraft(nextDraft);
        }
    }, [recordHistory]);

    const deleteRows = useCallback((count = 5) => {
        const curr = draftRef.current;
        const lowest = (curr.blocks || []).reduce((max, b) => {
            const row = Number(b?.position?.row) || 1;
            const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
            return Math.max(max, row + height - 1);
        }, 0);
        const minRows = Math.max(MIN_GRID_ROWS, lowest);
        const currentRows = Math.max(
            minRows,
            typeof curr.canvasRows === 'number' ? curr.canvasRows : MIN_GRID_ROWS
        );
        const nextRows = Math.max(minRows, currentRows - count);
        if (nextRows !== curr.canvasRows) {
            const nextDraft = { ...curr, canvasRows: nextRows };
            recordHistory(curr, nextDraft, 'Delete rows');
            setDraft(nextDraft);
        }
    }, [recordHistory]);

    const trimRows = useCallback(() => {
        const curr = draftRef.current;
        const lowest = (curr.blocks || []).reduce((max, b) => {
            const row = Number(b?.position?.row) || 1;
            const height = Number(b?.height) || BLOCK_TYPES[b?.type]?.height || 4;
            return Math.max(max, row + height - 1);
        }, 0);
        const targetRows = Math.max(MIN_GRID_ROWS, lowest);
        if (targetRows !== curr.canvasRows) {
            const nextDraft = { ...curr, canvasRows: targetRows };
            recordHistory(curr, nextDraft, 'Trim empty rows');
            setDraft(nextDraft);
        }
    }, [recordHistory]);

    const unlockCountdownAudio = () => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            countdownAudioRef.current =
                countdownAudioRef.current || new AudioContextClass();
            countdownAudioRef.current.resume?.();
        } catch (error) {
            return null;
        }
    };

    const isTextActive = Boolean(
        activeTextBlockId &&
        draft.blocks.some((b) => b.id === activeTextBlockId && b.type === 'text')
    );

    return (
        <AdminLayout title={t('admin.notesSection.title', 'Notes & Ideas')}>
            <div
                className={`admin-notes-workspace${isFullScreen ? ' is-full-screen' : ''}`}
            >
                <div className="admin-notes-toolbar">
                    <label className="admin-notes-search">
                        <span>{t('admin.notesSection.searchNotes', 'Search notes')}</span>
                        <input
                            type="text"
                            inputMode="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('admin.notesSection.searchPlaceholder', 'Search title, folder, or content')}
                        />
                    </label>
                    <div className="admin-notes-toolbar-actions">
                        {noteView === 'active' && (
                            isCreatingToolbarFolder ? (
                                <div className="admin-notes-toolbar-folder-form">
                                    <span className="admin-note-folder-icon" aria-hidden="true">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                    </span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={toolbarFolderName}
                                        onChange={(e) => setToolbarFolderName(e.target.value)}
                                        placeholder={t('admin.notesSection.newFolderEllipsis', 'New folder...')}
                                        aria-label={t('admin.notesSection.newFolderNamePlaceholder', 'New folder name')}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (toolbarFolderName.trim()) {
                                                    const trimmed = toolbarFolderName
                                                        .trim()
                                                        .replace(/^\/+|\/+$/g, '');
                                                    handleCreateFolder(trimmed);
                                                    setToolbarFolderName('');
                                                    setIsCreatingToolbarFolder(false);
                                                }
                                            } else if (e.key === 'Escape') {
                                                setIsCreatingToolbarFolder(false);
                                                setToolbarFolderName('');
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="admin-note-btn-create"
                                        onClick={() => {
                                            if (toolbarFolderName.trim()) {
                                                const trimmed = toolbarFolderName
                                                    .trim()
                                                    .replace(/^\/+|\/+$/g, '');
                                                handleCreateFolder(trimmed);
                                                setToolbarFolderName('');
                                                setIsCreatingToolbarFolder(false);
                                            }
                                        }}
                                    >
                                        {t('admin.notesSection.create', 'Create')}
                                    </button>
                                    <button
                                        type="button"
                                        className="admin-note-btn-cancel"
                                        onClick={() => {
                                            setIsCreatingToolbarFolder(false);
                                            setToolbarFolderName('');
                                        }}
                                        title={t('admin.notesSection.cancel', 'Cancel')}
                                        aria-label={t('admin.notesSection.cancel', 'Cancel')}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="admin-notes-new-folder-btn"
                                    onClick={() => {
                                        setIsCreatingToolbarFolder(true);
                                        setToolbarFolderName('');
                                    }}
                                    title={t('admin.notesSection.newFolder', 'Create new folder')}
                                >
                                    {t('admin.notesSection.newFolderBtn', '+ New folder')}
                                </button>
                            )
                        )}
                        <button
                            type="button"
                            className="admin-notes-new"
                            onClick={() => {
                                setNoteView('active');
                                startNewNote('');
                            }}
                        >
                            {t('admin.notesSection.newNoteBtn', '+ New note')}
                        </button>
                    </div>
                </div>

                {error && <p className="admin-error">{error}</p>}
                {loading && <p className="admin-loading-text">{t('admin.notesSection.loading', 'Loading notes...')}</p>}

                {!loading && (
                    <div className="admin-notes-layout">
                        <NoteSidebar
                            noteView={noteView}
                            setNoteView={setNoteView}
                            notes={notes}
                            allFolders={allFolders}
                            folderNotesMap={folderNotesMap}
                            visibleNotes={visibleNotes}
                            rootNotes={rootNotes}
                            filteredNotes={filteredNotes}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            currentFolder={draft.folder}
                            selectedId={selectedId}
                            selectNote={selectNoteAndNavigate}
                            isCreatingFolder={isCreatingFolder}
                            setIsCreatingFolder={setIsCreatingFolder}
                            newFolderName={newFolderName}
                            setNewFolderName={setNewFolderName}
                            handleCreateFolder={handleCreateFolder}
                            renamingFolder={renamingFolder}
                            setRenamingFolder={setRenamingFolder}
                            renameValue={renameValue}
                            setRenameValue={setRenameValue}
                            handleRenameFolder={handleRenameFolder}
                            startRenamingFolder={startRenamingFolder}
                            handleDeleteFolder={handleDeleteFolder}
                            startNewNote={startNewNote}
                        />

                        <section className="admin-note-editor" aria-label="Note editor">
                            <form onSubmit={handleSave}>
                                <div className="admin-note-editor-header">
                                    <div className="admin-note-title-wrap">
                                        <input
                                            className="admin-note-title"
                                            value={draft.title}
                                            onChange={handleTitleChange}
                                            placeholder={t('admin.notesSection.untitledNote', 'Untitled note')}
                                            aria-label={t('admin.labels.title', 'Note title')}
                                        />
                                        {noteView !== 'archived' && (
                                            <div
                                                className="admin-note-folder-dropdown-wrap"
                                                ref={folderDropdownRef}
                                            >
                                                <button
                                                    type="button"
                                                    className={`admin-note-folder-chip${isFolderDropdownOpen ? ' is-open' : ''
                                                        }`}
                                                    onClick={() =>
                                                        setIsFolderDropdownOpen((prev) => !prev)
                                                    }
                                                    aria-expanded={isFolderDropdownOpen}
                                                    aria-haspopup="listbox"
                                                    title={t('admin.notesSection.changeFolder', 'Change note folder location')}
                                                >
                                                    <span
                                                        className="admin-note-folder-chip-icon"
                                                        aria-hidden="true"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                                    </span>
                                                    <span className="admin-note-folder-chip-label">
                                                        {draft.folder
                                                            ? `/${draft.folder}`
                                                            : t('admin.notesSection.rootFolder', '/ (Root)')}
                                                    </span>
                                                    <span
                                                        className="admin-note-folder-chip-arrow"
                                                        aria-hidden="true"
                                                    >
                                                        ▾
                                                    </span>
                                                </button>

                                                {isFolderDropdownOpen && (
                                                    <div
                                                        className="admin-note-folder-menu"
                                                        role="listbox"
                                                    >
                                                        <div className="admin-note-folder-menu-header">
                                                            <span>{t('admin.notesSection.noteLocation', 'Note Location')}</span>
                                                        </div>
                                                        <div className="admin-note-folder-menu-items">
                                                            <button
                                                                type="button"
                                                                className={`admin-note-folder-menu-item${!draft.folder ? ' is-selected' : ''
                                                                    }`}
                                                                onClick={() => {
                                                                    handleFolderChange('');
                                                                    setIsFolderDropdownOpen(false);
                                                                }}
                                                                role="option"
                                                                aria-selected={!draft.folder}
                                                            >
                                                                <span className="admin-note-folder-item-icon">
                                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                                                </span>
                                                                <span className="admin-note-folder-item-text">
                                                                    {t('admin.notesSection.rootFolder', '/ (Root)')}
                                                                </span>
                                                                {!draft.folder && (
                                                                    <span
                                                                        className="admin-note-folder-item-check"
                                                                        aria-hidden="true"
                                                                    >
                                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                    </span>
                                                                )}
                                                            </button>

                                                            {allFolders.map((folder) => {
                                                                const isSelected =
                                                                    draft.folder === folder;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={folder}
                                                                        className={`admin-note-folder-menu-item${isSelected
                                                                            ? ' is-selected'
                                                                            : ''
                                                                            }`}
                                                                        onClick={() => {
                                                                            handleFolderChange(
                                                                                folder
                                                                            );
                                                                            setIsFolderDropdownOpen(
                                                                                false
                                                                            );
                                                                        }}
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                    >
                                                                        <span className="admin-note-folder-item-icon">
                                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                                                        </span>
                                                                        <span className="admin-note-folder-item-text">
                                                                            /{folder}
                                                                        </span>
                                                                        {isSelected && (
                                                                            <span
                                                                                className="admin-note-folder-item-check"
                                                                                aria-hidden="true"
                                                                            >
                                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                            </span>
                                                                        )}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <div className="admin-note-folder-menu-footer">
                                                            {isCreatingDropdownFolder ? (
                                                                <div className="admin-note-dropdown-folder-form">
                                                                    <span
                                                                        className="admin-note-folder-item-icon"
                                                                        aria-hidden="true"
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                                                    </span>
                                                                    <input
                                                                        autoFocus
                                                                        type="text"
                                                                        value={
                                                                            dropdownFolderName
                                                                        }
                                                                        onChange={(e) =>
                                                                            setDropdownFolderName(
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        placeholder={t('admin.notesSection.newFolderNamePlaceholder', 'New folder name...')}
                                                                        aria-label={t('admin.notesSection.newFolderNamePlaceholder', 'New folder name')}
                                                                        onKeyDown={(e) => {
                                                                            if (
                                                                                e.key === 'Enter'
                                                                            ) {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                if (
                                                                                    dropdownFolderName.trim()
                                                                                ) {
                                                                                    const trimmed =
                                                                                        dropdownFolderName
                                                                                            .trim()
                                                                                            .replace(
                                                                                                /^\/+|\/+$/g,
                                                                                                ''
                                                                                            );
                                                                                    handleCreateFolder(
                                                                                        trimmed
                                                                                    );
                                                                                    handleFolderChange(
                                                                                        trimmed
                                                                                    );
                                                                                    setDropdownFolderName(
                                                                                        ''
                                                                                    );
                                                                                    setIsCreatingDropdownFolder(
                                                                                        false
                                                                                    );
                                                                                    setIsFolderDropdownOpen(
                                                                                        false
                                                                                    );
                                                                                }
                                                                            } else if (
                                                                                e.key === 'Escape'
                                                                            ) {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                setIsCreatingDropdownFolder(
                                                                                    false
                                                                                );
                                                                                setDropdownFolderName(
                                                                                    ''
                                                                                );
                                                                            }
                                                                        }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        className="admin-note-btn-create"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (
                                                                                dropdownFolderName.trim()
                                                                            ) {
                                                                                const trimmed =
                                                                                    dropdownFolderName
                                                                                        .trim()
                                                                                        .replace(
                                                                                            /^\/+|\/+$/g,
                                                                                            ''
                                                                                        );
                                                                                handleCreateFolder(
                                                                                    trimmed
                                                                                );
                                                                                handleFolderChange(
                                                                                    trimmed
                                                                                );
                                                                                setDropdownFolderName(
                                                                                    ''
                                                                                );
                                                                                setIsCreatingDropdownFolder(
                                                                                    false
                                                                                );
                                                                                setIsFolderDropdownOpen(
                                                                                    false
                                                                                );
                                                                            }
                                                                        }}
                                                                    >
                                                                        {t('admin.notesSection.create', 'Create')}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="admin-note-btn-cancel"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setIsCreatingDropdownFolder(
                                                                                false
                                                                            );
                                                                            setDropdownFolderName(
                                                                                ''
                                                                            );
                                                                        }}
                                                                        title={t('admin.notesSection.cancel', 'Cancel')}
                                                                        aria-label={t('admin.notesSection.cancel', 'Cancel')}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="admin-note-folder-menu-add"
                                                                    onClick={() => {
                                                                        setIsCreatingDropdownFolder(
                                                                            true
                                                                        );
                                                                        setDropdownFolderName('');
                                                                    }}
                                                                >
                                                                    <span aria-hidden="true">+</span>{' '}
                                                                    {t('admin.notesSection.newFolderEllipsis', 'New folder...')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="admin-note-actions">
                                        {selectedId && (
                                            <button
                                                type="button"
                                                className={`admin-note-pin-btn${draft.pinned ? ' is-pinned' : ''}`}
                                                onClick={handleTogglePin}
                                                disabled={saving}
                                                title={
                                                    draft.pinned
                                                        ? t('admin.notesSection.unpinFromDashboard', 'Unpin from Dashboard')
                                                        : t('admin.notesSection.pinToDashboard', 'Pin to Dashboard')
                                                }
                                                aria-label={
                                                    draft.pinned
                                                        ? t('admin.notesSection.unpinFromDashboard', 'Unpin from Dashboard')
                                                        : t('admin.notesSection.pinToDashboard', 'Pin to Dashboard')
                                                }
                                            >
                                                {draft.pinned
                                                    ? t('admin.notesSection.pinned', 'Pinned')
                                                    : t('admin.notesSection.pin', 'Pin')}
                                            </button>
                                        )}
                                        {selectedId && (
                                            <button
                                                type="button"
                                                className="archive"
                                                onClick={handleArchiveToggle}
                                                disabled={saving}
                                            >
                                                {noteView === 'archived'
                                                    ? t('admin.notesSection.unarchive', 'Unarchive')
                                                    : t('admin.notesSection.archive', 'Archive')}
                                            </button>
                                        )}
                                        {selectedId && (
                                            <button
                                                type="button"
                                                className="danger"
                                                onClick={handleDelete}
                                                disabled={saving}
                                            >
                                                {t('admin.notesSection.delete', 'Delete')}
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="admin-notes-fullscreen"
                                            onClick={() =>
                                                setIsFullScreen((current) => !current)
                                            }
                                            aria-pressed={isFullScreen}
                                            aria-label={
                                                isFullScreen
                                                    ? t('admin.notesSection.exitFullScreen', 'Exit full screen')
                                                    : t('admin.notesSection.fullScreen', 'Full screen')
                                            }
                                        >
                                            {isFullScreen
                                                ? t('admin.notesSection.exitFullScreen', 'Exit full screen')
                                                : t('admin.notesSection.fullScreen', 'Full screen')}
                                        </button>
                                        <button
                                            type="submit"
                                            className="primary"
                                            disabled={saving}
                                        >
                                            {saving
                                                ? t('admin.actions.saving', 'Saving...')
                                                : t('admin.notesSection.saveNote', 'Save note')}
                                        </button>
                                    </div>
                                </div>
                                <div className="admin-note-board-shell">
                                    <div
                                        className="admin-note-widget-palette"
                                        aria-label="Widget palette"
                                    >
                                        <div className="admin-note-widget-group">
                                            <div className="admin-note-widget-top-row">
                                                <span>{t('admin.notesSection.widgets', 'Widgets')}</span>
                                                <div className="admin-note-widget-core">
                                                    {primaryWidgetTypes.map((blockType) => (
                                                        <button
                                                            type="button"
                                                            key={blockType}
                                                            onClick={() => addBlock(blockType)}
                                                        >
                                                            <b>
                                                                {blockType === 'habit' ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-1px' }}>
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                ) : (
                                                                    BLOCK_TYPES[blockType]?.icon
                                                                )}
                                                            </b>
                                                            {t(`admin.notesSection.blockTypes.${blockType}`, BLOCK_TYPES[blockType].label)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    className="admin-note-widget-more"
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        saveTextSelection();
                                                    }}
                                                    onClick={() =>
                                                        setShowMoreWidgets(
                                                            (current) => !current
                                                        )
                                                    }
                                                    aria-expanded={showMoreWidgets}
                                                    aria-label={
                                                        showMoreWidgets
                                                            ? t('admin.notesSection.hideMoreWidgets', 'Hide more widgets')
                                                            : t('admin.notesSection.showMoreWidgets', 'Show more widgets')
                                                    }
                                                    title={
                                                        showMoreWidgets
                                                            ? t('admin.notesSection.hideMoreWidgets', 'Hide more widgets')
                                                            : t('admin.notesSection.showMoreWidgets', 'Show more widgets')
                                                    }
                                                >
                                                    <span aria-hidden="true">
                                                        {showMoreWidgets ? '▲' : '▼'}
                                                    </span>
                                                </button>
                                            </div>
                                            {showMoreWidgets && (
                                                <div className="admin-note-secondary-widgets">
                                                    {secondaryWidgetTypes.map((blockType) => (
                                                        <button
                                                            type="button"
                                                            key={blockType}
                                                            onClick={() => addBlock(blockType)}
                                                        >
                                                            <b>
                                                                {blockType === 'habit' ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: '-1px' }}>
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                ) : (
                                                                    BLOCK_TYPES[blockType]?.icon
                                                                )}
                                                            </b>
                                                            {t(`admin.notesSection.blockTypes.${blockType}`, BLOCK_TYPES[blockType].label)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {showMoreWidgets && (
                                            <>
                                                <div className="admin-note-text-tools">
                                                <span>{t('admin.notesSection.textStyling', 'Text styling')}</span>
                                                {TEXT_STYLES.map((style) => (
                                                    <button
                                                        type="button"
                                                        key={style.label}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() => applyTextStyle(style)}
                                                        disabled={!isTextActive}
                                                    >
                                                        {t(`admin.notesSection.textStyles.${style.command}`, style.label)}
                                                    </button>
                                                ))}
                                                {TEXT_LIST_STYLES.map((style) => (
                                                    <button
                                                        type="button"
                                                        key={style.label}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() => applyTextStyle(style)}
                                                        disabled={!isTextActive}
                                                    >
                                                        {t(`admin.notesSection.textStyles.${style.command}`, style.label)}
                                                    </button>
                                                ))}
                                                <div
                                                    className="admin-note-font-size-control"
                                                    aria-label="Font size"
                                                >
                                                    <button
                                                        type="button"
                                                        aria-label="Decrease font size"
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() =>
                                                            applyTextSize(textSizeLevel - 1)
                                                        }
                                                        disabled={!isTextActive || textSizeLevel === 0}
                                                    >
                                                        −
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-note-font-size-icon"
                                                        aria-label={`Text size ${TEXT_SIZE_OPTIONS[textSizeLevel].label}`}
                                                        title={
                                                            TEXT_SIZE_OPTIONS[textSizeLevel]
                                                                .label
                                                        }
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() =>
                                                            applyTextSize(
                                                                textSizeLevel ===
                                                                    TEXT_SIZE_OPTIONS.length - 1
                                                                    ? 0
                                                                    : textSizeLevel + 1
                                                            )
                                                        }
                                                        disabled={!isTextActive}
                                                    >
                                                        {textSizeLevel === 0
                                                            ? 'T'
                                                            : TEXT_SIZE_OPTIONS[textSizeLevel]
                                                                .label}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        aria-label="Increase font size"
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() =>
                                                            applyTextSize(textSizeLevel + 1)
                                                        }
                                                        disabled={
                                                            !isTextActive ||
                                                            textSizeLevel ===
                                                            TEXT_SIZE_OPTIONS.length - 1
                                                        }
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                </div>
                                                <div className="admin-note-text-tools admin-note-options-tools" aria-label="Options">
                                                    <span>{t('admin.notesSection.options', 'Options')}</span>
                                                    <button
                                                        type="button"
                                                        className="admin-note-history-btn"
                                                        onClick={handleUndo}
                                                        disabled={undoStackRef.current.length === 0}
                                                        title={t('admin.notesSection.undoShortcut', 'Undo (Ctrl+Z)')}
                                                        aria-label={t('admin.notesSection.undoShortcut', 'Undo (Ctrl+Z)')}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <polyline points="9 14 4 9 9 4" />
                                                            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                                                        </svg>
                                                        <span>{t('admin.notesSection.undo', 'Undo')}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-note-history-btn"
                                                        onClick={handleRedo}
                                                        disabled={redoStackRef.current.length === 0}
                                                        title={t('admin.notesSection.redoShortcut', 'Redo (Ctrl+Y)')}
                                                        aria-label={t('admin.notesSection.redoShortcut', 'Redo (Ctrl+Y)')}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <polyline points="15 14 20 9 15 4" />
                                                            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
                                                        </svg>
                                                        <span>{t('admin.notesSection.redo', 'Redo')}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="admin-note-history-btn"
                                                        onClick={handlePaste}
                                                        disabled={!hasClipboard}
                                                        title={t('admin.notesSection.pasteShortcut', 'Paste (Ctrl+V)')}
                                                        aria-label={t('admin.notesSection.pasteShortcut', 'Paste (Ctrl+V)')}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                                        </svg>
                                                        <span>{t('admin.notesSection.paste', 'Paste')}</span>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {selectedId && activeBacklinks.length > 0 && (
                                        <div className="admin-note-backlinks-bar" aria-label="Backlinks">
                                            <span className="admin-note-backlinks-label">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                                {t('admin.notesSection.backlinks', 'Linked from')}:
                                            </span>
                                            <div className="admin-note-backlinks-list">
                                                {activeBacklinks.map((bl) => (
                                                    <button
                                                        key={bl.id}
                                                        type="button"
                                                        className="admin-note-backlink-chip"
                                                        onClick={() => selectNoteAndNavigate(bl.note)}
                                                        title={bl.preview || bl.title}
                                                    >
                                                        <span className="admin-note-backlink-chip-icon">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                                                        </span>
                                                        <span className="admin-note-backlink-chip-title">{bl.title}</span>
                                                        {bl.folder && (
                                                            <span className="admin-note-backlink-chip-folder">/{bl.folder}</span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        className="admin-note-blocks"
                                        ref={boardRef}
                                        style={{
                                            gridTemplateRows: `repeat(${effectiveRows}, 38px)`,
                                        }}
                                        onPointerDown={handleBoardPointerDown}
                                        onPointerMove={handleBoardPointerMove}
                                        onPointerUp={handleBoardPointerUp}
                                    >
                                        {groupDropPreviews ? (
                                            Object.entries(groupDropPreviews).map(([bId, p]) => (
                                                <div
                                                    key={`group-drop-${bId}`}
                                                    className="admin-note-drop-preview is-group"
                                                    style={{
                                                        gridColumn: `${p.col} / span ${p.span}`,
                                                        gridRow: `${p.row} / span ${p.height}`,
                                                    }}
                                                    aria-hidden="true"
                                                />
                                            ))
                                        ) : draggingBlockId && dropPreview ? (() => {
                                            const draggingBlock = draft.blocks.find((b) => b.id === draggingBlockId);
                                            if (!dropPreview || !draggingBlock) return null;
                                            const width = Math.min(normalizeBlockSpan(draggingBlock.span, draggingBlock.type), 12);
                                            const height = Math.min(draggingBlock.height || BLOCK_TYPES[draggingBlock.type]?.height || 4, 30);
                                            return (
                                                <div
                                                    className="admin-note-drop-preview"
                                                    style={{
                                                        gridColumn: `${dropPreview.col} / span ${width}`,
                                                        gridRow: `${dropPreview.row} / span ${height}`,
                                                    }}
                                                    aria-label={`Drop position: column ${dropPreview.col}, row ${dropPreview.row}`}
                                                />
                                            );
                                        })() : null}
                                        {draft.blocks.map((block, index) => (
                                            <NoteBlock
                                                key={block.id}
                                                block={block}
                                                index={index}
                                                updateBlock={updateBlock}
                                                removeBlock={removeBlock}
                                                startBlockDrag={startBlockDrag}
                                                updateDropPreview={updateDropPreview}
                                                finishBlockDrag={finishBlockDrag}
                                                startBlockResize={startBlockResize}
                                                updateBlockResize={updateBlockResize}
                                                finishBlockResize={finishBlockResize}
                                                draggingBlockId={draggingBlockId}
                                                isGrouped={groupedBlockIds.has(block.id)}
                                                notes={notes}
                                                selectedId={selectedId}
                                                selectNote={selectNoteAndNavigate}
                                                editingLinkId={editingLinkId}
                                                setEditingLinkId={setEditingLinkId}
                                                linkClickTimerRef={linkClickTimerRef}
                                                editingFlashcardId={editingFlashcardId}
                                                setEditingFlashcardId={setEditingFlashcardId}
                                                editingImageId={editingImageId}
                                                setEditingImageId={setEditingImageId}
                                                imageErrors={imageErrors}
                                                setImageErrors={setImageErrors}
                                                editingEquationId={editingEquationId}
                                                setEditingEquationId={setEditingEquationId}
                                                editingNoteLinkId={editingNoteLinkId}
                                                setEditingNoteLinkId={setEditingNoteLinkId}
                                                currentTime={currentTime}
                                                unlockCountdownAudio={unlockCountdownAudio}
                                                setActiveTextBlockId={setActiveTextBlockId}
                                                saveTextSelection={saveTextSelection}
                                            />
                                        ))}
                                        {draft.blocks.length === 0 && (
                                            <div
                                                className="admin-note-board-empty"
                                                aria-label="Empty board"
                                            >
                                                <p>{t('admin.notesSection.noWidgets', 'No widgets on this board')}</p>
                                                <span>{t('admin.notesSection.clickWidgetToAdd', 'Click any widget above to add content')}</span>
                                            </div>
                                        )}
                                    </div>
                                    {groupedBlockIds.size >= 1 && (
                                        <div className="admin-note-group-bar" role="status" aria-live="polite">
                                            <span className="admin-note-group-bar-icon" aria-hidden="true">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                                            </span>
                                            <span className="admin-note-group-bar-text">
                                                {groupedBlockIds.size === 1
                                                    ? t('admin.notesSection.singleWidgetSelected', '1 widget selected')
                                                    : t('admin.notesSection.groupSelected', '{count} elements grouped').replace('{count}', formatNumber ? formatNumber(groupedBlockIds.size) : groupedBlockIds.size)}
                                            </span>
                                            <div className="admin-note-group-bar-actions">
                                                <button
                                                    type="button"
                                                    className="admin-note-group-bar-btn"
                                                    onClick={handleCut}
                                                    title={t('admin.notesSection.cutShortcut', 'Cut (Ctrl+X)')}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <circle cx="6" cy="6" r="3" />
                                                        <circle cx="6" cy="18" r="3" />
                                                        <line x1="20" y1="4" x2="8.12" y2="15.88" />
                                                        <line x1="14.47" y1="14.48" x2="20" y2="20" />
                                                        <line x1="8.12" y1="8.12" x2="12" y2="12" />
                                                    </svg>
                                                    <span>{t('admin.notesSection.cut', 'Cut')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-note-group-bar-btn"
                                                    onClick={handleCopy}
                                                    title={t('admin.notesSection.copyShortcut', 'Copy (Ctrl+C)')}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                    </svg>
                                                    <span>{t('admin.notesSection.copy', 'Copy')}</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="admin-note-group-bar-btn admin-note-group-bar-btn-delete"
                                                    onClick={handleDeleteSelectedBlocks}
                                                    title={t('admin.notesSection.deleteShortcut', 'Delete (Del)')}
                                                >
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                    </svg>
                                                    <span>{t('admin.notesSection.delete', 'Delete')}</span>
                                                </button>
                                            </div>
                                            <button
                                                type="button"
                                                className="admin-note-group-bar-ungroup-btn"
                                                onClick={() => setGroupedBlockIds(new Set())}
                                                title={t('admin.notesSection.deselect', 'Deselect (Esc)')}
                                            >
                                                ✕ {groupedBlockIds.size > 1 ? t('admin.notesSection.ungroup', 'Ungroup') : t('admin.notesSection.deselect', 'Deselect')}
                                            </button>
                                        </div>
                                    )}
                                    {marqueeBox && (
                                        <div
                                            className="admin-note-marquee-box"
                                            style={{
                                                left: `${marqueeBox.left}px`,
                                                top: `${marqueeBox.top}px`,
                                                width: `${marqueeBox.width}px`,
                                                height: `${marqueeBox.height}px`,
                                            }}
                                            aria-hidden="true"
                                        />
                                    )}
                                    <div
                                        className="admin-note-canvas-footer"
                                        aria-label={t('admin.notesSection.canvasHeight', 'Canvas Height')}
                                    >
                                        <div className="admin-note-canvas-controls">
                                            <button
                                                type="button"
                                                className="admin-note-canvas-btn"
                                                onClick={() => deleteRows(5)}
                                                disabled={effectiveRows <= minAllowedRows}
                                                title={
                                                    effectiveRows <= minAllowedRows
                                                        ? t(
                                                            'admin.notesSection.cannotReduceRows',
                                                            'Cannot reduce rows below active widgets or minimum (20)'
                                                        )
                                                        : t('admin.notesSection.delete5Rows', '-5 rows')
                                                }
                                                aria-label={t('admin.notesSection.delete5Rows', '-5 rows')}
                                            >
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                <span>5 {t('admin.notesSection.rowsUnit', 'rows')}</span>
                                            </button>
                                            <span className="admin-note-canvas-count" aria-live="polite">
                                                <strong>
                                                    {formatNumber ? formatNumber(effectiveRows) : effectiveRows}
                                                </strong>{' '}
                                                {t('admin.notesSection.rowsUnit', 'rows')}
                                            </span>
                                            <button
                                                type="button"
                                                className="admin-note-canvas-btn"
                                                onClick={() => addRows(5)}
                                                disabled={effectiveRows >= MAX_GRID_ROWS}
                                                title={t(
                                                    'admin.notesSection.add5RowsTitle',
                                                    t('admin.notesSection.add5Rows', '+5 rows')
                                                )}
                                                aria-label={t('admin.notesSection.add5Rows', '+5 rows')}
                                            >
                                                <svg
                                                    width="12"
                                                    height="12"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                <span>5 {t('admin.notesSection.rowsUnit', 'rows')}</span>
                                            </button>
                                            {effectiveRows > minAllowedRows && (
                                                <>
                                                    <span className="admin-note-canvas-divider" aria-hidden="true" />
                                                    <button
                                                        type="button"
                                                        className="admin-note-canvas-btn admin-note-canvas-btn-trim"
                                                        onClick={trimRows}
                                                        title={t(
                                                            'admin.notesSection.trimEmptyRowsTitle',
                                                            'Remove trailing empty rows below widgets'
                                                        )}
                                                        aria-label={t(
                                                            'admin.notesSection.trimEmptyRows',
                                                            'Trim empty rows'
                                                        )}
                                                    >
                                                        <svg
                                                            width="12"
                                                            height="12"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2.2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                        >
                                                            <polyline points="4 14 10 14 10 20" />
                                                            <polyline points="20 10 14 10 14 4" />
                                                            <line x1="14" y1="10" x2="21" y2="3" />
                                                            <line x1="3" y1="21" x2="10" y2="14" />
                                                        </svg>
                                                        <span>{t('admin.notesSection.trim', 'Trim')}</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
            {toastMessage && (
                <div className="admin-note-toast" role="status" aria-live="polite">
                    <span className="admin-note-toast-icon">✓</span>
                    <span>{toastMessage}</span>
                </div>
            )}
        </AdminLayout>
    );
};

export default NotesAdmin;
