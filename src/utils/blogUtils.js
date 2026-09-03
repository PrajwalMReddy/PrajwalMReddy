import {renderMarkdownWithFootnotes} from './markdownUtils';

const EN_TO_KN_DIGITS = ['\u0CE6', '\u0CE7', '\u0CE8', '\u0CE9', '\u0CEA', '\u0CEB', '\u0CEC', '\u0CED', '\u0CEE', '\u0CEF'];

const convertToKannadaNumerals = (str) => str.replace(/\d/g, d => EN_TO_KN_DIGITS[d]);

export const formatDisplayDate = (dateInput, language) => {
    if (!dateInput) return '';

    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return dateInput;

    const locale = language === 'kn' ? 'kn-IN' : 'en-US';

    try {
        let formatted = d.toLocaleDateString(locale, {
            year: 'numeric', month: 'long', day: 'numeric',
        });

        if (language === 'kn') {
            formatted = convertToKannadaNumerals(formatted);
        }

        return formatted;
    } catch {
        return dateInput;
    }
};

const getLocalMarkdownIndex = async (basePath) => {
    const response = await fetch(`/${basePath}/_metadata.json`);
    if (!response.ok) throw new Error(`Failed to fetch ${basePath} index`);

    const index = await response.json();
    return index.filter(item => !item.visibility || item.visibility === 'public');
};

const getMarkdownEntryBySlug = async (basePath, slug) => {
    const response = await fetch(`/${basePath}/_metadata.json`);
    if (!response.ok) throw new Error(`Failed to fetch ${basePath} index`);

    const index = await response.json();
    const entry = index.find(item => item.slug === slug);
    if (!entry) throw new Error(`${basePath} entry not found`);

    return entry;
};

const fetchMarkdownContent = async (basePath, filename) => {
    const res = await fetch(`/${basePath}/${filename}`);
    if (!res.ok) throw new Error(`Failed to fetch ${basePath} content`);
    return res.text();
};

const parseMarkdownContent = (content) => renderMarkdownWithFootnotes(content);

const normalizeLocalIndexDates = (items, language, defaultSource = 'local') => items.map(item => ({
    ...item,
    source: item.source || defaultSource,
    sortDate: Date.parse(item.date) || 0,
    date: formatDisplayDate(item.date, language),
}));

const getLocalBlogPosts = async () => getLocalMarkdownIndex('blog');

export const getAllBlogPosts = async (language) => {
    try {
        const posts = await getLocalBlogPosts();
        return normalizeLocalIndexDates(posts, language);
    } catch {
        return [];
    }
};

export const fetchBlogContent = async (filename) => fetchMarkdownContent('blog', filename);

export const parseBlogContent = (content) => parseMarkdownContent(content);

export const getBlogPostBySlug = async (slug, language) => {
    const post = await getMarkdownEntryBySlug('blog', slug);
    const content = await fetchBlogContent(`${slug}.md`);

    return {
        ...post,
        date: formatDisplayDate(post.date, language),
        content: parseBlogContent(content),
    };
};
