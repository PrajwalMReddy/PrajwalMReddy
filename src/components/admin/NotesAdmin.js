import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AdminLayout from './AdminLayout';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import 'highlight.js/styles/atom-one-dark.min.css';
import {renderMarkdownWithFootnotes} from '../../utils/markdownUtils';

hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);

const CODE_LANGUAGES = [{value: 'plain', label: 'Plain code'}, {value: 'python', label: 'Python'}, {
    value: 'java', label: 'Java'
}, {value: 'cpp', label: 'C/C++'},];

const escapeHtml = (value = '') => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const highlightCode = (code = '', language = 'plain') => {
    if (!code) return '';
    if (!language || language === 'plain') return escapeHtml(code);
    try {
        return hljs.highlight(code, {language}).value;
    } catch (error) {
        return escapeHtml(code);
    }
};

const NOTES_API = '/api/notes';
const MAX_GRID_ROWS = 60;
const BLOCK_TYPES = {
    text: {label: 'Text', icon: 'T', placeholder: 'Write something...', span: 2, height: 3},
    code: {label: 'Code block', icon: '</>', placeholder: 'Paste code here...', span: 2, height: 5},
    heading: {label: 'Heading', icon: 'H', placeholder: 'Section heading', span: 3, height: 2},
    todo: {label: 'Checklist', icon: '[]', placeholder: 'A task to remember', span: 1, height: 4},
    callout: {label: 'Callout', icon: '!', placeholder: 'A useful thought or reminder', span: 1, height: 4},
    table: {label: 'Table', icon: '#', placeholder: 'Table cell', span: 2, height: 6},
    quote: {label: 'Quote', icon: '"', placeholder: 'A line worth keeping', span: 1, height: 4},
    image: {label: 'Image', icon: '▧', placeholder: 'Image URL', span: 2, height: 7},
    progress: {label: 'Progress', icon: '%', placeholder: 'Progress label', span: 2, height: 3},
    counter: {label: 'Counter', icon: '+1', placeholder: 'Counter label', span: 1, height: 4},
    picker: {label: 'Random picker', icon: '?', placeholder: 'Picker title', span: 2, height: 7},
    link: {label: 'Link', icon: '@', placeholder: 'Link label', span: 1, height: 3},
    date: {label: 'Date', icon: 'D', placeholder: 'Date label', span: 1, height: 3},
    list: {label: 'List', icon: '•', placeholder: 'One item per line', span: 2, height: 4},
    status: {label: 'Status', icon: '●', placeholder: 'Status label', span: 2, height: 3},
    countdown: {label: 'Countdown', icon: '◷', placeholder: 'Countdown label', span: 2, height: 4},
    rating: {label: 'Rating', icon: '★', placeholder: 'Rating label', span: 2, height: 3},
    flashcards: {label: 'Flashcards', icon: '▣', placeholder: 'Front of card', span: 2, height: 5},
    chart: {label: 'Chart', icon: '▥', placeholder: 'Chart title', span: 2, height: 11},
    equation: {label: 'Equation', icon: 'Σ', placeholder: 'Enter an equation', span: 2, height: 3},
    divider: {label: 'Divider', icon: '-', placeholder: '', span: 3, height: 1},
    habit: {label: 'Habit', icon: '✓', placeholder: 'Habit name', span: 2, height: 6},
    note_link: {label: 'Linked Notes', icon: '📎', placeholder: '', span: 1, height: 3},
};

const TEXT_STYLES = [{label: 'Bold', command: 'bold'}, {label: 'Italic', command: 'italic'}, {
    label: 'Underline', command: 'underline'
}, {label: 'Strike', command: 'strikeThrough'},];

const TEXT_SIZE_OPTIONS = [{label: 'Text', tag: 'p'}, {label: 'H6', tag: 'h6'}, {label: 'H5', tag: 'h5'}, {
    label: 'H4', tag: 'h4'
}, {label: 'H3', tag: 'h3'}, {label: 'H2', tag: 'h2'}, {label: 'H1', tag: 'h1'},];

const TEXT_LIST_STYLES = [{label: 'Bullets', command: 'insertUnorderedList'}, {
    label: 'Numbered', command: 'insertOrderedList'
},];

const createBlock = (type = 'text') => ({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: '',
    checked: false,
    label: '',
    author: '',
    language: type === 'code' ? 'plain' : undefined,
    url: '',
    alt: '',
    value: 0,
    counterValue: type === 'counter' ? 0 : undefined,
    counterStep: type === 'counter' ? 1 : undefined,
    pickerOptions: type === 'picker' ? 'Option 1\nOption 2\nOption 3' : undefined,
    pickerChoice: type === 'picker' ? '' : undefined,
    date: '',
    dateTime: '',
    status: type === 'status' ? 'In progress' : undefined,
    listStyle: type === 'list' ? 'bulleted' : undefined,
    rating: type === 'rating' ? 0 : undefined,
    flipped: false,
    cards: type === 'flashcards' ? [{front: '', back: ''}] : undefined,
    cardIndex: 0,
    chartValues: type === 'chart' ? '25, 50, 35, 70' : undefined,
    chartLabels: type === 'chart' ? 'A, B, C, D' : undefined,
    chartXAxis: type === 'chart' ? 'Category' : undefined,
    chartYAxis: type === 'chart' ? 'Value' : undefined,
    chartStyle: type === 'chart' ? 'bar' : undefined,
    habitMonth: type === 'habit' ? getCurrentMonthValue() : undefined,
    habitCompletions: type === 'habit' ? {} : undefined,
    linkedNote: type === 'note_link' ? '' : undefined,
    span: BLOCK_TYPES[type].span,
    height: BLOCK_TYPES[type].height,
    rows: type === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined,
});

const stripHtml = (value = '') => {
    if (!value) return '';
    return String(value)
        .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
};

const getNotePreview = (note) => {
    if (Array.isArray(note?.blocks) && note.blocks.length > 0) {
        const textParts = note.blocks.map((block) => {
            if (!block) return '';
            if (block.type === 'table' && Array.isArray(block.rows)) {
                return block.rows.map((row) => Array.isArray(row) ? row.join(' ') : '').join(' ');
            }
            if (block.type === 'flashcards' && Array.isArray(block.cards)) {
                return block.cards.map((c) => `${c.front || ''} ${c.back || ''}`).join(' ');
            }
            if (block.type === 'progress') {
                return [block.label, block.value !== undefined ? `${block.value}%` : ''].filter(Boolean).join(' ');
            }
            if (block.type === 'counter') {
                return [block.label, block.counterValue !== undefined ? String(block.counterValue) : ''].filter(Boolean).join(' ');
            }
            if (block.type === 'status') {
                return [block.label, block.status].filter(Boolean).join(' ');
            }
            return [block.label, block.text, block.pickerChoice, block.author, block.alt].filter(Boolean).join(' ');
        }).filter(Boolean);
        const combined = textParts.join(' ');
        const cleaned = stripHtml(combined);
        if (cleaned) return cleaned;
    }
    if (note?.content) {
        const cleaned = stripHtml(note.content);
        if (cleaned) return cleaned;
    }
    return 'Empty note';
};

const generateNoteContent = (blocks) => {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    return blocks.map((block) => {
        if (!block) return '';
        if (block.type === 'table' && Array.isArray(block.rows)) {
            return block.rows.map((row) => Array.isArray(row) ? row.join(' | ') : '').join('\n');
        }
        if (block.type === 'flashcards' && Array.isArray(block.cards)) {
            return block.cards.map((c) => `${c.front || ''}: ${c.back || ''}`).join('\n');
        }
        if (block.type === 'list') {
            const items = block.text ? block.text.split('\n') : [];
            const prefix = block.listStyle === 'numbered' ? '' : '- ';
            return [block.label, items.map((it, idx) => block.listStyle === 'numbered' ? `${idx + 1}. ${it}` : `${prefix}${it}`).join('\n')].filter(Boolean).join('\n');
        }
        return [block.label, block.text, block.author].filter(Boolean).join('\n');
    }).filter(Boolean).join('\n\n');
};

const blocksFromNote = (note) => {
    if (Array.isArray(note?.blocks)) {
        return note.blocks.map((rawBlock, index) => {
            const block = rawBlock.type === 'toggle' ? {
                ...rawBlock, type: 'text', text: [rawBlock.label, rawBlock.text].filter(Boolean).join('\n\n')
            } : rawBlock.type === 'numbered' ? {
                ...rawBlock, type: 'list', listStyle: 'numbered'
            } : rawBlock.type === 'countdown' ? {
                ...rawBlock, dateTime: rawBlock.dateTime || (rawBlock.date ? `${rawBlock.date}T23:59` : '')
            } : rawBlock;
            return {
                ...block,
                span: block.span || BLOCK_TYPES[block.type]?.span || 1,
                height: block.height || BLOCK_TYPES[block.type]?.height || 3,
                position: block.position || {col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1},
            };
        });
    }
    if (note?.content && note.content.trim()) {
        return [{...createBlock('text'), text: note.content}];
    }
    return [];
};

