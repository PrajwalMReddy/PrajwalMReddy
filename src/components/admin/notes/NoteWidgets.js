import React from 'react';
import {
    BLOCK_TYPES,
    CODE_LANGUAGES,
    getCurrentMonthValue,
    getHabitCalendarDays,
    getLinkDomain,
    getLinkHref,
    getNotePreview,
    getTextEditorHtml,
    highlightCode,
    katex,
} from './noteUtils';

export const fitTextareaValue = (event) => {
    const textarea = event.currentTarget;
    const value = textarea.value;
    let low = 0;
    let high = value.length;
    let fitted = value;

    textarea.value = value;
    if (textarea.scrollHeight <= textarea.clientHeight) return value;

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        textarea.value = value.slice(0, middle);
        if (textarea.scrollHeight <= textarea.clientHeight) {
            fitted = textarea.value;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }

    textarea.value = fitted;
    return fitted;
};

export const getTableRowCapacity = (block) => Math.max(2, (block.height || 3) - 2);
export const getTableColumnCount = (block) => Math.max(1, block.rows?.[0]?.length || 1);

export const resizeTableColumns = (block, columnCount, updateBlock) => {
    const nextColumnCount = Math.max(1, Math.min(8, Number(columnCount)));
    const rows = block.rows.map((row) =>
        Array.from({ length: nextColumnCount }, (_, index) => row[index] || '')
    );
    updateBlock(block.id, { rows });
};

export const resizeTableRows = (block, rowCount, updateBlock) => {
    const nextRowCount = Math.max(2, Math.min(getTableRowCapacity(block), Number(rowCount)));
    const columnCount = getTableColumnCount(block);
    const rows = Array.from(
        { length: nextRowCount },
        (_, index) => block.rows[index] || Array.from({ length: columnCount }, () => '')
    ).map((row) => Array.from({ length: columnCount }, (_, index) => row[index] || ''));
    updateBlock(block.id, { rows });
};

export const getFlashcards = (block) =>
    block.cards?.length ? block.cards : [{ front: block.label || '', back: block.text || '' }];

export const renderEquation = (value) =>
    katex.renderToString(value || '\\text{Click to edit}', {
        displayMode: true,
        throwOnError: false,
    });

export const renderChart = (block) => {
    const values = String(block.chartValues || '')
        .split(',')
        .map((value) => Math.max(0, Number(value.trim()) || 0))
        .slice(0, 8);
    const labels = String(block.chartLabels || '')
        .split(',')
        .map((label) => label.trim())
        .slice(0, values.length);
    const max = Math.max(...values, 1);

    if (block.chartStyle === 'pie') {
        const total = Math.max(
            values.reduce((sum, value) => sum + value, 0),
            1
        );
        let cursor = 0;
        const segments = values.map((value, index) => {
            const start = cursor;
            cursor += (value / total) * 360;
            return `${['#6fa47d', '#6f8eaa', '#c08b36', '#9a789f'][index % 4]} ${start}deg ${cursor}deg`;
        });
        return (
            <div
                className="admin-note-chart-pie"
                style={{ background: `conic-gradient(${segments.join(', ')})` }}
                aria-label="Pie chart preview"
            />
        );
    }

    if (block.chartStyle === 'line') {
        const points = values
            .map(
                (value, index) =>
                    `${values.length === 1 ? 50 : 12 + (index / (values.length - 1)) * 84},${
                        86 - (value / max) * 70
                    }`
            )
            .join(' ');
        return (
            <svg
                className="admin-note-chart-plot"
                viewBox="0 0 110 110"
                role="img"
                aria-label={`${block.label || 'Line'} chart`}
            >
                <line x1="12" y1="10" x2="12" y2="86" />
                <line x1="12" y1="86" x2="98" y2="86" />
                {[0, 0.5, 1].map((tick) => (
                    <text key={tick} x="9" y={88 - tick * 70} textAnchor="end">
                        {Math.round(max * tick)}
                    </text>
                ))}
                <polyline
                    points={points}
                    fill="none"
                    stroke="#5d8f70"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                />
                {values.map((value, index) => (
                    <text
                        key={index}
                        x={values.length === 1 ? 50 : 12 + (index / (values.length - 1)) * 84}
                        y="98"
                        textAnchor="middle"
                    >
                        {labels[index] || index + 1}
                    </text>
                ))}
                <text className="admin-note-chart-axis-label" x="55" y="108" textAnchor="middle">
                    {block.chartXAxis || 'Category'}
                </text>
                <text
                    className="admin-note-chart-axis-label"
                    x="2"
                    y="48"
                    textAnchor="middle"
                    transform="rotate(-90 2 48)"
                >
                    {block.chartYAxis || 'Value'}
                </text>
            </svg>
        );
    }

    return (
        <svg
            className="admin-note-chart-plot"
            viewBox="0 0 110 110"
            role="img"
            aria-label={`${block.label || 'Bar'} chart`}
        >
            <line x1="12" y1="10" x2="12" y2="86" />
            <line x1="12" y1="86" x2="98" y2="86" />
            {[0, 0.5, 1].map((tick) => (
                <text key={tick} x="9" y={88 - tick * 70} textAnchor="end">
                    {Math.round(max * tick)}
                </text>
            ))}
            {values.map((value, index) => {
                const x = 14 + index * (84 / Math.max(values.length, 1));
                const height = (value / max) * 70;
                return (
                    <g key={index}>
                        <rect
                            x={x}
                            y={86 - height}
                            width={Math.max(3, 58 / Math.max(values.length, 1))}
                            height={height}
                            rx="1"
                        />
                        <text x={x + 2} y={82 - height} textAnchor="middle">
                            {value}
                        </text>
                        <text x={x + 2} y="98" textAnchor="middle">
                            {labels[index] || index + 1}
                        </text>
                    </g>
                );
            })}
            <text className="admin-note-chart-axis-label" x="55" y="108" textAnchor="middle">
                {block.chartXAxis || 'Category'}
            </text>
            <text
                className="admin-note-chart-axis-label"
                x="2"
                y="48"
                textAnchor="middle"
                transform="rotate(-90 2 48)"
            >
                {block.chartYAxis || 'Value'}
            </text>
        </svg>
    );
};

