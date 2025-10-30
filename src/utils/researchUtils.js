import {marked} from 'marked';

// Native footnote support for markdown (reuse from blog)
function processFootnotes(markdown) {
    const footnoteDefRegex = /^\[\^(.+?)\]:\s+(.+)$/gm;
    let footnotes = [];
    let mainText = markdown.replace(footnoteDefRegex, (match, id, text) => {
        footnotes.push({id, text});
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
        const response = await fetch('/research/metadata.json');
        if (!response.ok) throw new Error('Failed to fetch research metadata');
        const metadata = await response.json();
        return metadata || [];
    } catch (error) {
        console.error('Error fetching research metadata:', error);
        return [];
    }
};

// Fetch markdown content by filename
export const fetchResearchContent = async (filename) => {
    try {
        const response = await fetch(`/research/${filename}`);
        if (!response.ok) throw new Error('Failed to fetch research content');
        const content = await response.text();
        return processFootnotes(content);
    } catch (error) {
        console.error('Error fetching research content:', error);
        return '';
    }
};

// Get translated research items for the current language
// `metadata` is expected to be a flat array of items. This groups them by sectionTitle
export const getTranslatedResearch = (metadata, language) => {
    const visible = (metadata || []).filter(item => !item.visibility || item.visibility === 'public');

    const groups = {};
    for (const item of visible) {
        const sectionTitle = (item.sectionTitle && (item.sectionTitle[language] || item.sectionTitle.en)) || '';
        const key = sectionTitle || '_ungrouped_';
        if (!groups[key]) groups[key] = [];

        const baseItem = {
            type: item.type,
            title: (item.title && (item.title[language] || item.title.en)) || '',
            description: (item.description && (item.description[language] || item.description.en)) || '',
            image: item.image || '',
            slug: item.slug,
            date: item.date,
            url: item.url,
            component: item.component
        };

        if (item.type === 'custom') {
            baseItem.link = `/research/${item.slug}`;
        } else if (item.type === 'article') {
            baseItem.link = `/research/${item.slug}`;
        } else if (item.type === 'external') {
            baseItem.link = item.url;
        }

        groups[key].push(baseItem);
    }

    return Object.keys(groups).map(k => ({
        title: k === '_ungrouped_' ? null : k,
        items: groups[k]
    }));
};

// Parse markdown content with footnotes support
export const parseResearchContent = (content) => {
    const processed = processFootnotes(content);
    return marked(processed);
};

export const getResearchPostBySlug = async (slug) => {
    try {
        const metadata = await getAllResearchPosts();

        const article = (metadata || []).find(item => item.type === 'article' && item.slug === slug && (!item.visibility || item.visibility === 'public'));
        if (!article) throw new Error('Research article not found');

        // Get the content
        const content = await fetchResearchContent(`/${slug}.md`);
        const htmlContent = parseResearchContent(content);

        return {
            title: article.title?.en || article.title,
            description: article.description?.en || article.description,
            content: htmlContent,
            date: article.date
        };
    } catch (error) {
        console.error('Error fetching research article by slug:', error);
        throw error;
    }
};
