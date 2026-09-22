import React, { useState, useEffect, useRef } from 'react';
import { assistantApi } from '../../../utils/assistantApi';
import { renderAssistantMarkdown } from '../../../utils/markdownUtils';

const AIAssistantDrawer = ({ isOpen, onClose, initialQuery = '' }) => {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Hello Prajwal. I have direct access to your workspace tools (tasks, schedule, budget, notes, emails). How can I assist with your operations today?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            toolCalls: [],
            confirmations: [],
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmingId, setConfirmingId] = useState(null);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const isNearBottomRef = useRef(true);

    const handleScroll = () => {
        const el = chatContainerRef.current;
        if (!el) return;
        const threshold = 100;
        const isNear = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
        isNearBottomRef.current = isNear;
    };

    const scrollToBottomIfNear = () => {
        if (isNearBottomRef.current && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    };

    useEffect(() => {
        if (isOpen) {
            isNearBottomRef.current = true;
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
            if (initialQuery && initialQuery.trim()) {
                handleSend(initialQuery);
            }
        }
    }, [isOpen, initialQuery]);

    useEffect(() => {
        scrollToBottomIfNear();
    }, [messages, loading]);

    const handleSend = async (textToSend = null) => {
        const query = (textToSend || input).trim();
        if (!query || loading) return;

        const userMsg = {
            role: 'user',
            content: query,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const msgId = Date.now();
        const placeholderAssistantMsg = {
            id: msgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            toolCalls: [],
            confirmations: [],
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, userMsg, placeholderAssistantMsg]);
        setInput('');
        setLoading(true);

        try {
            await assistantApi.streamChatMessage(query, 'admin_session', {
                onToken: (token) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === msgId
                                ? { ...msg, content: msg.content + token, isStreaming: true }
                                : msg
                        )
                    );
                },
                onTool: (tool) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === msgId
                                ? { ...msg, toolCalls: [...(msg.toolCalls || []), tool] }
                                : msg
                        )
                    );
                },
                onDone: (data) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === msgId
                                ? {
                                      ...msg,
                                      content: data.reply || msg.content || 'I processed your request.',
                                      toolCalls: data.toolCallsExecuted || msg.toolCalls || [],
                                      confirmations: data.pendingConfirmations || [],
                                      source: data.source,
                                      cacheStats: data.cacheStats || null,
                                      isStreaming: false,
                                  }
                                : msg
                        )
                    );
                    setLoading(false);
                },
                onError: (err) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === msgId
                                ? {
                                      ...msg,
                                      content: msg.content
                                          ? `${msg.content}\n\n*(Stream disconnected: ${err.message})*`
                                          : `Error: ${err.message || 'Unable to connect to assistant.'}`,
                                      isError: true,
                                      isStreaming: false,
                                  }
                                : msg
                        )
                    );
                    setLoading(false);
                },
            });
        } catch (err) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === msgId
                        ? {
                              ...msg,
                              content: `Error: ${err.message || 'Unable to connect to assistant.'}`,
                              isError: true,
                              isStreaming: false,
                          }
                        : msg
                )
            );
            setLoading(false);
        }
    };

    const handleConfirmAction = async (confirmationId, confirmed) => {
        setConfirmingId(confirmationId);
        try {
            const res = await assistantApi.confirmAction(confirmationId, confirmed);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: res.message || (confirmed ? 'Action confirmed and executed successfully.' : 'Action cancelled.'),
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ]);
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    content: `Confirmation failed: ${err.message}`,
                    isError: true,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ]);
        } finally {
            setConfirmingId(null);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="ai-drawer-overlay is-open" onClick={onClose} role="dialog" aria-modal="true">
            <div className="ai-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="ai-box">
                    {/* Header */}
                    <div className="ai-box-header">
                        <div className="ai-box-title-group">
                            <div className="ai-box-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z" />
                                    <path d="M9 9h.01" />
                                    <path d="M15 9h.01" />
                                    <path d="M10 13c.5.5 1.5.5 2 0" />
                                </svg>
                            </div>
                            <div className="ai-box-titles">
                                <h3 className="ai-box-title">Operations & Productivity Analyst</h3>
                                <div className="ai-box-status">
                                    <span className="ai-status-indicator status-online" />
                                    <span className="ai-status-text">Active Context Memory</span>
                                </div>
                            </div>
                        </div>
                        <div className="ai-box-header-actions">
                            <button
                                type="button"
                                className="ai-box-close-btn"
                                onClick={onClose}
                                title="Close Assistant"
                                aria-label="Close Assistant"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages Container */}
                    <div className="ai-box-messages" ref={chatContainerRef} onScroll={handleScroll}>
                        {messages.map((msg, index) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={index} className={`ai-msg ${isUser ? 'is-user' : 'is-assistant'}`}>
                                    {!isUser && (
                                        <div className="ai-msg-avatar">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="ai-msg-bubble">
                                        <div className="ai-msg-sender">{isUser ? 'You' : 'Claude'}</div>
                                        {msg.isStreaming && !msg.content ? (
                                            <div style={{ color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.2rem 0' }}>
                                                <span className="ai-stream-pulse" />
                                                Claude is analyzing context...
                                            </div>
                                        ) : (
                                            <div className="ai-msg-text ai-msg-markdown">
                                                <span dangerouslySetInnerHTML={{ __html: renderAssistantMarkdown(msg.content) }} />
                                                {msg.isStreaming && <span className="ai-stream-cursor" />}
                                            </div>
                                        )}

                                        {/* Tool execution badges */}
                                        {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                                            <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                                {msg.toolCalls.map((tool, tIdx) => (
                                                    <span
                                                        key={tIdx}
                                                        style={{
                                                            fontSize: '0.68rem',
                                                            background: 'rgba(59, 130, 246, 0.1)',
                                                            color: '#2563eb',
                                                            padding: '0.15rem 0.45rem',
                                                            borderRadius: '4px',
                                                            fontWeight: '500',
                                                        }}
                                                    >
                                                        Tool: {tool.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Sensitive Action Confirmations */}
                                        {Array.isArray(msg.confirmations) && msg.confirmations.length > 0 && (
                                            <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {msg.confirmations.map((conf, cIdx) => (
                                                    <div key={cIdx} className="ai-proposal-card">
                                                        <div className="ai-proposal-top">
                                                            <span className="ai-proposal-tag">
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                                    <line x1="12" y1="9" x2="12" y2="13" />
                                                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                                                </svg>
                                                                Confirmation Required
                                                            </span>
                                                        </div>
                                                        <p className="ai-proposal-title">{conf.summary || conf.action}</p>
                                                        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.2rem 0' }}>
                                                            {conf.message}
                                                        </p>
                                                        <div className="ai-proposal-actions">
                                                            <button
                                                                type="button"
                                                                className="ai-btn-confirm"
                                                                disabled={confirmingId === conf.confirmationId}
                                                                onClick={() => handleConfirmAction(conf.confirmationId, true)}
                                                            >
                                                                {confirmingId === conf.confirmationId ? 'Executing...' : 'Approve Action'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ai-btn-ghost"
                                                                style={{ width: 'auto', padding: '0.35rem 0.7rem', fontSize: '0.775rem' }}
                                                                disabled={confirmingId === conf.confirmationId}
                                                                onClick={() => handleConfirmAction(conf.confirmationId, false)}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="ai-msg-time">{msg.timestamp}</div>
                                    </div>
                                </div>
                            );
                        })}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Footer */}
                    <div className="ai-box-footer">
                        <div className="ai-box-input-wrap">
                            <textarea
                                className="ai-box-textarea"
                                placeholder="Ask your assistant anything or give an action instruction..."
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="ai-btn-confirm"
                                style={{ borderRadius: '6px', padding: '0.45rem 0.85rem' }}
                                onClick={() => handleSend()}
                                disabled={loading || !input.trim()}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantDrawer;