export const NoteBlock = ({
    block,
    index,
    updateBlock,
    removeBlock,
    startBlockDrag,
    updateDropPreview,
    finishBlockDrag,
    startBlockResize,
    updateBlockResize,
    finishBlockResize,
    draggingBlockId,
    notes,
    selectedId,
    selectNote,
    editingLinkId,
    setEditingLinkId,
    linkClickTimerRef,
    editingFlashcardId,
    setEditingFlashcardId,
    editingImageId,
    setEditingImageId,
    imageErrors,
    setImageErrors,
    editingEquationId,
    setEditingEquationId,
    editingNoteLinkId,
    setEditingNoteLinkId,
    currentTime,
    unlockCountdownAudio,
    setActiveTextBlockId,
    saveTextSelection,
}) => {
    const type = BLOCK_TYPES[block.type] || BLOCK_TYPES.text;
    const position = block.position || {
        col: (index % 3) * 4 + 1,
        row: Math.floor(index / 3) * 6 + 1,
    };
    const statusKey =
        block.type === 'status'
            ? (block.status || 'In progress').toLowerCase().replace(/\s+/g, '-')
            : '';

    const handleLinkPreviewClick = (event, url) => {
        event.preventDefault();
        window.clearTimeout(linkClickTimerRef.current);
        linkClickTimerRef.current = window.setTimeout(() => {
            window.open(getLinkHref(url), '_blank', 'noopener,noreferrer');
        }, 250);
    };

    const getCountdownParts = (dateTime) => {
        if (!dateTime) return null;
        const seconds = Math.max(0, Math.floor((new Date(dateTime).getTime() - currentTime) / 1000));
        return {
            hours: String(Math.floor(seconds / 3600)).padStart(2, '0'),
            minutes: String(Math.floor((seconds % 3600) / 60)).padStart(2, '0'),
            seconds: String(seconds % 60).padStart(2, '0'),
        };
    };

    const renderStars = () => (
        <div className="admin-note-rating-stars" aria-label={`${block.rating || 0} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, idx) => (
                <button
                    type="button"
                    key={idx}
                    className={idx < (block.rating || 0) ? 'active' : ''}
                    onClick={() => updateBlock(block.id, { rating: idx + 1 })}
                    aria-label={`Rate ${idx + 1} out of 5`}
                >
                    ★
                </button>
            ))}
        </div>
    );

    const updateFlashcard = (changes) => {
        const cards = getFlashcards(block).map((card, idx) =>
            idx === (block.cardIndex || 0) ? { ...card, ...changes } : card
        );
        updateBlock(block.id, { cards });
    };

    const addFlashcard = () =>
        updateBlock(block.id, {
            cards: [...getFlashcards(block), { front: '', back: '' }],
            cardIndex: getFlashcards(block).length,
            flipped: false,
        });

    const getListItems = () => (block.text ? block.text.split('\n') : ['']);

    const updateListItem = (itemIndex, value) => {
        const items = getListItems();
        items[itemIndex] = value;
        updateBlock(block.id, { text: items.join('\n') });
    };

    const addListItem = () =>
        updateBlock(block.id, { text: `${block.text}${block.text ? '\n' : ''}` });

    const removeListItem = (itemIndex) => {
        const items = getListItems();
        if (items.length === 1) return updateBlock(block.id, { text: '' });
        items.splice(itemIndex, 1);
        updateBlock(block.id, { text: items.join('\n') });
    };

    const renderListWidget = () => {
        const numbered = block.listStyle === 'numbered';
        return (
            <div className={`admin-note-list-wrap${numbered ? ' is-numbered' : ''}`}>
                <div className="admin-note-list-controls" aria-label="List controls">
                    <input
                        className="admin-note-list-label"
                        value={block.label}
                        placeholder="List label"
                        aria-label="List label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <select
                        className="admin-note-list-style"
                        value={block.listStyle || 'bulleted'}
                        aria-label="List style"
                        onChange={(event) => updateBlock(block.id, { listStyle: event.target.value })}
                    >
                        <option value="bulleted">Bulleted</option>
                        <option value="numbered">Numbered</option>
                    </select>
                    <button
                        type="button"
                        onClick={addListItem}
                        aria-label="Add list item"
                        title="Add list item"
                    >
                        +
                    </button>
                </div>
                <div className="admin-note-list-items">
                    {getListItems().map((item, itemIndex) => (
                        <div
                            className="admin-note-bullet-item"
                            key={`${block.id}-item-${itemIndex}`}
                        >
                            <span className="admin-note-list-marker" aria-hidden="true">
                                {numbered ? `${itemIndex + 1}.` : '•'}
                            </span>
                            <input
                                value={item}
                                placeholder={itemIndex === 0 ? type.placeholder : 'List item'}
                                aria-label={`${numbered ? 'Numbered' : 'Bulleted'} list item ${itemIndex + 1}`}
                                onChange={(event) => updateListItem(itemIndex, event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem(itemIndex)}
                                aria-label={`Remove list item ${itemIndex + 1}`}
                                title="Remove list item"
                            >
                                -
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div
            className={`admin-note-block admin-note-block-${block.type} admin-note-block-span-${
                block.span || 1
            }${statusKey ? ` admin-note-status-${statusKey}` : ''}${
                draggingBlockId === block.id ? ' is-dragging' : ''
            }`}
            key={block.id}
            style={{
                gridColumn: `${position.col} / span ${(block.span || 1) * 4}`,
                gridRow: `${position.row} / span ${
                    block.type === 'chart' ? Math.max(block.height || 3, 11) : block.height || 3
                }`,
            }}
            onPointerDown={(event) => startBlockDrag(event, block.id)}
            onPointerMove={(event) => {
                if (draggingBlockId === block.id) updateDropPreview(event);
            }}
            onPointerUp={(event) => finishBlockDrag(event, block.id)}
        >
            <span className="admin-note-block-grip" title="Drag to reorder" aria-hidden="true">
                ::
            </span>

            {block.type === 'divider' ? (
                <hr />
            ) : block.type === 'counter' ? (
                <div className="admin-note-counter-wrap">
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Counter label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <div className="admin-note-counter-main" aria-label="Counter controls">
                        <button
                            type="button"
                            onClick={() =>
                                updateBlock(block.id, {
                                    counterValue: (block.counterValue || 0) - (block.counterStep || 1),
                                })
                            }
                            aria-label="Decrease counter"
                        >
                            -
                        </button>
                        <div className="admin-note-counter-value" aria-live="polite">
                            {block.counterValue ?? 0}
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                updateBlock(block.id, {
                                    counterValue: (block.counterValue || 0) + (block.counterStep || 1),
                                })
                            }
                            aria-label="Increase counter"
                        >
                            +
                        </button>
                    </div>
                    <div className="admin-note-counter-controls">
                        <div className="admin-note-counter-adjust">
                            <label className="admin-note-counter-step">
                                <span>Step size</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={block.counterStep || 1}
                                    aria-label="Counter step size"
                                    onChange={(event) =>
                                        updateBlock(block.id, {
                                            counterStep: Math.max(1, Number(event.target.value) || 1),
                                        })
                                    }
                                />
                            </label>
                        </div>
                        <button
                            type="button"
                            className="admin-note-counter-reset"
                            onClick={() => updateBlock(block.id, { counterValue: 0 })}
                            aria-label="Reset counter"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            ) : block.type === 'picker' ? (
                <div className="admin-note-picker-wrap">
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Picker title"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <label className="admin-note-picker-field">
                        <span>Options</span>
                        <textarea
                            value={block.pickerOptions || ''}
                            placeholder="One option per line"
                            aria-label="Picker options"
                            onChange={(event) =>
                                updateBlock(block.id, { pickerOptions: event.target.value })
                            }
                        />
                    </label>
                    <div className="admin-note-picker-result-label">Result</div>
                    <div className="admin-note-picker-result">
                        <span aria-live="polite">{block.pickerChoice || 'No choice yet'}</span>
                        <button
                            type="button"
                            className="admin-note-picker-choice"
                            onClick={() => {
                                const options = String(block.pickerOptions || '')
                                    .split('\n')
                                    .map((opt) => opt.trim())
                                    .filter(Boolean);
                                if (!options.length) return;
                                updateBlock(block.id, {
                                    pickerChoice: options[Math.floor(Math.random() * options.length)],
                                });
                            }}
                        >
                            Pick
                        </button>
                    </div>
                </div>
            ) : block.type === 'progress' ? (
                <div className="admin-note-progress-wrap">
                    <div className="admin-note-progress-header">
                        <input
                            value={block.label}
                            placeholder={type.placeholder}
                            aria-label="Progress label"
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                        />
                        <input
                            className="admin-note-progress-value"
                            type="number"
                            min="0"
                            max="100"
                            value={block.value}
                            aria-label="Progress percentage"
                            onChange={(event) =>
                                updateBlock(block.id, {
                                    value: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                                })
                            }
                        />
                        <span>%</span>
                    </div>
                    <progress
                        max="100"
                        value={block.value}
                        aria-label={`${block.label || 'Progress'}: ${block.value}%`}
                    />
                </div>
            ) : block.type === 'link' ? (
                <div
                    className="admin-note-link-wrap"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setEditingLinkId(null);
                    }}
                >
                    {block.label && block.url && editingLinkId !== block.id ? (
                        <div
                            className="admin-note-link-compact"
                            onDoubleClick={() => {
                                window.clearTimeout(linkClickTimerRef.current);
                                setEditingLinkId(block.id);
                            }}
                        >
                            <span className="admin-note-link-icon" aria-hidden="true">
                                ↗
                            </span>
                            <div className="admin-note-link-details">
                                <a
                                    className="admin-note-link-preview"
                                    href={getLinkHref(block.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(event) => handleLinkPreviewClick(event, block.url)}
                                >
                                    {block.label}
                                </a>
                                <span className="admin-note-link-domain">
                                    {getLinkDomain(block.url)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <input
                                value={block.label}
                                placeholder={type.placeholder}
                                aria-label="Link label"
                                onChange={(event) => {
                                    setEditingLinkId(block.id);
                                    updateBlock(block.id, { label: event.target.value });
                                }}
                            />
                            <input
                                value={block.url}
                                placeholder="https://example.com"
                                aria-label="Link URL"
                                onChange={(event) => {
                                    setEditingLinkId(block.id);
                                    updateBlock(block.id, { url: event.target.value });
                                }}
                            />
                        </>
                    )}
                </div>
            ) : block.type === 'date' ? (
                <div className="admin-note-date-wrap">
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Date label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <input
                        type="date"
                        value={block.date}
                        aria-label="Note date"
                        onChange={(event) => updateBlock(block.id, { date: event.target.value })}
                    />
                </div>
            ) : block.type === 'list' ? (
                renderListWidget()
            ) : block.type === 'habit' ? (
                <div className="admin-note-habit-wrap">
                    <div className="admin-note-habit-header">
                        <input
                            value={block.label}
                            placeholder={type.placeholder}
                            aria-label="Habit name"
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                        />
                        <input
                            type="month"
                            value={block.habitMonth || getCurrentMonthValue()}
                            aria-label="Habit month"
                            onChange={(event) => updateBlock(block.id, { habitMonth: event.target.value })}
                        />
                    </div>
                    <div className="admin-note-habit-weekdays" aria-hidden="true">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <span key={day}>{day}</span>
                        ))}
                    </div>
                    <div className="admin-note-habit-calendar" aria-label="Habit calendar">
                        {getHabitCalendarDays(block.habitMonth).map((day, dayIndex) => {
                            if (!day)
                                return <span className="admin-note-habit-blank" key={`blank-${dayIndex}`} />;
                            const completionKey = `${
                                block.habitMonth || getCurrentMonthValue()
                            }-${String(day).padStart(2, '0')}`;
                            const completed = Boolean(block.habitCompletions?.[completionKey]);
                            return (
                                <button
                                    type="button"
                                    key={completionKey}
                                    className={completed ? 'active' : ''}
                                    title={completionKey}
                                    onClick={() =>
                                        updateBlock(block.id, {
                                            habitCompletions: {
                                                ...(block.habitCompletions || {}),
                                                [completionKey]: !completed,
                                            },
                                        })
                                    }
                                    aria-label={`${completionKey}: ${completed ? 'complete' : 'incomplete'}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <span className="admin-note-habit-progress">
                        {
                            Object.entries(block.habitCompletions || {}).filter(
                                ([date, completed]) =>
                                    date.startsWith(`${block.habitMonth || getCurrentMonthValue()}-`) &&
                                    completed
                            ).length
                        }{' '}
                        days complete
                    </span>
                </div>
            ) : block.type === 'status' ? (
                <div className={`admin-note-status-wrap admin-note-status-wrap-${statusKey}`}>
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Status label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <select
                        value={block.status || 'In progress'}
                        aria-label="Status"
                        onChange={(event) => updateBlock(block.id, { status: event.target.value })}
                    >
                        <option>Not started</option>
                        <option>In progress</option>
                        <option>Blocked</option>
                        <option>Done</option>
                    </select>
                </div>
            ) : block.type === 'countdown' ? (
                <div className="admin-note-countdown-wrap">
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Countdown label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <input
                        type="datetime-local"
                        value={block.dateTime}
                        aria-label="Countdown date and time"
                        onFocus={unlockCountdownAudio}
                        onChange={(event) => updateBlock(block.id, { dateTime: event.target.value })}
                    />
                    {getCountdownParts(block.dateTime) ? (
                        <strong className="admin-note-countdown-value">
                            {getCountdownParts(block.dateTime).hours}:{getCountdownParts(block.dateTime).minutes}:
                            {getCountdownParts(block.dateTime).seconds}
                        </strong>
                    ) : (
                        <strong>Choose a date and time</strong>
                    )}
                </div>
            ) : block.type === 'rating' ? (
                <div className="admin-note-rating-wrap">
                    <input
                        value={block.label}
                        placeholder={type.placeholder}
                        aria-label="Rating label"
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    {renderStars()}
                </div>
            ) : block.type === 'flashcards' ? (
                <div className="admin-note-flashcard-wrap">
                    <div className="admin-note-flashcard-controls" aria-label="Flashcard controls">
                        <input
                            className="admin-note-flashcard-title"
                            value={block.label}
                            placeholder="Flashcard title"
                            aria-label="Flashcard title"
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                        />
                        <span className="admin-note-table-label">
                            Card {(block.cardIndex || 0) + 1} of {getFlashcards(block).length}
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                updateBlock(block.id, {
                                    cardIndex: Math.max(0, (block.cardIndex || 0) - 1),
                                    flipped: false,
                                })
                            }
                            disabled={!block.cardIndex}
                            aria-label="Previous card"
                            title="Previous card"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                updateBlock(block.id, {
                                    cardIndex: Math.min(getFlashcards(block).length - 1, (block.cardIndex || 0) + 1),
                                    flipped: false,
                                })
                            }
                            disabled={(block.cardIndex || 0) === getFlashcards(block).length - 1}
                            aria-label="Next card"
                            title="Next card"
                        >
                            Next
                        </button>
                        <button
                            type="button"
                            onClick={addFlashcard}
                            aria-label="Add flashcard"
                            title="Add flashcard"
                        >
                            New
                        </button>
                    </div>
                    {editingFlashcardId === block.id ? (
                        <div
                            className="admin-note-flashcard-edit"
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget))
                                    setEditingFlashcardId(null);
                            }}
                        >
                            <label className="admin-note-flashcard-edit-field">
                                <span>Front</span>
                                <input
                                    autoFocus
                                    value={getFlashcards(block)[block.cardIndex || 0].front}
                                    placeholder="Front of card"
                                    aria-label="Flashcard front"
                                    onChange={(event) => updateFlashcard({ front: event.target.value })}
                                />
                            </label>
                            <label className="admin-note-flashcard-edit-field">
                                <span>Back</span>
                                <input
                                    value={getFlashcards(block)[block.cardIndex || 0].back}
                                    placeholder="Back of card"
                                    aria-label="Flashcard back"
                                    onChange={(event) => updateFlashcard({ back: event.target.value })}
                                />
                            </label>
                        </div>
                    ) : (
                        <div
                            className="admin-note-flashcard"
                            role="button"
                            tabIndex="0"
                            onClick={() => updateBlock(block.id, { flipped: !block.flipped })}
                            onDoubleClick={() => setEditingFlashcardId(block.id)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    updateBlock(block.id, { flipped: !block.flipped });
                                }
                            }}
                            aria-label="Flip flashcard; double-click to edit"
                        >
                            <span>
                                {block.flipped
                                    ? getFlashcards(block)[block.cardIndex || 0].back || 'Add an answer below'
                                    : getFlashcards(block)[block.cardIndex || 0].front || type.placeholder}
                            </span>
                        </div>
                    )}
                </div>
            ) : block.type === 'chart' ? (
                <div className="admin-note-chart-wrap">
                    <div className="admin-note-chart-heading">
                        <label className="admin-note-chart-field">
                            <span>Title</span>
                            <input
                                value={block.label}
                                placeholder={type.placeholder}
                                aria-label="Chart title"
                                onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field chart-type">
                            <span>Type</span>
                            <select
                                value={block.chartStyle || 'bar'}
                                aria-label="Chart type"
                                onChange={(event) => updateBlock(block.id, { chartStyle: event.target.value })}
                            >
                                <option value="bar">Bar</option>
                                <option value="line">Line</option>
                                <option value="pie">Pie</option>
                            </select>
                        </label>
                    </div>
                    <div className="admin-note-chart-data-inputs">
                        <label className="admin-note-chart-field">
                            <span>Values</span>
                            <input
                                value={block.chartValues || '25, 50, 35, 70'}
                                placeholder="25, 50, 35, 70"
                                aria-label="Chart values"
                                onChange={(event) => updateBlock(block.id, { chartValues: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field">
                            <span>Categories</span>
                            <input
                                value={block.chartLabels || 'A, B, C, D'}
                                placeholder="A, B, C, D"
                                aria-label="Chart category labels"
                                onChange={(event) => updateBlock(block.id, { chartLabels: event.target.value })}
                            />
                        </label>
                    </div>
                    <div className="admin-note-chart-axis-inputs">
                        <label className="admin-note-chart-field">
                            <span>X axis</span>
                            <input
                                value={block.chartXAxis || 'Category'}
                                placeholder="Category"
                                aria-label="X-axis label"
                                onChange={(event) => updateBlock(block.id, { chartXAxis: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field">
                            <span>Y axis</span>
                            <input
                                value={block.chartYAxis || 'Value'}
                                placeholder="Value"
                                aria-label="Y-axis label"
                                onChange={(event) => updateBlock(block.id, { chartYAxis: event.target.value })}
                            />
                        </label>
                    </div>
                    {renderChart(block)}
                </div>
            ) : block.type === 'equation' ? (
                <div className="admin-note-equation-wrap">
                    {editingEquationId === block.id ? (
                        <div
                            className="admin-note-equation-edit"
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) setEditingEquationId(null);
                            }}
                        >
                            <input
                                value={block.label}
                                placeholder="Equation label"
                                aria-label="Equation label"
                                onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                            />
                            <input
                                autoFocus
                                value={block.text}
                                placeholder="\frac{a}{b}"
                                aria-label="Equation LaTeX"
                                onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="admin-note-equation-display"
                            onClick={() => setEditingEquationId(block.id)}
                            aria-label="Edit equation"
                        >
                            {block.label && <small>{block.label}</small>}
                            <span dangerouslySetInnerHTML={{ __html: renderEquation(block.text) }} />
                        </button>
                    )}
                </div>
            ) : block.type === 'note_link' ? (
                <div
                    className="admin-note-linked-notes-wrap"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setEditingNoteLinkId(null);
                    }}
                >
                    {block.linkedNote && editingNoteLinkId !== block.id ? (
                        (() => {
                            const linkedNote = notes.find((n) => n.id === block.linkedNote);
                            return linkedNote ? (
                                <div className="admin-note-linked-note-item">
                                    <span className="admin-note-link-icon" aria-hidden="true">
                                        📎
                                    </span>
                                    <div className="admin-note-linked-note-details">
                                        <button
                                            type="button"
                                            className="admin-note-linked-note-link"
                                            onClick={() => selectNote(linkedNote)}
                                            title="Open linked note"
                                        >
                                            {linkedNote.title || 'Untitled note'}
                                        </button>
                                        <span className="admin-note-linked-note-meta">
                                            {linkedNote.folder ? `/${linkedNote.folder}` : '/ (Root)'}
                                        </span>
                                        <span className="admin-note-linked-note-preview">
                                            {getNotePreview(linkedNote)}
                                        </span>
                                    </div>
                                    <div className="admin-note-linked-note-actions">
                                        <button
                                            type="button"
                                            onClick={() => updateBlock(block.id, { linkedNote: '' })}
                                            aria-label="Clear linked note"
                                            title="Clear linked note"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-note-linked-note-missing">
                                    <span>Linked note is unavailable.</span>
                                    <button
                                        type="button"
                                        onClick={() => updateBlock(block.id, { linkedNote: '' })}
                                    >
                                        Choose another
                                    </button>
                                </div>
                            );
                        })()
                    ) : (
                        <label className="admin-note-linked-note-picker">
                            <span>Link to a note</span>
                            <select
                                className="admin-note-linked-notes-select"
                                value={block.linkedNote || ''}
                                onChange={(event) => {
                                    updateBlock(block.id, { linkedNote: event.target.value });
                                    if (event.target.value) {
                                        setEditingNoteLinkId(null);
                                    }
                                }}
                            >
                                <option value="">Choose a note...</option>
                                {notes
                                    .filter((n) => n.id !== selectedId)
                                    .map((note) => (
                                        <option key={note.id} value={note.id}>
                                            {note.title || 'Untitled note'}
                                            {note.folder ? ` · /${note.folder}` : ''}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    )}
                </div>
            ) : block.type === 'text' ? (
                <div className="admin-note-text-wrap">
                    <div
                        className="admin-note-text-editor"
                        contentEditable
                        suppressContentEditableWarning
                        ref={(element) => {
                            if (!element || document.activeElement === element) return;
                            const html = getTextEditorHtml(block.text);
                            if (element.innerHTML !== html) element.innerHTML = html;
                        }}
                        data-text-editor-id={block.id}
                        onFocus={() => {
                            setActiveTextBlockId(block.id);
                            saveTextSelection(block.id);
                        }}
                        onKeyUp={saveTextSelection}
                        onMouseUp={saveTextSelection}
                        onInput={(event) => updateBlock(block.id, { text: event.currentTarget.innerHTML })}
                        role="textbox"
                        aria-label={type.label}
                        data-placeholder={type.placeholder}
                    />
                </div>
            ) : block.type === 'quote' ? (
                <div className="admin-note-quote-wrap">
                    <textarea
                        value={block.text}
                        placeholder={type.placeholder}
                        aria-label="Quote"
                        onChange={(event) => updateBlock(block.id, { text: fitTextareaValue(event) })}
                    />
                    <div className={`admin-note-quote-author${block.author ? ' has-author' : ''}`}>
                        <span className="admin-note-quote-dash" aria-hidden="true">
                            —
                        </span>
                        <input
                            value={block.author || ''}
                            placeholder="Authorship"
                            aria-label="Quote author"
                            onChange={(event) => updateBlock(block.id, { author: event.target.value })}
                        />
                    </div>
                </div>
            ) : block.type === 'image' ? (
                <div className="admin-note-image-wrap">
                    {editingImageId === block.id ? (
                        <div
                            className="admin-note-image-edit"
                            onBlur={(event) => {
                                if (!event.currentTarget.contains(event.relatedTarget)) setEditingImageId(null);
                            }}
                        >
                            <label className="admin-note-image-edit-field">
                                <span>Image URL</span>
                                <input
                                    autoFocus
                                    value={block.url}
                                    placeholder="https://example.com/image.jpg"
                                    aria-label="Image URL"
                                    onChange={(event) => {
                                        setImageErrors((current) => ({ ...current, [block.id]: false }));
                                        updateBlock(block.id, { url: event.target.value });
                                    }}
                                />
                            </label>
                            <label className="admin-note-image-edit-field">
                                <span>Label</span>
                                <input
                                    value={block.alt}
                                    placeholder="Optional caption"
                                    aria-label="Image label"
                                    onChange={(event) => updateBlock(block.id, { alt: event.target.value })}
                                />
                            </label>
                        </div>
                    ) : (
                        <div className="admin-note-image-view">
                            <div
                                className="admin-note-image-display"
                                role="button"
                                tabIndex="0"
                                onDoubleClick={() => setEditingImageId(block.id)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') setEditingImageId(block.id);
                                }}
                                aria-label="Image preview; double-click to edit"
                            >
                                {block.url && !imageErrors[block.id] ? (
                                    <img
                                        src={block.url}
                                        alt={block.alt || 'Note image'}
                                        referrerPolicy="no-referrer"
                                        onLoad={() =>
                                            setImageErrors((current) => ({
                                                ...current,
                                                [block.id]: false,
                                            }))
                                        }
                                        onError={() =>
                                            setImageErrors((current) => ({
                                                ...current,
                                                [block.id]: true,
                                            }))
                                        }
                                    />
                                ) : (
                                    <div className="admin-note-image-placeholder">
                                        {imageErrors[block.id]
                                            ? 'Could not load this URL. Use a direct image link.'
                                            : 'Double-click to add an image'}
                                    </div>
                                )}
                            </div>
                            {block.alt?.trim() ? (
                                <figcaption className="admin-note-image-label">{block.alt}</figcaption>
                            ) : null}
                        </div>
                    )}
                </div>
            ) : block.type === 'code' ? (
                <div className="admin-note-code-wrap">
                    <div className="admin-note-code-controls" aria-label="Code block controls">
                        <span className="admin-note-table-label">Code</span>
                        <select
                            value={block.language || 'plain'}
                            aria-label="Code language"
                            onChange={(event) => updateBlock(block.id, { language: event.target.value })}
                        >
                            {CODE_LANGUAGES.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="admin-note-code-editor">
                        <pre className="admin-note-code-highlight" aria-hidden="true">
                            <code
                                dangerouslySetInnerHTML={{
                                    __html: `${highlightCode(block.text, block.language || 'plain')}\n`,
                                }}
                            />
                        </pre>
                        <textarea
                            value={block.text}
                            placeholder={type.placeholder}
                            aria-label="Code block"
                            spellCheck="false"
                            onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                            onScroll={(event) => {
                                const highlight = event.currentTarget.previousElementSibling;
                                if (!highlight) return;
                                highlight.scrollTop = event.currentTarget.scrollTop;
                                highlight.scrollLeft = event.currentTarget.scrollLeft;
                            }}
                        />
                    </div>
                </div>
            ) : block.type === 'table' ? (
                <div className="admin-note-table-wrap">
                    <div className="admin-note-table-controls" aria-label="Table controls">
                        <span className="admin-note-table-label">Table</span>
                        <span className="admin-note-table-control-label">Columns</span>
                        <button
                            type="button"
                            onClick={() =>
                                resizeTableColumns(block, getTableColumnCount(block) - 1, updateBlock)
                            }
                            disabled={getTableColumnCount(block) === 1}
                            aria-label="Remove column"
                            title="Remove column"
                        >
                            -
                        </button>
                        <strong>{getTableColumnCount(block)}</strong>
                        <button
                            type="button"
                            onClick={() =>
                                resizeTableColumns(block, getTableColumnCount(block) + 1, updateBlock)
                            }
                            disabled={getTableColumnCount(block) === 8}
                            aria-label="Add column"
                            title="Add column"
                        >
                            +
                        </button>
                        <span className="admin-note-table-control-label">Rows</span>
                        <button
                            type="button"
                            onClick={() => resizeTableRows(block, block.rows.length - 1, updateBlock)}
                            disabled={block.rows.length === 2}
                            aria-label="Remove row"
                            title="Remove row"
                        >
                            -
                        </button>
                        <strong>{block.rows.length}</strong>
                        <button
                            type="button"
                            onClick={() => resizeTableRows(block, block.rows.length + 1, updateBlock)}
                            disabled={block.rows.length === getTableRowCapacity(block)}
                            aria-label="Add row"
                            title="Add row"
                        >
                            +
                        </button>
                    </div>
                    <table>
                        <tbody>
                            {block.rows.map((row, rowIndex) => (
                                <tr key={`${block.id}-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={`${block.id}-${rowIndex}-${cellIndex}`}>
                                            <input
                                                value={cell}
                                                aria-label={`Row ${rowIndex + 1}, column ${cellIndex + 1}`}
                                                placeholder={type.placeholder}
                                                onChange={(event) => {
                                                    const rows = block.rows.map((currentRow) => [
                                                        ...currentRow,
                                                    ]);
                                                    rows[rowIndex][cellIndex] = event.target.value;
                                                    updateBlock(block.id, { rows });
                                                }}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <>
                    {block.type === 'todo' && (
                        <input
                            type="checkbox"
                            checked={block.checked}
                            onChange={(event) => updateBlock(block.id, { checked: event.target.checked })}
                            aria-label="Mark task complete"
                        />
                    )}
                    <textarea
                        value={block.text}
                        onChange={(event) => updateBlock(block.id, { text: fitTextareaValue(event) })}
                        placeholder={type.placeholder}
                        aria-label={type.label}
                        rows={block.type === 'text' ? 3 : 1}
                    />
                </>
            )}

            <button
                type="button"
                className="admin-note-block-remove"
                onClick={() => removeBlock(block.id)}
                aria-label="Remove block"
            >
                x
            </button>
            {block.type !== 'divider' && (
                <button
                    type="button"
                    className="admin-note-block-resize"
                    aria-label="Resize widget"
                    title="Resize widget"
                    onPointerDown={(event) => startBlockResize(event, block)}
                    onPointerMove={(event) => updateBlockResize(event, block)}
                    onPointerUp={finishBlockResize}
                    onPointerCancel={finishBlockResize}
                >
                    ⤢
                </button>
            )}
        </div>
    );
};
