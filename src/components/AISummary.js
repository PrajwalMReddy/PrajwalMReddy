import React, { useState, useEffect } from 'react';
import { requestAI } from '../utils/aiApi';

const AISummary = () => {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSummary();
    }, []);

    const fetchSummary = async () => {
        try {
            setLoading(true);
            setError('');

            const data = await requestAI([{
                role: 'user',
                content: `Generate a brief executive summary for my admin dashboard. Include:
1. How many tasks I have today (including overdue)
2. Any important action items from recent notes
3. My spending this month and top spending categories
4. Recommended priorities for the day

Keep it concise and actionable. Use bullet points.`,
            }]);
            setSummary(data.content);
        } catch (err) {
            setError(err.message);
            console.error('Summary error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="ai-summary">
                <h2>✨ Today's Summary</h2>
                <div className="ai-summary-loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="ai-summary">
            <div className="ai-summary-header">
                <h2>✨ Today's Summary</h2>
                <button
                    className="ai-summary-refresh"
                    onClick={fetchSummary}
                    title="Refresh summary"
                >
                    🔄
                </button>
            </div>

            {error ? (
                <div className="ai-summary-error">
                    ❌ Failed to load summary: {error}
                </div>
            ) : summary ? (
                <div className="ai-summary-content">
                    {summary.split('\n').map((line, idx) => {
                        if (line.trim() === '') return null;
                        if (line.trim().startsWith('#')) {
                            return (
                                <h3 key={idx} className="ai-summary-section">
                                    {line.replace(/^#+\s*/, '')}
                                </h3>
                            );
                        }
                        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                            return (
                                <div key={idx} className="ai-summary-item">
                                    {line.replace(/^[-•]\s*/, '')}
                                </div>
                            );
                        }
                        if (line.trim().match(/^\d+\./)) {
                            return (
                                <div key={idx} className="ai-summary-item">
                                    {line}
                                </div>
                            );
                        }
                        return (
                            <p key={idx} className="ai-summary-text">
                                {line}
                            </p>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
};

export default AISummary;
