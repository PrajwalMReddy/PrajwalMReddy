import {renderMarkdownWithFootnotes} from './markdownUtils';

const SUBSTACK_LINK = 'https://prajwalmreddy.substack.com/feed';
const SUBSTACK_FEED_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(SUBSTACK_LINK)}`;

const EN_TO_KN_DIGITS = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];

const convertToKannadaNumerals = (str) => str.replace(/\d/g, d => EN_TO_KN_DIGITS[d]);

// ---------- Date formatting (shared everywhere) ----------

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

// ---------- Local posts ----------

const getLocalBlogPosts = async () => {
    const response = await fetch('/blog/_metadata.json');
    if (!response.ok) throw new Error('Failed to fetch blog index');

    const blogIndex = await response.json();
    return blogIndex.filter(p => !p.visibility || p.visibility === 'public');
};

// ---------- HTML decode ----------

function decodeEntities(input = '') {
    if (typeof document === 'undefined') return input;

    const textarea = document.createElement('textarea');
    textarea.innerHTML = input;
    const firstPass = textarea.value;
    textarea.innerHTML = firstPass;
    return textarea.value;
}

// ---------- Substack RSS ----------

const getSubstackPosts = async (language) => {
    try {
        const response = await fetch(SUBSTACK_FEED_URL);
        if (!response.ok) throw new Error('Failed to fetch Substack feed');

        const rssText = await response.text();
        const doc = new DOMParser().parseFromString(rssText, 'application/xml');

        return Array.from(doc.querySelectorAll('channel > item')).map((item, index) => {
            const title = decodeEntities(item.querySelector('title')?.textContent || 'Untitled');

            const link = item.querySelector('link')?.textContent || '';
            const rawDate = item.querySelector('pubDate')?.textContent || '';
            const author = item.querySelector('dc\\:creator, creator')?.textContent || 'Prajwal Reddy';

            const description = decodeEntities(item.querySelector('description')?.textContent || '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            let slug = `substack-${index}`;
            try {
                slug = new URL(link).pathname.split('/').filter(Boolean).pop() || slug;
            } catch {
            }

            return {
                id: `substack-${slug}`,
                slug,
                title,
                description,
                date: formatDisplayDate(rawDate, language),
                author,
                externalUrl: link,
                source: 'substack',
            };
        });
    } catch (error) {
        console.error('Substack RSS error:', error);
        return [];
    }
};

// ---------- Combined list ----------

export const getAllBlogPosts = async (language) => {
    try {
        const [local, substack] = await Promise.all([getLocalBlogPosts().catch(() => []), getSubstackPosts(language),]);

        const normalizedLocal = local.map(post => ({
            ...post, source: post.source || 'local', date: formatDisplayDate(post.date, language),
        }));

        return [...normalizedLocal, ...substack];
    } catch {
        return [];
    }
};

// ---------- Single blog post ----------

export const fetchBlogContent = async (filename) => {
    const res = await fetch(`/blog/${filename}`);
    if (!res.ok) throw new Error('Failed to fetch blog content');
    return res.text();
};

export const parseBlogContent = (content) => renderMarkdownWithFootnotes(content);

export const getBlogPostBySlug = async (slug, language) => {
    const response = await fetch('/blog/_metadata.json');
    if (!response.ok) throw new Error('Failed to fetch blog index');

    const blogIndex = await response.json();
    const post = blogIndex.find(p => p.slug === slug);
    if (!post) throw new Error('Blog post not found');

    const content = await fetchBlogContent(`${slug}.md`);

    return {
        ...post, date: formatDisplayDate(post.date, language), content: parseBlogContent(content),
    };
};
