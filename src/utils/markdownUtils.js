import { marked, Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
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
        link({ href, title, text }) {
            const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
            return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttr}>${text}</a>`;
        },
    },
    hooks: {
        postprocess(html) {
            return html
                .replace(/<table>/g, '<div class="ai-table-wrapper"><table class="ai-table">')
                .replace(/<\/table>/g, '</table></div>');
        },
    },
});

/**
 * Render Markdown for AI Assistant Chat messages
 * Formats headers, lists, bold/italics, code blocks with syntax highlighting, and responsive tables
 */
export const renderAssistantMarkdown = (content = '') => {
    if (!content || typeof content !== 'string') return '';
    try {
        return chatMarked.parse(content);
    } catch (err) {
        console.error('Failed to parse assistant markdown:', err);
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
    const processed = processFootnotes(markdown);
    return marked(processed);
};

