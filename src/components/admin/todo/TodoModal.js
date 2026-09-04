import React, { useEffect, useState } from 'react';
import { RECURRENCE_DAYS } from './todoUtils';

const TodoModal = ({ todo, isOpen, onClose, onSave }) => {
    const [draft, setDraft] = useState({});

    useEffect(() => {
        if (todo) {
            setDraft({ ...todo });
        }
    }, [todo]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!draft.title?.trim()) {
            alert('Please enter a task title.');
            return;
        }
        await onSave(draft);
        onClose();
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
        <div className="admin-todo-modal-overlay">
            <div className="admin-todo-modal-card">
                <div className="admin-todo-modal-header">
                    <h3 className="admin-todo-modal-title">Edit Task</h3>
                    <button className="admin-todo-modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="admin-todo-modal-body">
                    <form className="admin-todo-modal-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="admin-todo-modal-field">
                            <label>Title</label>
                            <input
                                type="text"
                                value={draft.title || ''}
                                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            />
                        </div>
                        <div className="admin-todo-modal-field">
                            <label>Description</label>
                            <textarea
                                value={draft.description || ''}
                                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                            />
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>Due Date</label>
                                <input
                                    type="date"
                                    value={draft.dueDate || ''}
                                    onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                                />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>Priority</label>
                                <select
                                    value={draft.priority || 'medium'}
                                    onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                        </div>
                        <div className="admin-todo-modal-row">
                            <div className="admin-todo-modal-field">
                                <label>Estimated Time (min)</label>
                                <input
                                    type="number"
                                    value={draft.estimatedTime || ''}
                                    onChange={(e) => setDraft({ ...draft, estimatedTime: e.target.value })}
                                />
                            </div>
                            <div className="admin-todo-modal-field">
                                <label>Recurrence</label>
                                <select
                                    value={draft.recurrence || 'none'}
                                    onChange={(e) => setDraft({
                                        ...draft,
                                        recurrence: e.target.value,
                                        recurrenceDays: e.target.value === 'weekly' ? (draft.recurrenceDays || []) : [],
                                    })}
                                >
                                    <option value="none">None</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                        </div>
                        {draft.recurrence && draft.recurrence !== 'none' && (
                            <div className="admin-todo-recurrence-options">
                                {draft.recurrence === 'weekly' && (
                                    <div className="admin-todo-modal-field">
                                        <label>Repeat on these weekdays</label>
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
                                                        <span>{label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                <div className="admin-todo-modal-field">
                                    <label>Repeat until <span className="admin-todo-optional">(optional)</span></label>
                                    <input
                                        type="date"
                                        value={draft.recurrenceUntil || ''}
                                        onChange={(e) => setDraft({ ...draft, recurrenceUntil: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="admin-todo-modal-field">
                            <label>Show task on <span className="admin-todo-optional">(optional)</span></label>
                            <input
                                type="date"
                                value={draft.scheduledAt ? draft.scheduledAt.slice(0, 10) : ''}
                                onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
                            />
                            <span className="admin-todo-field-help">The task stays in Other until this day.</span>
                        </div>
                        <div className="admin-todo-subtasks-section">
                            <div className="admin-todo-subtasks-header">
                                <div>
                                    <h4>Subtasks</h4>
                                    <span>{(draft.subtasks || []).length} items</span>
                                </div>
                                <button type="button" className="admin-todo-subtask-add" onClick={addSubtask}>
                                    + Add subtask
                                </button>
                            </div>
                            {(draft.subtasks || []).length === 0 ? (
                                <p className="admin-todo-subtasks-empty">Break this task into smaller steps.</p>
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
                                                placeholder="Subtask name"
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
                        Cancel
                    </button>
                    <button className="admin-todo-modal-btn admin-todo-modal-btn-save" onClick={handleSave}>
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TodoModal;
