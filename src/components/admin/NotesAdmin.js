import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import AdminLayout from './AdminLayout';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const NOTES_API = '/api/notes';
const MAX_GRID_ROWS = 60;
const BLOCK_TYPES = {
    text: {label: 'Text', icon: 'T', placeholder: 'Write something...', span: 2, height: 3},
    heading: {label: 'Heading', icon: 'H', placeholder: 'Section heading', span: 3, height: 2},
    todo: {label: 'Checklist', icon: '[]', placeholder: 'A task to remember', span: 1, height: 4},
    callout: {label: 'Callout', icon: '!', placeholder: 'A useful thought or reminder', span: 1, height: 4},
    table: {label: 'Table', icon: '#', placeholder: 'Table cell', span: 2, height: 6},
    quote: {label: 'Quote', icon: '"', placeholder: 'A line worth keeping', span: 1, height: 4},
    progress: {label: 'Progress', icon: '%', placeholder: 'Progress label', span: 2, height: 3},
    counter: {label: 'Counter', icon: '+1', placeholder: 'Counter label', span: 1, height: 4},
    picker: {label: 'Random picker', icon: '?', placeholder: 'Picker title', span: 2, height: 7},
    link: {label: 'Link', icon: '@', placeholder: 'Link label', span: 2, height: 3},
    date: {label: 'Date', icon: 'D', placeholder: 'Date label', span: 1, height: 3},
    list: {label: 'List', icon: '•', placeholder: 'One item per line', span: 2, height: 4},
    status: {label: 'Status', icon: '●', placeholder: 'Status label', span: 2, height: 3},
    countdown: {label: 'Countdown', icon: '◷', placeholder: 'Countdown label', span: 2, height: 4},
    rating: {label: 'Rating', icon: '★', placeholder: 'Rating label', span: 2, height: 3},
    flashcards: {label: 'Flashcards', icon: '▣', placeholder: 'Front of card', span: 2, height: 5},
    chart: {label: 'Chart', icon: '▥', placeholder: 'Chart title', span: 2, height: 11},
    equation: {label: 'Equation', icon: 'Σ', placeholder: 'Enter an equation', span: 2, height: 3},
    divider: {label: 'Divider', icon: '-', placeholder: '', span: 3, height: 1},
};

const createBlock = (type = 'text') => ({
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: '',
    checked: false,
    label: '',
    url: '',
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
    span: BLOCK_TYPES[type].span,
    height: BLOCK_TYPES[type].height,
    rows: type === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined,
});

const blocksFromNote = (note) => Array.isArray(note.blocks) && note.blocks.length
    ? note.blocks.map((rawBlock, index) => {
        const block = rawBlock.type === 'toggle'
            ? {...rawBlock, type: 'text', text: [rawBlock.label, rawBlock.text].filter(Boolean).join('\n\n')}
            : rawBlock.type === 'numbered'
                ? {...rawBlock, type: 'list', listStyle: 'numbered'}
                : rawBlock.type === 'countdown'
                    ? {...rawBlock, dateTime: rawBlock.dateTime || (rawBlock.date ? `${rawBlock.date}T23:59` : '')}
                    : rawBlock;
        return {
            ...block,
            span: block.span || BLOCK_TYPES[block.type]?.span || 1,
            height: block.height || BLOCK_TYPES[block.type]?.height || 3,
            position: block.position || {col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1},
        };
    })
    : [{...createBlock('text'), text: note.content || ''}];

const rectanglesOverlap = (first, second) => first.col < second.col + second.width
    && first.col + first.width > second.col
    && first.row < second.row + second.height
    && first.row + first.height > second.row;

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
        dateStyle: 'medium',
        timeStyle: 'short',
    });
};

const getLinkHref = (value) => value && /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : value ? `https://${value}` : '';

