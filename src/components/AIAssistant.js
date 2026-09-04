import React, { useState, useRef, useEffect } from 'react';
import { requestAI, checkAIHealth } from '../utils/aiApi';
import {
    SparklesIcon,
    XIcon,
    SendIcon,
    RefreshIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    ClockIcon,
    TasksIcon,
    NotesIcon,
    SpendingIcon,
} from './admin/AdminIcons';

const QUICK_ACTIONS = [
    {
        id: 'focus_today',
        label: 'Focus Today',
        icon: <ClockIcon width={13} height={13} />,
        prompt: 'What should I focus on today? Recommend top priorities from my tasks and schedule.',
    },
    {
        id: 'summarize_overdue',
        label: 'Overdue Tasks',
        icon: <AlertTriangleIcon width={13} height={13} />,
        prompt: 'Summarize all overdue tasks and tell me what is most urgent.',
    },
    {
        id: 'analyze_spending',
        label: 'Spending',
        icon: <SpendingIcon width={13} height={13} />,
        prompt: 'Analyze my spending this month, top categories, and cash flow balance.',
    },
    {
        id: 'summarize_notes',
        label: 'Notes',
        icon: <NotesIcon width={13} height={13} />,
        prompt: 'Summarize recent notes and highlight key takeaways.',
    },
];

