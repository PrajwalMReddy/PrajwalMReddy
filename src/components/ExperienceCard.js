import React from 'react';
import {useLanguage} from '../utils/LanguageContext';

const ExperienceCard = ({title, company, duration, description, technologies}) => {
    const {t} = useLanguage();

    return (<div className="experience-info">
        <div className="experience-header">
            <h1 className="experience-title">{title}</h1>
            <div className="experience-meta">
                <span className="experience-company">{company}</span>
                <span className="experience-duration">{duration}</span>
            </div>
        </div>
        <p className="experience-text">{description}</p>
        {technologies && technologies.length > 0 && (<div className="experience-technologies">
            <span className="technologies-label">{t('technologies')}: </span>
            <span className="technologies-list">{technologies.join(', ')}</span>
        </div>)}
    </div>);
};

export default ExperienceCard;
