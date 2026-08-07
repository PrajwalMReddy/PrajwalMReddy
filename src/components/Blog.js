import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {useLanguage} from '../utils/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import {getAllBlogPosts} from '../utils/blogUtils';

// Helper: Kannada to English month and numeral conversion
const KN_TO_EN_MONTHS = [{kn: 'ಜನವರಿ', en: 'January'}, {kn: 'ಫೆಬ್ರವರಿ', en: 'February'}, {
    kn: 'ಮಾರ್ಚ್', en: 'March'
}, {kn: 'ಏಪ್ರಿಲ್', en: 'April'}, {kn: 'ಮೇ', en: 'May'}, {kn: 'ಜೂನ್', en: 'June'}, {
    kn: 'ಜುಲೈ', en: 'July'
}, {kn: 'ಆಗಸ್ಟ್', en: 'August'}, {kn: 'ಸೆಪ್ಟೆಂಬರ್', en: 'September'}, {kn: 'ಅಕ್ಟೋಬರ್', en: 'October'}, {
    kn: 'ನವೆಂಬರ್', en: 'November'
}, {kn: 'ಡಿಸೆಂಬರ್', en: 'December'},];

const KN_NUMS = ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'];

function parseBlogDate(dateStr) {
    let d = Date.parse(dateStr);
    if (!isNaN(d)) return d;

    let enDateStr = dateStr;

    // convert Kannada month names → English
    KN_TO_EN_MONTHS.forEach(({kn, en}) => {
        enDateStr = enDateStr.replace(new RegExp(kn, 'g'), en);
    });

    // convert Kannada numerals → English
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
    const [blogNotice, setBlogNotice] = useState('');

    const renderWithNewlines = (text) => {
        if (!text || typeof text !== 'string') return text;
        const parts = text.split('\n');
        return parts.map((part, i) => (<React.Fragment key={i}>
            {part}
            {i < parts.length - 1 && <br/>}
        </React.Fragment>));
    };

    useEffect(() => {
        document.title = t('pageTitles.blog');
    }, [t]);

    useEffect(() => {
        const loadBlogPosts = async () => {
            try {
                setLoading(true);

                // language-aware date formatting now happens in blogUtils
                const posts = await getAllBlogPosts(language);

                const sortedPosts = posts.sort((a, b) => parseBlogDate(b.date) - parseBlogDate(a.date));

                setBlogPosts(sortedPosts);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadBlogPosts();
    }, [language]);

    // rotate through blog notices
    useEffect(() => {
        const noticeArray = t('blogNotice');
        const notices = Array.isArray(noticeArray) ? noticeArray : [noticeArray].filter(Boolean);

        if (notices.length === 0) {
            setBlogNotice('');
            return;
        }

        const key = `BlogNoticeIndex_${language || 'default'}`;
        let i = 0;
        try {
            i = Number(localStorage.getItem(key));
            if (!Number.isInteger(i) || i < 0 || i >= notices.length) i = 0;
        } catch {
            i = 0;
        }

        setBlogNotice(notices[i]);

        try {
            localStorage.setItem(key, String((i + 1) % notices.length));
        } catch {
            /* ignore */
        }
    }, [language, t]);

    return (<div id="app-root">
        <SideNav/>
        <main>
            <h1 id="blog-heading">{t('blogHeading')}</h1>
            {blogPosts.length === 0 ? (<p id="blog-subtitle"><Link to="/photography">{t('blogEmpty')}</Link></p>) : (
                <p id="blog-subtitle"><Link to="/photography">{t('blogSubtitle')}</Link></p>)}

            {(<>

                {blogNotice && (<div id="blog-notice-div">
                    <div className="blog-notice">
                        <div className="blog-notice-content">
                            {renderWithNewlines(blogNotice)}
                        </div>
                    </div>
                </div>)}

                {blogPosts.length > 0 && (<div className="blog-grid">
                    {blogPosts.map((post) => {
                        const key = post.id || post.slug || post.title;

                        if (post.externalUrl) {
                            return (<a
                                href={post.externalUrl}
                                key={key}
                                className="blog-card"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <h2 className="blog-title">
                                    {post.title}
                                    <span
                                        className="blog-external-icon"
                                        aria-label="Opens external Substack post"
                                        title="Opens external Substack post"
                                    >
                                                        ↗
                                                    </span>
                                </h2>

                                <p className="blog-excerpt">{post.description}</p>

                                <div className="blog-meta">
                                    <time className="blog-date">{post.date}</time>
                                </div>
                            </a>);
                        }

                        return (<Link
                            to={`/blog/${post.slug}`}
                            key={key}
                            className="blog-card"
                        >
                            <h2 className="blog-title">{post.title}</h2>
                            <p className="blog-excerpt">{post.description}</p>

                            <div className="blog-meta">
                                <time className="blog-date">{post.date}</time>
                                {post.author && (<span className="blog-author">
                                                        by {post.author}
                                                    </span>)}
                            </div>
                        </Link>);
                    })}
                </div>)}

                {blogPosts.length > 0 && (<p className="blog-external-notice">
                    {t('blogExternalSourceNotice')}
                </p>)}
            </>)}
        </main>
        <Footer/>
    </div>);
};

export default Blog;
