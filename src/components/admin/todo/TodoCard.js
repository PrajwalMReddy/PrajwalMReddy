import React from 'react';
import { useContent } from '../../../utils/ContentContext';
import {
    formatRecurrence,
    getDueDateLabel,
    getDueState,
    PRIORITY_LABEL,
} from './todoUtils';

const TodoCard = ({
    todo,
    draggedId,
    dragOverId,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    onToggle,
    onEdit,
    onDelete,
    onChangePriority,
    onSaveTodo,
    isExpanded,
    onToggleSubtasksExpanded,
}) => {
    const { t, formatNumber, language } = useContent();
    const dueState = getDueState(todo);
    const dueDateLabel = getDueDateLabel(todo, language, formatNumber);

    const tone = todo.completed
        ? 'done'
        : dueState === 'overdue' || todo.priority === 'high'
            ? 'urgent'
            : 'normal';

    const hasSubtasks = todo.subtasks && todo.subtasks.length > 0;

    return (
        <div
            className={`admin-todo-card tone-${tone} ${
                todo.completed ? 'complete' : ''
            } ${draggedId === todo.id ? 'dragging' : ''} ${
                dragOverId === todo.id ? 'drag-over' : ''
            }`}
            draggable
            onDragStart={(event) => onDragStart(event, todo.id)}
            onDragEnd={onDragEnd}
            onDragOver={(event) => onDragOver(event, todo.id)}
            onDragLeave={onDragLeave}
            onDrop={(event) => onDrop(event, todo.id)}
        >
            <div className="admin-todo-card-top">
                <span
                    className={`admin-todo-card-avatar priority-${todo.priority}`}
                    title={`${t('admin.todoSection.priority', 'Priority')}: ${t(`admin.todoSection.priorities.${todo.priority}`, PRIORITY_LABEL[todo.priority] || todo.priority)}`}
                />

                <div className="admin-todo-card-check">
                    <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => onToggle(todo.id, todo.completed)}
                    />
                    <span className="admin-todo-card-title">{todo.title}</span>
                </div>

                {hasSubtasks && (
                    <button
                        type="button"
                        className="admin-todo-card-subtasks-toggle"
                        onClick={() => onToggleSubtasksExpanded(todo.id)}
                        title={isExpanded ? t('admin.todoSection.hideSubtasks', 'Hide subtasks') : t('admin.todoSection.showSubtasks', 'Show subtasks')}
                    >
                        {isExpanded ? '▼' : '▶'} (
                        {formatNumber(todo.subtasks.filter((st) => st.completed).length)}/
                        {formatNumber(todo.subtasks.length)})
                    </button>
                )}

                <button
                    type="button"
                    className="admin-todo-card-edit"
                    onClick={() => onEdit(todo)}
                    aria-label={`${t('admin.actions.edit', 'Edit')}: ${todo.title}`}
                    title={t('admin.actions.edit', 'Edit')}
                >
                    ✎
                </button>

                <button
                    type="button"
                    className="admin-todo-card-delete"
                    onClick={() => onDelete(todo)}
                    aria-label={`${t('admin.actions.delete', 'Delete')}: ${todo.title}`}
                    title={t('admin.actions.delete', 'Delete')}
                >
                    ✕
                </button>
            </div>

            <div className="admin-todo-card-bottom">
                <div className="admin-todo-card-info">
                    {(dueDateLabel || todo.estimatedTime) && (
                        <div className="admin-todo-card-primary-info">
                            {dueDateLabel && (
                                <span className={`admin-todo-card-due due-${dueState}`}>
                                    <span className="admin-todo-card-due-date">
                                        📅 {dueDateLabel}
                                    </span>
                                </span>
                            )}

                            {todo.estimatedTime && (
                                <span className="admin-todo-card-time" title={t('admin.todoSection.estimatedTime', 'Estimated time')}>
                                    ⏱️ {formatNumber(todo.estimatedTime)}{t('admin.todoSection.min', 'min')}
                                </span>
                            )}
                        </div>
                    )}

                    {((todo.recurrence && todo.recurrence !== 'none') || (Array.isArray(todo.tags) && todo.tags.length > 0)) && (
                        <div className="admin-todo-card-secondary-info">
                            {todo.recurrence && todo.recurrence !== 'none' && (
                                <span className="admin-todo-card-recurrence" title={t('admin.todoSection.recurrence', 'Recurrence')}>
                                    🔄 {formatRecurrence(todo, t)}
                                </span>
                            )}

                            {Array.isArray(todo.tags) && todo.tags.map((tag, idx) => (
                                <span key={idx} className="admin-todo-card-recurrence admin-todo-card-tag" title={tag}>
                                    🏷️ {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {!todo.completed && (
                    <select
                        className="admin-todo-card-priority"
                        value={todo.priority}
                        onChange={(e) => onChangePriority(todo.id, e.target.value)}
                        title={t('admin.todoSection.changePriority', 'Change priority')}
                    >
                        <option value="low">{t('admin.todoSection.priorities.low', 'Low')}</option>
                        <option value="medium">{t('admin.todoSection.priorities.medium', 'Medium')}</option>
                        <option value="high">{t('admin.todoSection.priorities.high', 'High')}</option>
                    </select>
                )}
            </div>

            {isExpanded && hasSubtasks && (
                <div className="admin-todo-card-subtasks">
                    {todo.subtasks.map((subtask, idx) => (
                        <div key={subtask.id || idx} className="admin-todo-card-subtask">
                            <input
                                type="checkbox"
                                checked={subtask.completed}
                                onChange={() => {
                                    const updated = [...todo.subtasks];
                                    updated[idx] = { ...subtask, completed: !subtask.completed };
                                    onSaveTodo({ subtasks: updated });
                                }}
                            />
                            <span className={subtask.completed ? 'completed' : ''}>
                                {subtask.title}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TodoCard;
