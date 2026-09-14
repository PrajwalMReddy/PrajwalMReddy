import {renderMarkdownWithFootnotes} from './markdownUtils';

// Fetch all research post metadata
export const getAllResearchPosts = async () => {
    try {
        const apiRes = await fetch('/api/cms/content?type=research');
        if (apiRes.ok) {
            const data = await apiRes.json();
            if (Array.isArray(data) && data.length > 0) {
                return data;
            }
        }
    } catch {
        // Fall back to static JSON
    }

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
    const normalizedFilename = filename.startsWith('/') ? filename.slice(1) : filename;
    const slug = normalizedFilename.replace(/\.md$/, '');

    try {
        const apiRes = await fetch(`/api/cms/markdown?type=research&slug=${encodeURIComponent(slug)}`);
        if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.exists && data.content) {
                return data.content;
            }
        }
    } catch {
        // Fall back to static markdown file
    }

    try {
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
export const getTranslatedResearch = (metadata, language) => {
    const visible = (metadata || []).filter(item => !item.visibility || item.visibility === 'public');

    const groups = {};
    for (const item of visible) {
        // Helper to read a translated field from any metadata shape
        const readTranslated = (fieldName) => {
            // 1. Language-keyed translation on item (shape B: item[language][fieldName])
            if (item[language] && typeof item[language][fieldName] === 'string' && item[language][fieldName].trim()) {
                return item[language][fieldName].trim();
            }
            // 2. Shape A: item[fieldName] is an object with language keys
            if (item[fieldName] && typeof item[fieldName] === 'object') {
                const val = item[fieldName][language] || item[fieldName].en || item[fieldName].kn;
                if (typeof val === 'string' && val.trim()) return val.trim();
            }
            // 3. Fallback language in shape B
            if (language !== 'en' && item.en && typeof item.en[fieldName] === 'string' && item.en[fieldName].trim()) {
                return item.en[fieldName].trim();
            }
            if (language !== 'kn' && item.kn && typeof item.kn[fieldName] === 'string' && item.kn[fieldName].trim()) {
                return item.kn[fieldName].trim();
            }
            // 4. Direct string property on item (used as fallback)
            if (!item.en && !item.kn && typeof item[fieldName] === 'string' && item[fieldName].trim()) {
                return item[fieldName].trim();
            }
            // 5. Alternate field names for sectionTitle (e.g. group, section, category)
            if (fieldName === 'sectionTitle') {
                for (const alt of ['group', 'section', 'category']) {
                    if (item[language] && typeof item[language][alt] === 'string' && item[language][alt].trim()) {
                        return item[language][alt].trim();
                    }
                    if (item[alt] && typeof item[alt] === 'object') {
                        const val = item[alt][language] || item[alt].en || item[alt].kn;
                        if (typeof val === 'string' && val.trim()) return val.trim();
                    }
                    if (language !== 'en' && item.en && typeof item.en[alt] === 'string' && item.en[alt].trim()) {
                        return item.en[alt].trim();
                    }
                    if (!item.en && !item.kn && typeof item[alt] === 'string' && item[alt].trim()) {
                        return item[alt].trim();
                    }
                }
            }
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

        // Get the content: prefer embedded content from database, fallback to fetchResearchContent
        const content = article.content || await fetchResearchContent(`${slug}.md`);
        const htmlContent = parseResearchContent(content || '');

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
