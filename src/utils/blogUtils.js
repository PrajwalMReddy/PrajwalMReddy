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
    try {
        const apiRes = await fetch(`/api/cms/content?type=${basePath}`);
        if (apiRes.ok) {
            const index = await apiRes.json();
            if (Array.isArray(index)) {
                return index.filter(item => !item.visibility || item.visibility === 'public');
            }
        }
    } catch (err) {
        console.warn(`[blogUtils] Error fetching ${basePath} index:`, err);
    }
    return [];
};

const getMarkdownEntryBySlug = async (basePath, slug) => {
    const index = await getLocalMarkdownIndex(basePath);
    const entry = index.find(item => item.slug === slug);
    if (!entry) throw new Error(`${basePath} entry not found`);

    return entry;
};

const fetchMarkdownContent = async (basePath, filename) => {
    const slug = filename.replace(/\.md$/, '');
    try {
        const apiRes = await fetch(`/api/cms/markdown?type=${basePath}&slug=${encodeURIComponent(slug)}`);
        if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.exists && data.content) {
                return data.content;
            }
        }
    } catch {
        // Fall back to static markdown file
    }

    const res = await fetch(`/${basePath}/${filename}`);
    if (!res.ok) throw new Error(`Failed to fetch ${basePath} content`);
    return res.text();
};

const parseMarkdownContent = (content) => renderMarkdownWithFootnotes(content);

const normalizeLocalIndexDates = (items, language, defaultSource = 'local') => items.map(item => ({
    ...item,
    type: item.type || (item.component ? 'custom' : (item.externalUrl ? 'external' : 'article')),
    component: item.component || '',
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
    const isCustom = post.type === 'custom' || Boolean(post.component);
    const rawContent = post.content || (!isCustom ? await fetchBlogContent(`${slug}.md`).catch(() => '') : '');
    const payload = post.customData !== undefined ? post.customData : (post.data || null);

    return {
        ...post,
        type: isCustom ? 'custom' : (post.externalUrl ? 'external' : 'article'),
        component: post.component || '',
        customData: payload,
        data: payload,
        date: formatDisplayDate(post.date, language),
        content: isCustom ? '' : parseBlogContent(rawContent || ''),
    };
};

