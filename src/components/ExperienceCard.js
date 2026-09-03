import React from 'react';

const ExperienceCard = ({title, company, duration, description, notes}) => {
    return (<div className="experience-info">
        <div className="experience-header">
            <h1 className="experience-title">{title}</h1>
            <div className="experience-meta">
                <span className="experience-company">{company}</span>
                <span className="experience-duration">{duration}</span>
            </div>
        </div>
        <p className="experience-text">{description}</p>
        {notes && notes.label && notes.text && (<div className="experience-technologies">
            <span className="technologies-label">{notes.label}: </span>
            <span className="technologies-list">{notes.text}</span>
        </div>)}
    </div>);
};

export default ExperienceCard;
