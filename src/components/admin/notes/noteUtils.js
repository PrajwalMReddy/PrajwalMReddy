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
    text: { label: 'Text', icon: 'T', placeholder: 'Write something...', span: 6, height: 3 },
    code: { label: 'Code block', icon: '</>', placeholder: 'Paste code here...', span: 6, height: 5 },
    heading: { label: 'Heading', icon: 'H', placeholder: 'Section heading', span: 12, height: 2 },
    todo: { label: 'Checklist', icon: '[]', placeholder: 'A task to remember', span: 4, height: 3 },
    callout: { label: 'Callout', icon: '!', placeholder: 'A useful thought or reminder', span: 6, height: 3 },
    table: { label: 'Table', icon: '#', placeholder: 'Table cell', span: 6, height: 4 },
    link: { label: 'Link', icon: '@', placeholder: 'Link label', span: 4, height: 2 },
    quote: { label: 'Quote', icon: '"', placeholder: 'A line worth keeping', span: 4, height: 2 },
    image: { label: 'Image', icon: '▧', placeholder: 'Image URL', span: 6, height: 6 },
    progress: { label: 'Progress', icon: '%', placeholder: 'Progress label', span: 4, height: 2 },
    counter: { label: '+1 Counter', icon: '+1', placeholder: 'Counter label', span: 4, height: 3 },
    picker: { label: '? Random picker', icon: '?', placeholder: 'Picker title', span: 4, height: 5 },
    date: { label: 'Date', icon: 'D', placeholder: 'Date label', span: 4, height: 2 },
    list: { label: 'List', icon: '•', placeholder: 'One item per line', span: 4, height: 3 },
    status: { label: 'Status', icon: '●', placeholder: 'Status label', span: 4, height: 2 },
    countdown: { label: 'Countdown', icon: '◷', placeholder: 'Countdown label', span: 4, height: 3 },
    rating: { label: 'Rating', icon: '★', placeholder: 'Rating label', span: 4, height: 2 },
    flashcards: { label: 'Flashcards', icon: '▣', placeholder: 'Front of card', span: 4, height: 4 },
    chart: { label: 'Chart', icon: '▥', placeholder: 'Chart title', span: 6, height: 6 },
    equation: { label: 'Equation', icon: 'Σ', placeholder: 'Enter an equation', span: 4, height: 3 },
    divider: { label: 'Divider', icon: '-', placeholder: '', span: 12, height: 1 },
    habit: { label: 'Habit', icon: '✓︎', placeholder: 'Habit name', span: 6, height: 6 },
    note_link: { label: 'Linked Notes', icon: '⧉', placeholder: '', span: 4, height: 2 },
    timeline: { label: 'Timeline', icon: '⫶', placeholder: 'Timeline title', span: 12, height: 6 },
};

export const CALLOUT_VARIANTS = {
    info: { label: 'Info', color: '#2563eb' },
    tip: { label: 'Tip', color: '#10b981' },
    warning: { label: 'Warning', color: '#f59e0b' },
    danger: { label: 'Danger', color: '#ef4444' },
    idea: { label: 'Idea', color: '#8b5cf6' },
};

