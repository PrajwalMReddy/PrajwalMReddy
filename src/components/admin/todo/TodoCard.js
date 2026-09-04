import React from 'react';
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
    const dueState = getDueState(todo);
    const dueDateLabel = getDueDateLabel(todo);

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
                    title={`Priority: ${PRIORITY_LABEL[todo.priority] || todo.priority}`}
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
                        title={isExpanded ? 'Hide subtasks' : 'Show subtasks'}
                    >
                        {isExpanded ? '▼' : '▶'} (
                        {todo.subtasks.filter((st) => st.completed).length}/
                        {todo.subtasks.length})
                    </button>
                )}

                <button
                    type="button"
                    className="admin-todo-card-edit"
                    onClick={() => onEdit(todo)}
                    aria-label={`Edit task: ${todo.title}`}
                    title="Edit task"
                >
                    ✎
                </button>

                <button
                    type="button"
                    className="admin-todo-card-delete"
                    onClick={() => onDelete(todo)}
                    aria-label={`Delete task: ${todo.title}`}
                >
                    ✕
                </button>
            </div>

            <div className="admin-todo-card-bottom">
                <div className="admin-todo-card-info">
                    {dueDateLabel && (
                        <span className={`admin-todo-card-due due-${dueState}`}>
                            <span className="admin-todo-card-due-date">
                                📅 {dueDateLabel}
                            </span>
                        </span>
                    )}

                    {todo.estimatedTime && (
                        <span className="admin-todo-card-time" title="Estimated time">
                            ⏱️ {todo.estimatedTime}min
                        </span>
                    )}

                    {todo.recurrence && todo.recurrence !== 'none' && (
                        <span className="admin-todo-card-recurrence" title="Recurrence">
                            🔄 {formatRecurrence(todo)}
                        </span>
                    )}
                </div>

                {!todo.completed && (
                    <select
                        className="admin-todo-card-priority"
                        value={todo.priority}
                        onChange={(e) => onChangePriority(todo.id, e.target.value)}
                        title="Change priority"
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
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
