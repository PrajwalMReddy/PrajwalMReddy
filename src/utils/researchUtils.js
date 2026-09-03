import {renderMarkdownWithFootnotes} from './markdownUtils';

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
        const normalizedFilename = filename.startsWith('/') ? filename.slice(1) : filename;
        const response = await fetch(`/research/${normalizedFilename}`);
        if (!response.ok) throw new Error('Failed to fetch research content');
        return response.text();
    } catch (error) {
        console.error('Error fetching research content:', error);
        return '';
    }
};

// Get translated research items for the current language
// `metadata` is expected to be a flat array of items. This groups them by sectionTitle.
// Accept two metadata shapes:
// 1) fields nested under language keys (e.g. item.en.title)
// 2) fields nested under named keys (e.g. item.title.en)
export const getTranslatedResearch = (metadata, language) => {
    const visible = (metadata || []).filter(item => !item.visibility || item.visibility === 'public');

    const groups = {};
    for (const item of visible) {
        // Helper to read a translated field from either shape
        const readTranslated = (fieldName) => {
            // shape A: item[fieldName] is an object with language keys
            if (item[fieldName] && typeof item[fieldName] === 'object') {
                return item[fieldName][language] || item[fieldName].en || '';
            }
            // shape B: translations are top-level language keys containing the field
            if (item[language] && item[language][fieldName]) return item[language][fieldName];
            if (item.en && item.en[fieldName]) return item.en[fieldName];
            return '';
        };

        const sectionTitle = readTranslated('sectionTitle') || '';
        const key = sectionTitle || '_ungrouped_';
        if (!groups[key]) groups[key] = [];

        const baseItem = {
            type: item.type,
            title: readTranslated('title'),
            description: readTranslated('description'),
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
    return renderMarkdownWithFootnotes(content);
};

export const getResearchPostBySlug = async (slug) => {
    try {
        const metadata = await getAllResearchPosts();

        const article = (metadata || []).find(item => item.type === 'article' && item.slug === slug && (!item.visibility || item.visibility === 'public'));
        if (!article) throw new Error('Research article not found');

        // Get the content
        const content = await fetchResearchContent(`${slug}.md`);
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