const rectanglesOverlap = (first, second) => first.col < second.col + second.width && first.col + first.width > second.col && first.row < second.row + second.height && first.row + first.height > second.row;

const findFreePosition = (blocks, block) => {
    const width = Math.min((block.span || 1) * 4, 12);
    const height = Math.min(block.height || 3, 30);
    const occupied = blocks.map((item) => ({
        col: item.position?.col || 1,
        row: item.position?.row || 1,
        width: Math.min((item.span || 1) * 4, 12),
        height: Math.min(item.height || 3, 30),
    }));

    for (let row = 1; row <= MAX_GRID_ROWS - height + 1; row += 1) {
        for (let col = 1; col <= 13 - width; col += 1) {
            const candidate = {col, row, width, height};
            if (!occupied.some((item) => rectanglesOverlap(candidate, item))) return {col, row};
        }
    }

    return {col: 1, row: MAX_GRID_ROWS - height + 1};
};

const formatUpdatedAt = (value) => {
    if (!value) return 'Not saved yet';
    return new Date(value).toLocaleString(undefined, {
        dateStyle: 'medium', timeStyle: 'short',
    });
};

const getLinkHref = (value) => value && /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : value ? `https://${value}` : '';

const getLinkDomain = (value) => {
    try {
        return new URL(getLinkHref(value)).hostname.replace(/^www\./, '');
    } catch (error) {
        return value || 'Add a destination';
    }
};

const getTextEditorHtml = (value = '') => /<[^>]+>/.test(value) ? value : renderMarkdownWithFootnotes(value);

const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getHabitCalendarDays = (monthValue) => {
    const [year, month] = String(monthValue || getCurrentMonthValue()).split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const dayCount = new Date(year, month, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({length: dayCount}, (_, index) => index + 1)];
};

const FOLDERS_STORAGE_KEY = 'admin_notes_custom_folders';
const EXPANDED_FOLDERS_KEY = 'admin_notes_expanded_folders';

