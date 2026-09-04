import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
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
    FOLDERS_STORAGE_KEY,
    EXPANDED_FOLDERS_KEY,
} from './notes/noteUtils';
import { NoteBlock } from './notes/NoteWidgets';
import NoteSidebar from './notes/NoteSidebar';

const NotesAdmin = () => {
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState({ title: '', content: '', folder: '', blocks: [] });
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
        'list',
        'callout',
        'quote',
        'image',
        'code',
        'divider',
        'todo',
        'link',
        'note_link',
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
    const primaryWidgetTypes = widgetOrder.slice(0, 9);
    const boardRowCount = Math.max(
        30,
        ...draft.blocks.map((block) => (block.position?.row || 1) + (block.height || 3) - 1)
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
        const fromNotes = notes.map((n) => n.folder).filter(Boolean);
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
                console.error('Failed to rename note folder:', err);
            }
        }
        setNotes((current) =>
            current.map((n) => (n.folder === oldName ? { ...n, folder: trimmed } : n))
        );
    };

    const handleDeleteFolder = async (folderName) => {
        if (
            !window.confirm(
                `Delete folder "${folderName}"? Notes in this folder will be moved to / (root).`
            )
        )
            return;

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
                console.error('Failed to clear note folder on delete:', err);
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
                console.error('Failed to change folder:', err);
                setError('Failed to update folder location');
            } finally {
                setSaving(false);
            }
        }
    };

    const selectNote = (note) => {
        setSelectedId(note.id);
        setDraft({
            title: note.title,
            content: note.content,
            folder: note.folder || '',
            blocks: blocksFromNote(note),
        });
        if (note.folder) {
            setExpandedFolders((current) => new Set([...current, note.folder]));
        }
        setError('');
    };

    const startNewNote = (folder = '') => {
        const cleanFolder = folder
            ? String(folder).trim().replace(/^\/+|\/+$/g, '')
            : '';
        setSelectedId(null);
        setDraft({ title: '', content: '', folder: cleanFolder, blocks: [] });
        if (cleanFolder) {
            setExpandedFolders((current) => new Set([...current, cleanFolder]));
        }
        setError('');
    };

    const handleSave = async (event) => {
        event.preventDefault();
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
                blocks: blocksFromNote(savedNote),
            });
            if (savedNote.folder) {
                setExpandedFolders((current) => new Set([...current, savedNote.folder]));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedId || !window.confirm('Delete this note?')) return;

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

    const updateBlock = (id, changes) =>
        setDraft((current) => ({
            ...current,
            blocks: current.blocks.map((block) =>
                block.id === id ? { ...block, ...changes } : block
            ),
        }));

    const saveTextSelection = (blockId = activeTextBlockId) => {
        const selection = window.getSelection();
        const editor = document.querySelector(`[data-text-editor-id="${blockId}"]`);
        if (
            !selection?.rangeCount ||
            !editor ||
            !editor.contains(selection.anchorNode) ||
            !editor.contains(selection.focusNode)
        )
            return;
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

    const removeBlock = (id) =>
        setDraft((current) => ({
            ...current,
            blocks: current.blocks.filter((block) => block.id !== id),
        }));

    const placeBlock = (id, col, row) => updateBlock(id, { position: { col, row } });

    const getBoardMetrics = () => {
        if (!boardRef.current) return null;
        const board = boardRef.current;
        const bounds = board.getBoundingClientRect();
        const styles = window.getComputedStyle(board);
        const paddingX = parseFloat(styles.paddingLeft) || 0;
        const gap = parseFloat(styles.columnGap) || 0;
        const contentWidth = bounds.width - paddingX - (parseFloat(styles.paddingRight) || 0);
        return {
            bounds,
            paddingX,
            paddingY: parseFloat(styles.paddingTop) || 0,
            gap,
            cellWidth: (contentWidth - gap * 11) / 12,
            rowHeight:
                parseFloat(styles.gridTemplateRows.split(' ')[0]) +
                (parseFloat(styles.rowGap) || 0),
        };
    };

    const startBlockResize = (event, block) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const metrics = getBoardMetrics();
        const blockBounds = event.currentTarget.parentElement.getBoundingClientRect();
        const startColumn = metrics
            ? Math.floor(
                  (blockBounds.left - metrics.bounds.left - metrics.paddingX) /
                      (metrics.cellWidth + metrics.gap)
              ) + 1
            : block.position?.col || 1;
        resizeSessionRef.current = {
            id: block.id,
            startX: event.clientX,
            startY: event.clientY,
            startSpan: block.span || 1,
            startHeight: block.height || 3,
            maxSpan: Math.max(1, Math.min(3, Math.floor((13 - startColumn) / 4))),
            rowHeight: metrics?.rowHeight || 30,
            cellWidth: metrics?.cellWidth || 30,
            gap: metrics?.gap || 0,
        };
    };

    const updateBlockResize = (event, block) => {
        const session = resizeSessionRef.current;
        if (!session || session.id !== block.id) return;
        const widthDelta = Math.round(
            (event.clientX - session.startX) / ((session.cellWidth + session.gap) * 4)
        );
        const heightDelta = Math.round(
            (event.clientY - session.startY) / session.rowHeight
        );
        const width = Math.max(
            1,
            Math.min(session.maxSpan, session.startSpan + widthDelta)
        );
        const height = Math.max(1, Math.min(30, session.startHeight + heightDelta));
        if (width !== block.span || height !== block.height)
            updateBlock(block.id, { span: width, height });
    };

    const finishBlockResize = (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        resizeSessionRef.current = null;
    };

    const startBlockDrag = (event, id) => {
        if (
            event.target.closest(
                'a, input, textarea, select, button, .admin-note-flashcard, .admin-note-image-display'
            )
        )
            return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingBlockId(id);
        const block = draft.blocks.find((item) => item.id === id);
        if (block) setDropPreview(block.position || { col: 1, row: 1 });
    };

    const finishBlockDrag = (event, id) => {
        if (draggingBlockId !== id) return;
        if (dropPreview) placeBlock(id, dropPreview.col, dropPreview.row);
        if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        setDraggingBlockId(null);
        setDropPreview(null);
    };

    const getDropPreviewBlock = () =>
        draft.blocks.find((block) => block.id === draggingBlockId);

    const isPreviewCell = (col, row) => {
        if (!dropPreview) return false;
        const block = getDropPreviewBlock();
        if (!block) return false;
        const width = (block.span || 1) * 4;
        const height = block.height || 3;
        return (
            col >= dropPreview.col &&
            col < dropPreview.col + width &&
            row >= dropPreview.row &&
            row < dropPreview.row + height
        );
    };

    const renderPreviewCells = () => {
        const block = getDropPreviewBlock();
        if (!dropPreview || !block) return null;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        return (
            <div
                className="admin-note-drop-preview"
                style={{
                    gridColumn: `${dropPreview.col} / span ${width}`,
                    gridRow: `${dropPreview.row} / span ${height}`,
                }}
                aria-label={`Drop position: column ${dropPreview.col}, row ${dropPreview.row}`}
            >
                <span aria-hidden="true" />
            </div>
        );
    };

    const updateDropPreview = (event) => {
        if (!draggingBlockId || !boardRef.current) return;
        const block = getDropPreviewBlock();
        if (!block) return;
        const board = boardRef.current;
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const { bounds, paddingX, paddingY, gap, cellWidth, rowHeight } = metrics;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        const rawCol =
            Math.floor((event.clientX - bounds.left - paddingX) / (cellWidth + gap)) + 1;
        const rawRow =
            Math.floor((event.clientY - bounds.top - paddingY) / rowHeight) + 1;
        const col = Math.max(1, Math.min(rawCol, 13 - width));
        const row = Math.max(1, Math.min(rawRow, MAX_GRID_ROWS - height + 1));
        setDropPreview((current) =>
            current && current.col === col && current.row === row
                ? current
                : { col, row }
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

    const renderBlock = (block, index) => (
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
            selectNote={selectNote}
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
    );

    return (
        <AdminLayout title="Notes">
            <div
                className={`admin-notes-workspace${isFullScreen ? ' is-full-screen' : ''}`}
            >
                <div className="admin-notes-toolbar">
                    <label className="admin-notes-search">
                        <span>Search notes</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search title, folder, or content"
                        />
                    </label>
                    <div className="admin-notes-toolbar-actions">
                        {isCreatingToolbarFolder ? (
                            <div className="admin-notes-toolbar-folder-form">
                                <span className="admin-note-folder-icon" aria-hidden="true">
                                    📁
                                </span>
                                <input
                                    autoFocus
                                    type="text"
                                    value={toolbarFolderName}
                                    onChange={(e) => setToolbarFolderName(e.target.value)}
                                    placeholder="New folder..."
                                    aria-label="New folder name"
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
                                    Create
                                </button>
                                <button
                                    type="button"
                                    className="admin-note-btn-cancel"
                                    onClick={() => {
                                        setIsCreatingToolbarFolder(false);
                                        setToolbarFolderName('');
                                    }}
                                    title="Cancel"
                                    aria-label="Cancel"
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
                                title="Create new folder"
                            >
                                + New folder
                            </button>
                        )}
                        <button
                            type="button"
                            className="admin-notes-new"
                            onClick={() => startNewNote('')}
                        >
                            + New note
                        </button>
                    </div>
                </div>

                {error && <p className="admin-error">{error}</p>}
                {loading && <p className="admin-loading-text">Loading notes...</p>}

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
                            selectNote={selectNote}
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
                                            placeholder="Untitled note"
                                            aria-label="Note title"
                                        />
                                        <div
                                            className="admin-note-folder-dropdown-wrap"
                                            ref={folderDropdownRef}
                                        >
                                            <button
                                                type="button"
                                                className={`admin-note-folder-chip${
                                                    isFolderDropdownOpen ? ' is-open' : ''
                                                }`}
                                                onClick={() =>
                                                    setIsFolderDropdownOpen((prev) => !prev)
                                                }
                                                aria-expanded={isFolderDropdownOpen}
                                                aria-haspopup="listbox"
                                                title="Change note folder location"
                                            >
                                                <span
                                                    className="admin-note-folder-chip-icon"
                                                    aria-hidden="true"
                                                >
                                                    📁
                                                </span>
                                                <span className="admin-note-folder-chip-label">
                                                    {draft.folder
                                                        ? `/${draft.folder}`
                                                        : '/ (Root)'}
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
                                                        <span>Note Location</span>
                                                    </div>
                                                    <div className="admin-note-folder-menu-items">
                                                        <button
                                                            type="button"
                                                            className={`admin-note-folder-menu-item${
                                                                !draft.folder ? ' is-selected' : ''
                                                            }`}
                                                            onClick={() => {
                                                                handleFolderChange('');
                                                                setIsFolderDropdownOpen(false);
                                                            }}
                                                            role="option"
                                                            aria-selected={!draft.folder}
                                                        >
                                                            <span className="admin-note-folder-item-icon">
                                                                📁
                                                            </span>
                                                            <span className="admin-note-folder-item-text">
                                                                / (Root)
                                                            </span>
                                                            {!draft.folder && (
                                                                <span
                                                                    className="admin-note-folder-item-check"
                                                                    aria-hidden="true"
                                                                >
                                                                    ✓
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
                                                                    className={`admin-note-folder-menu-item${
                                                                        isSelected
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
                                                                        📁
                                                                    </span>
                                                                    <span className="admin-note-folder-item-text">
                                                                        /{folder}
                                                                    </span>
                                                                    {isSelected && (
                                                                        <span
                                                                            className="admin-note-folder-item-check"
                                                                            aria-hidden="true"
                                                                        >
                                                                            ✓
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
                                                                    📁
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
                                                                    placeholder="New folder..."
                                                                    aria-label="New folder name"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
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
                                                                    Create
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
                                                                    title="Cancel"
                                                                    aria-label="Cancel"
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
                                                                New folder...
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="admin-note-actions">
                                        {selectedId && (
                                            <button
                                                type="button"
                                                className="archive"
                                                onClick={handleArchiveToggle}
                                                disabled={saving}
                                            >
                                                {noteView === 'archived'
                                                    ? 'Unarchive'
                                                    : 'Archive'}
                                            </button>
                                        )}
                                        {selectedId && (
                                            <button
                                                type="button"
                                                className="danger"
                                                onClick={handleDelete}
                                                disabled={saving}
                                            >
                                                Delete
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
                                                    ? 'Exit full screen'
                                                    : 'Enter full screen'
                                            }
                                        >
                                            {isFullScreen ? 'Exit full screen' : 'Full screen'}
                                        </button>
                                        <button
                                            type="submit"
                                            className="primary"
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : 'Save note'}
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
                                                <span>Widgets</span>
                                                <div className="admin-note-widget-core">
                                                    {primaryWidgetTypes.map((blockType) => (
                                                        <button
                                                            type="button"
                                                            key={blockType}
                                                            onClick={() => addBlock(blockType)}
                                                        >
                                                            <b>{BLOCK_TYPES[blockType].icon}</b>
                                                            {BLOCK_TYPES[blockType].label}
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
                                                            ? 'Hide more widgets'
                                                            : 'Show more widgets'
                                                    }
                                                    title={
                                                        showMoreWidgets
                                                            ? 'Hide more widgets'
                                                            : 'Show more widgets'
                                                    }
                                                >
                                                    <span aria-hidden="true">
                                                        {showMoreWidgets ? '▲' : '▼'}
                                                    </span>
                                                </button>
                                            </div>
                                            {showMoreWidgets && (
                                                <div className="admin-note-secondary-widgets">
                                                    {widgetOrder.slice(8).map((blockType) => (
                                                        <button
                                                            type="button"
                                                            key={blockType}
                                                            onClick={() => addBlock(blockType)}
                                                        >
                                                            <b>{BLOCK_TYPES[blockType].icon}</b>
                                                            {BLOCK_TYPES[blockType].label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {showMoreWidgets && (
                                            <div className="admin-note-text-tools">
                                                <span>Text styling</span>
                                                {TEXT_STYLES.map((style) => (
                                                    <button
                                                        type="button"
                                                        key={style.label}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            saveTextSelection();
                                                        }}
                                                        onClick={() => applyTextStyle(style)}
                                                        disabled={
                                                            !draft.blocks.some(
                                                                (block) =>
                                                                    block.type === 'text'
                                                                )
                                                        }
                                                    >
                                                        {style.label}
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
                                                        disabled={
                                                            !draft.blocks.some(
                                                                (block) =>
                                                                    block.type === 'text'
                                                                )
                                                        }
                                                    >
                                                        {style.label}
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
                                                        disabled={textSizeLevel === 0}
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
                                    <div className="admin-note-blocks" ref={boardRef}>
                                        {Array.from(
                                            { length: boardRowCount * 12 },
                                            (_, cellIndex) => {
                                                const col = (cellIndex % 12) + 1;
                                                const row = Math.floor(cellIndex / 12) + 1;
                                                return (
                                                    <div
                                                        className={`admin-note-grid-cell${
                                                            isPreviewCell(col, row)
                                                                ? ' is-preview'
                                                                : ''
                                                        }`}
                                                        key={`${col}-${row}`}
                                                        style={{
                                                            gridColumn: col,
                                                            gridRow: row,
                                                        }}
                                                        aria-label={`Board column ${col}, row ${row}`}
                                                    />
                                                );
                                            }
                                        )}
                                        {draggingBlockId && renderPreviewCells()}
                                        {draft.blocks.map(renderBlock)}
                                        {draft.blocks.length === 0 && (
                                            <div
                                                className="admin-note-board-empty"
                                                aria-label="Empty board"
                                            >
                                                <p>No widgets on this board</p>
                                                <span>Click any widget above to add content</span>
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
