import { marked, Marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { tStatic } from '../locales';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const STATUS_KEYS = {
    'done': 'done',
    'completed': 'done',
    'in progress': 'in-progress',
    'in-progress': 'in-progress',
    'not started': 'not-started',
    'not-started': 'not-started',
    'blocked': 'blocked',
    'active': 'in-progress',
    'pending': 'not-started',
};

export const formatStatusBadgeHtml = (statusText) => {
    const clean = String(statusText || '').trim();
    const key = STATUS_KEYS[clean.toLowerCase()] || clean.toLowerCase().replace(/\s+/g, '-');
    return `<span class="admin-markdown-status-pill status-${key}"><span class="admin-markdown-status-dot" aria-hidden="true"></span>${clean}</span>`;
};

export const formatSpoilerHtml = (spoilerText) => {
    return `<span class="admin-markdown-spoiler" tabindex="0" role="button" aria-label="Spoiler, click to reveal" onclick="this.classList.toggle('is-revealed')">${spoilerText}</span>`;
};

const processMarkdownStatusAndTasks = (html) => {
    return html
        .replace(/\|\|([\s\S]+?)\|\|/g, (_, spoilerText) => formatSpoilerHtml(spoilerText))
        .replace(/<strong>([^<]+?):<\/strong>\s*<code>\s*(Done|In progress|Not started|Blocked|Completed|Pending|Active)\s*<\/code>/gi, (_, label, status) => {
            return `<span class="admin-markdown-status-line"><strong>${label}</strong> ${formatStatusBadgeHtml(status)}</span>`;
        })
        .replace(/<code>\s*(Done|In progress|Not started|Blocked|Completed|Pending|Active)\s*<\/code>/gi, (_, status) => {
            return formatStatusBadgeHtml(status);
        })
        .replace(/<li>\s*<input\s+([^>]*?)type=["']checkbox["']([^>]*?)>\s*([\s\S]*?)<\/li>/gi, (match, before, after, text) => {
            const isChecked = /checked/i.test(before) || /checked/i.test(after);
            const checkSvg = isChecked
                ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
                : '';
            return `<li class="admin-markdown-task-item${isChecked ? ' is-checked' : ''}"><span class="admin-markdown-task-checkbox${isChecked ? ' is-checked' : ''}" aria-hidden="true">${checkSvg}</span><span class="admin-markdown-task-text">${text}</span></li>`;
        });
};

const chatMarked = new Marked({
    gfm: true,
    breaks: true,
});

chatMarked.use({
    renderer: {
        code({ text, lang }) {
            const cleanLang = (lang || '').trim().toLowerCase();
            let highlighted = text;
            if (cleanLang && hljs.getLanguage(cleanLang)) {
                try {
                    highlighted = hljs.highlight(text, { language: cleanLang }).value;
                } catch {
                    highlighted = escapeHtml(text);
                }
            } else {
                highlighted = escapeHtml(text);
            }
            return `<div class="ai-code-wrapper"><div class="ai-code-header"><span class="ai-code-lang">${escapeHtml(cleanLang || 'code')}</span></div><pre class="ai-code-block"><code class="hljs ${escapeHtml(cleanLang)}">${highlighted}</code></pre></div>`;
        },
        link({ href, title, text, tokens }) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const content = this.parser ? this.parser.parseInline(tokens) : text;
            let finalHref = (href || '').trim();
            if (finalHref.startsWith('note:')) {
                finalHref = `/admin/notes/${finalHref.replace(/^note:/, '')}`;
            } else if (finalHref && !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(finalHref)) {
                finalHref = `https://${finalHref}`;
            }
            const isAnchor = finalHref.startsWith('#');
            const targetAttr = isAnchor ? '' : ' target="_blank" rel="noopener noreferrer"';
            return `<a href="${escapeHtml(finalHref)}"${targetAttr}${titleAttr}>${content || text}</a>`;
        },
        listitem(item) {
            const isChecked = Boolean(item.checked);
            const checkSvg = isChecked
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
                : '';
            const content = this.parser ? this.parser.parse(item.tokens, !item.loose) : (item.text || '');
            const cleanText = String(content)
                .replace(/^<p>\s*<input[^>]*>\s*/, '<p>')
                .replace(/^<input[^>]*>\s*/, '')
                .replace(/^<p>([\s\S]*?)<\/p>$/, '$1');
            if (item.task) {
                return `<li class="admin-markdown-task-item${isChecked ? ' is-checked' : ''}"><span class="admin-markdown-task-checkbox${isChecked ? ' is-checked' : ''}" aria-hidden="true">${checkSvg}</span><span class="admin-markdown-task-text">${cleanText}</span></li>\n`;
            }
            return `<li>${content}</li>\n`;
        },
        list(token) {
            const hasTask = token.items && token.items.some((it) => it.task);
            let body = '';
            for (let i = 0; i < (token.items || []).length; i++) {
                body += this.listitem(token.items[i]);
            }
            if (hasTask) {
                return `<ul class="admin-markdown-task-list">${body}</ul>\n`;
            }
            const type = token.ordered ? 'ol' : 'ul';
            const startAttr = token.ordered && token.start && token.start !== 1 ? ` start="${token.start}"` : '';
            return `<${type}${startAttr}>${body}</${type}>\n`;
        },
    },
    hooks: {
        postprocess(html) {
            return processMarkdownStatusAndTasks(
                html
                    .replace(/<table>/g, '<div class="ai-table-wrapper"><table class="ai-table">')
                    .replace(/<\/table>/g, '</table></div>')
            );
        },
    },
});

