import katex from 'katex';
import 'katex/dist/katex.min.css';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import 'highlight.js/styles/atom-one-dark.min.css';
import { renderMarkdownWithFootnotes } from '../../../utils/markdownUtils';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);

export { katex, hljs };

export const CODE_LANGUAGES = [
    { value: 'plain', label: 'Plain code' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C/C++' },
];

export const escapeHtml = (value = '') =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

export const highlightCode = (code = '', language = 'plain') => {
    if (!code) return '';
    if (!language || language === 'plain') return escapeHtml(code);
    try {
        return hljs.highlight(code, { language }).value;
    } catch (error) {
        return escapeHtml(code);
    }
};

export const NOTES_API = '/api/notes';
export const MAX_GRID_ROWS = 60;

export const BLOCK_TYPES = {
    text: { label: 'Text', icon: 'T', placeholder: 'Write something...', span: 2, height: 3 },
    code: { label: 'Code block', icon: '</>', placeholder: 'Paste code here...', span: 2, height: 5 },
    heading: { label: 'Heading', icon: 'H', placeholder: 'Section heading', span: 3, height: 2 },
    todo: { label: 'Checklist', icon: '[]', placeholder: 'A task to remember', span: 1, height: 4 },
    callout: { label: 'Callout', icon: '!', placeholder: 'A useful thought or reminder', span: 1, height: 4 },
    table: { label: 'Table', icon: '#', placeholder: 'Table cell', span: 2, height: 6 },
    link: { label: 'Link', icon: '@', placeholder: 'Link label', span: 1, height: 3 },
    quote: { label: 'Quote', icon: '"', placeholder: 'A line worth keeping', span: 1, height: 4 },
    image: { label: 'Image', icon: '▧', placeholder: 'Image URL', span: 2, height: 7 },
    progress: { label: 'Progress', icon: '%', placeholder: 'Progress label', span: 2, height: 3 },
    counter: { label: 'Counter', icon: '+1', placeholder: 'Counter label', span: 1, height: 4 },
    picker: { label: 'Random picker', icon: '?', placeholder: 'Picker title', span: 2, height: 7 },
    date: { label: 'Date', icon: 'D', placeholder: 'Date label', span: 1, height: 3 },
    list: { label: 'List', icon: '•', placeholder: 'One item per line', span: 2, height: 4 },
    status: { label: 'Status', icon: '●', placeholder: 'Status label', span: 2, height: 3 },
    countdown: { label: 'Countdown', icon: '◷', placeholder: 'Countdown label', span: 2, height: 4 },
    rating: { label: 'Rating', icon: '★', placeholder: 'Rating label', span: 2, height: 3 },
    flashcards: { label: 'Flashcards', icon: '▣', placeholder: 'Front of card', span: 2, height: 5 },
    chart: { label: 'Chart', icon: '▥', placeholder: 'Chart title', span: 2, height: 11 },
    equation: { label: 'Equation', icon: 'Σ', placeholder: 'Enter an equation', span: 2, height: 3 },
    divider: { label: 'Divider', icon: '-', placeholder: '', span: 3, height: 1 },
    habit: { label: 'Habit', icon: '✓', placeholder: 'Habit name', span: 2, height: 6 },
    note_link: { label: 'Linked Notes', icon: '📎', placeholder: '', span: 1, height: 3 },
    timeline: { label: 'Timeline', icon: '🏁', placeholder: 'Timeline title', span: 3, height: 6 },
};

export const TEXT_STYLES = [
    { label: 'Bold', command: 'bold' },
    { label: 'Italic', command: 'italic' },
    { label: 'Underline', command: 'underline' },
    { label: 'Strike', command: 'strikeThrough' },
];

export const TEXT_SIZE_OPTIONS = [
    { label: 'Text', tag: 'p' },
    { label: 'H6', tag: 'h6' },
    { label: 'H5', tag: 'h5' },
    { label: 'H4', tag: 'h4' },
    { label: 'H3', tag: 'h3' },
    { label: 'H2', tag: 'h2' },
    { label: 'H1', tag: 'h1' },
];

export const TEXT_LIST_STYLES = [
    { label: 'Bullets', command: 'insertUnorderedList' },
    { label: 'Numbered', command: 'insertOrderedList' },
];

export const getCurrentMonthValue = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const createBlock = (type = 'text') => ({
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
    cards: type === 'flashcards' ? [{ front: '', back: '' }] : undefined,
    cardIndex: 0,
    chartValues: type === 'chart' ? '25, 50, 35, 70' : undefined,
    chartLabels: type === 'chart' ? 'A, B, C, D' : undefined,
    chartXAxis: type === 'chart' ? 'Category' : undefined,
    chartYAxis: type === 'chart' ? 'Value' : undefined,
    chartStyle: type === 'chart' ? 'bar' : undefined,
    habitMonth: type === 'habit' ? getCurrentMonthValue() : undefined,
    habitCompletions: type === 'habit' ? {} : undefined,
    linkedNote: type === 'note_link' ? '' : undefined,
    timelineEvents: type === 'timeline' ? [
        { id: `m-1-${Date.now()}`, date: '', title: '', desc: '', status: 'pending' },
        { id: `m-2-${Date.now() + 1}`, date: '', title: '', desc: '', status: 'pending' },
    ] : undefined,
    span: BLOCK_TYPES[type].span,
    height: BLOCK_TYPES[type].height,
    rows: type === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined,
});

export const stripHtml = (value = '') => {
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

export const getNotePreview = (note) => {
    if (Array.isArray(note?.blocks) && note.blocks.length > 0) {
        const textParts = note.blocks
            .map((block) => {
                if (!block) return '';
                if (block.type === 'table' && Array.isArray(block.rows)) {
                    return block.rows.map((row) => (Array.isArray(row) ? row.join(' ') : '')).join(' ');
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
                if (block.type === 'timeline' && Array.isArray(block.timelineEvents)) {
                    return block.timelineEvents.map((ev) => [ev.date, ev.title, ev.desc].filter(Boolean).join(' ')).join(' ');
                }
                return [block.label, block.text, block.pickerChoice, block.author, block.alt].filter(Boolean).join(' ');
            })
            .filter(Boolean);
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

export const generateNoteContent = (blocks) => {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    return blocks
        .map((block) => {
            if (!block) return '';
            if (block.type === 'table' && Array.isArray(block.rows)) {
                return block.rows.map((row) => (Array.isArray(row) ? row.join(' | ') : '')).join('\n');
            }
            if (block.type === 'flashcards' && Array.isArray(block.cards)) {
                return block.cards.map((c) => `${c.front || ''}: ${c.back || ''}`).join('\n');
            }
            if (block.type === 'list') {
                const items = block.text ? block.text.split('\n') : [];
                const prefix = block.listStyle === 'numbered' ? '' : '- ';
                return [
                    block.label,
                    items
                        .map((it, idx) => (block.listStyle === 'numbered' ? `${idx + 1}. ${it}` : `${prefix}${it}`))
                        .join('\n'),
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            if (block.type === 'timeline' && Array.isArray(block.timelineEvents)) {
                return [
                    block.label,
                    block.timelineEvents
                        .map((ev) => `- [${ev.status || 'pending'}] ${ev.date ? `${ev.date}: ` : ''}${ev.title || ''}${ev.desc ? ` - ${ev.desc}` : ''}`)
                        .join('\n'),
                ]
                    .filter(Boolean)
                    .join('\n');
            }
            return [block.label, block.text, block.author].filter(Boolean).join('\n');
        })
        .filter(Boolean)
        .join('\n\n');
};

export const blocksFromNote = (note) => {
    if (Array.isArray(note?.blocks)) {
        return note.blocks.map((rawBlock, index) => {
            const block =
                rawBlock.type === 'toggle'
                    ? {
                        ...rawBlock,
                        type: 'text',
                        text: [rawBlock.label, rawBlock.text].filter(Boolean).join('\n\n'),
                    }
                    : rawBlock.type === 'numbered'
                        ? {
                            ...rawBlock,
                            type: 'list',
                            listStyle: 'numbered',
                        }
                        : rawBlock.type === 'countdown'
                            ? {
                                ...rawBlock,
                                dateTime: rawBlock.dateTime || (rawBlock.date ? `${rawBlock.date}T23:59` : ''),
                            }
                            : rawBlock;
            return {
                ...block,
                span: block.span || BLOCK_TYPES[block.type]?.span || 1,
                height: block.height || BLOCK_TYPES[block.type]?.height || 3,
                position: block.position || { col: (index % 3) * 4 + 1, row: Math.floor(index / 3) * 6 + 1 },
            };
        });
    }
    if (note?.content && note.content.trim()) {
        return [{ ...createBlock('text'), text: note.content }];
    }
    return [];
};

export const rectanglesOverlap = (first, second) =>
    first.col < second.col + second.width &&
    first.col + first.width > second.col &&
    first.row < second.row + second.height &&
    first.row + first.height > second.row;

export const findFreePosition = (blocks, block) => {
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
            const candidate = { col, row, width, height };
            if (!occupied.some((item) => rectanglesOverlap(candidate, item))) return { col, row };
        }
    }

    return { col: 1, row: MAX_GRID_ROWS - height + 1 };
};

export const formatUpdatedAt = (value, language = 'en', formatNumber = (x) => x) => {
    if (!value) return language === 'kn' ? 'ಇನ್ನೂ ಉಳಿಸಿಲ್ಲ' : 'Not saved yet';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    const formatted = date.toLocaleString(language === 'kn' ? 'kn-IN' : undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    return language === 'kn' ? formatNumber(formatted) : formatted;
};

export const getLinkHref = (value) =>
    value && /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : value ? `https://${value}` : '';

export const getLinkDomain = (value) => {
    try {
        return new URL(getLinkHref(value)).hostname.replace(/^www\./, '');
    } catch (error) {
        return value || 'Add a destination';
    }
};

export const getTextEditorHtml = (value = '') =>
    /<[^>]+>/.test(value) ? value : renderMarkdownWithFootnotes(value);

export const getHabitCalendarDays = (monthValue) => {
    const [year, month] = String(monthValue || getCurrentMonthValue()).split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const dayCount = new Date(year, month, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
};

export const FOLDERS_STORAGE_KEY = 'admin_notes_custom_folders';
export const EXPANDED_FOLDERS_KEY = 'admin_notes_expanded_folders';

export const getBacklinks = (targetNoteId, allNotes = []) => {
    if (!targetNoteId || !Array.isArray(allNotes)) return [];
    const targetIdStr = String(targetNoteId);
    const targetNote = allNotes.find(
        (n) => String(n.id || n._id) === targetIdStr
    );
    const targetTitle = targetNote?.title?.trim();

    return allNotes
        .filter((note) => {
            if (!note) return false;
            const currentId = String(note.id || note._id);
            if (currentId === targetIdStr) return false;

            // Check blocks
            if (Array.isArray(note.blocks)) {
                const hasBlockLink = note.blocks.some((block) => {
                    if (!block) return false;
                    if (block.type === 'note_link' && String(block.linkedNote) === targetIdStr) {
                        return true;
                    }
                    if (block.linkedNote && String(block.linkedNote) === targetIdStr) {
                        return true;
                    }
                    if (targetTitle && targetTitle.length >= 2) {
                        const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const titleRegex = new RegExp(`\\[\\[${escaped}\\]\\]`, 'i');
                        if (block.text && titleRegex.test(block.text)) return true;
                        if (block.label && titleRegex.test(block.label)) return true;
                    }
                    return false;
                });
                if (hasBlockLink) return true;
            }

            // Check raw content
            if (note.content) {
                if (targetTitle && targetTitle.length >= 2) {
                    const escaped = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const titleRegex = new RegExp(`\\[\\[${escaped}\\]\\]`, 'i');
                    if (titleRegex.test(note.content)) return true;
                }
                if (note.content.includes(`[note:${targetIdStr}]`)) {
                    return true;
                }
            }

            return false;
        })
        .map((note) => ({
            id: note.id || note._id,
            title: note.title || 'Untitled note',
            folder: note.folder || '',
            preview: getNotePreview(note),
            note,
        }));
};
