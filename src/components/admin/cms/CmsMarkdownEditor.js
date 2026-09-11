import React from 'react';

const CmsMarkdownEditor = ({ value = '', onChange, placeholder = 'Write your markdown content here...' }) => {
    return (
        <div className="cms-markdown-wrapper">
            <textarea
                className="cms-markdown-large-textarea"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={22}
                spellCheck="false"
            />
        </div>
    );
};

export default CmsMarkdownEditor;