export const CALLOUT_ICONS = {
    tip: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 8v3"/><path d="M12 15h.01"/></svg>',
    warning: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    danger: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    caution: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    idea: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    info: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    note: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
};

const contentMarked = new Marked({
    gfm: true,
    breaks: true,
});

contentMarked.use({
    renderer: {
        code({ text, lang }) {
            const cleanLang = (lang || '').trim().toLowerCase();
            let highlighted = text;
            if (cleanLang && hljs.getLanguage(cleanLang)) {
                try {
                    highlighted = hljs.highlight(text, { language: cleanLang }).value;
                } catch {
                    highlighted = escapeHtml(text);
                }
            } else {
                highlighted = escapeHtml(text);
            }
            return `<div class="ai-code-wrapper"><div class="ai-code-header"><span class="ai-code-lang">${escapeHtml(cleanLang || 'code')}</span></div><pre class="ai-code-block"><code class="hljs ${escapeHtml(cleanLang)}">${highlighted}</code></pre></div>`;
        },
        link({ href, title, text, tokens }) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            const content = this.parser ? this.parser.parseInline(tokens) : text;
            let finalHref = (href || '').trim();
            if (finalHref.startsWith('note:')) {
                finalHref = `/admin/notes/${finalHref.replace(/^note:/, '')}`;
            } else if (finalHref && !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(finalHref)) {
                finalHref = `https://${finalHref}`;
            }
            const isAnchor = finalHref.startsWith('#');
            const targetAttr = isAnchor ? '' : ' target="_blank" rel="noopener noreferrer"';
            return `<a href="${escapeHtml(finalHref)}"${targetAttr}${titleAttr}>${content || text}</a>`;
        },
        blockquote(token) {
            const bodyHtml = this.parser ? this.parser.parse(token.tokens) : (token.text || '');

            // Check for callout/alert syntax: [!TYPE] or [!TYPE] Title
            const alertMatch = String(bodyHtml).match(
                /^\s*<p>\s*\[!(NOTE|TIP|WARNING|DANGER|INFO|IDEA|CAUTION)\](?:[ \t]+([^\n<]*?))?(?:\s*<br\s*\/?>([\s\S]*?))?<\/p>([\s\S]*)$/i
            );

            if (alertMatch) {
                const rawType = alertMatch[1].toLowerCase();
                const type = (rawType === 'note' ? 'info' : (rawType === 'caution' ? 'danger' : rawType));
                const customTitle = (alertMatch[2] || '').trim();
                const restOfFirstP = (alertMatch[3] || '').trim();
                const restOfBody = alertMatch[4] || '';

                let title = '';
                let innerBody = '';

                if (restOfFirstP || restOfBody) {
                    title = customTitle || (type.charAt(0).toUpperCase() + type.slice(1));
                    innerBody = (restOfFirstP ? `<p>${restOfFirstP}</p>` : '') + restOfBody;
                } else {
                    title = customTitle || (type.charAt(0).toUpperCase() + type.slice(1));
                }

                const icon = CALLOUT_ICONS[rawType] || CALLOUT_ICONS.info;

                return `<div class="admin-markdown-callout admin-markdown-callout-${type}"><div class="admin-markdown-callout-header"><span class="admin-markdown-callout-icon">${icon}</span><span class="admin-markdown-callout-title">${title}</span></div>${innerBody ? `<div class="admin-markdown-callout-body">${innerBody}</div>` : ''}</div>\n`;
            }

            return `<blockquote class="admin-markdown-quote">${bodyHtml}</blockquote>\n`;
        },
        listitem(item) {
            const isChecked = Boolean(item.checked);
            const checkSvg = isChecked
                ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
                : '';
            const content = this.parser ? this.parser.parse(item.tokens, !item.loose) : (item.text || '');
            const cleanText = String(content)
                .replace(/^<p>\s*<input[^>]*>\s*/, '<p>')
                .replace(/^<input[^>]*>\s*/, '')
                .replace(/^<p>([\s\S]*?)<\/p>$/, '$1');
            if (item.task) {
                return `<li class="admin-markdown-task-item${isChecked ? ' is-checked' : ''}"><span class="admin-markdown-task-checkbox${isChecked ? ' is-checked' : ''}" aria-hidden="true">${checkSvg}</span><span class="admin-markdown-task-text">${cleanText}</span></li>\n`;
            }
            return `<li>${content}</li>\n`;
        },
        list(token) {
            const hasTask = token.items && token.items.some((it) => it.task);
            let body = '';
            for (let i = 0; i < (token.items || []).length; i++) {
                body += this.listitem(token.items[i]);
            }
            if (hasTask) {
                return `<ul class="admin-markdown-task-list">${body}</ul>\n`;
            }
            const type = token.ordered ? 'ol' : 'ul';
            const startAttr = token.ordered && token.start && token.start !== 1 ? ` start="${token.start}"` : '';
            return `<${type}${startAttr}>${body}</${type}>\n`;
        },
    },
    hooks: {
        postprocess(html) {
            return processMarkdownStatusAndTasks(html);
        },
    },
});

