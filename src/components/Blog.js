import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import {getAllBlogPosts} from '../utils/blogUtils';

// Helper: Kannada to English month and numeral conversion
const KN_TO_EN_MONTHS = [
    { kn: 'ಜನವರಿ', en: 'January' },
    { kn: 'ಫೆಬ್ರವರಿ', en: 'February' },
    { kn: 'ಮಾರ್ಚ್', en: 'March' },
    { kn: 'ಏಪ್ರಿಲ್', en: 'April' },
    { kn: 'ಮೇ', en: 'May' },
    { kn: 'ಜೂನ್', en: 'June' },
    { kn: 'ಜುಲೈ', en: 'July' },
    { kn: 'ಆಗಸ್ಟ್', en: 'August' },
    { kn: 'ಸೆಪ್ಟೆಂಬರ್', en: 'September' },
    { kn: 'ಅಕ್ಟೋಬರ್', en: 'October' },
    { kn: 'ನವೆಂಬರ್', en: 'November' },
    { kn: 'ಡಿಸೆಂಬರ್', en: 'December' },
];
const KN_NUMS = ['೦','೧','೨','೩','೪','೫','೬','೭','೮','೯'];

function parseBlogDate(dateStr) {
    let d = Date.parse(dateStr);
    if (!isNaN(d)) return d;
    let enDateStr = dateStr;
    KN_TO_EN_MONTHS.forEach(({ kn, en }) => {
        enDateStr = enDateStr.replace(kn, en);
    });
    for (let i = 0; i < KN_NUMS.length; i++) {
        enDateStr = enDateStr.replace(new RegExp(KN_NUMS[i], 'g'), i.toString());
    }
    d = Date.parse(enDateStr);
    return isNaN(d) ? 0 : d;
}

const Blog = () => {
    const {t, language} = useLanguage();
    const [blogPosts, setBlogPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const getBlogNoticeText = () => {
        let blogNoticeArray = t('blogNotice');
        let blogNotice;
        if (localStorage.getItem(language + 'BlogNotice') === null) {
            blogNotice = t('blogNotice')[0];
            localStorage.setItem(language + 'BlogNotice', blogNotice);
        } else if (Math.random() < 0.1) {
            blogNotice = blogNoticeArray[Math.floor(Math.random() * blogNoticeArray.length)];
            localStorage.setItem(language + 'BlogNotice', blogNotice);
        } else {
            blogNotice = localStorage.getItem(language + 'BlogNotice');
        }
        return blogNotice;
    };

    useEffect(() => {
        document.title = t('pageTitles.blog');
    }, [t]);

    useEffect(() => {
        const loadBlogPosts = async () => {
            try {
                setLoading(true);
                const posts = await getAllBlogPosts();
                const filteredPosts = posts.filter(post => post.language === language);
                const sortedPosts = filteredPosts.sort((a, b) => parseBlogDate(b.date) - parseBlogDate(a.date));
                setBlogPosts(sortedPosts);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadBlogPosts();
    }, [language]);

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="blog-heading">{t('blogHeading')}</h1>
            {loading ? (<div className="blog-loading">Loading...</div>) : error ? (
                <div className="blog-error">Error: {error}</div>) : (<>
                <div id="blog-notice-div">
                    <div className="blog-notice">
                        <h1 className="blog-notice-heading">
                            {blogPosts.length === 0 ? <Link to="/photography" className="nav-link">{t('blogNoticeEmpty')}</Link> : getBlogNoticeText()}
                        </h1>
                    </div>
                </div>
                {blogPosts.length > 0 && (<div className="blog-grid">
                    {blogPosts.map((post) => (<Link
                        to={`/content/blog/${post.slug}`}
                        key={post.slug}
                        className="blog-card"
                    >
                        <h2 className="blog-title">{post.title}</h2>
                        <p className="blog-excerpt">{post.description}</p>
                        <div className="blog-meta">
                            <time className="blog-date">{post.date}</time>
                            {post.author && (<span className="blog-author">by {post.author}</span>)}
                        </div>
                    </Link>))}
                </div>)}
            </>)}
        </main>
        <Footer/>
    </div>);
};

export default Blog;
