import React, { useEffect, useState } from 'react';
import { useContent } from '../../../utils/ContentContext';
import { RECURRENCE_DAYS } from './todoUtils';

const TodoModal = ({ todo, isOpen, onClose, onSave }) => {
    const { t, formatNumber } = useContent();
    const [draft, setDraft] = useState({});
    const [tagInput, setTagInput] = useState('');

    useEffect(() => {
        if (todo) {
            setDraft({
                ...todo,
                tags: Array.isArray(todo.tags) ? [...todo.tags] : [],
            });
            setTagInput('');
        }
    }, [todo]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!draft.title?.trim()) {
            alert(t('admin.todoSection.modal.alertTitleRequired', 'Please enter a task title.'));
            return;
        }
        await onSave(draft);
        onClose();
    };

    const handleAddTag = () => {
        const trimmed = tagInput.trim();
        if (!trimmed) return;
        const currentTags = Array.isArray(draft.tags) ? draft.tags : [];
        if (!currentTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
            setDraft({ ...draft, tags: [...currentTags, trimmed] });
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove) => {
        const currentTags = Array.isArray(draft.tags) ? draft.tags : [];
        setDraft({ ...draft, tags: currentTags.filter((t) => t !== tagToRemove) });
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const updateSubtask = (index, updates) => {
        const next = [...(draft.subtasks || [])];
        next[index] = { ...next[index], ...updates };
        setDraft({ ...draft, subtasks: next });
    };

    const addSubtask = () => {
        const next = [...(draft.subtasks || []), { id: Date.now(), title: '', completed: false }];
        setDraft({ ...draft, subtasks: next });
    };

    const removeSubtask = (index) => {
        const next = [...(draft.subtasks || [])];
        next.splice(index, 1);
        setDraft({ ...draft, subtasks: next });
    };

    return (
        <div className="admin-todo-modal-overlay" onClick={onClose}>
            <div className="admin-todo-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="admin-todo-modal-header">
                    <h3 className="admin-todo-modal-title">{t('admin.todoSection.modal.editTask', 'Edit Task')}</h3>
                    <button className="admin-todo-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="admin-todo-modal-body">
                    <form className="admin-todo-modal-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.todoSection.modal.title', 'Title')}</label>
                            <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            />
                        </div>
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.todoSection.modal.description', 'Description')}</label>
                            <textarea
                                value={draft.description || ''}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.todoSection.modal.dueDate', 'Due Date')}</label>
                                <input
                                    type="date"
                                    value={draft.dueDate || ''}
                                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                                />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.todoSection.modal.priority', 'Priority')}</label>
                                <select
                                    value={draft.priority || 'medium'}
                                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                                >
                                    <option value="low">{t('admin.todoSection.priorities.low', 'Low')}</option>
                                    <option value="medium">{t('admin.todoSection.priorities.medium', 'Medium')}</option>
                                    <option value="high">{t('admin.todoSection.priorities.high', 'High')}</option>
                                </select>
                            </div>
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.todoSection.modal.estimatedTime', 'Estimated Time (min)')}</label>
                                <input
                                    type="number"
                                    value={draft.estimatedTime || ''}
                                    onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })}
                                />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>{t('admin.todoSection.modal.recurrence', 'Recurrence')}</label>
                                <select
                                    value={draft.recurrence || 'none'}
                                    onChange={(e) => setDraft({
                                        ...draft,
                                        recurrence: e.target.value,
                                        recurrenceDays: e.target.value === 'weekly' ? (draft.recurrenceDays || []) : [],
                                    })}
                                >
                                    <option value="none">{t('admin.todoSection.modal.recurrenceOptions.none', 'None')}</option>
                                    <option value="daily">{t('admin.todoSection.modal.recurrenceOptions.daily', 'Daily')}</option>
                                    <option value="weekly">{t('admin.todoSection.modal.recurrenceOptions.weekly', 'Weekly')}</option>
                                    <option value="monthly">{t('admin.todoSection.modal.recurrenceOptions.monthly', 'Monthly')}</option>
                                </select>
                            </div>
                        </div>
                        {draft.recurrence && draft.recurrence !== 'none' && (
                            <div className="admin-todo-recurrence-options">
                                {draft.recurrence === 'weekly' && (
                                    <div className="admin-todo-modal-field">
                                        <label>{t('admin.todoSection.modal.repeatOnWeekdays', 'Repeat on these weekdays')}</label>
                                        <div className="admin-todo-day-picker">
                                            {RECURRENCE_DAYS.map(([value, label]) => {
                                                const selected = (draft.recurrenceDays || []).includes(value);
                                                return (
                                                    <label key={value} className={`admin-todo-day-option ${selected ? 'selected' : ''}`}>
                                                        <input
                                                             type="checkbox"
                                                             checked={selected}
                                                             onChange={() => setDraft({
                                                                 ...draft,
                                                                 recurrenceDays: selected
                                                                     ? (draft.recurrenceDays || []).filter((day) => day !== value)
                                                                     : [...(draft.recurrenceDays || []), value],
                                                             })}
                                                         />
                                                        <span>{t(`admin.todoSection.modal.weekdays.${value}`, label)}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div className="admin-todo-modal-field">
                                    <label>{t('admin.todoSection.modal.repeatUntil', 'Repeat until')} <span className="admin-todo-optional">({t('admin.todoSection.modal.optional', 'optional')})</span></label>
                                    <input
                                        type="date"
                                        value={draft.recurrenceUntil || ''}
                                        onChange={(e) => setDraft({ ...draft, recurrenceUntil: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="admin-todo-modal-field">
                            <label>{t('admin.todoSection.modal.showTaskOn', 'Show task on')} <span className="admin-todo-optional">({t('admin.todoSection.modal.optional', 'optional')})</span></label>
                            <input
                                type="date"
                                value={draft.scheduledAt ? draft.scheduledAt.slice(0, 10) : ''}
                                onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
                            />
                            <span className="admin-todo-field-help">{t('admin.todoSection.modal.showTaskHelp', 'The task stays in Other until this day.')}</span>
                        </div>
                        <div className="admin-todo-tags-section">
                            <label className="admin-todo-tags-label">
                                {t('admin.todoSection.modal.tags', 'Tags')} <span className="admin-todo-optional">({t('admin.todoSection.modal.optional', 'optional')})</span>
                            </label>
                            <div className="admin-todo-tag-input-row">
                                <input
                                    type="text"
                                    className="admin-todo-tag-input"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    placeholder={t('admin.todoSection.modal.tagPlaceholder', 'Add a tag (press Enter)')}
                                />
                                <button
                                    type="button"
                                    className="admin-todo-tag-add-btn"
                                    onClick={handleAddTag}
                                >
                                    {t('admin.todoSection.modal.addTag', 'Add')}
                                </button>
                            </div>
                            {Array.isArray(draft.tags) && draft.tags.length > 0 && (
                                <div className="admin-todo-tag-pills">
                                    {draft.tags.map((tag, idx) => (
                                        <span key={idx} className="admin-todo-tag-pill">
                                            {tag}
                                            <button
                                                type="button"
                                                className="admin-todo-tag-remove"
                                                onClick={() => handleRemoveTag(tag)}
                                                aria-label={`Remove tag ${tag}`}
                                                title="Remove tag"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="admin-todo-subtasks-section">
                            <div className="admin-todo-subtasks-header">
                                <div>
                                    <h4>{t('admin.todoSection.modal.subtasks', 'Subtasks')}</h4>
                                    <span>{formatNumber((draft.subtasks || []).length)} {t('admin.messages.items', 'items')}</span>
                                </div>
                                <button type="button" className="admin-todo-subtask-add" onClick={addSubtask}>
                                    {t('admin.todoSection.modal.addSubtask', '+ Add Subtask')}
                                </button>
                            </div>
                            {(draft.subtasks || []).length === 0 ? (
                                <p className="admin-todo-subtasks-empty">{t('admin.todoSection.modal.breakIntoSteps', 'Break this task into smaller steps.')}</p>
                            ) : (
                                <div className="admin-todo-subtask-list">
                                    {(draft.subtasks || []).map((st, i) => (
                                        <div key={st.id || i} className="admin-todo-subtask-row">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(st.completed)}
                                                onChange={(e) => updateSubtask(i, { completed: e.target.checked })}
                                                aria-label={`Complete subtask ${i + 1}`}
                                            />
                                            <input
                                                type="text"
                                                value={st.title || ''}
                                                onChange={(e) => updateSubtask(i, { title: e.target.value })}
                                                placeholder={t('admin.todoSection.modal.subtaskPlaceholder', 'Subtask name')}
                                                aria-label={`Subtask ${i + 1}`}
                                            />
                                            <button
                                                type="button"
                                                className="admin-todo-subtask-remove"
                                                onClick={() => removeSubtask(i)}
                                                aria-label={`Remove subtask ${i + 1}`}
                                                title="Remove subtask"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                <div className="admin-todo-modal-footer">
                    <button className="admin-todo-modal-btn admin-todo-modal-btn-cancel" onClick={onClose}>
                        {t('admin.todoSection.modal.cancel', 'Cancel')}
                    </button>
                    <button className="admin-todo-modal-btn admin-todo-modal-btn-save" onClick={handleSave}>
                        {t('admin.todoSection.modal.saveChanges', 'Save Changes')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TodoModal;