const NotesAdmin = () => {
    const [notes, setNotes] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState({title: '', content: '', blocks: [createBlock()]});
    const [search, setSearch] = useState('');
    const [noteView, setNoteView] = useState('active');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showMoreWidgets, setShowMoreWidgets] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [editingEquationId, setEditingEquationId] = useState(null);
    const [editingFlashcardId, setEditingFlashcardId] = useState(null);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const countdownBeepedRef = useRef(new Set());
    const countdownAudioRef = useRef(null);
    const linkClickTimerRef = useRef(null);
    const [draggingBlockId, setDraggingBlockId] = useState(null);
    const [dropPreview, setDropPreview] = useState(null);
    const boardRef = useRef(null);
    const resizeSessionRef = useRef(null);
    const widgetOrder = ['text', 'heading', 'todo', 'table', 'list', 'callout', 'status', 'counter', 'progress', 'link', 'date', 'countdown', 'rating', 'flashcards', 'picker', 'chart', 'equation', 'divider'];
    const primaryWidgetTypes = widgetOrder.slice(0, 8);
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
                [0, 0.18, 0.36].forEach((offset) => {
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
            credentials: 'include',
            ...options,
            headers: {
                ...(hasBody ? {'Content-Type': 'application/json'} : {}),
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

    const visibleNotes = useMemo(() => notes.filter((note) => noteView === 'archived' ? note.archived : !note.archived), [notes, noteView]);

    const filteredNotes = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return visibleNotes;
        return visibleNotes.filter((note) =>
            `${note.title} ${note.content}`.toLowerCase().includes(term)
        );
    }, [search, visibleNotes]);

    const selectNote = (note) => {
        setSelectedId(note.id);
        setDraft({title: note.title, content: note.content, blocks: blocksFromNote(note)});
        setError('');
    };

    const startNewNote = () => {
        setSelectedId(null);
        setDraft({title: '', content: '', blocks: [createBlock()]});
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
            const content = draft.blocks.map((block) => block.text || '').join('\n\n');
            const saved = await request(
                selectedId ? `${NOTES_API}/${selectedId}` : NOTES_API,
                {
                    method: selectedId ? 'PUT' : 'POST',
                    body: JSON.stringify({...draft, content}),
                }
            );
            setNotes((current) => {
                const withoutSaved = current.filter((note) => note.id !== saved.id);
                return [saved, ...withoutSaved];
            });
            setSelectedId(saved.id);
            setDraft({title: saved.title, content: saved.content, blocks: blocksFromNote(saved)});
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const updateBlock = (id, changes) => setDraft((current) => ({
        ...current,
        blocks: current.blocks.map((block) => block.id === id ? {...block, ...changes} : block),
    }));

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
        if (type === 'flashcards') setEditingFlashcardId(next.id);
        return {...current, blocks: [...current.blocks.slice(0, index), next, ...current.blocks.slice(index)]};
    });

    const removeBlock = (id) => setDraft((current) => ({
        ...current,
        blocks: current.blocks.length === 1 ? current.blocks : current.blocks.filter((block) => block.id !== id),
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
        const startColumn = metrics
            ? Math.floor((blockBounds.left - metrics.bounds.left - metrics.paddingX) / (metrics.cellWidth + metrics.gap)) + 1
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
        if (event.target.closest('a, input, textarea, select, button, .admin-note-flashcard')) return;
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
                <span className="admin-note-table-label">List</span>
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
        displayMode: true,
        throwOnError: false,
    });

    const renderStars = (block) => <div className="admin-note-rating-stars"
                                        aria-label={`${block.rating || 0} out of 5 stars`}>
        {Array.from({length: 5}, (_, index) => <button type="button" key={index}
                                                       className={index < (block.rating || 0) ? 'active' : ''}
                                                       onClick={() => updateBlock(block.id, {rating: index + 1})}
                                                       aria-label={`Rate ${index + 1} out of 5`}>★</button>)}
    </div>;

    const getFlashcards = (block) => block.cards?.length ? block.cards : [{
        front: block.label || '',
        back: block.text || ''
    }];

    const updateFlashcard = (block, changes) => {
        const cards = getFlashcards(block).map((card, index) => index === (block.cardIndex || 0) ? {...card, ...changes} : card);
        updateBlock(block.id, {cards});
    };

    const addFlashcard = (block) => updateBlock(block.id, {
        cards: [...getFlashcards(block), {front: '', back: ''}],
        cardIndex: getFlashcards(block).length,
        flipped: false,
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
        const statusKey = block.type === 'status'
            ? (block.status || 'In progress').toLowerCase().replace(/\s+/g, '-')
            : '';
        return (
            <div
                className={`admin-note-block admin-note-block-${block.type} admin-note-block-span-${block.span || 1}${statusKey ? ` admin-note-status-${statusKey}` : ''}${draggingBlockId === block.id ? ' is-dragging' : ''}`}
                key={block.id} style={{
                gridColumn: `${position.col} / span ${(block.span || 1) * 4}`,
                gridRow: `${position.row} / span ${block.type === 'chart' ? Math.max(block.height || 3, 11) : block.height || 3}`
            }} onPointerDown={(event) => startBlockDrag(event, block.id)} onPointerMove={(event) => {
                if (draggingBlockId === block.id) updateDropPreview(event);
            }} onPointerUp={(event) => finishBlockDrag(event, block.id)}>
                <span className="admin-note-block-grip" title="Drag to reorder" aria-hidden="true">::</span>
                {block.type === 'divider' ? <hr/> : block.type === 'counter' ? (
                    <div className="admin-note-counter-wrap">
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
                    </div>
                ) : block.type === 'picker' ? (
                    <div className="admin-note-picker-wrap">
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
                    </div>
                ) : block.type === 'progress' ? (
                    <div className="admin-note-progress-wrap">
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
                    </div>
                ) : block.type === 'link' ? (
                    <div className="admin-note-link-wrap" onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setEditingLinkId(null);
                    }}>
                        {block.label && block.url && editingLinkId !== block.id ?
                            <div className="admin-note-link-compact"
                                 onDoubleClick={() => {
                                     window.clearTimeout(linkClickTimerRef.current);
                                     setEditingLinkId(block.id);
                                 }}>
                                <a className="admin-note-link-preview" href={getLinkHref(block.url)} target="_blank"
                                   rel="noopener noreferrer"
                                   onClick={(event) => handleLinkPreviewClick(event, block.url)}>{block.label}</a>
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
                    </div>
                ) : block.type === 'date' ? (
                    <div className="admin-note-date-wrap">
                        <input value={block.label} placeholder={type.placeholder} aria-label="Date label"
                               onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                        <input type="date" value={block.date} aria-label="Note date"
                               onChange={(event) => updateBlock(block.id, {date: event.target.value})}/>
                    </div>
                ) : block.type === 'list' ? (
                    renderListWidget(block, type)
                ) : block.type === 'status' ? (
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
                    </div>
                ) : block.type === 'countdown' ? (
                    <div className="admin-note-countdown-wrap">
                        <input value={block.label} placeholder={type.placeholder} aria-label="Countdown label"
                               onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                        <input type="datetime-local" value={block.dateTime} aria-label="Countdown date and time"
                               onFocus={unlockCountdownAudio}
                               onChange={(event) => updateBlock(block.id, {dateTime: event.target.value})}/>
                        {getCountdownParts(block.dateTime) ? <strong className="admin-note-countdown-value">
                            {getCountdownParts(block.dateTime).hours}:{getCountdownParts(block.dateTime).minutes}:{getCountdownParts(block.dateTime).seconds}
                        </strong> : <strong>Choose a date and time</strong>}
                    </div>
                ) : block.type === 'rating' ? (
                    <div className="admin-note-rating-wrap">
                        <input value={block.label} placeholder={type.placeholder} aria-label="Rating label"
                               onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>{renderStars(block)}
                    </div>
                ) : block.type === 'flashcards' ? (
                    <div className="admin-note-flashcard-wrap">
                        <div className="admin-note-flashcard-controls" aria-label="Flashcard controls">
                            <input className="admin-note-flashcard-title" value={block.label}
                                   placeholder="Flashcard title"
                                   aria-label="Flashcard title"
                                   onChange={(event) => updateBlock(block.id, {label: event.target.value})}/>
                            <span
                                className="admin-note-table-label">Card {(block.cardIndex || 0) + 1} of {getFlashcards(block).length}</span>
                            <button type="button" onClick={() => updateBlock(block.id, {
                                cardIndex: Math.max(0, (block.cardIndex || 0) - 1),
                                flipped: false
                            })} disabled={!block.cardIndex} aria-label="Previous card" title="Previous card">Previous
                            </button>
                            <button type="button" onClick={() => updateBlock(block.id, {
                                cardIndex: Math.min(getFlashcards(block).length - 1, (block.cardIndex || 0) + 1),
                                flipped: false
                            })} disabled={(block.cardIndex || 0) === getFlashcards(block).length - 1}
                                    aria-label="Next card" title="Next card">Next
                            </button>
                            <button type="button" onClick={() => addFlashcard(block)} aria-label="Add flashcard"
                                    title="Add flashcard">New
                            </button>
                        </div>
                        {editingFlashcardId === block.id ?
                            <div className="admin-note-flashcard-edit" onBlur={(event) => {
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
                    </div>
                ) : block.type === 'chart' ? (
                    <div className="admin-note-chart-wrap">
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
                    </div>
                ) : block.type === 'equation' ? (
                    <div className="admin-note-equation-wrap">
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
                    </div>
                ) : block.type === 'table' ? (
                    <div className="admin-note-table-wrap">
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
                    </div>
                ) : (
                    <>{block.type === 'todo' && <input type="checkbox" checked={block.checked}
                                                       onChange={(event) => updateBlock(block.id, {checked: event.target.checked})}
                                                       aria-label="Mark task complete"/>}<textarea value={block.text}
                                                                                                   onChange={(event) => updateBlock(block.id, {text: fitTextareaValue(event)})}
                                                                                                   placeholder={type.placeholder}
                                                                                                   aria-label={type.label}
                                                                                                   rows={block.type === 'text' ? 3 : 1}/></>
                )}
                <button type="button" className="admin-note-block-remove" onClick={() => removeBlock(block.id)}
                        aria-label="Remove block">x
                </button>
                {block.type !== 'divider' &&
                    <button type="button" className="admin-note-block-resize" aria-label="Resize widget"
                            title="Resize widget" onPointerDown={(event) => startBlockResize(event, block)}
                            onPointerMove={(event) => updateBlockResize(event, block)} onPointerUp={finishBlockResize}
                            onPointerCancel={finishBlockResize}>⤢</button>}
            </div>
        );
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
                method: 'PUT',
                body: JSON.stringify({archived}),
            });
            setNotes((current) => current.map((note) => note.id === selectedId ? {...note, archived} : note));
            startNewNote();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminLayout title="Notes">
            <div className={`admin-notes-workspace${isFullScreen ? ' is-full-screen' : ''}`}>
            <div className="admin-notes-toolbar">
                <label className="admin-notes-search">
                    <span>Search notes</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search title or content"
                    />
                </label>
                <button type="button" className="admin-notes-new" onClick={startNewNote}>
                    New note
                </button>
            </div>

            {error && <p className="admin-error">{error}</p>}
            {loading && <p className="admin-loading-text">Loading notes...</p>}

            {!loading && (
                <div className="admin-notes-layout">
                    <aside className="admin-notes-list" aria-label="Notes list">
                        <div className="admin-notes-list-heading">
                            <h2 className="admin-notes-list-title">Notes</h2>
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
                        {filteredNotes.map((note) => (
                            <button
                                type="button"
                                key={note.id}
                                className={`admin-note-list-item${selectedId === note.id ? ' active' : ''}`}
                                onClick={() => selectNote(note)}
                            >
                                <strong>{note.title}</strong>
                                <span>{formatUpdatedAt(note.updatedAt)}</span>
                                <p>{note.content.replace(/\s+/g, ' ').trim() || 'Empty note'}</p>
                            </button>
                        ))}
                        {!filteredNotes.length && <p className="admin-notes-empty">No notes found.</p>}
                    </aside>

                    <section className="admin-note-editor" aria-label="Note editor">
                        <form onSubmit={handleSave}>
                            <div className="admin-note-editor-header">
                                <input
                                    className="admin-note-title"
                                    value={draft.title}
                                    onChange={(event) => setDraft({...draft, title: event.target.value})}
                                    placeholder="Untitled note"
                                    aria-label="Note title"
                                />
                                <div className="admin-note-actions">
                                    {selectedId &&
                                        <button type="button" className="archive" onClick={handleArchiveToggle}
                                                disabled={saving}>{noteView === 'archived' ? 'Unarchive' : 'Archive'}</button>}
                                    {selectedId && <button type="button" className="danger" onClick={handleDelete}
                                                           disabled={saving}>Delete</button>}

                                    <button type="button" className="admin-notes-fullscreen" onClick={() => setIsFullScreen((current) => !current)}
                                            aria-pressed={isFullScreen} aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}>
                                        {isFullScreen ? 'Exit full screen' : 'Full screen'}
                                    </button>
                                    <button type="submit" className="primary"
                                            disabled={saving}>{saving ? 'Saving...' : 'Save note'}</button>
                                </div>
                            </div>
                            <div className="admin-note-board-shell">
                                <div className="admin-note-widget-palette" aria-label="Widget palette">
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
                                                onClick={() => setShowMoreWidgets((current) => !current)}
                                                aria-expanded={showMoreWidgets}
                                                aria-label={showMoreWidgets ? 'Hide more widgets' : 'Show more widgets'}
                                                title={showMoreWidgets ? 'Hide more widgets' : 'Show more widgets'}>
                                            <span aria-hidden="true">{showMoreWidgets ? '▲' : '▼'}</span>
                                        </button>
                                    </div>
                                    {showMoreWidgets && <div className="admin-note-widget-extra">
                                        {widgetOrder.slice(8).map((blockType) => <button type="button"
                                                                                         key={blockType}
                                                                                         onClick={() => addBlock(blockType)}>
                                            <b>{BLOCK_TYPES[blockType].icon}</b>{BLOCK_TYPES[blockType].label}
                                        </button>)}
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
