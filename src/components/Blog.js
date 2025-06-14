import React from 'react';
import {useLanguage} from '../context/LanguageContext';
import SideNav from './SideNav';
import Footer from './Footer';
import BlogCard from "./BlogCard";

const Blog = () => {
    const {t} = useLanguage();
    return (
        <div id="app-root">
            <SideNav/>
            <main>
                <h1 id="blog-heading">{t('blogHeading')}</h1>
                <div id="blog-notice-div">
                    <div className="blog-notice">
                        <h1 className="blog-notice-heading">{t('blogNotice')}</h1>
                    </div>
                </div>

                <BlogCard
                    title={"Hello, my name is Prajwal Reddy and I am the author of this blog."}
                    date={"June 14th, 2025"}
                    id={"hello"}
                    language={"en"}
                />
                <BlogCard
                title={"Hello, this is my second blog post."}
                date={"June 14th, 2025"}
                id={"hello"}
                language={"en"}
            />
            </main>
            <Footer/>
        </div>
    );
};

export default Blog; 