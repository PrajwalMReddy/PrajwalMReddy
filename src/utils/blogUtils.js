import {marked} from 'marked';

// Fetch all blog post metadata from metadata.json
export const getAllBlogPosts = async () => {
    try {
        const response = await fetch('/blog/metadata.json');
        if (!response.ok) throw new Error('Failed to fetch blog index');
        const blogIndex = await response.json();
        // Only return posts that are public or have no visibility set
        return blogIndex.filter(post => !post.visibility || post.visibility === 'public');
    } catch (error) {
        console.error('Error fetching blog index:', error);
        return [];
    }
};

// Fetch the markdown content for a given slug
export const fetchBlogContent = async (filename) => {
    try {
        const response = await fetch(`/blog/${filename}`);
        if (!response.ok) throw new Error('Failed to fetch blog content');
        const content = await response.text();
        return content;
    } catch (error) {
        console.error('Error fetching blog content:', error);
        throw error;
    }
};

// Parse markdown content (no metadata/frontmatter)
export const parseBlogContent = (content) => {
    // Just convert the markdown body to HTML
    const htmlContent = marked(content);
    return htmlContent;
};

// Get a single blog post's metadata and content by slug
export const getBlogPostBySlug = async (slug) => {
    // Fetch the full index, not filtered by visibility
    try {
        const response = await fetch('/blog/metadata.json');
        if (!response.ok) throw new Error('Failed to fetch blog index');
        const blogIndex = await response.json();
        const post = blogIndex.find((p) => p.slug === slug);
        if (!post) throw new Error('Blog post not found');
        const content = await fetchBlogContent(`${slug}.md`);
        const htmlContent = parseBlogContent(content);
        return {...post, content: htmlContent};
    } catch (error) {
        console.error('Error fetching blog post by slug:', error);
        throw error;
    }
};
