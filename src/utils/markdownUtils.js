import {marked} from 'marked';

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