export const normalizeBlockSpan = (span, type) => {
    if (span === null || span === undefined || span === '') {
        return BLOCK_TYPES[type]?.span || 6;
    }
    const num = Number(span);
    if (Number.isNaN(num)) {
        return BLOCK_TYPES[type]?.span || 6;
    }
    return Math.max(1, Math.min(12, num));
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

export const createBlock = (type = 'text') => {
    const config = BLOCK_TYPES[type] || BLOCK_TYPES.text;
    return {
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
        todos: type === 'todo' ? [{ id: `todo-${Date.now()}-0`, text: '', checked: false }] : undefined,
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
        calloutType: type === 'callout' ? 'info' : undefined,
        timelineEvents: type === 'timeline' ? [
            { id: `m-1-${Date.now()}`, date: '', title: '', desc: '', status: 'pending' },
            { id: `m-2-${Date.now() + 1}`, date: '', title: '', desc: '', status: 'pending' },
        ] : undefined,
        span: config.span,
        height: config.height,
        rows: type === 'table' ? [['Column 1', 'Column 2'], ['', '']] : undefined,
    };
};

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

export const htmlToMarkdown = (raw = '') => {
    if (!raw) return '';
    let str = String(raw);
    if (!/<[a-z][\s\S]*>/i.test(str)) return str.trim();

    str = str
        .replace(/<span[^>]*style="[^"]*font-weight:\s*(?:bold|[7-9]00)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<b>$1</b>')
        .replace(/<span[^>]*style="[^"]*font-style:\s*italic[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<i>$1</i>')
        .replace(/<span[^>]*style="[^"]*text-decoration:\s*(?:underline)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<u>$1</u>')
        .replace(/<span[^>]*style="[^"]*text-decoration:\s*(?:line-through)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<s>$1</s>')
        .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
            const inner = content
                .replace(/<br\s*\/?>/gi, '\n    ')
                .replace(/<\/?(div|p)[^>]*>/gi, '\n    ')
                .trim();
            return `- ${inner}\n`;
        })
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
            let index = 1;
            return content.replace(/^- (.*?)$/gm, () => `${index++}. $1`) + '\n\n';
        })
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n')
        .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n')
        .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) =>
            content
                .trim()
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n') + '\n\n'
        );

    for (let pass = 0; pass < 3; pass++) {
        str = str
            .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
            .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
            .replace(/<(strike|del|s)[^>]*>([\s\S]*?)<\/\1>/gi, '~~$2~~')
            .replace(/<(u|ins)[^>]*>([\s\S]*?)<\/\1>/gi, '<u>$2</u>');
    }

    return str
        .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
        .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
        .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
        .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n')
        .replace(/<(?!(\/?(u|ins|cite|br)\b))[^>]+>/gi, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

export const renderChartHtml = (block) => {
    const values = String(block?.chartValues || '')
        .split(',')
        .map((val) => Math.max(0, Number(val.trim()) || 0))
        .slice(0, 8);
    const labels = String(block?.chartLabels || '')
        .split(',')
        .map((label) => label.trim())
        .slice(0, values.length);
    const max = Math.max(...values, 1);
    const title = (block?.label || '').trim();
    const xAxis = (block?.chartXAxis || '').trim();
    const yAxis = (block?.chartYAxis || '').trim();

    if (!values.length || (values.length === 1 && values[0] === 0 && !labels.length)) {
        return title ? `**${title}**` : '';
    }

    const gradId = `chart-grad-${Math.random().toString(36).substring(2, 8)}`;
    const areaId = `chart-area-${Math.random().toString(36).substring(2, 8)}`;
    let chartBody = '';

    if (block?.chartStyle === 'pie') {
        const total = Math.max(values.reduce((sum, v) => sum + v, 0), 1);
        let currentDeg = 0;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
        const segments = values.map((val, idx) => {
            const startDeg = currentDeg;
            currentDeg += (val / total) * 360;
            return `${colors[idx % colors.length]} ${startDeg}deg ${currentDeg}deg`;
        });
        const legendItems = labels
            .map((label, idx) => {
                const color = colors[idx % colors.length];
                const val = values[idx] !== undefined ? values[idx] : 0;
                const pct = Math.round((val / total) * 100);
                return `<div class="admin-markdown-chart-legend-item"><span class="admin-markdown-chart-legend-dot" style="background-color: ${color}"></span><span class="admin-markdown-chart-legend-label">${label || idx + 1}</span><span class="admin-markdown-chart-legend-val">${val} <small>(${pct}%)</small></span></div>`;
            })
            .join('');
        chartBody = `<div class="admin-markdown-chart-pie-wrap"><div class="admin-markdown-chart-donut" style="background: conic-gradient(${segments.join(', ')});" role="img" aria-label="Pie chart"></div>${legendItems ? `<div class="admin-markdown-chart-legend">${legendItems}</div>` : ''}</div>`;
    } else if (block?.chartStyle === 'line') {
        const points = values.map((val, idx) => ({
            x: values.length === 1 ? 131 : 36 + (idx / Math.max(values.length - 1, 1)) * 190,
            y: 130 - (val / max) * 90,
        }));
        const areaPath = `M ${points[0].x} 130 L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${points[points.length - 1].x} 130 Z`;
        const linePath = `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
        const dots = points
            .map(
                (p, idx) =>
                    `<g><circle cx="${p.x}" cy="${p.y}" r="4" fill="#ffffff" stroke="#3b82f6" stroke-width="2.5" /><text x="${p.x}" y="${Math.max(16, p.y - 7)}" text-anchor="middle" class="admin-markdown-chart-val-text">${values[idx]}</text><text x="${p.x}" y="144" text-anchor="middle" class="admin-markdown-chart-cat-text">${labels[idx] || idx + 1}</text></g>`
            )
            .join('');

        chartBody = `<svg class="admin-markdown-chart-plot" viewBox="0 0 240 160" role="img" aria-label="Line chart"><defs><linearGradient id="${areaId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28" /><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" /></linearGradient></defs>${yAxis ? `<text class="admin-markdown-chart-axis-title" x="36" y="11" text-anchor="start">${yAxis}</text>` : ''}<line x1="36" y1="40" x2="226" y2="40" class="admin-markdown-chart-grid" /><line x1="36" y1="85" x2="226" y2="85" class="admin-markdown-chart-grid" /><line x1="36" y1="130" x2="226" y2="130" class="admin-markdown-chart-baseline" /><text x="30" y="43" text-anchor="end" class="admin-markdown-chart-tick">${max}</text><text x="30" y="88" text-anchor="end" class="admin-markdown-chart-tick">${Math.round(0.5 * max)}</text><text x="30" y="133" text-anchor="end" class="admin-markdown-chart-tick">0</text><path d="${areaPath}" fill="url(#${areaId})" /><path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />${dots}${xAxis ? `<text class="admin-markdown-chart-axis-title" x="131" y="157" text-anchor="middle">${xAxis}</text>` : ''}</svg>`;
    } else {
        const barAreaWidth = 190 / Math.max(values.length, 1);
        const barWidth = Math.min(36, Math.max(10, 0.58 * barAreaWidth));
        const bars = values
            .map((val, idx) => {
                const centerX = 36 + (idx + 0.5) * barAreaWidth;
                const barX = centerX - barWidth / 2;
                const barH = Math.max(2, (val / max) * 90);
                const barY = 130 - barH;
                return `<g><rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" rx="4" fill="url(#${gradId})" /><text x="${centerX}" y="${Math.max(16, barY - 5)}" text-anchor="middle" class="admin-markdown-chart-val-text">${val}</text><text x="${centerX}" y="144" text-anchor="middle" class="admin-markdown-chart-cat-text">${labels[idx] || idx + 1}</text></g>`;
            })
            .join('');

        chartBody = `<svg class="admin-markdown-chart-plot" viewBox="0 0 240 160" role="img" aria-label="Bar chart"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6" /><stop offset="100%" stop-color="#1d4ed8" /></linearGradient></defs>${yAxis ? `<text class="admin-markdown-chart-axis-title" x="36" y="11" text-anchor="start">${yAxis}</text>` : ''}<line x1="36" y1="40" x2="226" y2="40" class="admin-markdown-chart-grid" /><line x1="36" y1="85" x2="226" y2="85" class="admin-markdown-chart-grid" /><line x1="36" y1="130" x2="226" y2="130" class="admin-markdown-chart-baseline" /><text x="30" y="43" text-anchor="end" class="admin-markdown-chart-tick">${max}</text><text x="30" y="88" text-anchor="end" class="admin-markdown-chart-tick">${Math.round(0.5 * max)}</text><text x="30" y="133" text-anchor="end" class="admin-markdown-chart-tick">0</text>${bars}${xAxis ? `<text class="admin-markdown-chart-axis-title" x="131" y="157" text-anchor="middle">${xAxis}</text>` : ''}</svg>`;
    }

    return `<div class="admin-markdown-chart-container">${title ? `<div class="admin-markdown-chart-title">${title}</div>` : ''}${chartBody}</div>`.replace(/\n\s+/g, '');
};

export const convertBlockToMarkdown = (block) => {
    if (!block) return '';
    switch (block.type) {
        case 'heading': {
            const headingText = (block.text || block.label || '').trim();
            return headingText ? `<h1 class="admin-note-heading-widget">${headingText}</h1>` : '';
        }
        case 'callout': {
            const type = (block.calloutType || block.variant || 'info').toUpperCase();
            const label = (block.label || '').trim();
            const body = htmlToMarkdown(block.text || '').trim();
            const lines = [];
            if (label) {
                lines.push(`> [!${type}] ${label}`);
            } else {
                lines.push(`> [!${type}]`);
            }
            if (body) {
                body.split('\n').forEach((l) => lines.push(`> ${l}`));
            }
            return lines.join('\n');
        }
        case 'date': {
            const label = (block.label || '').trim();
            const dateStr = (block.date || block.dateTime || block.text || '').trim();
            if (!label && !dateStr) return '';
            if (label && dateStr) return `**${label}:** ${dateStr}`;
            if (dateStr) return `**Date:** ${dateStr}`;
            return `**${label}**`;
        }
        case 'todo': {
            const label = (block.label || '').trim();
            let items = [];
            if (Array.isArray(block.todos) && block.todos.length > 0) {
                items = block.todos
                    .map((t) => ({ text: (t.text || '').trim(), checked: Boolean(t.checked) }))
                    .filter((t) => t.text.length > 0);
            } else if (block.text) {
                const lines = block.text.split('\n');
                const isAllChecked = Boolean(block.checked || block.completed);
                items = lines
                    .map((l) => {
                        const m = l.match(/^\s*-\s*\[([ xX])\]\s*(.*)$/);
                        if (m) {
                            return { text: m[2].trim(), checked: m[1].toLowerCase() === 'x' };
                        }
                        return { text: l.trim().replace(/^\s*-\s*/, ''), checked: isAllChecked };
                    })
                    .filter((t) => t.text.length > 0);
            }
            if (!items.length) {
                return label ? `**${label}**\n- [ ] ` : '- [ ] ';
            }
            const todoMarkdown = items
                .map((t) => `- [${t.checked ? 'x' : ' '}] ${t.text}`)
                .join('\n');
            if (label && todoMarkdown) return `**${label}**\n${todoMarkdown}`;
            return todoMarkdown || (label ? `**${label}**` : '');
        }
        case 'code': {
            const lang = (block.language || 'plain').toLowerCase();
            const label = (block.label || '').trim();
            const code = (block.code || block.text || '').replace(/\r\n/g, '\n');
            const fence = `\`\`\`${lang !== 'plain' ? lang : ''}\n${code}\n\`\`\``;
            return label ? `**${label}**\n${fence}` : fence;
        }
        case 'quote': {
            const text = (block.text || block.label || '').trim();
            const author = (block.author || '').trim();
            if (!text && !author) return '';
            const lines = [];
            if (text) {
                text.split('\n').forEach((l) => lines.push(`> ${l}`));
            }
            if (author) {
                if (text) lines.push('> ');
                lines.push(`> — *${author}*`);
            }
            return lines.join('\n');
        }
        case 'list': {
            const label = (block.label || '').trim();
            const items = (block.text || '')
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean);
            const isNumbered = block.listStyle === 'numbered';
            const listMarkdown = items
                .map((item, idx) => {
                    const cleaned = item.replace(/^\s*(?:[-*]|\d+\.)\s*/, '');
                    return isNumbered ? `${idx + 1}. ${cleaned}` : `- ${cleaned}`;
                })
                .join('\n');
            if (label && listMarkdown) return `**${label}**\n${listMarkdown}`;
            return listMarkdown || (label ? `**${label}**` : '');
        }
        case 'table': {
            const label = (block.label || '').trim();
            const rows = Array.isArray(block.rows) ? block.rows : [];
            if (!rows.length) return label ? `**${label}**` : '';
            const header = rows[0] || [];
            const dataRows = rows.slice(1);
            const headerLine = `| ${header.map((c) => (c || ' ').trim()).join(' | ')} |`;
            const sepLine = `| ${header.map(() => '---').join(' | ')} |`;
            const dataLines = dataRows.map((r) => `| ${r.map((c) => (c || ' ').trim()).join(' | ')} |`);
            const tableMarkdown = [headerLine, sepLine, ...dataLines].join('\n');
            return label ? `**${label}**\n\n${tableMarkdown}` : tableMarkdown;
        }
        case 'link': {
            const href = getLinkHref(block.url || block.text);
            const label = (block.label || block.text || getLinkDomain(href) || href).trim();
            if (href) return `[${label}](${href})`;
            return label ? `**${label}**` : '';
        }
        case 'note_link': {
            const label = (block.label || block.linkedNoteTitle || block.text || 'Linked Note').trim();
            return `[${label}](note:${block.linkedNote || ''})`;
        }
        case 'image': {
            const url = (block.url || '').trim();
            const alt = (block.alt || block.label || 'Image').trim();
            const caption = (block.label || '').trim();
            if (!url) return caption ? `*${caption}*` : '';
            const imgMarkdown = `![${alt}](${url})`;
            return caption && caption !== alt ? `${imgMarkdown}\n*${caption}*` : imgMarkdown;
        }
        case 'equation': {
            const label = (block.label || '').trim();
            const latex = (block.latex || block.text || '').trim();
            if (!latex) return label ? `**${label}**` : '';
            const eqMarkdown = `$$\n${latex}\n$$`;
            return label ? `**${label}**\n${eqMarkdown}` : eqMarkdown;
        }
        case 'progress': {
            const label = (block.label || '').trim();
            const val = Math.max(0, Math.min(100, Number(block.value || 0)));
            return label ? `**${label}:** ${val}%` : `**Progress:** ${val}%`;
        }
        case 'counter': {
            const label = (block.label || '').trim();
            const val = block.counterValue !== undefined ? block.counterValue : 0;
            return label ? `**${label}:** ${val}` : `**Counter:** ${val}`;
        }
        case 'status': {
            const label = (block.label || '').trim();
            const statusVal = (block.status || 'In progress').trim();
            const key = statusVal.toLowerCase().replace(/\s+/g, '-');
            const pillHtml = `<span class="admin-markdown-status-pill status-${key}"><span class="admin-markdown-status-dot"></span>${statusVal}</span>`;
            return label ? `**${label}** ${pillHtml}` : pillHtml;
        }
        case 'rating': {
            const label = (block.label || '').trim();
            const rating = Math.max(0, Math.min(5, Number(block.rating || 0)));
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            return label ? `**${label}:** ${stars}` : stars;
        }
        case 'countdown': {
            const label = (block.label || '').trim();
            const dt = (block.dateTime || '').trim();
            if (!dt) return label ? `**${label}**` : '';
            return label ? `**${label}:** ${dt}` : `**Countdown:** ${dt}`;
        }
        case 'picker': {
            const label = (block.label || '').trim();
            const choice = (block.pickerChoice || '').trim();
            const options = (block.pickerOptions || '')
                .split('\n')
                .map((o) => o.trim())
                .filter(Boolean);
            const title = label || 'Random picker';
            if (choice) {
                return `**${title}:** **${choice}** (${options.length} options)`;
            }
            return `**${title}** (${options.length} options)`;
        }
        case 'habit': {
            const habitLabel = (block.label || block.text || '').trim() || 'Habit';
            const month = block.habitMonth || getCurrentMonthValue();
            const completedCount = block.habitCompletions
                ? Object.entries(block.habitCompletions).filter(([dateKey, isDone]) => dateKey.startsWith(`${month}-`) && Boolean(isDone)).length
                : 0;
            return `**${habitLabel}:** ${completedCount} days completed this month`;
        }
        case 'chart':
            return renderChartHtml(block);
        case 'flashcards': {
            const label = (block.label || '').trim();
            const cards = (Array.isArray(block.cards) ? block.cards : [])
                .filter((c) => c && (c.front || c.back))
                .map((c, idx) => {
                    const front = (c.front || '').trim();
                    const back = (c.back || '').trim();
                    const backMask = back ? `||${back}||` : '';
                    return `${idx + 1}. **Q:** ${front}\n   **A:** ${backMask}`;
                })
                .join('\n\n');
            if (label && cards) return `**${label}**\n\n${cards}`;
            return cards || (label ? `**${label}**` : '');
        }
        case 'timeline': {
            const label = (block.label || '').trim();
            const events = (Array.isArray(block.timelineEvents) ? block.timelineEvents : [])
                .filter((ev) => ev && (ev.title || ev.date || ev.desc))
                .map((ev) => `- **${ev.date ? `${ev.date}: ` : ''}${ev.title || ''}**${ev.desc ? ` — ${ev.desc}` : ''}`)
                .join('\n');
            if (label && events) return `**${label}**\n\n${events}`;
            return events || (label ? `**${label}**` : '');
        }
        case 'divider':
            return '---';
        default: {
            const val = block.text || block.label || '';
            return htmlToMarkdown(val);
        }
    }
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

export const sortBlocksTopLeft = (blocks = []) => {
    if (!Array.isArray(blocks)) return [];
    return [...blocks].sort((a, b) => {
        const rowA = Number(a?.position?.row) || 1;
        const rowB = Number(b?.position?.row) || 1;
        if (rowA !== rowB) return rowA - rowB;
        const colA = Number(a?.position?.col) || 1;
        const colB = Number(b?.position?.col) || 1;
        if (colA !== colB) return colA - colB;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
};

export const generateNoteContent = (blocks) => {
    if (!Array.isArray(blocks) || !blocks.length) return '';
    return sortBlocksTopLeft(blocks)
        .map((b) => convertBlockToMarkdown(b))
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
            const span = normalizeBlockSpan(block.span, block.type);
            const height = block.height || BLOCK_TYPES[block.type]?.height || 4;
            return {
                ...block,
                span,
                height,
                position: block.position || {
                    col: ((6 * index) % 12) + 1,
                    row: 6 * Math.floor((6 * index) / 12) + 1,
                },
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
    const width = Math.max(1, Math.min(normalizeBlockSpan(block?.span, block?.type), 12));
    const height = Math.min(block?.height || BLOCK_TYPES[block?.type]?.height || 4, MAX_GRID_ROWS);
    const occupied = (blocks || []).map((item) => ({
        col: item?.position?.col || 1,
        row: item?.position?.row || 1,
        width: Math.max(1, Math.min(normalizeBlockSpan(item?.span, item?.type), 12)),
        height: Math.min(item?.height || BLOCK_TYPES[item?.type]?.height || 4, MAX_GRID_ROWS),
    }));

    for (let row = 1; row <= MAX_GRID_ROWS - height + 1; row += 1) {
        for (let col = 1; col <= 13 - width; col += 1) {
            const candidate = { col, row, width, height };
            if (!occupied.some((item) => rectanglesOverlap(candidate, item))) return { col, row };
        }
    }

    return { col: 1, row: 1 };
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