/**
 * Process LaTeX mathematical expressions ($...$ and $$...$$) into KaTeX HTML
 */
export const processMath = (markdown = '') => {
    if (!markdown || typeof markdown !== 'string') return '';

    // Replace block math $$ ... $$
    let result = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (_, equation) => {
        try {
            return `<div class="katex-display-wrapper">${katex.renderToString(equation.trim(), {
                displayMode: true,
                throwOnError: false,
            })}</div>`;
        } catch {
            return `$$${equation}$$`;
        }
    });

    // Replace inline math $...$ (avoiding currency like $50 or escaped \$)
    result = result.replace(/(^|[^\\])\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, (match, prefix, equation) => {
        if (/^\d+(?:\.\d+)?$/.test(equation)) return match;
        try {
            return `${prefix}${katex.renderToString(equation.trim(), {
                displayMode: false,
                throwOnError: false,
            })}`;
        } catch {
            return match;
        }
    });

    return result;
};

/**
 * Render Markdown for AI Assistant Chat messages
 * Formats headers, lists, bold/italics, code blocks with syntax highlighting, and responsive tables
 */
export const renderAssistantMarkdown = (content = '') => {
    if (!content || typeof content !== 'string') return '';
    try {
        const withMath = processMath(content);
        return chatMarked.parse(withMath);
    } catch (err) {
        console.error(tStatic('logs.markdownParseError', undefined, 'Failed to parse assistant markdown:'), err);
        return escapeHtml(content);
    }
};

// Shared markdown helpers for blog/research pages
export const processFootnotes = (markdown = '') => {
    const footnoteDefRegex = /^\[\^(.+?)\]:\s+(.+)$/gm;
    const footnotes = [];

    let mainText = markdown.replace(footnoteDefRegex, (match, id, text) => {
        footnotes.push({id, text});
        return '';
    });

    mainText = mainText.replace(/\[\^(.+?)\]/g, (match, id) => {
        const idx = footnotes.findIndex(f => f.id === id);
        if (idx === -1) return match;
        return `<sup class="footnote-ref"><a href="#footnote-${id}" id="footnote-ref-${id}">[${id}]</a></sup>`;
    });

    if (footnotes.length === 0) return mainText;

    const renderedFootnotes = footnotes
        .map(f => `<li id="footnote-${f.id}">${f.text} <a href="#footnote-ref-${f.id}" class="footnote-backref">↩</a></li>`)
        .join('');

    return `${mainText}\n\n---\n\n<section class="footnotes"><ol>${renderedFootnotes}</ol></section>`;
};

export const renderMarkdownWithFootnotes = (markdown = '') => {
    const withMath = processMath(markdown);
    const processed = processFootnotes(withMath);
    return contentMarked.parse(processed);
};