const NotesAdmin = () => {
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState({title: '', content: '', folder: '', blocks: []});
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
            localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify(Array.from(expandedFolders)));
        } catch (e) {
            // ignore
        }
    }, [expandedFolders]);

    const widgetOrder = [
        'text', 'heading', 'table', 'list', 'callout', 'quote', 'image', 'code', 'divider',
        'todo', 'link', 'note_link', 'date', 'status', 'counter', 'progress', 'countdown', 'rating', 'flashcards', 'picker', 'chart', 'equation', 'habit'
    ];
    const primaryWidgetTypes = widgetOrder.slice(0, 9);
    const boardRowCount = Math.max(30, ...draft.blocks.map((block) => (block.position?.row || 1) + (block.height || 3) - 1));

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
        draft.blocks.filter((block) => block.type === 'countdown' && block.dateTime).forEach((block) => {
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
                [0, 0.18, 0.36, 1.10, 1.28, 1.46, 2.20, 2.38, 2.56].forEach((offset) => {
                    const oscillator = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    oscillator.frequency.value = 880;
                    gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
                    gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + offset + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.12);
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
            credentials: 'include', ...options, headers: {
                ...(hasBody ? {'Content-Type': 'application/json'} : {}), ...options.headers,
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

    const visibleNotes = useMemo(() => notes.filter((note) => noteView === 'archived' ? note.archived : !note.archived), [notes, noteView]);

    const allFolders = useMemo(() => {
        const fromNotes = notes.map((n) => n.folder).filter(Boolean);
        const combined = Array.from(new Set([...customFolders, ...fromNotes]));
        return combined.sort((a, b) => a.localeCompare(b));
    }, [customFolders, notes]);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return visibleNotes;
        return visibleNotes.filter((note) => {
            const preview = getNotePreview(note);
            return `${note.title} ${note.folder || ''} ${note.content || ''} ${preview}`.toLowerCase().includes(term);
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

        setCustomFolders((current) => current.map((f) => f === oldName ? trimmed : f));
        setExpandedFolders((current) => {
            const next = new Set(current);
            if (next.has(oldName)) {
                next.delete(oldName);
                next.add(trimmed);
            }
            return next;
        });

        if (draft.folder === oldName) {
            setDraft((current) => ({...current, folder: trimmed}));
        }

        const affectedNotes = notes.filter((n) => n.folder === oldName);
        for (const note of affectedNotes) {
            try {
                await request(`${NOTES_API}/${note.id}`, {
                    method: 'PUT', body: JSON.stringify({folder: trimmed}),
                });
            } catch (err) {
                console.error('Failed to rename note folder:', err);
            }
        }
        setNotes((current) => current.map((n) => n.folder === oldName ? {...n, folder: trimmed} : n));
    };

    const handleDeleteFolder = async (folderName) => {
        if (!window.confirm(`Delete folder "${folderName}"? Notes in this folder will be moved to / (root).`)) return;

        setCustomFolders((current) => current.filter((f) => f !== folderName));
        setExpandedFolders((current) => {
            const next = new Set(current);
            next.delete(folderName);
            return next;
        });

        if (draft.folder === folderName) {
            setDraft((current) => ({...current, folder: ''}));
        }

        const affectedNotes = notes.filter((n) => n.folder === folderName);
        for (const note of affectedNotes) {
            try {
                await request(`${NOTES_API}/${note.id}`, {
                    method: 'PUT', body: JSON.stringify({folder: ''}),
                });
            } catch (err) {
                console.error('Failed to clear note folder on delete:', err);
            }
        }
        setNotes((current) => current.map((n) => n.folder === folderName ? {...n, folder: ''} : n));
    };

    const handleFolderChange = async (targetFolder) => {
        const trimmed = targetFolder ? String(targetFolder).trim().replace(/^\/+|\/+$/g, '') : '';
        setDraft((current) => ({...current, folder: trimmed}));
        if (trimmed) {
            setExpandedFolders((current) => new Set([...current, trimmed]));
        }
        if (selectedId) {
            setSaving(true);
            try {
                const updated = await request(`${NOTES_API}/${selectedId}`, {
                    method: 'PUT', body: JSON.stringify({folder: trimmed}),
                });
                const updatedNote = {
                    ...updated, folder: (updated && updated.folder !== undefined) ? (updated.folder || '') : trimmed,
                };
                setNotes((current) => current.map((n) => n.id === selectedId ? {
                    ...n, ...updatedNote, folder: trimmed
                } : n));
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
            title: note.title, content: note.content, folder: note.folder || '', blocks: blocksFromNote(note),
        });
        if (note.folder) {
            setExpandedFolders((current) => new Set([...current, note.folder]));
        }
        setError('');
    };

    const startNewNote = (folder = '') => {
        const cleanFolder = folder ? String(folder).trim().replace(/^\/+|\/+$/g, '') : '';
        setSelectedId(null);
        setDraft({title: '', content: '', folder: cleanFolder, blocks: []});
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
            const folderValue = draft.folder ? String(draft.folder).trim().replace(/^\/+|\/+$/g, '') : '';
            const bodyData = {
                ...draft, folder: folderValue, content,
            };
            const saved = await request(selectedId ? `${NOTES_API}/${selectedId}` : NOTES_API, {
                method: selectedId ? 'PUT' : 'POST', body: JSON.stringify(bodyData),
            });
            const savedNote = {
                ...saved, folder: (saved && saved.folder !== undefined) ? (saved.folder || '') : folderValue,
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

    const updateBlock = (id, changes) => setDraft((current) => ({
        ...current, blocks: current.blocks.map((block) => block.id === id ? {...block, ...changes} : block),
    }));

    const saveTextSelection = (blockId = activeTextBlockId) => {
        const selection = window.getSelection();
        const editor = document.querySelector(`[data-text-editor-id="${blockId}"]`);
        if (!selection?.rangeCount || !editor || !editor.contains(selection.anchorNode) || !editor.contains(selection.focusNode)) return;
        textSelectionRef.current = {
            blockId, range: selection.getRangeAt(0).cloneRange(),
        };
        const selectionElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
        const blockElement = selectionElement?.closest('h1, h2, h3, h4, h5, h6, p');
        const sizeIndex = TEXT_SIZE_OPTIONS.findIndex((option) => option.tag === blockElement?.tagName?.toLowerCase());
        setTextSizeLevel(sizeIndex < 0 ? 0 : sizeIndex);
    };

    const getActiveTextEditor = () => {
        const blockId = textSelectionRef.current?.blockId || activeTextBlockId;
        return document.querySelector(`[data-text-editor-id="${blockId}"]`) || document.querySelector('.admin-note-text-editor');
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
        updateBlock(editor.dataset.textEditorId, {text: editor.innerHTML});
    };

    const applyTextSize = (nextSize) => {
        const editor = getActiveTextEditor();
        if (!editor) return;
        const clampedSize = Math.max(0, Math.min(TEXT_SIZE_OPTIONS.length - 1, nextSize));
        restoreTextSelection(editor);
        document.execCommand('formatBlock', false, TEXT_SIZE_OPTIONS[clampedSize].tag);
        setTextSizeLevel(clampedSize);
        updateBlock(editor.dataset.textEditorId, {text: editor.innerHTML});
    };

    const handleLinkPreviewClick = (event, url) => {
        event.preventDefault();
        window.clearTimeout(linkClickTimerRef.current);
        linkClickTimerRef.current = window.setTimeout(() => {
            window.open(getLinkHref(url), '_blank', 'noopener,noreferrer');
        }, 250);
    };

    const addBlock = (type, afterId = null) => setDraft((current) => {
        const next = createBlock(type);
        next.position = findFreePosition(current.blocks, next);
        const index = afterId ? current.blocks.findIndex((block) => block.id === afterId) + 1 : current.blocks.length;
        if (type === 'link') setEditingLinkId(next.id);
        if (type === 'note_link') setEditingNoteLinkId(next.id);
        if (type === 'flashcards') setEditingFlashcardId(next.id);
        if (type === 'image') setEditingImageId(next.id);
        return {...current, blocks: [...current.blocks.slice(0, index), next, ...current.blocks.slice(index)]};
    });

    const removeBlock = (id) => setDraft((current) => ({
        ...current, blocks: current.blocks.filter((block) => block.id !== id),
    }));

    const moveBlock = (fromId, toId) => setDraft((current) => {
        const fromIndex = current.blocks.findIndex((block) => block.id === fromId);
        const toIndex = current.blocks.findIndex((block) => block.id === toId);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
        const next = [...current.blocks];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return {...current, blocks: next};
    });

    const placeBlock = (id, col, row) => updateBlock(id, {position: {col, row}});

    const getTableRowCapacity = (block) => Math.max(2, (block.height || 3) - 2);
    const getTableColumnCount = (block) => Math.max(1, block.rows?.[0]?.length || 1);

    const resizeTableColumns = (block, columnCount) => {
        const nextColumnCount = Math.max(1, Math.min(8, Number(columnCount)));
        const rows = block.rows.map((row) => Array.from({length: nextColumnCount}, (_, index) => row[index] || ''));
        updateBlock(block.id, {rows});
    };

    const resizeTableRows = (block, rowCount) => {
        const nextRowCount = Math.max(2, Math.min(getTableRowCapacity(block), Number(rowCount)));
        const columnCount = getTableColumnCount(block);
        const rows = Array.from({length: nextRowCount}, (_, index) => block.rows[index] || Array.from({length: columnCount}, () => ''))
            .map((row) => Array.from({length: columnCount}, (_, index) => row[index] || ''));
        updateBlock(block.id, {rows});
    };

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
            rowHeight: parseFloat(styles.gridTemplateRows.split(' ')[0]) + (parseFloat(styles.rowGap) || 0),
        };
    };

    const startBlockResize = (event, block) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        const metrics = getBoardMetrics();
        const blockBounds = event.currentTarget.parentElement.getBoundingClientRect();
        const startColumn = metrics ? Math.floor((blockBounds.left - metrics.bounds.left - metrics.paddingX) / (metrics.cellWidth + metrics.gap)) + 1 : block.position?.col || 1;
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
        const widthDelta = Math.round((event.clientX - session.startX) / ((session.cellWidth + session.gap) * 4));
        const heightDelta = Math.round((event.clientY - session.startY) / session.rowHeight);
        const width = Math.max(1, Math.min(session.maxSpan, session.startSpan + widthDelta));
        const height = Math.max(1, Math.min(30, session.startHeight + heightDelta));
        if (width !== block.span || height !== block.height) updateBlock(block.id, {span: width, height});
    };

    const finishBlockResize = (event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        resizeSessionRef.current = null;
    };

    const fitTextareaValue = (event) => {
        const textarea = event.currentTarget;
        const value = textarea.value;
        let low = 0;
        let high = value.length;
        let fitted = value;

        textarea.value = value;
        if (textarea.scrollHeight <= textarea.clientHeight) return value;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            textarea.value = value.slice(0, middle);
            if (textarea.scrollHeight <= textarea.clientHeight) {
                fitted = textarea.value;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        textarea.value = fitted;
        return fitted;
    };

    const startBlockDrag = (event, id) => {
        if (event.target.closest('a, input, textarea, select, button, .admin-note-flashcard, .admin-note-image-display')) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDraggingBlockId(id);
        const block = draft.blocks.find((item) => item.id === id);
        if (block) setDropPreview(block.position || {col: 1, row: 1});
    };

    const finishBlockDrag = (event, id) => {
        if (draggingBlockId !== id) return;
        if (dropPreview) placeBlock(id, dropPreview.col, dropPreview.row);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setDraggingBlockId(null);
        setDropPreview(null);
    };

    const getDropPreviewBlock = () => draft.blocks.find((block) => block.id === draggingBlockId);

    const isPreviewCell = (col, row) => {
        if (!dropPreview) return false;
        const block = getDropPreviewBlock();
        if (!block) return false;
        const width = (block.span || 1) * 4;
        const height = block.height || 3;
        return col >= dropPreview.col && col < dropPreview.col + width && row >= dropPreview.row && row < dropPreview.row + height;
    };

    const renderPreviewCells = () => {
        const block = getDropPreviewBlock();
        if (!dropPreview || !block) return null;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        return <div
            className="admin-note-drop-preview"
            style={{gridColumn: `${dropPreview.col} / span ${width}`, gridRow: `${dropPreview.row} / span ${height}`}}
            aria-label={`Drop position: column ${dropPreview.col}, row ${dropPreview.row}`}
        >
            <span aria-hidden="true"/>
        </div>;
    };

    const updateDropPreview = (event) => {
        if (!draggingBlockId || !boardRef.current) return;
        const block = getDropPreviewBlock();
        if (!block) return;
        const board = boardRef.current;
        const metrics = getBoardMetrics();
        if (!metrics) return;
        const {bounds, paddingX, paddingY, gap, cellWidth, rowHeight} = metrics;
        const width = Math.min((block.span || 1) * 4, 12);
        const height = Math.min(block.height || 3, 30);
        const rawCol = Math.floor((event.clientX - bounds.left - paddingX) / (cellWidth + gap)) + 1;
        const rawRow = Math.floor((event.clientY - bounds.top - paddingY) / rowHeight) + 1;
        const col = Math.max(1, Math.min(rawCol, 13 - width));
        const row = Math.max(1, Math.min(rawRow, MAX_GRID_ROWS - height + 1));
        setDropPreview((current) => current && current.col === col && current.row === row ? current : {col, row});
    };

    const getListItems = (block) => block.text ? block.text.split('\n') : [''];

    const updateListItem = (block, itemIndex, value) => {
        const items = getListItems(block);
        items[itemIndex] = value;
        updateBlock(block.id, {text: items.join('\n')});
    };

    const addListItem = (block) => updateBlock(block.id, {text: `${block.text}${block.text ? '\n' : ''}`});

    const removeListItem = (block, itemIndex) => {
        const items = getListItems(block);
        if (items.length === 1) return updateBlock(block.id, {text: ''});
        items.splice(itemIndex, 1);
        updateBlock(block.id, {text: items.join('\n')});
    };

    const renderListWidget = (block, type) => {
        const numbered = block.listStyle === 'numbered';
        return <div className={`admin-note-list-wrap${numbered ? ' is-numbered' : ''}`}>
            <div className="admin-note-list-controls" aria-label="List controls">
                <input className="admin-note-list-label" value={block.label} placeholder="List label"
                       aria-label="List label"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                <select className="admin-note-list-style" value={block.listStyle || 'bulleted'} aria-label="List style"
                        onChange={(event) => updateBlock(block.id, {listStyle: event.target.value})}>
                    <option value="bulleted">Bulleted</option>
                    <option value="numbered">Numbered</option>
                </select>
                <button type="button" onClick={() => addListItem(block)} aria-label="Add list item"
                        title="Add list item">+
                </button>
            </div>
            <div className="admin-note-list-items">
                {getListItems(block).map((item, itemIndex) => <div className="admin-note-bullet-item"
                                                                   key={`${block.id}-item-${itemIndex}`}>
                    <span className="admin-note-list-marker"
                          aria-hidden="true">{numbered ? `${itemIndex + 1}.` : '•'}</span>
                    <input value={item} placeholder={itemIndex === 0 ? type.placeholder : 'List item'}
                           aria-label={`${numbered ? 'Numbered' : 'Bulleted'} list item ${itemIndex + 1}`}
                           onChange={(event) => updateListItem(block, itemIndex, event.target.value)}/>
                    <button type="button" onClick={() => removeListItem(block, itemIndex)}
                            aria-label={`Remove list item ${itemIndex + 1}`} title="Remove list item">-
                    </button>
                </div>)}
            </div>
        </div>;
    };

    const getCountdownParts = (dateTime) => {
        if (!dateTime) return null;
        const seconds = Math.max(0, Math.floor((new Date(dateTime).getTime() - currentTime) / 1000));
        return {
            hours: String(Math.floor(seconds / 3600)).padStart(2, '0'),
            minutes: String(Math.floor(seconds % 3600 / 60)).padStart(2, '0'),
            seconds: String(seconds % 60).padStart(2, '0'),
        };
    };

    const unlockCountdownAudio = () => {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            countdownAudioRef.current = countdownAudioRef.current || new AudioContextClass();
            countdownAudioRef.current.resume?.();
        } catch (error) {
            return null;
        }
    };

    const renderEquation = (value) => katex.renderToString(value || '\\text{Click to edit}', {
        displayMode: true, throwOnError: false,
    });

    const renderStars = (block) => <div className="admin-note-rating-stars"
                                        aria-label={`${block.rating || 0} out of 5 stars`}>
        {Array.from({length: 5}, (_, index) => <button type="button" key={index}
                                                       className={index < (block.rating || 0) ? 'active' : ''}
                                                       onClick={() => updateBlock(block.id, {rating: index + 1})}
                                                       aria-label={`Rate ${index + 1} out of 5`}>★</button>)}
    </div>;

    const getFlashcards = (block) => block.cards?.length ? block.cards : [{
        front: block.label || '', back: block.text || ''
    }];

    const updateFlashcard = (block, changes) => {
        const cards = getFlashcards(block).map((card, index) => index === (block.cardIndex || 0) ? {...card, ...changes} : card);
        updateBlock(block.id, {cards});
    };

    const addFlashcard = (block) => updateBlock(block.id, {
        cards: [...getFlashcards(block), {front: '', back: ''}], cardIndex: getFlashcards(block).length, flipped: false,
    });

    const renderChart = (block) => {
        const values = String(block.chartValues || '').split(',').map((value) => Math.max(0, Number(value.trim()) || 0)).slice(0, 8);
        const labels = String(block.chartLabels || '').split(',').map((label) => label.trim()).slice(0, values.length);
        const max = Math.max(...values, 1);
        if (block.chartStyle === 'pie') {
            const total = Math.max(values.reduce((sum, value) => sum + value, 0), 1);
            let cursor = 0;
            const segments = values.map((value, index) => {
                const start = cursor;
                cursor += value / total * 360;
                return `${['#6fa47d', '#6f8eaa', '#c08b36', '#9a789f'][index % 4]} ${start}deg ${cursor}deg`;
            });
            return <div className="admin-note-chart-pie" style={{background: `conic-gradient(${segments.join(', ')})`}}
                        aria-label="Pie chart preview"/>;
        }
        if (block.chartStyle === 'line') {
            const points = values.map((value, index) => `${values.length === 1 ? 50 : 12 + index / (values.length - 1) * 84},${86 - value / max * 70}`).join(' ');
            return <svg className="admin-note-chart-plot" viewBox="0 0 110 110" role="img"
                        aria-label={`${block.label || 'Line'} chart`}>
                <line x1="12" y1="10" x2="12" y2="86"/>
                <line x1="12" y1="86" x2="98" y2="86"/>
                {[0, 0.5, 1].map((tick) => <text key={tick} x="9" y={88 - tick * 70}
                                                 textAnchor="end">{Math.round(max * tick)}</text>)}
                <polyline points={points} fill="none" stroke="#5d8f70" strokeWidth="3"
                          vectorEffect="non-scaling-stroke"/>
                {values.map((value, index) => <text key={index}
                                                    x={values.length === 1 ? 50 : 12 + index / (values.length - 1) * 84}
                                                    y="98" textAnchor="middle">{labels[index] || index + 1}</text>)}
                <text className="admin-note-chart-axis-label" x="55" y="108"
                      textAnchor="middle">{block.chartXAxis || 'Category'}</text>
                <text className="admin-note-chart-axis-label" x="2" y="48" textAnchor="middle"
                      transform="rotate(-90 2 48)">{block.chartYAxis || 'Value'}</text>
            </svg>;
        }
        return <svg className="admin-note-chart-plot" viewBox="0 0 110 110" role="img"
                    aria-label={`${block.label || 'Bar'} chart`}>
            <line x1="12" y1="10" x2="12" y2="86"/>
            <line x1="12" y1="86" x2="98" y2="86"/>
            {[0, 0.5, 1].map((tick) => <text key={tick} x="9" y={88 - tick * 70}
                                             textAnchor="end">{Math.round(max * tick)}</text>)}
            {values.map((value, index) => {
                const x = 14 + index * (84 / Math.max(values.length, 1));
                const height = value / max * 70;
                return <g key={index}>
                    <rect x={x} y={86 - height} width={Math.max(3, 58 / Math.max(values.length, 1))} height={height}
                          rx="1"/>
                    <text x={x + 2} y={82 - height} textAnchor="middle">{value}</text>
                    <text x={x + 2} y="98" textAnchor="middle">{labels[index] || index + 1}</text>
                </g>;
            })}
            <text className="admin-note-chart-axis-label" x="55" y="108"
                  textAnchor="middle">{block.chartXAxis || 'Category'}</text>
            <text className="admin-note-chart-axis-label" x="2" y="48" textAnchor="middle"
                  transform="rotate(-90 2 48)">{block.chartYAxis || 'Value'}</text>
        </svg>;
    };

    const renderBlock = (block, index) => {
        const type = BLOCK_TYPES[block.type] || BLOCK_TYPES.text;
        const position = block.position || {col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1};
        const statusKey = block.type === 'status' ? (block.status || 'In progress').toLowerCase().replace(/\s+/g, '-') : '';
        return (<div
            className={`admin-note-block admin-note-block-${block.type} admin-note-block-span-${block.span || 1}${statusKey ? ` admin-note-status-${statusKey}` : ''}${draggingBlockId === block.id ? ' is-dragging' : ''}`}
            key={block.id} style={{
            gridColumn: `${position.col} / span ${(block.span || 1) * 4}`,
            gridRow: `${position.row} / span ${block.type === 'chart' ? Math.max(block.height || 3, 11) : block.height || 3}`
        }} onPointerDown={(event) => startBlockDrag(event, block.id)} onPointerMove={(event) => {
            if (draggingBlockId === block.id) updateDropPreview(event);
        }} onPointerUp={(event) => finishBlockDrag(event, block.id)}>
            <span className="admin-note-block-grip" title="Drag to reorder" aria-hidden="true">::</span>
            {block.type === 'divider' ? <hr/> : block.type === 'counter' ? (<div className="admin-note-counter-wrap">
                <input value={block.label} placeholder={type.placeholder} aria-label="Counter label"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                <div className="admin-note-counter-main" aria-label="Counter controls">
                    <button type="button"
                            onClick={() => updateBlock(block.id, {counterValue: (block.counterValue || 0) - (block.counterStep || 1)})}
                            aria-label="Decrease counter">-
                    </button>
                    <div className="admin-note-counter-value" aria-live="polite">{block.counterValue ?? 0}</div>
                    <button type="button"
                            onClick={() => updateBlock(block.id, {counterValue: (block.counterValue || 0) + (block.counterStep || 1)})}
                            aria-label="Increase counter">+
                    </button>
                </div>
                <div className="admin-note-counter-controls">
                    <div className="admin-note-counter-adjust">
                        <label className="admin-note-counter-step"><span>Step size</span><input type="number"
                                                                                                min="1"
                                                                                                value={block.counterStep || 1}
                                                                                                aria-label="Counter step size"
                                                                                                onChange={(event) => updateBlock(block.id, {counterStep: Math.max(1, Number(event.target.value) || 1)})}/></label>
                    </div>
                    <button type="button" className="admin-note-counter-reset"
                            onClick={() => updateBlock(block.id, {counterValue: 0})}
                            aria-label="Reset counter">Reset
                    </button>
                </div>
            </div>) : block.type === 'picker' ? (<div className="admin-note-picker-wrap">
                <input value={block.label} placeholder={type.placeholder} aria-label="Picker title"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                <label className="admin-note-picker-field"><span>Options</span><textarea
                    value={block.pickerOptions || ''} placeholder="One option per line"
                    aria-label="Picker options"
                    onChange={(event) => updateBlock(block.id, {pickerOptions: event.target.value})}/></label>
                <div className="admin-note-picker-result-label">Result</div>
                <div className="admin-note-picker-result">
                    <span aria-live="polite">{block.pickerChoice || 'No choice yet'}</span>
                    <button type="button" className="admin-note-picker-choice" onClick={() => {
                        const options = String(block.pickerOptions || '').split('\n').map((option) => option.trim()).filter(Boolean);
                        if (!options.length) return;
                        updateBlock(block.id, {pickerChoice: options[Math.floor(Math.random() * options.length)]});
                    }}>Pick
                    </button>
                </div>
            </div>) : block.type === 'progress' ? (<div className="admin-note-progress-wrap">
                <div className="admin-note-progress-header">
                    <input value={block.label} placeholder={type.placeholder} aria-label="Progress label"
                           onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                    <input className="admin-note-progress-value" type="number" min="0" max="100"
                           value={block.value} aria-label="Progress percentage"
                           onChange={(event) => updateBlock(block.id, {value: Math.max(0, Math.min(100, Number(event.target.value) || 0))})}/>
                    <span>%</span>
                </div>
                <progress max="100" value={block.value}
                          aria-label={`${block.label || 'Progress'}: ${block.value}%`}/>
            </div>) : block.type === 'link' ? (<div className="admin-note-link-wrap" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setEditingLinkId(null);
            }}>
                {block.label && block.url && editingLinkId !== block.id ? <div className="admin-note-link-compact"
                                                                               onDoubleClick={() => {
                                                                                   window.clearTimeout(linkClickTimerRef.current);
                                                                                   setEditingLinkId(block.id);
                                                                               }}>
                    <span className="admin-note-link-icon" aria-hidden="true">↗</span>
                    <div className="admin-note-link-details">
                        <a className="admin-note-link-preview" href={getLinkHref(block.url)} target="_blank"
                           rel="noopener noreferrer"
                           onClick={(event) => handleLinkPreviewClick(event, block.url)}>{block.label}</a>
                        <span className="admin-note-link-domain">{getLinkDomain(block.url)}</span>
                    </div>
                </div> : <>
                    <input value={block.label} placeholder={type.placeholder} aria-label="Link label"
                           onChange={(event) => {
                               setEditingLinkId(block.id);
                               updateBlock(block.id, {label: event.target.value});
                           }}/>
                    <input value={block.url} placeholder="https://example.com" aria-label="Link URL"
                           onChange={(event) => {
                               setEditingLinkId(block.id);
                               updateBlock(block.id, {url: event.target.value});
                           }}/>
                </>}
            </div>) : block.type === 'date' ? (<div className="admin-note-date-wrap">
                <input value={block.label} placeholder={type.placeholder} aria-label="Date label"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                <input type="date" value={block.date} aria-label="Note date"
                       onChange={(event) => updateBlock(block.id, {date: event.target.value})}/>
            </div>) : block.type === 'list' ? (renderListWidget(block, type)) : block.type === 'habit' ? (
                <div className="admin-note-habit-wrap">
                    <div className="admin-note-habit-header">
                        <input value={block.label} placeholder={type.placeholder} aria-label="Habit name"
                               onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                        <input type="month" value={block.habitMonth || getCurrentMonthValue()} aria-label="Habit month"
                               onChange={(event) => updateBlock(block.id, {habitMonth: event.target.value})}/>
                    </div>
                    <div className="admin-note-habit-weekdays" aria-hidden="true">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                    </div>
                    <div className="admin-note-habit-calendar" aria-label="Habit calendar">
                        {getHabitCalendarDays(block.habitMonth).map((day, dayIndex) => {
                            if (!day) return <span className="admin-note-habit-blank" key={`blank-${dayIndex}`}/>;
                            const completionKey = `${block.habitMonth || getCurrentMonthValue()}-${String(day).padStart(2, '0')}`;
                            const completed = Boolean(block.habitCompletions?.[completionKey]);
                            return <button type="button" key={completionKey} className={completed ? 'active' : ''}
                                           title={completionKey}
                                           onClick={() => updateBlock(block.id, {
                                               habitCompletions: {
                                                   ...(block.habitCompletions || {}), [completionKey]: !completed
                                               },
                                           })}
                                           aria-label={`${completionKey}: ${completed ? 'complete' : 'incomplete'}`}>
                                {day}
                            </button>;
                        })}
                    </div>
                    <span className="admin-note-habit-progress">
                    {Object.entries(block.habitCompletions || {})
                        .filter(([date, completed]) => date.startsWith(`${block.habitMonth || getCurrentMonthValue()}-`) && completed).length} days complete
                </span>
                </div>) : block.type === 'status' ? (
                <div className={`admin-note-status-wrap admin-note-status-wrap-${statusKey}`}>
                    <input value={block.label} placeholder={type.placeholder} aria-label="Status label"
                           onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                    <select value={block.status || 'In progress'} aria-label="Status"
                            onChange={(event) => updateBlock(block.id, {status: event.target.value})}>
                        <option>Not started</option>
                        <option>In progress</option>
                        <option>Blocked</option>
                        <option>Done</option>
                    </select>
                </div>) : block.type === 'countdown' ? (<div className="admin-note-countdown-wrap">
                <input value={block.label} placeholder={type.placeholder} aria-label="Countdown label"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                <input type="datetime-local" value={block.dateTime} aria-label="Countdown date and time"
                       onFocus={unlockCountdownAudio}
                       onChange={(event) => updateBlock(block.id, {dateTime: event.target.value})}/>
                {getCountdownParts(block.dateTime) ? <strong className="admin-note-countdown-value">
                    {getCountdownParts(block.dateTime).hours}:{getCountdownParts(block.dateTime).minutes}:{getCountdownParts(block.dateTime).seconds}
                </strong> : <strong>Choose a date and time</strong>}
            </div>) : block.type === 'rating' ? (<div className="admin-note-rating-wrap">
                <input value={block.label} placeholder={type.placeholder} aria-label="Rating label"
                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>{renderStars(block)}
            </div>) : block.type === 'flashcards' ? (<div className="admin-note-flashcard-wrap">
                <div className="admin-note-flashcard-controls" aria-label="Flashcard controls">
                    <input className="admin-note-flashcard-title" value={block.label}
                           placeholder="Flashcard title"
                           aria-label="Flashcard title"
                           onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                    <span
                        className="admin-note-table-label">Card {(block.cardIndex || 0) + 1} of {getFlashcards(block).length}</span>
                    <button type="button" onClick={() => updateBlock(block.id, {
                        cardIndex: Math.max(0, (block.cardIndex || 0) - 1), flipped: false
                    })} disabled={!block.cardIndex} aria-label="Previous card" title="Previous card">Previous
                    </button>
                    <button type="button" onClick={() => updateBlock(block.id, {
                        cardIndex: Math.min(getFlashcards(block).length - 1, (block.cardIndex || 0) + 1), flipped: false
                    })} disabled={(block.cardIndex || 0) === getFlashcards(block).length - 1}
                            aria-label="Next card" title="Next card">Next
                    </button>
                    <button type="button" onClick={() => addFlashcard(block)} aria-label="Add flashcard"
                            title="Add flashcard">New
                    </button>
                </div>
                {editingFlashcardId === block.id ? <div className="admin-note-flashcard-edit" onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setEditingFlashcardId(null);
                }}>
                    <label className="admin-note-flashcard-edit-field"><span>Front</span><input autoFocus
                                                                                                value={getFlashcards(block)[block.cardIndex || 0].front}
                                                                                                placeholder="Front of card"
                                                                                                aria-label="Flashcard front"
                                                                                                onChange={(event) => updateFlashcard(block, {front: event.target.value})}/></label>
                    <label className="admin-note-flashcard-edit-field"><span>Back</span><input
                        value={getFlashcards(block)[block.cardIndex || 0].back} placeholder="Back of card"
                        aria-label="Flashcard back"
                        onChange={(event) => updateFlashcard(block, {back: event.target.value})}/></label>
                </div> : <div className="admin-note-flashcard" role="button" tabIndex="0"
                              onClick={() => updateBlock(block.id, {flipped: !block.flipped})}
                              onDoubleClick={() => setEditingFlashcardId(block.id)}
                              onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      updateBlock(block.id, {flipped: !block.flipped});
                                  }
                              }} aria-label="Flip flashcard; double-click to edit">
                    <span>{block.flipped ? (getFlashcards(block)[block.cardIndex || 0].back || 'Add an answer below') : (getFlashcards(block)[block.cardIndex || 0].front || type.placeholder)}</span>
                </div>}
            </div>) : block.type === 'chart' ? (<div className="admin-note-chart-wrap">
                <div className="admin-note-chart-heading">
                    <label className="admin-note-chart-field"><span>Title</span><input value={block.label}
                                                                                       placeholder={type.placeholder}
                                                                                       aria-label="Chart title"
                                                                                       onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                    </label>
                    <label className="admin-note-chart-field chart-type"><span>Type</span><select
                        value={block.chartStyle || 'bar'} aria-label="Chart type"
                        onChange={(event) => updateBlock(block.id, {chartStyle: event.target.value})}>
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="pie">Pie</option>
                    </select>
                    </label>
                </div>
                <div className="admin-note-chart-data-inputs">
                    <label className="admin-note-chart-field"><span>Values</span><input
                        value={block.chartValues || '25, 50, 35, 70'} placeholder="25, 50, 35, 70"
                        aria-label="Chart values"
                        onChange={(event) => updateBlock(block.id, {chartValues: event.target.value})}/>
                    </label>
                    <label className="admin-note-chart-field"><span>Categories</span><input
                        value={block.chartLabels || 'A, B, C, D'} placeholder="A, B, C, D"
                        aria-label="Chart category labels"
                        onChange={(event) => updateBlock(block.id, {chartLabels: event.target.value})}/>
                    </label>
                </div>
                <div className="admin-note-chart-axis-inputs">
                    <label className="admin-note-chart-field"><span>X axis</span><input
                        value={block.chartXAxis || 'Category'} placeholder="Category" aria-label="X-axis label"
                        onChange={(event) => updateBlock(block.id, {chartXAxis: event.target.value})}/>
                    </label>
                    <label className="admin-note-chart-field"><span>Y axis</span><input
                        value={block.chartYAxis || 'Value'} placeholder="Value" aria-label="Y-axis label"
                        onChange={(event) => updateBlock(block.id, {chartYAxis: event.target.value})}/>
                    </label>
                </div>
                {renderChart(block)}
            </div>) : block.type === 'equation' ? (<div className="admin-note-equation-wrap">
                {editingEquationId === block.id ? <div className="admin-note-equation-edit" onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setEditingEquationId(null);
                }}>
                    <input value={block.label} placeholder="Equation label" aria-label="Equation label"
                           onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                    <input autoFocus value={block.text} placeholder="\frac{a}{b}" aria-label="Equation LaTeX"
                           onChange={(event) => updateBlock(block.id, {text: event.target.value})}/>
                </div> : <button type="button" className="admin-note-equation-display"
                                 onClick={() => setEditingEquationId(block.id)} aria-label="Edit equation">
                    {block.label && <small>{block.label}</small>}
                    <span dangerouslySetInnerHTML={{__html: renderEquation(block.text)}}/>
                </button>}
            </div>) : block.type === 'note_link' ? (<div className="admin-note-linked-notes-wrap" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setEditingNoteLinkId(null);
            }}>
                {block.linkedNote && editingNoteLinkId !== block.id ? (() => {
                    const linkedNote = notes.find(n => n.id === block.linkedNote);
                    return linkedNote ? (
                        <div className="admin-note-linked-note-item" onDoubleClick={() => {
                            window.clearTimeout(linkClickTimerRef.current);
                            setEditingNoteLinkId(block.id);
                        }}>
                            <span className="admin-note-link-icon" aria-hidden="true">📎</span>
                            <a className="admin-note-linked-note-link"
                               href="#"
                               onClick={(event) => {
                                   event.preventDefault();
                                   window.clearTimeout(linkClickTimerRef.current);
                                   linkClickTimerRef.current = window.setTimeout(() => {
                                       selectNote(linkedNote);
                                   }, 250);
                               }}
                               title="Click to open note">
                                {linkedNote.title}
                            </a>
                        </div>
                    ) : null;
                })() : (
                    <select 
                        className="admin-note-linked-notes-select"
                        value={block.linkedNote || ''}
                        onChange={(e) => {
                            updateBlock(block.id, { linkedNote: e.target.value });
                            if (e.target.value) {
                                setEditingNoteLinkId(null);
                            }
                        }}
                    >
                        <option value="">+ Link a note</option>
                        {notes.filter(n => n.id !== selectedId).map((note) => (
                            <option key={note.id} value={note.id}>
                                {note.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>) : block.type === 'text' ? (<div className="admin-note-text-wrap">
                <div
                    className="admin-note-text-editor"
                    contentEditable
                    suppressContentEditableWarning
                    ref={(element) => {
                        if (!element || document.activeElement === element) return;
                        const html = getTextEditorHtml(block.text);
                        if (element.innerHTML !== html) element.innerHTML = html;
                    }}
                    data-text-editor-id={block.id}
                    onFocus={() => {
                        setActiveTextBlockId(block.id);
                        saveTextSelection(block.id);
                    }}
                    onKeyUp={saveTextSelection}
                    onMouseUp={saveTextSelection}
                    onInput={(event) => updateBlock(block.id, {text: event.currentTarget.innerHTML})}
                    role="textbox"
                    aria-label={type.label}
                    data-placeholder={type.placeholder}/>
            </div>) : block.type === 'quote' ? (<div className="admin-note-quote-wrap">
                <textarea value={block.text} placeholder={type.placeholder} aria-label="Quote"
                          onChange={(event) => updateBlock(block.id, {text: fitTextareaValue(event)})}/>
                <div className={`admin-note-quote-author${block.author ? ' has-author' : ''}`}>
                    <span className="admin-note-quote-dash" aria-hidden="true">—</span>
                    <input value={block.author || ''} placeholder="Authorship" aria-label="Quote author"
                           onChange={(event) => updateBlock(block.id, {author: event.target.value})}/>
                </div>
            </div>) : block.type === 'image' ? (<div className="admin-note-image-wrap">
                {editingImageId === block.id ? <div className="admin-note-image-edit" onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setEditingImageId(null);
                }}>
                    <label className="admin-note-image-edit-field">
                        <span>Image URL</span>
                        <input autoFocus value={block.url} placeholder="https://example.com/image.jpg"
                               aria-label="Image URL"
                               onChange={(event) => {
                                   setImageErrors((current) => ({...current, [block.id]: false}));
                                   updateBlock(block.id, {url: event.target.value});
                               }}/>
                    </label>
                    <label className="admin-note-image-edit-field">
                        <span>Label</span>
                        <input value={block.alt} placeholder="Optional caption" aria-label="Image label"
                               onChange={(event) => updateBlock(block.id, {alt: event.target.value})}/>
                    </label>
                </div> : <div className="admin-note-image-view">
                    <div className="admin-note-image-display" role="button" tabIndex="0"
                         onDoubleClick={() => setEditingImageId(block.id)}
                         onKeyDown={(event) => {
                             if (event.key === 'Enter') setEditingImageId(block.id);
                         }}
                         aria-label="Image preview; double-click to edit">
                        {block.url && !imageErrors[block.id] ? <img src={block.url} alt={block.alt || 'Note image'}
                                                                    referrerPolicy="no-referrer"
                                                                    onLoad={() => setImageErrors((current) => ({
                                                                        ...current, [block.id]: false
                                                                    }))}
                                                                    onError={() => setImageErrors((current) => ({
                                                                        ...current, [block.id]: true
                                                                    }))}/> : <div
                            className="admin-note-image-placeholder">{imageErrors[block.id] ? 'Could not load this URL. Use a direct image link.' : 'Double-click to add an image'}</div>}
                    </div>
                    {block.alt?.trim() ? <figcaption className="admin-note-image-label">{block.alt}</figcaption> : null}
                </div>}
            </div>) : block.type === 'code' ? (<div className="admin-note-code-wrap">
                <div className="admin-note-code-controls" aria-label="Code block controls">
                    <span className="admin-note-table-label">Code</span>
                    <select value={block.language || 'plain'} aria-label="Code language"
                            onChange={(event) => updateBlock(block.id, {language: event.target.value})}>
                        {CODE_LANGUAGES.map((option) => <option key={option.value}
                                                                value={option.value}>{option.label}</option>)}
                    </select>
                </div>
                <div className="admin-note-code-editor">
                    <pre className="admin-note-code-highlight" aria-hidden="true"><code
                        dangerouslySetInnerHTML={{__html: `${highlightCode(block.text, block.language || 'plain')}\n`}}/></pre>
                    <textarea value={block.text} placeholder={type.placeholder} aria-label="Code block"
                              spellCheck="false"
                              onChange={(event) => updateBlock(block.id, {text: event.target.value})}
                              onScroll={(event) => {
                                  const highlight = event.currentTarget.previousElementSibling;
                                  if (!highlight) return;
                                  highlight.scrollTop = event.currentTarget.scrollTop;
                                  highlight.scrollLeft = event.currentTarget.scrollLeft;
                              }}/>
                </div>
            </div>) : block.type === 'table' ? (<div className="admin-note-table-wrap">
                <div className="admin-note-table-controls" aria-label="Table controls">
                    <span className="admin-note-table-label">Table</span>
                    <span className="admin-note-table-control-label">Columns</span>
                    <button type="button"
                            onClick={() => resizeTableColumns(block, getTableColumnCount(block) - 1)}
                            disabled={getTableColumnCount(block) === 1} aria-label="Remove column"
                            title="Remove column">-
                    </button>
                    <strong>{getTableColumnCount(block)}</strong>
                    <button type="button"
                            onClick={() => resizeTableColumns(block, getTableColumnCount(block) + 1)}
                            disabled={getTableColumnCount(block) === 8} aria-label="Add column"
                            title="Add column">+
                    </button>
                    <span className="admin-note-table-control-label">Rows</span>
                    <button type="button" onClick={() => resizeTableRows(block, block.rows.length - 1)}
                            disabled={block.rows.length === 2} aria-label="Remove row" title="Remove row">-
                    </button>
                    <strong>{block.rows.length}</strong>
                    <button type="button" onClick={() => resizeTableRows(block, block.rows.length + 1)}
                            disabled={block.rows.length === getTableRowCapacity(block)} aria-label="Add row"
                            title="Add row">+
                    </button>
                </div>
                <table>
                    <tbody>{block.rows.map((row, rowIndex) => <tr
                        key={`${block.id}-${rowIndex}`}>{row.map((cell, cellIndex) => <td
                        key={`${block.id}-${rowIndex}-${cellIndex}`}><input value={cell}
                                                                            aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`}
                                                                            placeholder={type.placeholder}
                                                                            onChange={(event) => {
                                                                                const rows = block.rows.map((currentRow) => [...currentRow]);
                                                                                rows[rowIndex][cellIndex] = event.target.value;
                                                                                updateBlock(block.id, {rows});
                                                                            }}/></td>)}</tr>)}</tbody>
                </table>
            </div>) : (<>{block.type === 'todo' && <input type="checkbox" checked={block.checked}
                                                          onChange={(event) => updateBlock(block.id, {checked: event.target.checked})}
                                                          aria-label="Mark task complete"/>}<textarea
                value={block.text}
                onChange={(event) => updateBlock(block.id, {text: fitTextareaValue(event)})}
                placeholder={type.placeholder}
                aria-label={type.label}
                rows={block.type === 'text' ? 3 : 1}/></>)}
            <button type="button" className="admin-note-block-remove" onClick={() => removeBlock(block.id)}
                    aria-label="Remove block">x
            </button>
            {block.type !== 'divider' &&
                <button type="button" className="admin-note-block-resize" aria-label="Resize widget"
                        title="Resize widget" onPointerDown={(event) => startBlockResize(event, block)}
                        onPointerMove={(event) => updateBlockResize(event, block)} onPointerUp={finishBlockResize}
                        onPointerCancel={finishBlockResize}>⤢</button>}
        </div>);
    };

    const handleDelete = async () => {
        if (!selectedId || !window.confirm('Delete this note?')) return;

        setSaving(true);
        setError('');
        try {
            await request(`${NOTES_API}/${selectedId}`, {method: 'DELETE'});
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
                method: 'PUT', body: JSON.stringify({archived}),
            });
            setNotes((current) => current.map((note) => note.id === selectedId ? {...note, archived} : note));
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (<AdminLayout title="Notes">
        <div className={`admin-notes-workspace${isFullScreen ? ' is-full-screen' : ''}`}>
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
                    {isCreatingToolbarFolder ? (<div className="admin-notes-toolbar-folder-form">
                        <span className="admin-note-folder-icon" aria-hidden="true">📁</span>
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
                                        const trimmed = toolbarFolderName.trim().replace(/^\/+|\/+$/g, '');
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
                                    const trimmed = toolbarFolderName.trim().replace(/^\/+|\/+$/g, '');
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
                    </div>) : (<button
                        type="button"
                        className="admin-notes-new-folder-btn"
                        onClick={() => {
                            setIsCreatingToolbarFolder(true);
                            setToolbarFolderName('');
                        }}
                        title="Create new folder"
                    >
                        + New folder
                    </button>)}
                    <button type="button" className="admin-notes-new" onClick={() => startNewNote('')}>
                        + New note
                    </button>
                </div>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {loading && <p className="admin-loading-text">Loading notes...</p>}

            {!loading && (<div className="admin-notes-layout">
                <aside className="admin-notes-list" aria-label="Notes file explorer">
                    <div className="admin-notes-list-heading">
                        <div className="admin-notes-list-header-top">
                            <h2 className="admin-notes-list-title">Notes</h2>
                        </div>
                        <div className="admin-note-view-toggle" role="tablist" aria-label="Note status">
                            <button type="button" className={noteView === 'active' ? 'active' : ''}
                                    onClick={() => setNoteView('active')} role="tab"
                                    aria-selected={noteView === 'active'}>
                                Active <span>{notes.filter((note) => !note.archived).length}</span>
                            </button>
                            <button type="button" className={noteView === 'archived' ? 'active' : ''}
                                    onClick={() => setNoteView('archived')} role="tab"
                                    aria-selected={noteView === 'archived'}>
                                Archived <span>{notes.filter((note) => note.archived).length}</span>
                            </button>
                        </div>
                    </div>

                    <div className="admin-notes-tree">
                        {isCreatingFolder && (<form className="admin-note-new-folder-form" onSubmit={(e) => {
                            e.preventDefault();
                            handleCreateFolder(newFolderName);
                        }}>
                            <span className="admin-note-folder-icon" aria-hidden="true">📁</span>
                            <input
                                autoFocus
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="folder name"
                                aria-label="New folder name"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsCreatingFolder(false);
                                        setNewFolderName('');
                                    }
                                }}
                            />
                            <button type="submit" title="Create folder" aria-label="Confirm new folder">✓</button>
                            <button type="button" onClick={() => {
                                setIsCreatingFolder(false);
                                setNewFolderName('');
                            }} title="Cancel" aria-label="Cancel new folder">✕
                            </button>
                        </form>)}

                        {/* Folders */}
                        {allFolders.map((folderName) => {
                            const folderNotes = folderNotesMap[folderName] || [];
                            const totalInFolder = visibleNotes.filter((n) => n.folder === folderName).length;
                            const isExpanded = expandedFolders.has(folderName);
                            const isRenaming = renamingFolder === folderName;

                            return (<div className={`admin-note-folder-group${isExpanded ? ' is-expanded' : ''}`}
                                         key={folderName}>
                                {isRenaming ? (<form className="admin-note-rename-folder-form" onSubmit={(e) => {
                                    e.preventDefault();
                                    handleRenameFolder(folderName, renameValue);
                                }}>
                                    <span className="admin-note-folder-icon" aria-hidden="true">📁</span>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        aria-label="Rename folder"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') setRenamingFolder(null);
                                        }}
                                    />
                                    <button type="submit" title="Save folder name"
                                            aria-label="Save folder name">✓
                                    </button>
                                    <button type="button" onClick={() => setRenamingFolder(null)} title="Cancel"
                                            aria-label="Cancel rename">✕
                                    </button>
                                </form>) : (<div
                                    className={`admin-note-folder-header${draft.folder === folderName ? ' is-current-folder' : ''}`}
                                    onClick={() => toggleFolder(folderName)}
                                    role="button"
                                    tabIndex="0"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleFolder(folderName);
                                        }
                                    }}
                                    aria-expanded={isExpanded}
                                >
                                            <span className="admin-note-folder-chevron" aria-hidden="true">
                                                {isExpanded ? '▾' : '▸'}
                                            </span>
                                    <span className="admin-note-folder-icon" aria-hidden="true">
                                                {isExpanded ? '📂' : '📁'}
                                            </span>
                                    <span className="admin-note-folder-title" title={folderName}>
                                                {folderName}
                                            </span>
                                    <span className="admin-note-folder-count">
                                                {totalInFolder}
                                            </span>
                                    <div className="admin-note-folder-actions"
                                         onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className="admin-note-action-icon"
                                            onClick={() => startNewNote(folderName)}
                                            title={`New note in /${folderName}`}
                                            aria-label={`New note in /${folderName}`}
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-note-action-icon"
                                            onClick={() => startRenamingFolder(folderName)}
                                            title="Rename folder"
                                            aria-label="Rename folder"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            type="button"
                                            className="admin-note-action-icon danger"
                                            onClick={() => handleDeleteFolder(folderName)}
                                            title="Delete folder"
                                            aria-label="Delete folder"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>)}

                                {isExpanded && (<div className="admin-note-folder-children">
                                    {folderNotes.map((note) => (<button
                                        type="button"
                                        key={note.id}
                                        className={`admin-note-list-item is-nested${selectedId === note.id ? ' active' : ''}`}
                                        onClick={() => selectNote(note)}
                                    >
                                        <strong>{note.title || 'Untitled note'}</strong>
                                        <span>{formatUpdatedAt(note.updatedAt)}</span>
                                        <p>{getNotePreview(note)}</p>
                                    </button>))}
                                    {folderNotes.length === 0 && (<button
                                        type="button"
                                        className="admin-note-empty-folder-btn"
                                        onClick={() => startNewNote(folderName)}
                                    >
                                        <span aria-hidden="true">+</span> New note in /{folderName}
                                    </button>)}
                                </div>)}
                            </div>);
                        })}

                        {/* Top-level Linux-style Root Notes directly under / */}
                        {rootNotes.map((note) => (<button
                            type="button"
                            key={note.id}
                            className={`admin-note-list-item is-root${selectedId === note.id ? ' active' : ''}`}
                            onClick={() => selectNote(note)}
                        >
                            <strong>{note.title || 'Untitled note'}</strong>
                            <span>{formatUpdatedAt(note.updatedAt)}</span>
                            <p>{getNotePreview(note)}</p>
                        </button>))}

                        {!filteredNotes.length && !allFolders.length && (
                            <p className="admin-notes-empty">No notes found.</p>)}
                    </div>
                </aside>

                <section className="admin-note-editor" aria-label="Note editor">
                    <form onSubmit={handleSave}>
                        <div className="admin-note-editor-header">
                            <div className="admin-note-title-wrap">
                                <input
                                    className="admin-note-title"
                                    value={draft.title}
                                    onChange={(event) => setDraft({...draft, title: event.target.value})}
                                    placeholder="Untitled note"
                                    aria-label="Note title"
                                />
                                <div className="admin-note-folder-dropdown-wrap" ref={folderDropdownRef}>
                                    <button
                                        type="button"
                                        className={`admin-note-folder-chip${isFolderDropdownOpen ? ' is-open' : ''}`}
                                        onClick={() => setIsFolderDropdownOpen((prev) => !prev)}
                                        aria-expanded={isFolderDropdownOpen}
                                        aria-haspopup="listbox"
                                        title="Change note folder location"
                                    >
                                        <span className="admin-note-folder-chip-icon" aria-hidden="true">📁</span>
                                        <span className="admin-note-folder-chip-label">
                                            {draft.folder ? `/${draft.folder}` : '/ (Root)'}
                                        </span>
                                        <span className="admin-note-folder-chip-arrow" aria-hidden="true">▾</span>
                                    </button>

                                    {isFolderDropdownOpen && (<div className="admin-note-folder-menu" role="listbox">
                                        <div className="admin-note-folder-menu-header">
                                            <span>Note Location</span>
                                        </div>
                                        <div className="admin-note-folder-menu-items">
                                            <button
                                                type="button"
                                                className={`admin-note-folder-menu-item${!draft.folder ? ' is-selected' : ''}`}
                                                onClick={() => {
                                                    handleFolderChange('');
                                                    setIsFolderDropdownOpen(false);
                                                }}
                                                role="option"
                                                aria-selected={!draft.folder}
                                            >
                                                <span className="admin-note-folder-item-icon">📁</span>
                                                <span className="admin-note-folder-item-text">/ (Root)</span>
                                                {!draft.folder && <span className="admin-note-folder-item-check"
                                                                        aria-hidden="true">✓</span>}
                                            </button>

                                            {allFolders.map((folder) => {
                                                const isSelected = draft.folder === folder;
                                                return (<button
                                                    type="button"
                                                    key={folder}
                                                    className={`admin-note-folder-menu-item${isSelected ? ' is-selected' : ''}`}
                                                    onClick={() => {
                                                        handleFolderChange(folder);
                                                        setIsFolderDropdownOpen(false);
                                                    }}
                                                    role="option"
                                                    aria-selected={isSelected}
                                                >
                                                    <span className="admin-note-folder-item-icon">📁</span>
                                                    <span
                                                        className="admin-note-folder-item-text">/{folder}</span>
                                                    {isSelected && <span className="admin-note-folder-item-check"
                                                                         aria-hidden="true">✓</span>}
                                                </button>);
                                            })}
                                        </div>

                                        <div className="admin-note-folder-menu-footer">
                                            {isCreatingDropdownFolder ? (
                                                <div className="admin-note-dropdown-folder-form">
                                                        <span className="admin-note-folder-item-icon"
                                                              aria-hidden="true">📁</span>
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={dropdownFolderName}
                                                        onChange={(e) => setDropdownFolderName(e.target.value)}
                                                        placeholder="New folder..."
                                                        aria-label="New folder name"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (dropdownFolderName.trim()) {
                                                                    const trimmed = dropdownFolderName.trim().replace(/^\/+|\/+$/g, '');
                                                                    handleCreateFolder(trimmed);
                                                                    handleFolderChange(trimmed);
                                                                    setDropdownFolderName('');
                                                                    setIsCreatingDropdownFolder(false);
                                                                    setIsFolderDropdownOpen(false);
                                                                }
                                                            } else if (e.key === 'Escape') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setIsCreatingDropdownFolder(false);
                                                                setDropdownFolderName('');
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="admin-note-btn-create"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (dropdownFolderName.trim()) {
                                                                const trimmed = dropdownFolderName.trim().replace(/^\/+|\/+$/g, '');
                                                                handleCreateFolder(trimmed);
                                                                handleFolderChange(trimmed);
                                                                setDropdownFolderName('');
                                                                setIsCreatingDropdownFolder(false);
                                                                setIsFolderDropdownOpen(false);
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
                                                            setIsCreatingDropdownFolder(false);
                                                            setDropdownFolderName('');
                                                        }}
                                                        title="Cancel"
                                                        aria-label="Cancel"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>) : (<button
                                                type="button"
                                                className="admin-note-folder-menu-add"
                                                onClick={() => {
                                                    setIsCreatingDropdownFolder(true);
                                                    setDropdownFolderName('');
                                                }}
                                            >
                                                <span aria-hidden="true">+</span> New folder...
                                            </button>)}
                                        </div>
                                    </div>)}
                                </div>
                            </div>
                            <div className="admin-note-actions">
                                {selectedId && <button type="button" className="archive" onClick={handleArchiveToggle}
                                                       disabled={saving}>{noteView === 'archived' ? 'Unarchive' : 'Archive'}</button>}
                                {selectedId && <button type="button" className="danger" onClick={handleDelete}
                                                       disabled={saving}>Delete</button>}

                                <button type="button" className="admin-notes-fullscreen"
                                        onClick={() => setIsFullScreen((current) => !current)}
                                        aria-pressed={isFullScreen}
                                        aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}>
                                    {isFullScreen ? 'Exit full screen' : 'Full screen'}
                                </button>
                                <button type="submit" className="primary"
                                        disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button>
                            </div>
                        </div>
                        <div className="admin-note-board-shell">
                            <div className="admin-note-widget-palette" aria-label="Widget palette">
                                <div className="admin-note-widget-group">
                                    <div className="admin-note-widget-top-row">
                                        <span>Widgets</span>
                                        <div className="admin-note-widget-core">
                                            {primaryWidgetTypes.map((blockType) => <button type="button"
                                                                                           key={blockType}
                                                                                           onClick={() => addBlock(blockType)}>
                                                <b>{BLOCK_TYPES[blockType].icon}</b>{BLOCK_TYPES[blockType].label}
                                            </button>)}
                                        </div>
                                        <button type="button" className="admin-note-widget-more"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    saveTextSelection();
                                                }}
                                                onClick={() => setShowMoreWidgets((current) => !current)}
                                                aria-expanded={showMoreWidgets}
                                                aria-label={showMoreWidgets ? 'Hide more widgets' : 'Show more widgets'}
                                                title={showMoreWidgets ? 'Hide more widgets' : 'Show more widgets'}>
                                            <span aria-hidden="true">{showMoreWidgets ? '▲' : '▼'}</span>
                                        </button>
                                    </div>
                                    {showMoreWidgets && <div className="admin-note-secondary-widgets">
                                        {widgetOrder.slice(8).map((blockType) => <button type="button"
                                                                                         key={blockType}
                                                                                         onClick={() => addBlock(blockType)}>
                                            <b>{BLOCK_TYPES[blockType].icon}</b>{BLOCK_TYPES[blockType].label}
                                        </button>)}
                                    </div>}
                                </div>
                                {showMoreWidgets && <div className="admin-note-text-tools">
                                    <span>Text styling</span>
                                    {TEXT_STYLES.map((style) => <button type="button" key={style.label}
                                                                        onMouseDown={(event) => {
                                                                            event.preventDefault();
                                                                            saveTextSelection();
                                                                        }}
                                                                        onClick={() => applyTextStyle(style)}
                                                                        disabled={!draft.blocks.some((block) => block.type === 'text')}>
                                        {style.label}
                                    </button>)}
                                    {TEXT_LIST_STYLES.map((style) => <button type="button" key={style.label}
                                                                             onMouseDown={(event) => {
                                                                                 event.preventDefault();
                                                                                 saveTextSelection();
                                                                             }}
                                                                             onClick={() => applyTextStyle(style)}
                                                                             disabled={!draft.blocks.some((block) => block.type === 'text')}>
                                        {style.label}
                                    </button>)}
                                    <div className="admin-note-font-size-control" aria-label="Font size">
                                        <button type="button" aria-label="Decrease font size"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    saveTextSelection();
                                                }}
                                                onClick={() => applyTextSize(textSizeLevel - 1)}
                                                disabled={textSizeLevel === 0}>−
                                        </button>
                                        <button type="button" className="admin-note-font-size-icon"
                                                aria-label={`Text size ${TEXT_SIZE_OPTIONS[textSizeLevel].label}`}
                                                title={TEXT_SIZE_OPTIONS[textSizeLevel].label}
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    saveTextSelection();
                                                }}
                                                onClick={() => applyTextSize(textSizeLevel === TEXT_SIZE_OPTIONS.length - 1 ? 0 : textSizeLevel + 1)}>
                                            {textSizeLevel === 0 ? 'T' : TEXT_SIZE_OPTIONS[textSizeLevel].label}
                                        </button>
                                        <button type="button" aria-label="Increase font size"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    saveTextSelection();
                                                }}
                                                onClick={() => applyTextSize(textSizeLevel + 1)}
                                                disabled={textSizeLevel === TEXT_SIZE_OPTIONS.length - 1}>+
                                        </button>
                                    </div>
                                </div>}
                            </div>
                            <div className="admin-note-blocks" ref={boardRef}>
                                {Array.from({length: boardRowCount * 12}, (_, cellIndex) => {
                                    const col = cellIndex % 12 + 1;
                                    const row = Math.floor(cellIndex / 12) + 1;
                                    return <div
                                        className={`admin-note-grid-cell${isPreviewCell(col, row) ? ' is-preview' : ''}`}
                                        key={`${col}-${row}`} style={{gridColumn: col, gridRow: row}}
                                        aria-label={`Board column ${col}, row ${row}`}/>;
                                })}
                                {draggingBlockId && renderPreviewCells()}
                                {draft.blocks.map(renderBlock)}
                                {draft.blocks.length === 0 && (
                                    <div className="admin-note-board-empty" aria-label="Empty board">
                                        <p>No widgets on this board</p>
                                        <span>Click any widget above to add content</span>
                                    </div>)}
                            </div>
                        </div>
                    </form>
                </section>
            </div>)}
        </div>
    </AdminLayout>);
};

export default NotesAdmin;
