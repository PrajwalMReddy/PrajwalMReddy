import { marked } from 'marked';

// Native footnote support for markdown (reuse from blog)
function processFootnotes(markdown) {
    const footnoteDefRegex = /^\[\^(.+?)\]:\s+(.+)$/gm;
    let footnotes = [];
    let mainText = markdown.replace(footnoteDefRegex, (match, id, text) => {
        footnotes.push({ id, text });
        return '';
    });

    mainText = mainText.replace(/\[\^(.+?)\]/g, (match, id) => {
        const idx = footnotes.findIndex((f) => f.id === id);
        if (idx !== -1) {
            return `<sup class="footnote-ref"><a href="#footnote-${id}" id="footnote-ref-${id}">[${id}]</a></sup>`;
        }
        return match;
    });

    if (footnotes.length > 0) {
        mainText += '\n\n---\n\n<section class="footnotes"><ol>';
        for (const f of footnotes) {
            mainText += `<li id="footnote-${f.id}">${f.text} <a href="#footnote-ref-${f.id}" class="footnote-backref">↩</a></li>`;
        }
        mainText += '</ol></section>';
    }
    return mainText;
}

// Fetch all research post metadata
export const getAllResearchPosts = async () => {
    try {
        const response = await fetch('/research/_metadata.json');
        if (!response.ok) throw new Error('Failed to fetch research index');
        const researchIndex = await response.json();
        return researchIndex.filter((p) => !p.visibility || p.visibility === 'public');
    } catch (error) {
        console.error('Error fetching research index:', error);
        return [];
    }
};

// Fetch markdown content by filename
export const fetchResearchContent = async (filename) => {
    try {
        const response = await fetch(`/research/${filename}`);
        if (!response.ok) throw new Error('Failed to fetch research content');
        return await response.text();
    } catch (error) {
        console.error('Error fetching research content:', error);
        throw error;
    }
};

export const parseResearchContent = (content) => {
    const processed = processFootnotes(content);
    return marked(processed);
};

export const getResearchPostBySlug = async (slug) => {
    try {
        const response = await fetch('/research/_metadata.json');
        if (!response.ok) throw new Error('Failed to fetch research index');
        const researchIndex = await response.json();
        const post = researchIndex.find((p) => p.slug === slug);
        if (!post) throw new Error('Research post not found');
        const content = await fetchResearchContent(`${slug}.md`);
        const htmlContent = parseResearchContent(content);
        return { ...post, content: htmlContent };
    } catch (error) {
        console.error('Error fetching research post by slug:', error);
        throw error;
    }
};
