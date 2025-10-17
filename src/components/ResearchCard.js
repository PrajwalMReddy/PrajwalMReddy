import React from 'react';
import { Link } from 'react-router-dom';

const ResearchCard = ({title, image, description, link}) => {
    const content = (
        <div className="research-card-inner">
            <h2 className="research-card-title">{title}</h2>
            {image && <img className="research-card-image" src={image} alt={title} />}
            {description && <p className="research-card-desc">{description}</p>}
        </div>
    );

    const isInternal = typeof link === 'string' && link.startsWith('/');
    return (
        <div className="project-info research-card">
            {link ? (
                isInternal ? (
                    <Link className="project-link research-card-link" to={link}>
                        {content}
                    </Link>
                ) : (
                    <a className="project-link research-card-link" href={link} rel="noopener noreferrer">
                        {content}
                    </a>
                )
            ) : content}
        </div>
    );
};

export default ResearchCard; 