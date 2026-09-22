import React from 'react';
import {useContent} from '../../../utils/ContentContext';
import {formatRecurrence, getDueDateLabel, getDueState, PRIORITY_LABEL,} from './todoUtils';

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
                      onToggleSubtask,
                      isExpanded,
                      onToggleSubtasksExpanded,
                  }) => {
    const {t, formatNumber, language} = useContent();
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
            onMouseDown={(event) => {
                const interactive = event.target.closest('input, button, select, textarea, a, label');
                event.currentTarget.draggable = !interactive;
            }}
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
                        className={`admin-todo-card-subtasks-toggle${isExpanded ? ' is-open' : ''}`}
                        onClick={() => onToggleSubtasksExpanded(todo.id)}
                        aria-expanded={isExpanded}
                        title={isExpanded ? t('admin.todoSection.hideSubtasks', 'Hide subtasks') : t('admin.todoSection.showSubtasks', 'Show subtasks')}
                    >
                        <svg
                            className="admin-todo-card-subtasks-chevron"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                        <span className="admin-todo-card-subtasks-count">
                            {formatNumber(todo.subtasks.filter((st) => st.completed).length)}/{formatNumber(todo.subtasks.length)}
                        </span>
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
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                             strokeLinejoin="round"
                                             style={{verticalAlign: 'middle', marginRight: '3px'}}>
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                            <line x1="16" y1="2" x2="16" y2="6"/>
                                            <line x1="8" y1="2" x2="8" y2="6"/>
                                            <line x1="3" y1="10" x2="21" y2="10"/>
                                        </svg>
                                        {dueDateLabel}
                                    </span>
                                </span>
                            )}

                            {todo.estimatedTime && (
                                <span className="admin-todo-card-time"
                                      title={t('admin.todoSection.estimatedTime', 'Estimated time')}>
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                         style={{verticalAlign: 'middle', marginRight: '3px'}}>
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    {formatNumber(todo.estimatedTime)}{t('admin.todoSection.min', 'min')}
                                </span>
                            )}
                        </div>
                    )}

                    {((todo.recurrence && todo.recurrence !== 'none') || todo.personId || (Array.isArray(todo.tags) && todo.tags.length > 0)) && (
                        <div className="admin-todo-card-secondary-info">
                            {Boolean(todo.personId || (Array.isArray(todo.tags) && todo.tags.some((t) => String(t).toLowerCase() === 'networking'))) && (
                                <span
                                    className="admin-todo-card-recurrence admin-todo-card-sync-badge"
                                    title={t('admin.todoSection.syncedWithNetworking', 'Synced with Networking')}
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '3px' }}>
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <polyline points="16 11 18 13 22 9" />
                                    </svg>
                                    {t('admin.todoSection.syncedNetworking', 'Synced: Networking')}
                                </span>
                            )}

                            {todo.recurrence && todo.recurrence !== 'none' && (
                                <span className="admin-todo-card-recurrence"
                                      title={t('admin.todoSection.recurrence', 'Recurrence')}>
                                    {formatRecurrence(todo, t)}
                                </span>
                            )}

                            {Array.isArray(todo.tags) && todo.tags
                                .filter((tag) => {
                                    const lower = String(tag || '').trim().toLowerCase();
                                    const isNet = lower === 'networking';
                                    const isName = todo.personName && lower === todo.personName.trim().toLowerCase();
                                    return !isNet && !isName;
                                })
                                .map((tag, idx) => (
                                    <span key={idx} className="admin-todo-card-recurrence admin-todo-card-tag" title={tag}>
                                        {tag}
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
                        <label key={subtask.id || idx} className="admin-todo-card-subtask">
                            <input
                                type="checkbox"
                                checked={!!subtask.completed}
                                onChange={() => onToggleSubtask(todo.id, idx)}
                            />
                            <span className={subtask.completed ? 'completed' : ''}>
                                {subtask.title}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TodoCard;