const AIAssistant = ({ isOpen = true, onClose, onTaskCreated, embedded = false }) => {
    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello Prajwal! I'm your local AI assistant running on your local Ollama instance (Mistral).\n\nAsk me anything about your tasks, notes, or spending!",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [connectionInfo, setConnectionInfo] = useState({ status: 'checking', model: 'mistral' });
    const [actionStatus, setActionStatus] = useState({});

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);
    const lastRequestRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        verifyHealth();
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const verifyHealth = async () => {
        setConnectionInfo((prev) => ({ ...prev, status: 'checking' }));
        const health = await checkAIHealth();
        setConnectionInfo(health);
    };

    const handleSendMessage = async (textToSend = null, actionId = null) => {
        const text = (textToSend !== null ? textToSend : input).trim();
        if (!text && !actionId) return;

        lastRequestRef.current = { text, actionId };
        setError('');

        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text || (actionId ? `Run ${actionId.replace(/_/g, ' ')}` : ''),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const aiMsgId = `ai-${Date.now()}`;
        const initialAiMsg = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            proposedActions: [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, userMsg, initialAiMsg]);
        if (textToSend === null) setInput('');
        setIsLoading(true);

        try {
            const history = messages
                .filter((m) => m.id !== 'welcome')
                .slice(-6)
                .map((m) => ({ role: m.role, content: m.content }));

            const chatMessages = [...history];
            if (text) {
                chatMessages.push({ role: 'user', content: text });
            }

            const result = await requestAI(chatMessages, {
                action: actionId,
                query: text,
                onToken: (token, fullContent) => {
                    setIsLoading(false);
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === aiMsgId ? { ...m, content: fullContent } : m
                        )
                    );
                },
            });

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiMsgId
                        ? {
                              ...m,
                              content: result.content || result.reply || m.content,
                              proposedActions: result.proposedActions || [],
                              isStreaming: false,
                          }
                        : m
                )
            );
            setConnectionInfo((prev) => ({
                status: 'connected',
                model: result.model || prev.model || 'mistral',
            }));
        } catch (err) {
            console.error('AI Request Error:', err);
            setError(err.message || 'Failed to connect to local Ollama. Please check if Ollama is running.');
            setMessages((prev) => prev.filter((m) => m.id !== aiMsgId || m.content));
            if (
                err.message?.includes('unreachable') ||
                err.message?.includes('Cannot connect to Ollama') ||
                err.message?.includes('Failed to fetch') ||
                err.message?.includes('ECONNREFUSED')
            ) {
                setConnectionInfo((prev) => ({ ...prev, status: 'offline' }));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (action) => {
        handleSendMessage(action.prompt, action.id);
    };

    const handleConfirmTaskAction = async (action, actionKey) => {
        setActionStatus((prev) => ({ ...prev, [actionKey]: 'saving' }));
        try {
            const res = await fetch('/api/todo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: action.payload.title,
                    priority: action.payload.priority || 'medium',
                    dueDate: action.payload.dueDate || null,
                    completed: false,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create task');
            }

            setActionStatus((prev) => ({ ...prev, [actionKey]: 'saved' }));
            if (onTaskCreated) onTaskCreated();
        } catch (err) {
            alert(`Could not create task: ${err.message}`);
            setActionStatus((prev) => ({ ...prev, [actionKey]: 'error' }));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const clearConversation = () => {
        setMessages([
            {
                id: 'welcome',
                role: 'assistant',
                content: "Conversation cleared. How can I help you today?",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ]);
        setError('');
        verifyHealth();
    };

    if (!isOpen && !embedded) return null;

    const chatContent = (
        <div className={`ai-box ${embedded ? 'is-embedded' : 'is-drawer'}`}>
            {/* Header */}
            <div className="ai-box-header">
                <div className="ai-box-title-group">
                    <div className="ai-box-icon">
                        <SparklesIcon width={16} height={16} />
                    </div>
                    <div>
                        <h3 className="ai-box-title">Local AI Assistant</h3>
                        <div
                            className="ai-box-status"
                            onClick={verifyHealth}
                            style={{ cursor: 'pointer' }}
                            title="Click to re-check Ollama status"
                        >
                            <span
                                className={`ai-status-indicator ${
                                    connectionInfo.status === 'connected'
                                        ? 'status-online'
                                        : connectionInfo.status === 'checking'
                                        ? 'status-checking'
                                        : 'status-offline'
                                }`}
                            />
                            <span className="ai-status-text">
                                {connectionInfo.status === 'connected'
                                    ? `Ollama • ${connectionInfo.model || 'mistral'}`
                                    : connectionInfo.status === 'checking'
                                    ? 'Checking Ollama...'
                                    : 'Ollama Offline (click to check)'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="ai-box-actions">
                    <button
                        type="button"
                        className="ai-btn-ghost"
                        onClick={clearConversation}
                        title="Clear conversation"
                        aria-label="Clear chat"
                    >
                        <RefreshIcon width={14} height={14} />
                    </button>
                    {!embedded && onClose && (
                        <button
                            type="button"
                            className="ai-btn-ghost"
                            onClick={onClose}
                            title="Close assistant"
                            aria-label="Close"
                        >
                            <XIcon width={15} height={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Body */}
            <div className="ai-box-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`ai-msg ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                        {msg.role === 'assistant' && (
                            <div className="ai-msg-avatar" aria-hidden="true">
                                <SparklesIcon width={13} height={13} />
                            </div>
                        )}
                        <div className="ai-msg-bubble">
                            <div className="ai-msg-text">
                                {!msg.content && msg.isStreaming ? (
                                    <div className="ai-typing-inline">
                                        <div className="ai-typing-dots">
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                        <span className="ai-loading-label">Thinking with local Ollama...</span>
                                    </div>
                                ) : (
                                    <>
                                        {(msg.content || '').split('\n').map((line, idx) => {
                                            if (!line.trim()) return <div key={idx} className="ai-msg-spacer" />;
                                            if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
                                                return <h4 key={idx} className="ai-msg-heading">{line.replace(/^#+\s*/, '')}</h4>;
                                            }
                                            if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
                                                return (
                                                    <div key={idx} className="ai-msg-bullet">
                                                        <span className="ai-bullet-dot">•</span>
                                                        <span>{line.replace(/^[-*•]\s*/, '')}</span>
                                                    </div>
                                                );
                                            }
                                            if (/^\d+\.\s/.test(line)) {
                                                return (
                                                    <div key={idx} className="ai-msg-numbered">
                                                        <span>{line}</span>
                                                    </div>
                                                );
                                            }
                                            if (line.includes('action:create_task') || line.includes('```')) {
                                                return null;
                                            }
                                            return <p key={idx}>{line}</p>;
                                        })}
                                        {msg.isStreaming && <span className="ai-stream-cursor" />}
                                    </>
                                )}
                            </div>

                            {/* Structured Proposed Actions */}
                            {Array.isArray(msg.proposedActions) && msg.proposedActions.length > 0 && (
                                <div className="ai-proposals">
                                    <div className="ai-proposals-header">
                                        <TasksIcon width={13} height={13} />
                                        <span>Suggested Action:</span>
                                    </div>
                                    {msg.proposedActions.map((act, actIdx) => {
                                        const actionKey = `${msg.id}-${actIdx}`;
                                        const status = actionStatus[actionKey];
                                        if (status === 'dismissed') return null;

                                        return (
                                            <div key={actIdx} className="ai-proposal-card">
                                                <div className="ai-proposal-details">
                                                    <span className="ai-proposal-tag">Create Task</span>
                                                    <h5 className="ai-proposal-title">{act.payload.title}</h5>
                                                    <div className="ai-proposal-meta">
                                                        <span className={`badge-pill badge-${act.payload.priority || 'medium'}`}>
                                                            {(act.payload.priority || 'medium').toUpperCase()}
                                                        </span>
                                                        {act.payload.dueDate && (
                                                            <span className="ai-due-badge">
                                                                <ClockIcon width={11} height={11} />
                                                                {act.payload.dueDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="ai-proposal-actions">
                                                    {status === 'saved' ? (
                                                        <div className="ai-proposal-success">
                                                            <CheckCircleIcon width={14} height={14} />
                                                            <span>Task Added</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="ai-btn-confirm"
                                                                onClick={() => handleConfirmTaskAction(act, actionKey)}
                                                                disabled={status === 'saving'}
                                                            >
                                                                {status === 'saving' ? 'Adding...' : 'Confirm & Add'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ai-btn-dismiss"
                                                                onClick={() => setActionStatus((p) => ({ ...p, [actionKey]: 'dismissed' }))}
                                                            >
                                                                Dismiss
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <span className="ai-msg-time">{msg.timestamp}</span>
                        </div>
                    </div>
                ))}



                {error && (
                    <div className="ai-error-banner">
                        <AlertTriangleIcon width={15} height={15} />
                        <div className="ai-error-content">
                            <p className="ai-error-text">{error}</p>
                            <button
                                type="button"
                                className="ai-retry-btn"
                                onClick={() => {
                                    if (lastRequestRef.current) {
                                        handleSendMessage(lastRequestRef.current.text, lastRequestRef.current.actionId);
                                    } else {
                                        verifyHealth();
                                    }
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="ai-box-chips">
                {QUICK_ACTIONS.map((qa) => (
                    <button
                        key={qa.id}
                        type="button"
                        className="ai-chip"
                        onClick={() => handleQuickAction(qa)}
                        disabled={isLoading}
                    >
                        {qa.icon}
                        <span>{qa.label}</span>
                    </button>
                ))}
            </div>

            {/* Input Box */}
            <div className="ai-box-footer">
                <div className="ai-box-input-wrap">
                    <textarea
                        ref={textareaRef}
                        className="ai-box-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask local AI about tasks, notes, or spending..."
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        className="ai-box-send"
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || !input.trim()}
                        aria-label="Send message"
                    >
                        <SendIcon width={15} height={15} />
                    </button>
                </div>
                <div className="ai-box-privacy">
                    🔒 Processed 100% locally on your laptop via Ollama ({connectionInfo.model || 'mistral'}).
                </div>
            </div>
        </div>
    );

    if (embedded) {
        return chatContent;
    }

    return (
        <div className={`ai-drawer-overlay ${isOpen ? 'is-open' : ''}`} onClick={onClose}>
            <aside className="ai-drawer" role="dialog" aria-label="Local AI Assistant" onClick={(e) => e.stopPropagation()}>
                {chatContent}
            </aside>
        </div>
    );
};

export default AIAssistant;
