import React, { useEffect, useMemo, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';

const DEFAULT_QUOTE = {
    id: '',
    text: '',
    author: '',
    language: 'en',
};

function formatQuoteDisplay(text) {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.startsWith('“') || trimmed.startsWith('"') || trimmed.startsWith('\'')) {
        return trimmed;
    }
    return `“${trimmed}”`;
}

function normalizeQuote(q, idx) {
    if (!q) return { id: `quote-${idx}`, text: '', author: '', language: 'en' };
    const lang = q.language || (q.text?.kn && !q.text?.en ? 'kn' : 'en');
    const text = typeof q.text === 'string' ? q.text : (q.text?.[lang] || q.text?.en || q.text?.kn || '');
    const author = typeof q.author === 'string' ? q.author : (q.author?.[lang] || q.author?.en || q.author?.kn || '');
    return {
        id: q.id || `quote-${idx}`,
        text: text || '',
        author: author || '',
        language: lang,
    };
}

const CmsQuotes = ({ data = [], onSave, saving }) => {
    const { t, formatNumber } = useContent();
    const rawQuotes = Array.isArray(data) ? data : [];

    const quotes = useMemo(() => {
        return rawQuotes.map((q, idx) => normalizeQuote(q, idx));
    }, [rawQuotes]);

    const [search, setSearch] = useState('');
    const [filterLang, setFilterLang] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);
    const [formState, setFormState] = useState(DEFAULT_QUOTE);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (!isModalOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen]);

    const filteredQuotes = useMemo(() => {
        return quotes.filter((q) => {
            const matchesSearch =
                !search ||
                q.text.toLowerCase().includes(search.toLowerCase()) ||
                q.author.toLowerCase().includes(search.toLowerCase());
            const matchesLang = filterLang === 'all' || q.language === filterLang;
            return matchesSearch && matchesLang;
        });
    }, [quotes, search, filterLang]);

    const handleOpenAdd = () => {
        setEditingIndex(null);
        setFormState({
            id: `quote-${Date.now()}`,
            text: '',
            author: '',
            language: filterLang !== 'all' ? filterLang : 'en',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEdit = (quote, index) => {
        setEditingIndex(index);
        setFormState({
            id: quote.id || `quote-${index}`,
            text: quote.text || '',
            author: quote.author || '',
            language: quote.language || 'en',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleDelete = async (index) => {
        const item = quotes[index];
        const preview = item?.text || 'this quote';
        if (!window.confirm(t('admin.ui.cmsQuotes.areYouSureYouWantTo', { p0: preview.slice(0, 40) }))) {
            return;
        }
        const updated = quotes.filter((_, i) => i !== index);
        await onSave(updated, 'Quote deleted successfully');
    };

    const handleMove = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= quotes.length) return;

        const updated = [...quotes];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);
        await onSave(updated, 'Quotes reordered');
    };

    const handleSaveModal = async (e) => {
        e.preventDefault();
        if (!formState.text.trim()) {
            setFormError(t('admin.ui.cmsQuotes.pleaseProvideTheQuoteText'));
            return;
        }

        const newQuote = {
            id: formState.id || `quote-${Date.now()}`,
            text: formState.text.trim(),
            author: formState.author.trim(),
            language: formState.language || 'en',
        };

        let updated;
        if (editingIndex !== null) {
            updated = quotes.map((item, idx) => (idx === editingIndex ? newQuote : item));
        } else {
            updated = [...quotes, newQuote];
        }

        setIsModalOpen(false);
        await onSave(
            updated,
            editingIndex !== null ? 'Quote updated successfully' : 'Quote added successfully'
        );
    };

    return (
        <div className="cms-container">
            {/* Standard Ergonomic Action Bar */}
            <div className="cms-action-bar">
                <div className="cms-action-bar-left">
                    <div className="cms-search-wrap">
                        <span className="cms-search-icon">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder={t('admin.placeholders.searchQuotes')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="cms-search-input"
                        />
                    </div>

                    <select
                        className="cms-select"
                        value={filterLang}
                        onChange={(e) => setFilterLang(e.target.value)}
                    >
                        <option value="all">{t('admin.filters.allLanguages')}</option>
                        <option value="en">{t('admin.labels.english')}</option>
                        <option value="kn">{t('admin.labels.kannada')}</option>
                    </select>

                    <span className="cms-meta-summary">
                        {formatNumber(filteredQuotes.length)} {t('admin.messages.of')} {formatNumber(quotes.length)}
                    </span>
                </div>

                <div className="cms-action-bar-right">
                    <button
                        type="button"
                        className="cms-btn cms-btn-primary"
                        onClick={handleOpenAdd}
                    >
                        {t('admin.actions.addQuote')}
                    </button>
                </div>
            </div>

            {/* Standard CMS List Rows */}
            {filteredQuotes.length === 0 ? (
                <div className="cms-empty-state">
                    <p className="cms-empty-title">{t('admin.messages.noQuotes')}</p>
                    <p className="cms-empty-text">
                        {t('admin.messages.adjustSearch')}
                    </p>
                    <button
                        type="button"
                        className="cms-btn cms-btn-secondary"
                        onClick={handleOpenAdd}
                        style={{ marginTop: '0.75rem' }}
                    >
                        {t('admin.actions.addQuote')}
                    </button>
                </div>
            ) : (
                <div className="cms-list">
                    {filteredQuotes.map((quote) => {
                        const originalIndex = quotes.indexOf(quote);

                        return (
                            <div key={quote.id || originalIndex} className="cms-item-row">
                                <div className="cms-item-main">
                                    <div className="cms-item-content">
                                        <div className="cms-item-header">
                                            <h4 className="cms-item-title">
                                                {formatQuoteDisplay(quote.text)}
                                            </h4>
                                            {quote.author && (
                                                <span className="cms-tag cms-tag-source">— {quote.author}</span>
                                            )}
                                            <span className="cms-tag cms-tag-lang">
                                                {quote.language === 'kn' ? t('admin.labels.kannada') : t('admin.labels.english')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="cms-item-actions">
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveUp')}
                                        disabled={originalIndex === 0 || saving}
                                        onClick={() => handleMove(originalIndex, -1)}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-icon"
                                        title={t('admin.actions.moveDown')}
                                        disabled={originalIndex === quotes.length - 1 || saving}
                                        onClick={() => handleMove(originalIndex, 1)}
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-sm cms-btn-secondary"
                                        onClick={() => handleOpenEdit(quote, originalIndex)}
                                        disabled={saving}
                                    >
                                        {t('admin.actions.edit')}
                                    </button>
                                    <button
                                        type="button"
                                        className="cms-btn-sm cms-btn-danger"
                                        onClick={() => handleDelete(originalIndex)}
                                        disabled={saving}
                                    >
                                        {t('admin.actions.delete')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Standard Add / Edit Quote Modal */}
            {isModalOpen && (
                <div className="cms-modal-backdrop" onClick={() => setIsModalOpen(false)}>
                    <div className="cms-modal-content cms-modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="cms-modal-header">
                            <h3 className="cms-modal-title">
                                {editingIndex !== null ? t('admin.modals.editQuote') : t('admin.modals.newQuote')}
                            </h3>
                            <button
                                type="button"
                                className="cms-modal-close-btn"
                                onClick={() => setIsModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveModal}>
                            <div className="cms-modal-body">
                                {formError && (
                                    <p className="admin-error" style={{ marginBottom: '0.75rem' }}>
                                        {formError}
                                    </p>
                                )}

                                <div className="cms-form-group">
                                    <label className="cms-form-label">
                                        {t('admin.labels.quoteText')} <span className="required">*</span>
                                    </label>
                                    <textarea
                                        className="cms-textarea"
                                        rows={4}
                                        placeholder={t('admin.placeholders.enterQuoteText')}
                                        value={formState.text}
                                        onChange={(e) =>
                                            setFormState((prev) => ({
                                                ...prev,
                                                text: e.target.value,
                                            }))
                                        }
                                        required
                                    />
                                </div>

                                <div className="cms-form-row">
                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.author')}</label>
                                        <input
                                            type="text"
                                            className="cms-input"
                                            placeholder={t('admin.placeholders.quoteAuthor')}
                                            value={formState.author}
                                            onChange={(e) =>
                                                setFormState((prev) => ({
                                                    ...prev,
                                                    author: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="cms-form-group">
                                        <label className="cms-form-label">{t('admin.labels.language')}</label>
                                        <select
                                            className="cms-select"
                                            value={formState.language || 'en'}
                                            onChange={(e) =>
                                                setFormState((prev) => ({
                                                    ...prev,
                                                    language: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="en">{t('admin.labels.english')}</option>
                                            <option value="kn">{t('admin.labels.kannada')}</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="cms-modal-footer">
                                <button
                                    type="button"
                                    className="cms-btn cms-btn-secondary"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    {t('admin.actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="cms-btn cms-btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? t('admin.actions.saving') : t('admin.actions.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CmsQuotes;
