import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useContent } from '../../utils/ContentContext';
import {
    BLOCK_TYPES,
    MAX_GRID_ROWS,
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
} from './notes/noteUtils';
import { NoteBlock } from './notes/NoteWidgets';
import NoteSidebar from './notes/NoteSidebar';

const NotesAdmin = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useContent();
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
    const boardRef = useRef(null);
    const resizeSessionRef = useRef(null);

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
        'table',
        'link',
        'list',
        'callout',
        'quote',
        'image',
        'code',
        'divider',
        'todo',
        'note_link',
        'timeline',
        'date',
        'status',
        'counter',
        'progress',
        'countdown',
        'rating',
        'flashcards',
        'picker',
        'chart',
        'equation',
        'habit',
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
            .map((n) => n.folder)
            .filter(Boolean);
        const combined = Array.from(new Set([...customFolders, ...fromNotes]));
        return combined.sort((a, b) => a.localeCompare(b));
    }, [customFolders, notes]);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return visibleNotes;
        return visibleNotes.filter((note) => {
            const preview = note.content || '';
            return `${note.title} ${note.folder || ''} ${note.content || ''} ${preview}`
                .toLowerCase()
                .includes(term);
        });
    }, [search, visibleNotes]);

    const rootNotes = useMemo(() => {
        return filteredNotes.filter((note) => !note.folder || note.folder === '/');
    }, [filteredNotes]);

    const folderNotesMap = useMemo(() => {
        const map = {};
        allFolders.forEach((f) => {
            map[f] = filteredNotes.filter((note) => note.folder === f);
        });
        return map;
    }, [allFolders, filteredNotes]);

    useEffect(() => {
        if (search.trim()) {
            const matchingFolders = new Set();
            filteredNotes.forEach((n) => {
                if (n.folder) matchingFolders.add(n.folder);
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
        const trimmed = targetFolder
            ? String(targetFolder).trim().replace(/^\/+|\/+$/g, '')
            : '';
        setDraft((current) => ({ ...current, folder: trimmed }));
        if (trimmed) {
            setExpandedFolders((current) => new Set([...current, trimmed]));
        }
        if (selectedId) {
            setSaving(true);
            try {
                const updated = await request(`${NOTES_API}/${selectedId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ folder: trimmed }),
                });
                const updatedNote = {
                    ...updated,
                    folder:
                        updated && updated.folder !== undefined
                            ? updated.folder || ''
                            : trimmed,
                };
                setNotes((current) =>
                    current.map((n) =>
                        n.id === selectedId ? { ...n, ...updatedNote, folder: trimmed } : n
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
            setSelectedId(note.id);
            setDraft({
                title: note.title,
                content: note.content,
                folder: note.folder || '',
                pinned: Boolean(note.pinned),
                blocks: blocksFromNote(note),
            });
            if (note.folder) {
                setExpandedFolders((current) => new Set([...current, note.folder]));
            }
            if (note.archived) {
                setNoteView('archived');
            }
            setError('');
        }
    }, []);

    const selectNoteAndNavigate = useCallback((note) => {
        if (note) {
            selectNote(note);
            if (String(id) !== String(note.id)) {
                navigate(`/admin/notes/${note.id}`);
            }
        }
    }, [selectNote, id, navigate]);

    const startNewNote = useCallback((folder = '') => {
        const cleanFolder = folder
            ? String(folder).trim().replace(/^\/+|\/+$/g, '')
            : '';
        setSelectedId(null);
        setDraft({
            title: '',
            content: '',
            folder: cleanFolder,
            pinned: false,
            blocks: [],
        });
        if (cleanFolder) {
            setExpandedFolders((current) => new Set([...current, cleanFolder]));
        }
        setError('');
        if (id) {
            navigate('/admin/notes');
        }
    }, [id, navigate]);

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
            const folderValue = draft.folder
                ? String(draft.folder).trim().replace(/^\/+|\/+$/g, '')
                : '';
            const bodyData = {
                ...draft,
                pinned: Boolean(draft.pinned),
                folder: folderValue,
                content,
            };
            const saved = await request(
                selectedId ? `${NOTES_API}/${selectedId}` : NOTES_API,
                {
                    method: selectedId ? 'PUT' : 'POST',
                    body: JSON.stringify(bodyData),
                }
            );
            const savedNote = {
                ...saved,
                pinned:
                    saved && saved.pinned !== undefined
                        ? saved.pinned
                        : Boolean(draft.pinned),
                folder:
                    saved && saved.folder !== undefined
                        ? saved.folder || ''
                        : folderValue,
            };
            setNotes((current) => {
                const withoutSaved = current.filter((note) => note.id !== savedNote.id);
                return [savedNote, ...withoutSaved];
            });
            setSelectedId(savedNote.id);
            setDraft({
                title: savedNote.title,
                content: savedNote.content,
                folder: savedNote.folder || '',
                pinned: Boolean(savedNote.pinned),
                blocks: blocksFromNote(savedNote),
            });
            if (savedNote.folder) {
                setExpandedFolders((current) => new Set([...current, savedNote.folder]));
            }
            if (String(id) !== String(savedNote.id)) {
                navigate(`/admin/notes/${savedNote.id}`, { replace: true });
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }, [draft, selectedId, request, id, navigate]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

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

    const updateBlock = (blockId, changes) =>
        setDraft((current) => ({
            ...current,
            blocks: current.blocks.map((block) =>
                block.id === blockId ? { ...block, ...changes } : block
            ),
        }));

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

    const addBlock = (type, afterId = null) =>
        setDraft((current) => {
            const next = createBlock(type);
            next.position = findFreePosition(current.blocks, next);
            const index = afterId
                ? current.blocks.findIndex((block) => block.id === afterId) + 1
                : current.blocks.length;
            if (type === 'link') setEditingLinkId(next.id);
            if (type === 'note_link') setEditingNoteLinkId(next.id);
            if (type === 'flashcards') setEditingFlashcardId(next.id);
            if (type === 'image') setEditingImageId(next.id);
            return {
                ...current,
                blocks: [
                    ...current.blocks.slice(0, index),
                    next,
                    ...current.blocks.slice(index),
                ],
            };
        });

    const removeBlock = (blockId) =>
        setDraft((current) => ({
            ...current,
            blocks: current.blocks.filter((block) => block.id !== blockId),
        }));

    const placeBlock = (blockId, col, row) =>
        updateBlock(blockId, { position: { col, row } });

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
        const clampedHeight = Math.max(session.minHeight, Math.min(30, newHeight));
        if (clampedSpan !== block.span || clampedHeight !== block.height) {
            updateBlock(block.id, { span: clampedSpan, height: clampedHeight });
        }
    };

    const finishBlockResize = (event) => {
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
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingBlockId(blockId);
        const block = draft.blocks.find((b) => b.id === blockId);
        if (block) {
            setDropPreview(block.position || { col: 1, row: 1 });
        }
    };

    const finishBlockDrag = (event, blockId) => {
        if (draggingBlockId === blockId) {
            if (dropPreview) {
                placeBlock(blockId, dropPreview.col, dropPreview.row);
            }
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            setDraggingBlockId(null);
            setDropPreview(null);
        }
    };

    const updateDropPreview = (event) => {
        if (!draggingBlockId || !boardRef.current) return;
        const block = draft.blocks.find((b) => b.id === draggingBlockId);
        if (!block) return;
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const { bounds, paddingX, paddingY, gap, cellWidth, rowHeight } = metrics;
        const width = Math.min(normalizeBlockSpan(block.span, block.type), 12);
        const height = Math.min(block.height || BLOCK_TYPES[block.type]?.height || 4, 30);
        const rawCol = Math.floor((event.clientX - bounds.left - paddingX) / (cellWidth + gap)) + 1;
        const rawRow = Math.floor((event.clientY - bounds.top - paddingY) / rowHeight) + 1;
        const col = Math.max(1, Math.min(rawCol, 13 - width));
        const row = Math.max(1, Math.min(rawRow, MAX_GRID_ROWS - height + 1));
        setDropPreview((current) =>
            current && current.col === col && current.row === row ? current : { col, row }
        );
    };

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
                                            onChange={(event) =>
                                                setDraft({ ...draft, title: event.target.value })
                                            }
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
                                    <div className="admin-note-blocks" ref={boardRef}>
                                        {draggingBlockId && (() => {
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
                                        })()}
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
                                </div>
                            </form>
                        </section>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default NotesAdmin;
