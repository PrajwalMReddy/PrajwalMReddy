import React from 'react';
import { useContent } from '../utils/ContentContext';

// Formats text that might contain markdown-style bolding (**text**)
const renderFormattedText = (text) => {
    if (!text || typeof text !== 'string') return text;
    if (!text.includes('**')) return text;

    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={index} className="experience-bold-highlight">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return part;
    });
};

const ExperienceCard = ({ title, company, duration, description, notes }) => {
    const { formatNumber } = useContent();

    // Parse description into structured bullets, tags, or clean paragraphs
    const parseDescription = (desc) => {
        if (!desc) return { type: 'empty', items: [] };

        // Check for bullet lines (contains newlines or bullet markers)
        if (typeof desc === 'string' && (desc.includes('\n') || desc.includes('•') || desc.trim().startsWith('-'))) {
            const rawLines = desc.split('\n').map(l => l.trim()).filter(Boolean);
            const bullets = rawLines
                .map(line => line.replace(/^[•\-\*\u2022]\s*/, '').trim())
                .filter(Boolean);

            if (bullets.length > 0) {
                return { type: 'bullets', items: bullets };
            }
        }

        // Check for comma-separated items (e.g. Coursework list)
        if (typeof desc === 'string' && desc.includes(',')) {
            const commaItems = desc.split(',').map(s => s.trim()).filter(Boolean);
            if (commaItems.length >= 3 && commaItems.every(s => s.length < 60)) {
                return { type: 'tags', items: commaItems };
            }
        }

        return { type: 'text', items: [desc] };
    };

    const parsed = parseDescription(description);

    return (
        <div className="experience-info">
            <div className="experience-header">
                <div className="experience-title-row">
                    <h3 className="experience-title">{title}</h3>
                    {duration && (
                        <span className="experience-duration-pill">
                            <svg
                                className="experience-calendar-icon"
                                width="13"
                                height="13"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {formatNumber(duration)}
                        </span>
                    )}
                </div>

                {company && (
                    <div className="experience-company-wrap">
                        <svg
                            className="experience-company-icon"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                        <span className="experience-company-text">{company}</span>
                    </div>
                )}
            </div>

            <div className="experience-body">
                {parsed.type === 'bullets' && (
                    <ul className="experience-bullet-list">
                        {parsed.items.map((bullet, idx) => (
                            <li key={idx} className="experience-bullet-item">
                                <span className="experience-bullet-indicator" aria-hidden="true">
                                    <svg
                                        width="10"
                                        height="10"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </span>
                                <span className="experience-bullet-text">
                                    {renderFormattedText(bullet)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                {parsed.type === 'tags' && (
                    <div className="experience-tags-container">
                        {parsed.items.map((tag, idx) => (
                            <span key={idx} className="experience-tag-chip">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {parsed.type === 'text' && (
                    <p className="experience-text-content">
                        {renderFormattedText(parsed.items[0])}
                    </p>
                )}
            </div>

            {notes && notes.label && notes.text && (
                <div className="experience-technologies">
                    <span className="technologies-label">{notes.label}:</span>
                    <span className="technologies-list">{notes.text}</span>
                </div>
            )}
        </div>
    );
};

export default ExperienceCard;
