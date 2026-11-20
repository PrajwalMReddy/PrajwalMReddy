import React from 'react';
import { useContent } from '../../../utils/ContentContext';
import {
    BLOCK_TYPES,
    CALLOUT_VARIANTS,
    CODE_LANGUAGES,
    getCurrentMonthValue,
    getHabitCalendarDays,
    getLinkHref,
    getNotePreview,
    getTextEditorHtml,
    highlightCode,
    katex,
    normalizeBlockSpan,
} from './noteUtils';

export const CalloutIcon = ({ type = 'info', size = 15, className = '' }) => {
    switch (type) {
        case 'tip':
            return (
                <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    <path d="M12 8v3" />
                    <path d="M12 15h.01" />
                </svg>
            );
        case 'warning':
            return (
                <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            );
        case 'danger':
            return (
                <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
        case 'idea':
            return (
                <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                </svg>
            );
        default:
            return (
                <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                </svg>
            );
    }
};

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

export const renderChart = (block, t = (k, f) => f) => {
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
                aria-label={t('admin.ui.noteWidgets.pieChartPreview')}
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
                aria-label={`${block.label || t('admin.notesSection.widgetsDetail.line')} ${t('admin.notesSection.blockTypes.chart')}`}
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
                    {block.chartXAxis || t('admin.notesSection.widgetsDetail.category')}
                </text>
                <text
                    className="admin-note-chart-axis-label"
                    x="2"
                    y="48"
                    textAnchor="middle"
                    transform="rotate(-90 2 48)"
                >
                    {block.chartYAxis || t('admin.notesSection.widgetsDetail.value')}
                </text>
            </svg>
        );
    }

    return (
        <svg
            className="admin-note-chart-plot"
            viewBox="0 0 110 110"
            role="img"
            aria-label={`${block.label || t('admin.notesSection.widgetsDetail.bar')} ${t('admin.notesSection.blockTypes.chart')}`}
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
                {block.chartXAxis || t('admin.notesSection.widgetsDetail.category')}
            </text>
            <text
                className="admin-note-chart-axis-label"
                x="2"
                y="48"
                textAnchor="middle"
                transform="rotate(-90 2 48)"
            >
                {block.chartYAxis || t('admin.notesSection.widgetsDetail.value')}
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
    isGrouped = false,
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
    readOnly = false,
}) => {
    const { t, formatNumber } = useContent();
    const type = BLOCK_TYPES[block.type] || BLOCK_TYPES.text;
    const blockPlaceholder = t(`admin.notesSection.placeholders.${block.type}`, type.placeholder);
    const position = block.position || {
        col: (index % 3) * 4 + 1,
        row: Math.floor(index / 3) * 6 + 1,
    };
    const statusKey =
        block.type === 'status'
            ? (block.status || 'In progress').toLowerCase().replace(/\s+/g, '-')
            : '';

    const handleLinkPreviewClick = (event, url) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!url) return;
        window.clearTimeout(linkClickTimerRef.current);
        linkClickTimerRef.current = window.setTimeout(() => {
            window.open(getLinkHref(url), '_blank', 'noopener,noreferrer');
        }, 250);
    };

    const getCountdownParts = (dateTime) => {
        if (!dateTime) return null;
        const target = new Date(dateTime).getTime();
        if (Number.isNaN(target)) return null;
        const totalSeconds = Math.max(0, Math.floor((target - currentTime) / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return {
            days,
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
            isExpired: totalSeconds === 0,
        };
    };

    const renderStars = () => (
        <div className="admin-note-rating-stars" aria-label={`${formatNumber(block.rating || 0)} / ${formatNumber(5)}`}>
            {Array.from({ length: 5 }, (_, idx) => (
                <button
                    type="button"
                    key={idx}
                    className={idx < (block.rating || 0) ? 'active' : ''}
                    onClick={() => updateBlock(block.id, { rating: idx + 1 })}
                    aria-label={`${formatNumber(idx + 1)} / ${formatNumber(5)}`}
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
        if (readOnly) {
            return (
                <div className={`admin-note-list-wrap is-readonly${numbered ? ' is-numbered' : ''}`}>
                    {block.label && (
                        <div className="admin-note-list-label-display">{block.label}</div>
                    )}
                    <div className="admin-note-list-items">
                        {getListItems().map((item, itemIndex) => (
                            <div
                                className="admin-note-bullet-item is-readonly"
                                key={`${block.id}-item-${itemIndex}`}
                            >
                                <span className="admin-note-list-marker" aria-hidden="true">
                                    {numbered ? `${formatNumber(itemIndex + 1)}.` : '•'}
                                </span>
                                <span className="admin-note-list-item-text">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div className={`admin-note-list-wrap${numbered ? ' is-numbered' : ''}`}>
                <div className="admin-note-list-controls" aria-label={t('admin.ui.noteWidgets.listControls')}>
                    <input
                        className="admin-note-list-label"
                        value={block.label}
                        placeholder={t('admin.notesSection.widgetsDetail.listLabel')}
                        aria-label={t('admin.notesSection.widgetsDetail.listLabel')}
                        onChange={(event) => updateBlock?.(block.id, { label: event.target.value })}
                    />
                    <select
                        className="admin-note-list-style"
                        value={block.listStyle || 'bulleted'}
                        aria-label={t('admin.ui.noteWidgets.listStyle')}
                        onChange={(event) => updateBlock?.(block.id, { listStyle: event.target.value })}
                    >
                        <option value="bulleted">{t('admin.notesSection.widgetsDetail.bulleted')}</option>
                        <option value="numbered">{t('admin.notesSection.widgetsDetail.numbered')}</option>
                    </select>
                    <button
                        type="button"
                        onClick={addListItem}
                        aria-label={t('admin.notesSection.widgetsDetail.addListItem')}
                        title={t('admin.notesSection.widgetsDetail.addListItem')}
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
                                {numbered ? `${formatNumber(itemIndex + 1)}.` : '•'}
                            </span>
                            <input
                                value={item}
                                placeholder={itemIndex === 0 ? blockPlaceholder : t('admin.notesSection.widgetsDetail.listItem')}
                                aria-label={`${numbered ? t('admin.notesSection.widgetsDetail.numbered') : t('admin.notesSection.widgetsDetail.bulleted')} ${t('admin.notesSection.widgetsDetail.listItem')} ${formatNumber(itemIndex + 1)}`}
                                onChange={(event) => updateListItem(itemIndex, event.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => removeListItem(itemIndex)}
                                aria-label={`${t('admin.notesSection.widgetsDetail.removeListItem')} ${formatNumber(itemIndex + 1)}`}
                                title={t('admin.notesSection.widgetsDetail.removeListItem')}
                            >
                                -
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const span = normalizeBlockSpan(block.span, block.type);
    const col = Math.max(1, Math.min(position.col || 1, 13 - span));
    const height = Math.max(
        1,
        block.height ||
            type.height ||
            type.defaultHeight ||
            4
    );

    return (
        <div
            className={`admin-note-block admin-note-block-${block.type}${
                statusKey ? ` admin-note-status-${statusKey}` : ''
            }${
                block.type === 'callout'
                    ? ` admin-note-callout-block-${block.calloutType || 'info'}`
                    : ''
            }${
                draggingBlockId === block.id ? ' is-dragging' : ''
            }${isGrouped ? ' is-grouped' : ''
            }${readOnly ? ' is-readonly' : ''}`}
            key={block.id}
            data-block-id={block.id}
            style={{
                order: 20 * (position.row || 1) + col,
                gridColumn: `${col} / span ${span}`,
                gridRow: `${position.row || 1} / span ${height}`,
            }}
            onPointerDown={readOnly ? undefined : (event) => startBlockDrag?.(event, block.id)}
            onPointerMove={readOnly ? undefined : (event) => {
                if (draggingBlockId === block.id) updateDropPreview?.(event);
            }}
            onPointerUp={readOnly ? undefined : (event) => finishBlockDrag?.(event, block.id)}
        >
            {!readOnly && (
                <span className="admin-note-block-grip" title={t('admin.notesSection.widgetsDetail.dragToReorder')} aria-hidden="true">
                    ::
                </span>
            )}

            {block.type === 'divider' ? (
                <hr />
            ) : block.type === 'counter' ? (
                <div className="admin-note-counter-wrap">
                    {readOnly ? (
                        block.label && <div className="admin-note-widget-label-static">{block.label}</div>
                    ) : (
                        <input
                            value={block.label}
                            placeholder={blockPlaceholder}
                            aria-label={t('admin.notesSection.placeholders.counter')}
                            onChange={(event) => updateBlock?.(block.id, { label: event.target.value })}
                        />
                    )}
                    <div className="admin-note-counter-main" aria-label={t('admin.ui.noteWidgets.counterControls')}>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() =>
                                    updateBlock?.(block.id, {
                                        counterValue: (block.counterValue || 0) - (block.counterStep || 1),
                                    })
                                }
                                aria-label={t('admin.ui.noteWidgets.decreaseCounter')}
                            >
                                -
                            </button>
                        )}
                        <div className="admin-note-counter-value" aria-live="polite">
                            {formatNumber(block.counterValue ?? 0)}
                        </div>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={() =>
                                    updateBlock?.(block.id, {
                                        counterValue: (block.counterValue || 0) + (block.counterStep || 1),
                                    })
                                }
                                aria-label={t('admin.ui.noteWidgets.increaseCounter')}
                            >
                                +
                            </button>
                        )}
                    </div>
                    {!readOnly && (
                        <div className="admin-note-counter-controls">
                            <div className="admin-note-counter-adjust">
                                <label className="admin-note-counter-step">
                                    <span>{t('admin.notesSection.widgetsDetail.stepSize')}</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={block.counterStep || 1}
                                        aria-label={t('admin.ui.noteWidgets.counterStepSize')}
                                        onChange={(event) =>
                                            updateBlock?.(block.id, {
                                                counterStep: Math.max(1, Number(event.target.value) || 1),
                                            })
                                        }
                                    />
                                </label>
                            </div>
                            <button
                                type="button"
                                className="admin-note-counter-reset"
                                onClick={() => updateBlock?.(block.id, { counterValue: 0 })}
                                aria-label={t('admin.notesSection.widgetsDetail.reset')}
                            >
                                {t('admin.notesSection.widgetsDetail.reset')}
                            </button>
                        </div>
                    )}
                </div>
            ) : block.type === 'picker' ? (
                <div className="admin-note-picker-wrap">
                    <input
                        value={block.label}
                        placeholder={blockPlaceholder}
                        aria-label={t('admin.notesSection.placeholders.picker')}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <label className="admin-note-picker-field">
                        <span>{t('admin.notesSection.widgetsDetail.options')}</span>
                        <textarea
                            value={block.pickerOptions || ''}
                            placeholder={t('admin.notesSection.widgetsDetail.oneOptionPerLine')}
                            aria-label={t('admin.ui.noteWidgets.pickerOptions')}
                            onChange={(event) =>
                                updateBlock(block.id, { pickerOptions: event.target.value })
                            }
                        />
                    </label>
                    <div className="admin-note-picker-result-label">{t('admin.notesSection.widgetsDetail.result')}</div>
                    <div className="admin-note-picker-result">
                        <span aria-live="polite">{block.pickerChoice || t('admin.notesSection.widgetsDetail.noChoiceYet')}</span>
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
                            {t('admin.notesSection.widgetsDetail.pick')}
                        </button>
                    </div>
                </div>
            ) : block.type === 'progress' ? (
                <div className="admin-note-progress-wrap">
                    <div className="admin-note-progress-header">
                        {readOnly ? (
                            <span className="admin-note-widget-label-static">{block.label || t('admin.notesSection.blockTypes.progress')}</span>
                        ) : (
                            <input
                                value={block.label}
                                placeholder={blockPlaceholder}
                                aria-label={t('admin.notesSection.placeholders.progress')}
                                onChange={(event) => updateBlock?.(block.id, { label: event.target.value })}
                            />
                        )}
                        {readOnly ? (
                            <span className="admin-note-progress-val">{formatNumber(block.value || 0)}%</span>
                        ) : (
                            <>
                                <input
                                    className="admin-note-progress-value"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={block.value}
                                    aria-label={t('admin.ui.noteWidgets.progressPercentage')}
                                    onChange={(event) =>
                                        updateBlock?.(block.id, {
                                            value: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                                        })
                                    }
                                />
                                <span>%</span>
                            </>
                        )}
                    </div>
                    <progress
                        max="100"
                        value={block.value}
                        aria-label={`${block.label || t('admin.notesSection.blockTypes.progress')}: ${formatNumber(block.value)}%`}
                    />
                </div>
            ) : block.type === 'link' ? (
                <div
                    className="admin-note-link-wrap"
                    onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setEditingLinkId(null);
                    }}
                >
                    {(block.label || block.url) && editingLinkId !== block.id ? (
                        <div
                            className="admin-note-link-compact"
                            onClick={(event) => handleLinkPreviewClick(event, block.url)}
                            onDoubleClick={(event) => {
                                event.stopPropagation();
                                window.clearTimeout(linkClickTimerRef.current);
                                setEditingLinkId(block.id);
                            }}
                            title={t('admin.notesSection.widgetsDetail.openLinkOrEdit')}
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
                                    title={block.label || block.url}
                                >
                                    {block.label || block.url}
                                </a>
                                {block.url && (
                                    <span className="admin-note-link-url-preview">
                                        {block.url}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <input
                                value={block.label}
                                placeholder={blockPlaceholder}
                                aria-label={t('admin.notesSection.placeholders.link')}
                                onChange={(event) => {
                                    setEditingLinkId(block.id);
                                    updateBlock(block.id, { label: event.target.value });
                                }}
                            />
                            <input
                                value={block.url}
                                placeholder="https://example.com"
                                aria-label={t('admin.ui.noteWidgets.linkUrl')}
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
                        placeholder={blockPlaceholder}
                        aria-label={t('admin.notesSection.placeholders.date')}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <input
                        type="date"
                        value={block.date}
                        aria-label={t('admin.ui.noteWidgets.noteDate')}
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
                            placeholder={blockPlaceholder}
                            aria-label={t('admin.notesSection.placeholders.habit')}
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                        />
                        <input
                            type="month"
                            value={block.habitMonth || getCurrentMonthValue()}
                            aria-label={t('admin.ui.noteWidgets.habitMonth')}
                            onChange={(event) => updateBlock(block.id, { habitMonth: event.target.value })}
                        />
                    </div>
                    <div className="admin-note-habit-weekdays" aria-hidden="true">
                        {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((dayKey) => (
                            <span key={dayKey}>{t(`admin.todoSection.modal.weekdays.${dayKey}`, dayKey)}</span>
                        ))}
                    </div>
                    <div className="admin-note-habit-calendar" aria-label={t('admin.ui.noteWidgets.habitCalendar')}>
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
                                    {formatNumber(day)}
                                </button>
                            );
                        })}
                    </div>
                    <span className="admin-note-habit-progress">
                        {formatNumber(
                            Object.entries(block.habitCompletions || {}).filter(
                                ([date, completed]) =>
                                    date.startsWith(`${block.habitMonth || getCurrentMonthValue()}-`) &&
                                    completed
                            ).length
                        )}{' '}
                        {t('admin.notesSection.widgetsDetail.daysComplete')}
                    </span>
                </div>
            ) : block.type === 'status' ? (
                <div className={`admin-note-status-wrap admin-note-status-wrap-${statusKey}`}>
                    <input
                        value={block.label}
                        placeholder={blockPlaceholder}
                        aria-label={t('admin.notesSection.placeholders.status')}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <select
                        value={block.status || 'In progress'}
                        aria-label={t('admin.notesSection.placeholders.status')}
                        onChange={(event) => updateBlock(block.id, { status: event.target.value })}
                    >
                        <option value="Not started">{t('admin.notesSection.widgetsDetail.notStarted')}</option>
                        <option value="In progress">{t('admin.notesSection.widgetsDetail.inProgress')}</option>
                        <option value="Blocked">{t('admin.notesSection.widgetsDetail.blocked')}</option>
                        <option value="Done">{t('admin.notesSection.widgetsDetail.done')}</option>
                    </select>
                </div>
            ) : block.type === 'countdown' ? (
                <div className="admin-note-countdown-wrap">
                    <input
                        value={block.label}
                        placeholder={blockPlaceholder}
                        aria-label={t('admin.notesSection.placeholders.countdown')}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    <input
                        type="datetime-local"
                        value={block.dateTime}
                        aria-label={t('admin.ui.noteWidgets.countdownDateAndTime')}
                        onFocus={unlockCountdownAudio}
                        onChange={(event) => updateBlock(block.id, { dateTime: event.target.value })}
                    />
                    {getCountdownParts(block.dateTime) ? (
                        <strong className="admin-note-countdown-value">
                            {getCountdownParts(block.dateTime).days > 0 ? `${formatNumber(getCountdownParts(block.dateTime).days)}d ` : ''}
                            {formatNumber(getCountdownParts(block.dateTime).hours)}:
                            {formatNumber(getCountdownParts(block.dateTime).minutes)}:
                            {formatNumber(getCountdownParts(block.dateTime).seconds)}
                        </strong>
                    ) : (
                        <strong>{t('admin.notesSection.widgetsDetail.chooseDateTime')}</strong>
                    )}
                </div>
            ) : block.type === 'rating' ? (
                <div className="admin-note-rating-wrap">
                    <input
                        value={block.label}
                        placeholder={blockPlaceholder}
                        aria-label={t('admin.notesSection.placeholders.rating')}
                        onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                    />
                    {renderStars()}
                </div>
            ) : block.type === 'flashcards' ? (
                <div className="admin-note-flashcard-wrap">
                    <div className="admin-note-flashcard-controls" aria-label={t('admin.ui.noteWidgets.flashcardControls')}>
                        <input
                            className="admin-note-flashcard-title"
                            value={block.label}
                            placeholder={t('admin.notesSection.widgetsDetail.flashcardTitle')}
                            aria-label={t('admin.notesSection.widgetsDetail.flashcardTitle')}
                            onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                        />
                        <span className="admin-note-table-label">
                            {t('admin.notesSection.widgetsDetail.card')} {formatNumber((block.cardIndex || 0) + 1)} {t('admin.notesSection.widgetsDetail.of')} {formatNumber(getFlashcards(block).length)}
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
                            aria-label={t('admin.notesSection.widgetsDetail.previous')}
                            title={t('admin.notesSection.widgetsDetail.previous')}
                        >
                            {t('admin.notesSection.widgetsDetail.previous')}
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
                            aria-label={t('admin.notesSection.widgetsDetail.next')}
                            title={t('admin.notesSection.widgetsDetail.next')}
                        >
                            {t('admin.notesSection.widgetsDetail.next')}
                        </button>
                        <button
                            type="button"
                            onClick={addFlashcard}
                            aria-label={t('admin.notesSection.widgetsDetail.newCard')}
                            title={t('admin.notesSection.widgetsDetail.newCard')}
                        >
                            {t('admin.notesSection.widgetsDetail.newCard')}
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
                                <span>{t('admin.notesSection.widgetsDetail.front')}</span>
                                <input
                                    autoFocus
                                    value={getFlashcards(block)[block.cardIndex || 0].front}
                                    placeholder={t('admin.notesSection.placeholders.flashcards')}
                                    aria-label={t('admin.ui.noteWidgets.flashcardFront')}
                                    onChange={(event) => updateFlashcard({ front: event.target.value })}
                                />
                            </label>
                            <label className="admin-note-flashcard-edit-field">
                                <span>{t('admin.notesSection.widgetsDetail.back')}</span>
                                <input
                                    value={getFlashcards(block)[block.cardIndex || 0].back}
                                    placeholder={t('admin.notesSection.widgetsDetail.addAnswerBelow')}
                                    aria-label={t('admin.ui.noteWidgets.flashcardBack')}
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
                            aria-label={`${t('admin.notesSection.widgetsDetail.clickToFlip')}; ${t('admin.notesSection.widgetsDetail.doubleClickToEdit')}`}
                        >
                            <span>
                                {block.flipped
                                    ? getFlashcards(block)[block.cardIndex || 0].back || t('admin.notesSection.widgetsDetail.addAnswerBelow')
                                    : getFlashcards(block)[block.cardIndex || 0].front || blockPlaceholder}
                            </span>
                        </div>
                    )}
                </div>
            ) : block.type === 'chart' ? (
                <div className="admin-note-chart-wrap">
                    <div className="admin-note-chart-heading">
                        <label className="admin-note-chart-field">
                            <span>{t('admin.notesSection.widgetsDetail.chartTitle')}</span>
                            <input
                                value={block.label}
                                placeholder={blockPlaceholder}
                                aria-label={t('admin.notesSection.widgetsDetail.chartTitle')}
                                onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field chart-type">
                            <span>{t('admin.notesSection.widgetsDetail.chartType')}</span>
                            <select
                                value={block.chartStyle || 'bar'}
                                aria-label={t('admin.ui.noteWidgets.chartType')}
                                onChange={(event) => updateBlock(block.id, { chartStyle: event.target.value })}
                            >
                                <option value="bar">{t('admin.notesSection.widgetsDetail.bar')}</option>
                                <option value="line">{t('admin.notesSection.widgetsDetail.line')}</option>
                                <option value="pie">{t('admin.notesSection.widgetsDetail.pie')}</option>
                            </select>
                        </label>
                    </div>
                    <div className="admin-note-chart-data-inputs">
                        <label className="admin-note-chart-field">
                            <span>{t('admin.notesSection.widgetsDetail.values')}</span>
                            <input
                                value={block.chartValues || '25, 50, 35, 70'}
                                placeholder="25, 50, 35, 70"
                                aria-label={t('admin.ui.noteWidgets.chartValues')}
                                onChange={(event) => updateBlock(block.id, { chartValues: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field">
                            <span>{t('admin.notesSection.widgetsDetail.categories')}</span>
                            <input
                                value={block.chartLabels || 'A, B, C, D'}
                                placeholder="A, B, C, D"
                                aria-label={t('admin.ui.noteWidgets.chartCategoryLabels')}
                                onChange={(event) => updateBlock(block.id, { chartLabels: event.target.value })}
                            />
                        </label>
                    </div>
                    <div className="admin-note-chart-axis-inputs">
                        <label className="admin-note-chart-field">
                            <span>{t('admin.notesSection.widgetsDetail.xAxis')}</span>
                            <input
                                value={block.chartXAxis || ''}
                                placeholder={t('admin.notesSection.widgetsDetail.category')}
                                aria-label={t('admin.ui.noteWidgets.xAxisLabel')}
                                onChange={(event) => updateBlock(block.id, { chartXAxis: event.target.value })}
                            />
                        </label>
                        <label className="admin-note-chart-field">
                            <span>{t('admin.notesSection.widgetsDetail.yAxis')}</span>
                            <input
                                value={block.chartYAxis || ''}
                                placeholder={t('admin.notesSection.widgetsDetail.value')}
                                aria-label={t('admin.ui.noteWidgets.yAxisLabel')}
                                onChange={(event) => updateBlock(block.id, { chartYAxis: event.target.value })}
                            />
                        </label>
                    </div>
                    {renderChart(block, t)}
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
                                placeholder={t('admin.notesSection.widgetsDetail.equationLabel')}
                                aria-label={t('admin.notesSection.widgetsDetail.equationLabel')}
                                onChange={(event) => updateBlock(block.id, { label: event.target.value })}
                            />
                            <input
                                autoFocus
                                value={block.text}
                                placeholder="\frac{a}{b}"
                                aria-label={t('admin.ui.noteWidgets.equationLatex')}
                                onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="admin-note-equation-display"
                            onClick={() => setEditingEquationId(block.id)}
                            aria-label={t('admin.notesSection.widgetsDetail.doubleClickToEdit')}
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
                                <div
                                    className="admin-note-linked-note-item"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        window.clearTimeout(linkClickTimerRef.current);
                                        linkClickTimerRef.current = window.setTimeout(() => {
                                            selectNote(linkedNote);
                                        }, 250);
                                    }}
                                    onDoubleClick={(event) => {
                                        event.stopPropagation();
                                        window.clearTimeout(linkClickTimerRef.current);
                                        setEditingNoteLinkId(block.id);
                                    }}
                                    title={t('admin.notesSection.widgetsDetail.openLinkedNote')}
                                >
                                    <span className="admin-note-link-icon" aria-hidden="true">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                    </span>
                                    <div className="admin-note-linked-note-details">
                                        <button
                                            type="button"
                                            className="admin-note-linked-note-link"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                window.clearTimeout(linkClickTimerRef.current);
                                                linkClickTimerRef.current = window.setTimeout(() => {
                                                    selectNote(linkedNote);
                                                }, 250);
                                            }}
                                            title={t('admin.notesSection.widgetsDetail.openLinkedNote')}
                                        >
                                            {linkedNote.title || t('admin.notesSection.untitledNote')}
                                        </button>
                                        <span className="admin-note-linked-note-meta">
                                            {linkedNote.folder ? `/${linkedNote.folder}` : t('admin.notesSection.rootFolder')}
                                        </span>
                                        <span className="admin-note-linked-note-preview">
                                            {getNotePreview(linkedNote)}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="admin-note-linked-note-missing">
                                    <span>{t('admin.notesSection.widgetsDetail.linkedUnavailable')}</span>
                                    <button
                                        type="button"
                                        onClick={() => updateBlock(block.id, { linkedNote: '' })}
                                    >
                                        {t('admin.notesSection.widgetsDetail.chooseAnother')}
                                    </button>
                                </div>
                            );
                        })()
                    ) : (
                        <label className="admin-note-linked-note-picker">
                            <span>{t('admin.notesSection.widgetsDetail.linkToNote')}</span>
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
                                <option value="">{t('admin.notesSection.widgetsDetail.chooseNote')}</option>
                                {notes
                                    .filter((n) => n.id !== selectedId)
                                    .map((note) => (
                                        <option key={note.id} value={note.id}>
                                            {note.title || t('admin.notesSection.untitledNote')}
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
                        className={`admin-note-text-editor${readOnly ? ' is-readonly' : ''}`}
                        contentEditable={!readOnly}
                        suppressContentEditableWarning
                        ref={(element) => {
                            if (!element || (!readOnly && document.activeElement === element)) return;
                            const html = getTextEditorHtml(block.text);
                            if (element.innerHTML !== html) element.innerHTML = html;
                        }}
                        data-text-editor-id={block.id}
                        onFocus={readOnly ? undefined : () => {
                            setActiveTextBlockId?.(block.id);
                            saveTextSelection?.(block.id);
                        }}
                        onKeyUp={readOnly ? undefined : saveTextSelection}
                        onMouseUp={readOnly ? undefined : saveTextSelection}
                        onInput={readOnly ? undefined : (event) => updateBlock?.(block.id, { text: event.currentTarget.innerHTML })}
                        role="textbox"
                        aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                        data-placeholder={readOnly ? '' : blockPlaceholder}
                    />
                </div>
            ) : block.type === 'quote' ? (
                <div className="admin-note-quote-wrap">
                    <textarea
                        value={block.text}
                        placeholder={blockPlaceholder}
                        aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                        onChange={(event) => updateBlock(block.id, { text: fitTextareaValue(event) })}
                    />
                    <div className={`admin-note-quote-author${block.author ? ' has-author' : ''}`}>
                        <span className="admin-note-quote-dash" aria-hidden="true">
                            —
                        </span>
                        <input
                            value={block.author || ''}
                            placeholder={t('admin.notesSection.widgetsDetail.authorship')}
                            aria-label={t('admin.notesSection.widgetsDetail.authorship')}
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
                                <span>{t('admin.notesSection.widgetsDetail.imageUrl')}</span>
                                <input
                                    autoFocus
                                    value={block.url}
                                    placeholder="https://example.com/image.jpg"
                                    aria-label={t('admin.ui.noteWidgets.imageUrl')}
                                    onChange={(event) => {
                                        setImageErrors((current) => ({ ...current, [block.id]: false }));
                                        updateBlock(block.id, { url: event.target.value });
                                    }}
                                />
                            </label>
                            <label className="admin-note-image-edit-field">
                                <span>{t('admin.notesSection.widgetsDetail.caption')}</span>
                                <input
                                    value={block.alt}
                                    placeholder={t('admin.notesSection.widgetsDetail.caption')}
                                    aria-label={t('admin.ui.noteWidgets.imageLabel')}
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
                                aria-label={`${t('admin.notesSection.blockTypes.image')}; ${t('admin.notesSection.widgetsDetail.doubleClickToEdit')}`}
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
                                            ? t('admin.notesSection.widgetsDetail.couldNotLoadImage')
                                            : t('admin.notesSection.widgetsDetail.doubleClickToAddImage')}
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
                    {!readOnly && (
                        <div className="admin-note-code-controls" aria-label={t('admin.ui.noteWidgets.codeBlockControls')}>
                            <span className="admin-note-table-label">{t('admin.notesSection.widgetsDetail.code')}</span>
                            <select
                                value={block.language || 'plain'}
                                aria-label={t('admin.ui.noteWidgets.codeLanguage')}
                                onChange={(event) => updateBlock?.(block.id, { language: event.target.value })}
                            >
                                {CODE_LANGUAGES.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="admin-note-code-editor">
                        <pre className="admin-note-code-highlight" aria-hidden={!readOnly}>
                            <code
                                dangerouslySetInnerHTML={{
                                    __html: `${highlightCode(block.text, block.language || 'plain')}\n`,
                                }}
                            />
                        </pre>
                        {!readOnly && (
                            <textarea
                                value={block.text}
                                placeholder={blockPlaceholder}
                                aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                                spellCheck="false"
                                onChange={(event) => updateBlock?.(block.id, { text: event.target.value })}
                                onScroll={(event) => {
                                    const highlight = event.currentTarget.previousElementSibling;
                                    if (!highlight) return;
                                    highlight.scrollTop = event.currentTarget.scrollTop;
                                    highlight.scrollLeft = event.currentTarget.scrollLeft;
                                }}
                            />
                        )}
                    </div>
                </div>
            ) : block.type === 'table' ? (
                <div className="admin-note-table-wrap">
                    {!readOnly && (
                        <div className="admin-note-table-controls" aria-label={t('admin.ui.noteWidgets.tableControls')}>
                            <span className="admin-note-table-label">{t('admin.notesSection.widgetsDetail.table')}</span>
                            <span className="admin-note-table-control-label">{t('admin.notesSection.widgetsDetail.columns')}</span>
                            <button
                                type="button"
                                onClick={() =>
                                    resizeTableColumns(block, getTableColumnCount(block) - 1, updateBlock)
                                }
                                disabled={getTableColumnCount(block) === 1}
                                aria-label={t('admin.notesSection.widgetsDetail.removeColumn')}
                                title={t('admin.notesSection.widgetsDetail.removeColumn')}
                            >
                                -
                            </button>
                            <strong>{formatNumber(getTableColumnCount(block))}</strong>
                            <button
                                type="button"
                                onClick={() =>
                                    resizeTableColumns(block, getTableColumnCount(block) + 1, updateBlock)
                                }
                                disabled={getTableColumnCount(block) === 8}
                                aria-label={t('admin.notesSection.widgetsDetail.addColumn')}
                                title={t('admin.notesSection.widgetsDetail.addColumn')}
                            >
                                +
                            </button>
                            <span className="admin-note-table-control-label">{t('admin.notesSection.widgetsDetail.rows')}</span>
                            <button
                                type="button"
                                onClick={() => resizeTableRows(block, block.rows.length - 1, updateBlock)}
                                disabled={block.rows.length === 2}
                                aria-label={t('admin.notesSection.widgetsDetail.removeRow')}
                                title={t('admin.notesSection.widgetsDetail.removeRow')}
                            >
                                -
                            </button>
                            <strong>{formatNumber(block.rows.length)}</strong>
                            <button
                                type="button"
                                onClick={() => resizeTableRows(block, block.rows.length + 1, updateBlock)}
                                disabled={block.rows.length === getTableRowCapacity(block)}
                                aria-label={t('admin.notesSection.widgetsDetail.addRow')}
                                title={t('admin.notesSection.widgetsDetail.addRow')}
                            >
                                +
                            </button>
                        </div>
                    )}
                    <table>
                        <tbody>
                            {block.rows.map((row, rowIndex) => (
                                <tr key={`${block.id}-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                        <td key={`${block.id}-${rowIndex}-${cellIndex}`}>
                                            {readOnly ? (
                                                <span className="admin-note-table-cell-static">{cell}</span>
                                            ) : (
                                                <input
                                                    value={cell}
                                                    aria-label={`${t('admin.notesSection.widgetsDetail.rows')} ${formatNumber(rowIndex + 1)}, ${t('admin.notesSection.widgetsDetail.columns')} ${formatNumber(cellIndex + 1)}`}
                                                    placeholder={blockPlaceholder}
                                                    onChange={(event) => {
                                                        const rows = block.rows.map((currentRow) => [
                                                            ...currentRow,
                                                        ]);
                                                        rows[rowIndex][cellIndex] = event.target.value;
                                                        updateBlock?.(block.id, { rows });
                                                    }}
                                                />
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : block.type === 'callout' ? (
                <div className="admin-note-callout-wrap">
                    {readOnly ? (
                        block.label ? (
                            <div className="admin-note-callout-controls is-readonly">
                                <span className="admin-note-widget-label-static">{block.label}</span>
                            </div>
                        ) : null
                    ) : (
                        <div className="admin-note-callout-controls" aria-label={t('admin.ui.noteWidgets.calloutControls')}>
                            <input
                                className="admin-note-callout-label"
                                value={block.label || ''}
                                placeholder={t('admin.notesSection.blockTypes.callout')}
                                aria-label={t('admin.notesSection.widgetsDetail.calloutLabel')}
                                onChange={(event) => updateBlock?.(block.id, { label: event.target.value })}
                            />
                            <select
                                className="admin-note-callout-type"
                                value={block.calloutType || 'info'}
                                aria-label={t('admin.ui.noteWidgets.calloutType')}
                                onChange={(event) => updateBlock?.(block.id, { calloutType: event.target.value })}
                            >
                                {Object.entries(CALLOUT_VARIANTS).map(([variantKey, variantConfig]) => (
                                    <option key={variantKey} value={variantKey}>
                                        {t(`admin.notesSection.calloutTypes.${variantKey}`, variantConfig.label)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="admin-note-callout-body">
                        <span className={`admin-note-callout-icon admin-note-callout-icon-${block.calloutType || 'info'}`} aria-hidden="true">
                            <CalloutIcon type={block.calloutType || 'info'} size={16} />
                        </span>
                        {readOnly ? (
                            <div className="admin-note-callout-text">{block.text || ''}</div>
                        ) : (
                            <textarea
                                value={block.text || ''}
                                placeholder={blockPlaceholder}
                                aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                                onChange={(event) => updateBlock?.(block.id, { text: fitTextareaValue(event) })}
                            />
                        )}
                    </div>
                </div>
            ) : block.type === 'heading' ? (
                <div className="admin-note-heading-wrap">
                    {readOnly ? (
                        <h2 className="admin-note-heading-display">
                            {block.text || block.label || ''}
                        </h2>
                    ) : (
                        <textarea
                            className="admin-note-heading-input"
                            value={block.text || block.label || ''}
                            onChange={(event) => updateBlock?.(block.id, { text: fitTextareaValue(event) })}
                            placeholder={blockPlaceholder}
                            aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                            rows={1}
                        />
                    )}
                </div>
            ) : block.type === 'todo' ? (
                <div className="admin-note-todo-wrap">
                    {block.label && <div className="admin-note-todo-label">{block.label}</div>}
                    <div className="admin-note-todo-items">
                        {(Array.isArray(block.todos) ? block.todos : [{ text: block.text, checked: block.checked }]).map((item, idx) => (
                            <div key={item.id || idx} className={`admin-note-todo-row${item.checked ? ' is-checked' : ''}`}>
                                <input
                                    type="checkbox"
                                    checked={Boolean(item.checked)}
                                    disabled={readOnly}
                                    onChange={readOnly ? undefined : (e) => {
                                        const newTodos = [...(block.todos || [])];
                                        newTodos[idx] = { ...item, checked: e.target.checked };
                                        updateBlock?.(block.id, { todos: newTodos });
                                    }}
                                />
                                <span className="admin-note-todo-text">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                readOnly ? (
                    <div className="admin-note-static-fallback">
                        {block.text}
                    </div>
                ) : (
                    <textarea
                        value={block.text}
                        onChange={(event) => updateBlock?.(block.id, { text: fitTextareaValue(event) })}
                        placeholder={blockPlaceholder}
                        aria-label={t(`admin.notesSection.blockTypes.${block.type}`, type.label)}
                        rows={block.type === 'text' ? 3 : 1}
                    />
                )
            )}

            {!readOnly && (
                <button
                    type="button"
                    className="admin-note-block-remove"
                    onClick={() => removeBlock?.(block.id)}
                    aria-label={t('admin.notesSection.widgetsDetail.removeBlock')}
                    title={t('admin.notesSection.widgetsDetail.removeBlock')}
                >
                    x
                </button>
            )}
            {!readOnly && block.type !== 'divider' && (
                <button
                    type="button"
                    className="admin-note-block-resize"
                    aria-label={t('admin.notesSection.widgetsDetail.resizeWidget')}
                    title={t('admin.notesSection.widgetsDetail.resizeWidget')}
                    onPointerDown={(event) => startBlockResize?.(event, block)}
                    onPointerMove={(event) => updateBlockResize?.(event, block)}
                    onPointerUp={finishBlockResize}
                    onPointerCancel={finishBlockResize}
                >
                    ⤢
                </button>
            )}
        </div>
    );
};
