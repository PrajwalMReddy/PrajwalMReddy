import React from 'react';

const ProjectCard = ({title, image, description, link}) => {
    const content = (
        <>
            <h1 className="project-title">{title}</h1>
            <img className="project-image" src={image} alt={title}/>
            <p className="project-text">{description}</p>
        </>
    );

    return (
        <div className="project-info">
            {link ? (
                <a className="project-link" href={link} target="_blank" rel="noopener noreferrer">
                    {content}
                </a>
            ) : content}
        </div>
    );
};

export default ProjectCard; 