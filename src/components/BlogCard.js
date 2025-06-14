import React from 'react';

const BlogCard = ({title, date, id, language}) => {
    const content = (<>
        <h1 className="blog-title">{title}</h1>
        <p className="blog-date">{date}</p>
    </>);

    return (
        <a className="blog-link" href={window.location.href + "/" + id} target="_blank" rel="noopener noreferrer">
            <div className="blog-card">
                {content}
            </div>
        </a>
    );
};

export default BlogCard;