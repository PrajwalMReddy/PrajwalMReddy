import React, {lazy, Suspense} from 'react';
import {Link} from 'react-router-dom';

const ResearchCard = ({type, component, title, image, description, link}) => {
    const content = (
        <div className="research-card-inner">
            <h2 className="research-card-title">{title}</h2>
            {image && <img className="research-card-image" src={image} alt={title}/>}
            {description && <p className="research-card-desc">{description}</p>}
        </div>
    );

    // For custom components (like BengaluruTeluguDictionary)
    if (type === 'custom' && component) {
        const CustomComponent = lazy(() => import(`./${component}`));
        return (
            <div className="project-info research-card">
                <Link className="project-link research-card-link" to={link}>
                    <Suspense fallback={content}>
                        {content}
                    </Suspense>
                </Link>
            </div>
        );
    }

    // For regular cards (article pages or external links)
    const isInternal = typeof link === 'string' && link.startsWith('/');
    return (
        <div className="project-info research-card">
            {link ? (
                isInternal ? (
                    <Link className="project-link research-card-link" to={link}>
                        {content}
                    </Link>
                ) : (
                    <a
                        className="project-link research-card-link"
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {content}
                    </a>
                )
            ) : content}
        </div>
    );
};

export default ResearchCard; 