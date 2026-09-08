import React, { useState, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import {
    requestAI,
    checkAIHealth,
    fetchConversations,
    fetchConversation,
    saveConversation,
    deleteConversation,
    fetchMemories,
    deleteMemory,
    fetchGoals,
    createGoal,
    deleteGoal,
    fetchProjects,
    createProject,
    deleteProject,
    createMemory,
    fetchDailyBriefing,
    fetchAIPreferences,
    saveAIPreferences,
} from '../utils/aiApi';
import {
    SparklesIcon,
    XIcon,
    SendIcon,
    RefreshIcon,
    CheckCircleIcon,
    AlertTriangleIcon,
    ClockIcon,
    CalendarIcon,
    PlusIcon,
    TasksIcon,
    NotesIcon,
    SpendingIcon,
} from './admin/AdminIcons';

// Configure marked with syntax highlighting and responsive table wrapping
const customRenderer = new marked.Renderer();
customRenderer.code = function ({ text, lang }) {
    let highlighted = text;
    try {
        if (lang && hljs.getLanguage(lang)) {
            highlighted = hljs.highlight(text, { language: lang }).value;
        } else {
            highlighted = hljs.highlightAuto(text).value;
        }
    } catch {
        highlighted = text;
    }
    const langLabel = lang ? `<span class="ai-code-lang">${lang}</span>` : '';
    return `<div class="ai-code-wrapper"><div class="ai-code-header">${langLabel}</div><pre class="ai-code-block"><code class="hljs ${lang || ''}">${highlighted}</code></pre></div>`;
};

marked.use({
    renderer: customRenderer,
    breaks: true,
    gfm: true,
    hooks: {
        postprocess(html) {
            return html.replace(/<table>([\s\S]*?)<\/table>/g, '<div class="ai-table-wrapper"><table class="ai-table">$1</table></div>');
        },
    },
});

function renderMarkdown(content) {
    if (!content) return '';
    // Strip action proposal code blocks so they only render as interactive proposal cards
    let cleaned = content.replace(/```(?:action|json):(create_task|create_goal|create_project|remember_fact|forget_memory)[\s\S]*?```/g, '').trim();

    // If the model wrapped the entire response in conversational ```markdown ... ``` or ```text ... ```, unwrap it so it formats as clean typography
    const wrapperMatch = cleaned.match(/^```(?:markdown|text|plaintext)?\s*\n([\s\S]*?)\n```$/i);
    if (wrapperMatch && !wrapperMatch[1].includes('```')) {
        cleaned = wrapperMatch[1].trim();
    }

    try {
        return marked.parse(cleaned);
    } catch {
        return cleaned;
    }
}

function formatNewsDateTime(dateStr) {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            return dateStr.length > 22 ? dateStr.slice(0, 22) : dateStr;
        }
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        const timePart = d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });

        if (diffMins >= 0 && diffMins < 60) {
            return `${diffMins <= 1 ? 'Just now' : `${diffMins}m ago`} (${timePart})`;
        }
        if (d.toDateString() === now.toDateString() || (diffHours >= 0 && diffHours < 18)) {
            return `Today, ${timePart}`;
        }
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) {
            return `Yesterday, ${timePart}`;
        }
        const datePart = d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
        return `${datePart}, ${timePart}`;
    } catch {
        return null;
    }
}

function formatExecutiveBriefingMarkdown(b) {
    if (!b) return 'Unable to load briefing.';
    const today = b.dayOfWeek ? `${b.dayOfWeek}, ${b.date}` : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const summary = b.summary?.body || b.executiveSummary || '';
    
    let glance = '';
    if (b.at_a_glance && b.at_a_glance.length > 0) {
        glance = b.at_a_glance.map((i) => `**${i.value}** ${i.label.toLowerCase()}`).join(' · ');
    }

    let out = `# Good Morning\n*${today}*\n\n${summary}\n\n`;
    if (glance) {
        out += `> ${glance}\n\n---\n\n`;
    }

    if (b.recommendation?.action) {
        out += `### 💡 WHAT I'D DO FIRST\n**${b.recommendation.action}**\n\n*${b.recommendation.reason || ''}*\n\n---\n\n`;
    }

    if (b.watch_items && b.watch_items.length > 0) {
        out += `### ⚠️ TODAY'S WATCH\n`;
        for (const w of b.watch_items) {
            out += `- **${w.title}**: ${w.message || w.reason}\n`;
        }
        out += `\n---\n\n`;
    }

    const overdue = b.priorities?.overdue || [];
    const todayTasks = b.priorities?.today || [];
    const upNext = b.priorities?.upNext || [];

    if (overdue.length > 0 || todayTasks.length > 0 || upNext.length > 0) {
        out += `### 📋 YOUR PRIORITIES\n\n`;
        if (overdue.length > 0) {
            out += `**OVERDUE (${overdue.length})**\n`;
            for (const t of overdue) {
                out += `- [ ] **${t.title}** (${t.priority} priority · ${t.reason || `${t.daysOverdue}d overdue`})\n`;
            }
            out += `\n`;
        }
        if (todayTasks.length > 0) {
            out += `**DUE TODAY (${todayTasks.length})**\n`;
            for (const t of todayTasks) {
                out += `- [ ] **${t.title}** (${t.priority} priority)\n`;
            }
            out += `\n`;
        }
        if (upNext.length > 0) {
            out += `**UP NEXT**\n`;
            for (const t of upNext) {
                out += `- [ ] **${t.title}** (${t.reason || t.dueDate})\n`;
            }
            out += `\n`;
        }
        out += `---\n\n`;
    }

    if (b.news && b.news.length > 0) {
        out += `### 📰 TOP DEVELOPMENTS\n\n`;
        for (const n of b.news.slice(0, 7)) {
            const timeStr = formatNewsDateTime(n.pubDate || n.published_at || n.date);
            out += `**${(n.source || 'News').toUpperCase()}${timeStr ? ` · ${timeStr}` : ''}**\n`;
            out += `[${n.title}](${n.url})\n\n`;
            if (n.summary && n.summary !== n.title) {
                out += `${n.summary}\n\n`;
            }
            if (n.why_it_matters) {
                out += `> **Why it matters:** ${n.why_it_matters}\n\n`;
            }
        }
    }

    return out.trim();
}



const AIAssistant = ({
    isOpen = true,
    onClose,
    onTaskCreated,
    onNoteCreated,
    embedded = false,
    initialPrompt = '',
    autoTriggerAction = null,
}) => {
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [showSessionMenu, setShowSessionMenu] = useState(false);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [memoryTab, setMemoryTab] = useState('memories'); // 'memories' | 'goals' | 'projects'

    // Save Chat to Note state
    const [showSaveNoteModal, setShowSaveNoteModal] = useState(false);
    const [saveNoteTitle, setSaveNoteTitle] = useState('');
    const [saveNoteFolder, setSaveNoteFolder] = useState('AI Chats');
    const [availableFolders, setAvailableFolders] = useState(['AI Chats', 'General', 'Work', 'Ideas']);
    const [isCreatingCustomFolder, setIsCreatingCustomFolder] = useState(false);
    const [customFolderName, setCustomFolderName] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);
    const [saveNoteSuccess, setSaveNoteSuccess] = useState('');

    const [memories, setMemories] = useState([]);
    const [goals, setGoals] = useState([]);
    const [projects, setProjects] = useState([]);
    const [newFactInput, setNewFactInput] = useState('');

    // Active Goals state
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalCategory, setNewGoalCategory] = useState('General');
    const [newGoalTargetDate, setNewGoalTargetDate] = useState('');
    const [newGoalDesc, setNewGoalDesc] = useState('');
    const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
    const [showAddGoalForm, setShowAddGoalForm] = useState(false);

    // Ongoing Projects state
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectTargetDate, setNewProjectTargetDate] = useState('');
    const [newProjectTags, setNewProjectTags] = useState('');
    const [newProjectDesc, setNewProjectDesc] = useState('');
    const [isSubmittingProject, setIsSubmittingProject] = useState(false);
    const [showAddProjectForm, setShowAddProjectForm] = useState(false);

    // Persistent Context & Rules state
    const [contextPrefs, setContextPrefs] = useState({
        identity: {
            userName: '',
            currencySymbol: '$',
            temperatureUnit: 'fahrenheit',
            windUnit: 'mph',
        },
        locations: [],
        weatherAlerts: {
            rainChanceThreshold: 50,
            heatThresholdF: 90,
            heatThresholdC: 32,
        },
        newsPreferences: {
            topics: [],
            excludedTopics: [],
            maxAgeDays: 3,
        },
        actionGapTopics: [],
        horizons: {
            upcomingTaskDays: 7,
            goalWarningDays: 30,
            goalUrgencyDays: 7,
            noteTaskDueDays: 7,
            budgetAlertRatio: 0.9,
            ayanaMonths: 6,
        },
        systemInstructions: '',
        customDirectives: '',
        quickActions: [],
    });
    const [newLocationInput, setNewLocationInput] = useState('');
    const [newNewsTopicInput, setNewNewsTopicInput] = useState('');
    const [newExcludedTopicInput, setNewExcludedTopicInput] = useState('');
    const [newGapTermInput, setNewGapTermInput] = useState('');
    const [newGapLabelInput, setNewGapLabelInput] = useState('');
    const [newActionLabel, setNewActionLabel] = useState('');
    const [newActionPrompt, setNewActionPrompt] = useState('');
    const [isSavingPrefs, setIsSavingPrefs] = useState(false);
    const [prefsSaveSuccess, setPrefsSaveSuccess] = useState('');
    const [prefsError, setPrefsError] = useState('');

    const [messages, setMessages] = useState([
        {
            id: 'welcome',
            role: 'assistant',
            content: "How can I help you today? Ask about your tasks, budget, notes, or plan your week.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [connectionInfo, setConnectionInfo] = useState({ status: 'checking', model: 'mistral' });
    const [actionStatus, setActionStatus] = useState({});

    const messagesContainerRef = useRef(null);
    const textareaRef = useRef(null);
    const lastRequestRef = useRef(null);

    const scrollToBottom = () => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    };

    const loadConversationsList = useCallback(async () => {
        try {
            const list = await fetchConversations();
            setConversations(Array.isArray(list) ? list : []);
        } catch (e) {
            console.warn('Could not load conversations list:', e);
        }
    }, []);

    const loadPersistentContextData = useCallback(async () => {
        try {
            const [mList, gList, pList, prefs] = await Promise.all([
                fetchMemories().catch(() => []),
                fetchGoals('active').catch(() => []),
                fetchProjects('active').catch(() => []),
                fetchAIPreferences().catch(() => null),
            ]);
            setMemories(Array.isArray(mList) ? mList : []);
            setGoals(Array.isArray(gList) ? gList : []);
            setProjects(Array.isArray(pList) ? pList : []);
            if (prefs) {
                setContextPrefs({
                    identity: {
                        userName: prefs.identity?.userName || '',
                        currencySymbol: prefs.identity?.currencySymbol || '$',
                        temperatureUnit: prefs.identity?.temperatureUnit || 'fahrenheit',
                        windUnit: prefs.identity?.windUnit || 'mph',
                    },
                    locations: Array.isArray(prefs.locations) ? prefs.locations : [],
                    weatherAlerts: {
                        rainChanceThreshold: prefs.weatherAlerts?.rainChanceThreshold ?? 50,
                        heatThresholdF: prefs.weatherAlerts?.heatThresholdF ?? 90,
                        heatThresholdC: prefs.weatherAlerts?.heatThresholdC ?? 32,
                    },
                    newsPreferences: {
                        topics: Array.isArray(prefs.newsPreferences?.topics) ? prefs.newsPreferences.topics : [],
                        excludedTopics: Array.isArray(prefs.newsPreferences?.excludedTopics) ? prefs.newsPreferences.excludedTopics : [],
                        maxAgeDays: prefs.newsPreferences?.maxAgeDays ?? 3,
                    },
                    actionGapTopics: Array.isArray(prefs.actionGapTopics) ? prefs.actionGapTopics : [],
                    horizons: {
                        upcomingTaskDays: prefs.horizons?.upcomingTaskDays ?? 7,
                        goalWarningDays: prefs.horizons?.goalWarningDays ?? 30,
                        goalUrgencyDays: prefs.horizons?.goalUrgencyDays ?? 7,
                        noteTaskDueDays: prefs.horizons?.noteTaskDueDays ?? 7,
                        budgetAlertRatio: prefs.horizons?.budgetAlertRatio ?? 0.9,
                        ayanaMonths: prefs.horizons?.ayanaMonths ?? 6,
                    },
                    systemInstructions: prefs.systemInstructions || '',
                    customDirectives: prefs.customDirectives || '',
                    quickActions: Array.isArray(prefs.quickActions) ? prefs.quickActions : [],
                });
            }
        } catch (e) {
            console.warn('Could not load memory/goal/preferences data:', e);
        }
    }, []);

    const verifyHealth = async () => {
        setConnectionInfo((prev) => ({ ...prev, status: 'checking' }));
        const health = await checkAIHealth();
        setConnectionInfo(health);
    };

    useEffect(() => {
        verifyHealth();
        loadConversationsList();
        loadPersistentContextData();
    }, [loadConversationsList, loadPersistentContextData]);

    const handleSelectConversation = async (convId) => {
        setShowSessionMenu(false);
        if (!convId) {
            // Start brand new conversation
            setActiveConversationId(null);
            setMessages([
                {
                    id: 'welcome',
                    role: 'assistant',
                    content: "New chat session started. Persistent memories, goals, and dashboard data remain fully accessible.",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                },
            ]);
            return;
        }

        try {
            setIsLoading(true);
            const conv = await fetchConversation(convId);
            setActiveConversationId(conv.id);
            if (Array.isArray(conv.messages) && conv.messages.length > 0) {
                setMessages(conv.messages);
                setTimeout(scrollToBottom, 50);
            } else {
                setMessages([
                    {
                        id: 'welcome',
                        role: 'assistant',
                        content: `Switched to "${conv.title}". How can I help you?`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                ]);
            }
        } catch (err) {
            setError(`Could not load conversation: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConversation = async (e, convId) => {
        e.stopPropagation();
        try {
            await deleteConversation(convId);
            setConversations((prev) => prev.filter((c) => c.id !== convId));
            if (activeConversationId === convId) {
                handleSelectConversation(null);
            }
        } catch (err) {
            alert(`Could not delete conversation: ${err.message}`);
        }
    };

    const handleOpenSaveNoteModal = async () => {
        let initialTitle = '';
        if (activeConversationId) {
            const activeConv = conversations.find((c) => c.id === activeConversationId);
            if (activeConv?.title) initialTitle = activeConv.title;
        }
        if (!initialTitle) {
            const firstUserMsg = messages.find((m) => m.role === 'user');
            if (firstUserMsg) {
                const preview = firstUserMsg.content.slice(0, 38).replace(/\n+/g, ' ').trim();
                initialTitle = `Chat: ${preview}${firstUserMsg.content.length > 38 ? '...' : ''}`;
            } else {
                initialTitle = `AI Chat - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            }
        }
        setSaveNoteTitle(initialTitle);
        setIsCreatingCustomFolder(false);
        setCustomFolderName('');
        setSaveNoteSuccess('');

        // Fetch user's existing note folders
        try {
            const res = await fetch('/api/notes', { credentials: 'include' });
            if (res.ok) {
                const allNotes = await res.json();
                const fetchedFolders = Array.from(new Set(allNotes.map((n) => n.folder).filter(Boolean)));
                const combined = Array.from(new Set(['AI Chats', ...fetchedFolders, 'General']));
                setAvailableFolders(combined);
            }
        } catch {
            // fallback
        }

        setShowSaveNoteModal(true);
    };

    const handleSaveChatToNote = async (e) => {
        e.preventDefault();
        if (!saveNoteTitle.trim()) return;

        const folderToUse = (isCreatingCustomFolder ? customFolderName.trim() : saveNoteFolder) || 'General';

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });

        let noteMarkdown = `# ${saveNoteTitle.trim()}\n*Saved from AI Assistant on ${dateStr}*\n\n---\n\n`;

        const meaningfulMessages = messages.filter((m) => m.id !== 'welcome');
        if (meaningfulMessages.length === 0) {
            noteMarkdown += `*(No conversation messages recorded)*\n`;
        } else {
            noteMarkdown += meaningfulMessages
                .map((m) => {
                    const roleLabel = m.role === 'user' ? '👤 **You**' : '🤖 **AI Assistant**';
                    const timeLabel = m.timestamp ? ` *(${m.timestamp})*` : '';
                    const cleanContent = (m.content || '')
                        .replace(/```(?:action|json):(create_task|create_goal|create_project|remember_fact|forget_memory)[\s\S]*?```/g, '')
                        .trim();
                    return `### ${roleLabel}${timeLabel}\n\n${cleanContent}\n`;
                })
                .join('\n---\n\n');
        }

        setIsSavingNote(true);
        try {
            const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    title: saveNoteTitle.trim(),
                    content: noteMarkdown,
                    folder: folderToUse,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create note');
            }

            setSaveNoteSuccess(`Saved to "${folderToUse}" as a new note!`);
            if (onNoteCreated) onNoteCreated();

            setTimeout(() => {
                setShowSaveNoteModal(false);
                setSaveNoteSuccess('');
            }, 1200);
        } catch (err) {
            alert(`Could not save note: ${err.message}`);
        } finally {
            setIsSavingNote(false);
        }
    };

    const autoTriggeredRef = useRef(false);

    useEffect(() => {
        if (isOpen && (autoTriggerAction || initialPrompt) && !autoTriggeredRef.current) {
            autoTriggeredRef.current = true;
            handleSendMessage(initialPrompt || null, autoTriggerAction || null);
        }
        if (!isOpen) {
            autoTriggeredRef.current = false;
        }
    }, [isOpen, autoTriggerAction, initialPrompt]);

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
        setTimeout(scrollToBottom, 50);

        // Directly format daily briefing with executive assistant synthesis
        if (actionId === 'daily_briefing') {
            try {
                const briefing = await fetchDailyBriefing(false);
                const md = formatExecutiveBriefingMarkdown(briefing);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === aiMsgId
                            ? {
                                  ...m,
                                  content: md,
                                  proposedActions: [],
                                  isStreaming: false,
                              }
                            : m
                    )
                );
                setIsLoading(false);
                return;
            } catch (err) {
                console.warn('Direct briefing fetch fallback:', err);
            }
        }

        try {
            const history = messages
                .filter((m) => m.id !== 'welcome')
                .slice(-8)
                .map((m) => ({ role: m.role, content: m.content }));

            const chatMessages = [...history];
            if (text) {
                chatMessages.push({ role: 'user', content: text });
            }

            const result = await requestAI(chatMessages, {
                action: actionId,
                query: text,
                conversationId: activeConversationId,
                onToken: (token, fullContent) => {
                    setIsLoading(false);
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === aiMsgId ? { ...m, content: fullContent } : m
                        )
                    );
                },
            });

            const finalContent = result.content || result.reply || '';
            const proposedActions = result.proposedActions || [];

            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiMsgId
                        ? {
                              ...m,
                              content: finalContent,
                              proposedActions,
                              isStreaming: false,
                          }
                        : m
                )
            );

            // If a conversationId was created or updated on server
            if (result.conversationId && result.conversationId !== activeConversationId) {
                setActiveConversationId(result.conversationId);
                loadConversationsList();
            } else if (!activeConversationId) {
                // Save conversation session to db
                try {
                    const saved = await saveConversation({
                        title: text ? text.slice(0, 30) : 'Chat Session',
                        messages: [...messages.filter((m) => m.id !== 'welcome'), userMsg, {
                            ...initialAiMsg,
                            content: finalContent,
                            proposedActions,
                            isStreaming: false,
                        }],
                    });
                    if (saved?.id) {
                        setActiveConversationId(saved.id);
                        loadConversationsList();
                    }
                } catch {
                    // non-fatal
                }
            }

            // Refresh context if memory/goal action occurred
            if (result.memoryAction || proposedActions.length > 0) {
                loadPersistentContextData();
            }

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

    const handleTriggerDailyBriefing = async (forceRefresh = false) => {
        if (isLoading) return;
        setError('');

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMsg = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: forceRefresh ? '🔄 Refreshing Executive Daily Briefing...' : '🌅 Daily Briefing',
            timestamp: timeStr,
        };

        const aiMsgId = `ai-${Date.now() + 1}`;
        const initialAiMsg = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            isBriefing: true,
            streamingStatus: forceRefresh
                ? 'Refreshing live weather, priority tasks, active goals & news...'
                : "Compiling today's executive intelligence report...",
            timestamp: timeStr,
        };

        setMessages((prev) => [...prev, userMsg, initialAiMsg]);
        setIsLoading(true);
        setTimeout(scrollToBottom, 50);

        try {
            const briefingData = await fetchDailyBriefing(forceRefresh);
            const executiveReport = briefingData?.executiveSummary || 'No executive summary available.';
            const proposedActions = [];
            for (const obs of briefingData?.observations || []) {
                if (obs.actionProposal) proposedActions.push(obs.actionProposal);
            }

            const finalAiMsg = {
                id: aiMsgId,
                role: 'assistant',
                content: executiveReport,
                isStreaming: false,
                isBriefing: true,
                briefing: briefingData,
                proposedActions,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessages((prev) =>
                prev.map((m) => (m.id === aiMsgId ? finalAiMsg : m))
            );

            // Persist to current conversation session in background
            try {
                let convId = activeConversationId;
                if (!convId) {
                    const saved = await saveConversation({
                        title: `Daily Briefing (${briefingData?.dayOfWeek || new Date().toLocaleDateString()})`,
                        messages: [...messages, userMsg, finalAiMsg],
                    });
                    if (saved?.id) {
                        setActiveConversationId(saved.id);
                        loadConversationsList();
                    }
                } else {
                    await saveConversation({
                        id: convId,
                        messages: [...messages, userMsg, finalAiMsg],
                    });
                }
            } catch (saveErr) {
                console.warn('Could not auto-save briefing conversation:', saveErr);
            }
        } catch (err) {
            console.error('Daily Briefing Error:', err);
            setError(`Could not generate daily briefing: ${err.message}`);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === aiMsgId
                        ? {
                              ...m,
                              content: `⚠️ Failed to compile daily briefing: ${err.message}. Please check connection or try again.`,
                              isStreaming: false,
                          }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickAction = (action) => {
        if (action.id === 'daily_briefing') {
            handleTriggerDailyBriefing(false);
            return;
        }
        handleSendMessage(action.prompt, action.id);
    };

    const prevTriggerRef = useRef({ initialPrompt, autoTriggerAction, isOpen });
    useEffect(() => {
        if (!isOpen) {
            prevTriggerRef.current = { initialPrompt, autoTriggerAction, isOpen };
            return;
        }

        const timer = setTimeout(() => {
            textareaRef.current?.focus();
        }, 150);

        const hasPromptChanged = initialPrompt && initialPrompt !== prevTriggerRef.current.initialPrompt;
        const hasActionChanged = autoTriggerAction && autoTriggerAction !== prevTriggerRef.current.autoTriggerAction;
        const justOpenedWithPrompt = !prevTriggerRef.current.isOpen && (initialPrompt || autoTriggerAction);

        if (hasActionChanged || (justOpenedWithPrompt && autoTriggerAction === 'daily_briefing')) {
            if (autoTriggerAction === 'daily_briefing') {
                handleTriggerDailyBriefing(false);
            }
        } else if (hasPromptChanged || (justOpenedWithPrompt && initialPrompt)) {
            handleSendMessage(initialPrompt);
        }

        prevTriggerRef.current = { initialPrompt, autoTriggerAction, isOpen };

        const handleEsc = (e) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEsc);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, initialPrompt, autoTriggerAction, onClose]);

    // Action Proposal Confirmation Handler
    const handleConfirmAction = async (action, actionKey) => {
        setActionStatus((prev) => ({ ...prev, [actionKey]: 'saving' }));
        try {
            if (action.type === 'CREATE_TASK') {
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
                if (!res.ok) throw new Error('Failed to create task');
                if (onTaskCreated) onTaskCreated();
            } else if (action.type === 'CREATE_GOAL') {
                await createGoal({
                    title: action.payload.title,
                    description: action.payload.description || '',
                    targetDate: action.payload.targetDate || null,
                    category: action.payload.category || 'General',
                });
                loadPersistentContextData();
            } else if (action.type === 'DELETE_GOAL') {
                if (action.payload?.id) {
                    await deleteGoal(action.payload.id);
                    loadPersistentContextData();
                }
            } else if (action.type === 'CREATE_PROJECT') {
                await createProject({
                    name: action.payload.name,
                    description: action.payload.description || '',
                    targetDate: action.payload.targetDate || null,
                    tags: action.payload.tags || [],
                });
                loadPersistentContextData();
            } else if (action.type === 'DELETE_PROJECT') {
                if (action.payload?.id) {
                    await deleteProject(action.payload.id);
                    loadPersistentContextData();
                }
            } else if (action.type === 'REMEMBER_FACT') {
                await createMemory({
                    fact: action.payload.fact,
                    category: action.payload.category || 'general',
                    tags: action.payload.tags || [],
                    importance: 4,
                });
                loadPersistentContextData();
            } else if (action.type === 'FORGET_MEMORY') {
                await deleteMemory({
                    id: action.payload.id,
                    query: action.payload.query,
                });
                loadPersistentContextData();
            }

            setActionStatus((prev) => ({ ...prev, [actionKey]: 'saved' }));
        } catch (err) {
            alert(`Action failed: ${err.message}`);
            setActionStatus((prev) => ({ ...prev, [actionKey]: 'error' }));
        }
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();
        if (!newGoalTitle.trim()) return;
        setIsSubmittingGoal(true);
        try {
            await createGoal({
                title: newGoalTitle.trim(),
                category: newGoalCategory || 'General',
                targetDate: newGoalTargetDate || null,
                description: newGoalDesc.trim(),
            });
            setNewGoalTitle('');
            setNewGoalCategory('General');
            setNewGoalTargetDate('');
            setNewGoalDesc('');
            setShowAddGoalForm(false);
            await loadPersistentContextData();
        } catch (err) {
            alert(`Could not add goal: ${err.message}`);
        } finally {
            setIsSubmittingGoal(false);
        }
    };

    const handleDeleteGoalItem = async (goalId) => {
        if (!window.confirm('Are you sure you want to delete this active goal?')) return;
        try {
            await deleteGoal(goalId);
            setGoals((prev) => prev.filter((g) => g.id !== goalId));
            loadPersistentContextData();
        } catch (err) {
            alert(`Could not delete goal: ${err.message}`);
        }
    };

    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        setIsSubmittingProject(true);
        try {
            const tags = newProjectTags
                .split(',')
                .map((t) => t.trim().replace(/^#/, ''))
                .filter(Boolean);
            await createProject({
                name: newProjectName.trim(),
                targetDate: newProjectTargetDate || null,
                tags,
                description: newProjectDesc.trim(),
            });
            setNewProjectName('');
            setNewProjectTargetDate('');
            setNewProjectTags('');
            setNewProjectDesc('');
            setShowAddProjectForm(false);
            await loadPersistentContextData();
        } catch (err) {
            alert(`Could not add project: ${err.message}`);
        } finally {
            setIsSubmittingProject(false);
        }
    };

    const handleDeleteProjectItem = async (projectId) => {
        if (!window.confirm('Are you sure you want to delete this ongoing project?')) return;
        try {
            await deleteProject(projectId);
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
            loadPersistentContextData();
        } catch (err) {
            alert(`Could not delete project: ${err.message}`);
        }
    };

    const handleAddManualFact = async (e) => {
        e.preventDefault();
        if (!newFactInput.trim()) return;
        try {
            await createMemory({ fact: newFactInput.trim(), category: 'fact', importance: 4 });
            setNewFactInput('');
            loadPersistentContextData();
        } catch (err) {
            alert(`Could not save fact: ${err.message}`);
        }
    };

    const handleDeleteMemoryFact = async (memId) => {
        try {
            await deleteMemory({ id: memId });
            setMemories((prev) => prev.filter((m) => m.id !== memId));
        } catch (err) {
            alert(`Could not delete memory: ${err.message}`);
        }
    };

    const handleDeleteLocation = (idxToRemove) => {
        setContextPrefs((prev) => ({
            ...prev,
            locations: prev.locations.filter((_, i) => i !== idxToRemove),
        }));
    };

    const handleAddLocation = (e) => {
        e.preventDefault();
        const clean = newLocationInput.trim();
        if (!clean) return;
        if (contextPrefs.locations.includes(clean)) {
            setNewLocationInput('');
            return;
        }
        setContextPrefs((prev) => ({
            ...prev,
            locations: [...prev.locations, clean],
        }));
        setNewLocationInput('');
    };

    const handleDeleteNewsTopic = (idxToRemove) => {
        setContextPrefs((prev) => ({
            ...prev,
            newsPreferences: {
                ...prev.newsPreferences,
                topics: prev.newsPreferences.topics.filter((_, i) => i !== idxToRemove),
            },
        }));
    };

    const handleAddNewsTopic = (e) => {
        e.preventDefault();
        const clean = newNewsTopicInput.trim();
        if (!clean) return;
        if (contextPrefs.newsPreferences.topics.includes(clean)) {
            setNewNewsTopicInput('');
            return;
        }
        setContextPrefs((prev) => ({
            ...prev,
            newsPreferences: {
                ...prev.newsPreferences,
                topics: [...prev.newsPreferences.topics, clean],
            },
        }));
        setNewNewsTopicInput('');
    };

    const handleDeleteExcludedTopic = (idxToRemove) => {
        setContextPrefs((prev) => ({
            ...prev,
            newsPreferences: {
                ...prev.newsPreferences,
                excludedTopics: prev.newsPreferences.excludedTopics.filter((_, i) => i !== idxToRemove),
            },
        }));
    };

    const handleAddExcludedTopic = (e) => {
        e.preventDefault();
        const clean = newExcludedTopicInput.trim();
        if (!clean) return;
        if (contextPrefs.newsPreferences.excludedTopics.includes(clean)) {
            setNewExcludedTopicInput('');
            return;
        }
        setContextPrefs((prev) => ({
            ...prev,
            newsPreferences: {
                ...prev.newsPreferences,
                excludedTopics: [...prev.newsPreferences.excludedTopics, clean],
            },
        }));
        setNewExcludedTopicInput('');
    };

    const handleDeleteGapTopic = (idxToRemove) => {
        setContextPrefs((prev) => ({
            ...prev,
            actionGapTopics: prev.actionGapTopics.filter((_, i) => i !== idxToRemove),
        }));
    };

    const handleAddGapTopic = (e) => {
        e.preventDefault();
        const term = newGapTermInput.trim().toLowerCase();
        if (!term) return;
        const label = newGapLabelInput.trim() || term.charAt(0).toUpperCase() + term.slice(1);
        setContextPrefs((prev) => ({
            ...prev,
            actionGapTopics: [...prev.actionGapTopics, { term, label }],
        }));
        setNewGapTermInput('');
        setNewGapLabelInput('');
    };

    const handleDeleteQuickAction = (idxToRemove) => {
        setContextPrefs((prev) => ({
            ...prev,
            quickActions: (prev.quickActions || []).filter((_, i) => i !== idxToRemove),
        }));
    };

    const handleAddQuickAction = (e) => {
        e.preventDefault();
        const label = newActionLabel.trim();
        const prompt = newActionPrompt.trim();
        if (!label || !prompt) return;
        const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
        setContextPrefs((prev) => ({
            ...prev,
            quickActions: [...(prev.quickActions || []), { id, label, prompt }],
        }));
        setNewActionLabel('');
        setNewActionPrompt('');
    };

    const handleSaveContextPreferences = async () => {
        try {
            setIsSavingPrefs(true);
            setPrefsError('');
            setPrefsSaveSuccess('');
            await saveAIPreferences(contextPrefs);
            setPrefsSaveSuccess('Persistent context & rules saved successfully!');
            setTimeout(() => setPrefsSaveSuccess(''), 4000);
        } catch (err) {
            setPrefsError(err.message || 'Failed to save context preferences');
        } finally {
            setIsSavingPrefs(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const clearConversation = () => {
        handleSelectConversation(null);
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
                        <div className="ai-box-title-row">
                            <h3 className="ai-box-title">Dashboard Intelligence</h3>
                            <button
                                type="button"
                                className="ai-pill-badge"
                                onClick={() => setShowMemoryModal(true)}
                                title="Context Actions (Persistent Context, Memories, Goals, Projects)"
                            >
                                Context Actions
                            </button>
                        </div>
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
                    {/* Conversations dropdown toggle */}
                    <div className="ai-session-toggle-wrap">
                        <button
                            type="button"
                            className="ai-btn-ghost ai-btn-sessions"
                            onClick={() => setShowSessionMenu((p) => !p)}
                            title="Conversation Sessions"
                            aria-label="Conversation History"
                        >
                            <CalendarIcon width={14} height={14} />
                            <span className="ai-sessions-count">{conversations.length}</span>
                        </button>

                        {showSessionMenu && (
                            <div className="ai-sessions-dropdown">
                                <div className="ai-sessions-header">
                                    <span>Conversations</span>
                                    <button
                                        type="button"
                                        className="ai-btn-new-chat"
                                        onClick={() => handleSelectConversation(null)}
                                    >
                                        + New Chat
                                    </button>
                                </div>
                                <div className="ai-sessions-list">
                                    {conversations.length === 0 ? (
                                        <p className="ai-sessions-empty">No saved conversations yet.</p>
                                    ) : (
                                        conversations.map((c) => (
                                            <div
                                                key={c.id}
                                                className={`ai-session-item ${c.id === activeConversationId ? 'is-active' : ''}`}
                                                onClick={() => handleSelectConversation(c.id)}
                                            >
                                                <div className="ai-session-item-info">
                                                    <span className="ai-session-item-title">{c.title}</span>
                                                    <span className="ai-session-item-meta">
                                                        {c.messageCount || 0} messages • {c.lastActive?.slice(5, 10)}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="ai-session-item-del"
                                                    onClick={(e) => handleDeleteConversation(e, c.id)}
                                                    title="Delete session"
                                                >
                                                    <XIcon width={12} height={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        className="ai-btn-ghost"
                        onClick={handleOpenSaveNoteModal}
                        title="Save current chat to a new note"
                        aria-label="Save chat to note"
                        disabled={messages.filter((m) => m.id !== 'welcome').length === 0}
                    >
                        <NotesIcon width={14} height={14} />
                    </button>

                    <button
                        type="button"
                        className="ai-btn-ghost"
                        onClick={clearConversation}
                        title="New / Clear Chat"
                        aria-label="Clear chat"
                    >
                        <RefreshIcon width={14} height={14} />
                    </button>
                    {onClose && (
                        <button
                            type="button"
                            className="ai-btn-ghost"
                            onClick={onClose}
                            title={embedded ? 'Collapse assistant' : 'Close assistant'}
                            aria-label={embedded ? 'Collapse assistant' : 'Close assistant'}
                        >
                            <XIcon width={15} height={15} />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages Body */}
            <div className="ai-box-messages" ref={messagesContainerRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`ai-msg ${msg.role === 'user' ? 'is-user' : 'is-assistant is-ai'}`}>
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
                                        <span className="ai-loading-label">{msg.streamingStatus || 'Synthesizing with local Ollama...'}</span>
                                    </div>
                                ) : (
                                    <div className="ai-msg-formatted">
                                        {msg.isBriefing || (typeof msg.content === 'string' && msg.content.includes('Executive Daily Briefing')) ? (
                                            <div className="ai-executive-report-container">
                                                <div className="ai-executive-report-topbar">
                                                    <div className="ai-executive-badge">
                                                        <SparklesIcon width={13} height={13} />
                                                        <span>Executive Intelligence Briefing</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="ai-executive-refresh-btn"
                                                        onClick={() => handleTriggerDailyBriefing(true)}
                                                        disabled={isLoading}
                                                        title="Live Refresh Briefing"
                                                    >
                                                        <RefreshIcon width={12} height={12} />
                                                        <span>Live Refresh</span>
                                                    </button>
                                                </div>
                                                <div
                                                    className="dash-briefing-report-body ai-executive-report-body"
                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="ai-msg-markdown"
                                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                            />
                                        )}
                                        {msg.isStreaming && <span className="ai-stream-cursor" />}
                                    </div>
                                )}
                            </div>

                            {/* Structured Proposed Actions (Interactive Cards) */}
                            {Array.isArray(msg.proposedActions) && msg.proposedActions.length > 0 && (
                                <div className="ai-proposals">
                                    <div className="ai-proposals-header">
                                        <SparklesIcon width={12} height={12} />
                                        <span>Action Proposal</span>
                                    </div>
                                    {msg.proposedActions.map((act, actIdx) => {
                                        const actionKey = `${msg.id}-${actIdx}`;
                                        const status = actionStatus[actionKey];
                                        if (status === 'dismissed') return null;

                                        const isTask = act.type === 'CREATE_TASK';
                                        const isGoal = act.type === 'CREATE_GOAL';
                                        const isProject = act.type === 'CREATE_PROJECT';
                                        const isRemember = act.type === 'REMEMBER_FACT';
                                        const isForget = act.type === 'FORGET_MEMORY';

                                        const title =
                                            act.payload?.title ||
                                            act.payload?.name ||
                                            act.payload?.fact ||
                                            (isForget ? `Forget: ${act.payload?.query || 'memory'}` : 'Proposed Action');

                                        return (
                                            <div key={actIdx} className={`ai-proposal-card ${status === 'saved' ? 'is-saved' : ''}`}>
                                                <div className="ai-proposal-top">
                                                    <span className="ai-proposal-tag">
                                                        {isTask && <TasksIcon width={12} height={12} />}
                                                        {isGoal && <CalendarIcon width={12} height={12} />}
                                                        {isProject && <SparklesIcon width={12} height={12} />}
                                                        {isRemember && <span>🧠</span>}
                                                        {isForget && <span>🗑️</span>}
                                                        <span>
                                                            {isTask && 'Create Task'}
                                                            {isGoal && 'Set Goal'}
                                                            {isProject && 'New Project'}
                                                            {isRemember && 'Remember Fact'}
                                                            {isForget && 'Forget Memory'}
                                                        </span>
                                                    </span>
                                                    <div className="ai-proposal-meta">
                                                        {act.payload?.priority && (
                                                            <span className={`ai-priority-badge priority-${act.payload.priority}`}>
                                                                {act.payload.priority.toUpperCase()}
                                                            </span>
                                                        )}
                                                        {act.payload?.targetDate && (
                                                            <span className="ai-due-badge">
                                                                <CalendarIcon width={11} height={11} />
                                                                <span>Target: {act.payload.targetDate}</span>
                                                            </span>
                                                        )}
                                                        {act.payload?.dueDate && (
                                                            <span className="ai-due-badge">
                                                                <CalendarIcon width={11} height={11} />
                                                                <span>Due: {act.payload.dueDate}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <h5 className="ai-proposal-title">{title}</h5>
                                                {act.payload?.description && (
                                                    <p className="ai-proposal-desc">{act.payload.description}</p>
                                                )}

                                                <div className="ai-proposal-actions">
                                                    {status === 'saved' ? (
                                                        <div className="ai-proposal-success">
                                                            <CheckCircleIcon width={14} height={14} />
                                                            <span>Action Confirmed & Saved</span>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="ai-btn-confirm"
                                                                onClick={() => handleConfirmAction(act, actionKey)}
                                                                disabled={status === 'saving'}
                                                            >
                                                                <PlusIcon width={13} height={13} />
                                                                <span>{status === 'saving' ? 'Saving...' : 'Confirm & Save'}</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="ai-btn-dismiss"
                                                                onClick={() => setActionStatus((p) => ({ ...p, [actionKey]: 'dismissed' }))}
                                                                title="Dismiss suggestion"
                                                            >
                                                                <XIcon width={12} height={12} />
                                                                <span>Dismiss</span>
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
            </div>

            {/* Quick Action Chips */}
            {contextPrefs.quickActions && contextPrefs.quickActions.length > 0 && (
                <div className="ai-box-chips">
                    {contextPrefs.quickActions.map((qa) => (
                        <button
                            key={qa.id || qa.label}
                            type="button"
                            className="ai-chip"
                            onClick={() => handleQuickAction(qa)}
                            disabled={isLoading}
                        >
                            <SparklesIcon width={13} height={13} />
                            <span>{qa.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Input Box */}
            <div className="ai-box-footer">
                <div className="ai-box-input-wrap">
                    <textarea
                        ref={textareaRef}
                        className="ai-box-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything, plan your week, or check goals..."
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
                    🔒 State & Memory stored in database • Local Ollama ({connectionInfo.model || 'mistral'}).
                </div>
            </div>

            {/* Context & Memory Inspection Modal */}
            {showMemoryModal && (
                <div className="ai-memory-modal-backdrop" onClick={() => setShowMemoryModal(false)}>
                    <div className="ai-memory-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ai-memory-modal-header">
                            <div className="ai-memory-modal-title">
                                <h3>Persistent Context & Memory</h3>
                                <p>Database-owned facts and goals informing all AI interactions</p>
                            </div>
                            <button
                                type="button"
                                className="ai-btn-ghost"
                                onClick={() => setShowMemoryModal(false)}
                            >
                                <XIcon width={16} height={16} />
                            </button>
                        </div>

                        <div className="ai-memory-modal-tabs">
                            <button
                                type="button"
                                className={`ai-tab-btn ${memoryTab === 'memories' ? 'active' : ''}`}
                                onClick={() => setMemoryTab('memories')}
                            >
                                Long-Term Facts ({memories.length})
                            </button>
                            <button
                                type="button"
                                className={`ai-tab-btn ${memoryTab === 'goals' ? 'active' : ''}`}
                                onClick={() => setMemoryTab('goals')}
                            >
                                Active Goals ({goals.length})
                            </button>
                            <button
                                type="button"
                                className={`ai-tab-btn ${memoryTab === 'projects' ? 'active' : ''}`}
                                onClick={() => setMemoryTab('projects')}
                            >
                                Ongoing Projects ({projects.length})
                            </button>
                            <button
                                type="button"
                                className={`ai-tab-btn ${memoryTab === 'context' ? 'active' : ''}`}
                                onClick={() => setMemoryTab('context')}
                            >
                                Context & Rules
                            </button>
                        </div>

                        <div className="ai-memory-modal-body">
                            {memoryTab === 'memories' && (
                                <div className="ai-memories-pane">
                                    <form onSubmit={handleAddManualFact} className="ai-memory-add-form">
                                        <input
                                            type="text"
                                            value={newFactInput}
                                            onChange={(e) => setNewFactInput(e.target.value)}
                                            placeholder="Add a new fact to remember (e.g. 'Prefers dark mode')..."
                                        />
                                        <button type="submit" className="dash-btn dash-btn-primary">
                                            Remember
                                        </button>
                                    </form>

                                    {memories.length === 0 ? (
                                        <p className="admin-empty">No facts in long-term memory yet.</p>
                                    ) : (
                                        <ul className="ai-memory-list">
                                            {memories.map((m) => (
                                                <li key={m.id} className="ai-memory-item">
                                                    <div className="ai-memory-item-content">
                                                        <span className="ai-memory-fact">{m.fact}</span>
                                                        {m.tags && m.tags.length > 0 && (
                                                            <div className="ai-memory-item-tags">
                                                                {m.tags.map((t, idx) => (
                                                                    <span key={idx} className="dash-tag">
                                                                        #{t}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="ai-btn-ghost"
                                                        onClick={() => handleDeleteMemoryFact(m.id)}
                                                        title="Forget memory"
                                                    >
                                                        <XIcon width={13} height={13} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {memoryTab === 'goals' && (
                                <div className="ai-goals-pane">
                                    <div className="ai-modal-pane-header">
                                        <span className="ai-modal-pane-subtitle">
                                            Track strategic targets. Active goals sync with briefing observations and task priorities.
                                        </span>
                                        <button
                                            type="button"
                                            className="dash-btn dash-btn-sm dash-btn-secondary"
                                            onClick={() => setShowAddGoalForm((p) => !p)}
                                        >
                                            {showAddGoalForm ? 'Cancel' : '+ New Goal'}
                                        </button>
                                    </div>

                                    {showAddGoalForm && (
                                        <form onSubmit={handleAddGoal} className="ai-entity-add-card">
                                            <div className="ai-entity-form-grid">
                                                <div className="ai-entity-form-field">
                                                    <label>Goal Title *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="e.g. Launch Mobile App V1"
                                                        value={newGoalTitle}
                                                        onChange={(e) => setNewGoalTitle(e.target.value)}
                                                    />
                                                </div>
                                                <div className="ai-entity-form-field">
                                                    <label>Category</label>
                                                    <select
                                                        value={newGoalCategory}
                                                        onChange={(e) => setNewGoalCategory(e.target.value)}
                                                    >
                                                        <option value="General">General</option>
                                                        <option value="Career">Career</option>
                                                        <option value="Health">Health</option>
                                                        <option value="Personal">Personal</option>
                                                        <option value="Tech">Tech</option>
                                                        <option value="Finance">Finance</option>
                                                    </select>
                                                </div>
                                                <div className="ai-entity-form-field">
                                                    <label>Target Date</label>
                                                    <input
                                                        type="date"
                                                        value={newGoalTargetDate}
                                                        onChange={(e) => setNewGoalTargetDate(e.target.value)}
                                                    />
                                                </div>
                                                <div className="ai-entity-form-field full-width">
                                                    <label>Description / Milestones</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Complete beta testing, finalize store listing"
                                                        value={newGoalDesc}
                                                        onChange={(e) => setNewGoalDesc(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="ai-entity-form-actions">
                                                <button
                                                    type="button"
                                                    className="dash-btn dash-btn-ghost"
                                                    onClick={() => setShowAddGoalForm(false)}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="dash-btn dash-btn-primary"
                                                    disabled={isSubmittingGoal || !newGoalTitle.trim()}
                                                >
                                                    {isSubmittingGoal ? 'Adding...' : 'Add Active Goal'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {goals.length === 0 ? (
                                        <p className="admin-empty">No active goals registered yet. Click "+ New Goal" above to create one.</p>
                                    ) : (
                                        <div className="ai-goals-grid">
                                            {goals.map((g) => (
                                                <div key={g.id} className="ai-goal-card">
                                                    <div className="ai-goal-card-top">
                                                        <div className="ai-goal-title-group">
                                                            <span className="ai-goal-title">{g.title}</span>
                                                            <span className="dash-tag dash-tag-neutral">{g.category || 'General'}</span>
                                                        </div>
                                                        <div className="ai-goal-card-actions">
                                                            {g.targetDate && (
                                                                <span className="ai-goal-date">🎯 {g.targetDate}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="ai-card-delete-btn"
                                                                onClick={() => handleDeleteGoalItem(g.id)}
                                                                title="Delete goal"
                                                            >
                                                                <XIcon width={13} height={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="ai-goal-desc">{g.description || 'Active pursuit'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {memoryTab === 'projects' && (
                                <div className="ai-projects-pane">
                                    <div className="ai-modal-pane-header">
                                        <span className="ai-modal-pane-subtitle">
                                            Maintain awareness of ongoing codebases, initiatives, tech stacks, and due dates.
                                        </span>
                                        <button
                                            type="button"
                                            className="dash-btn dash-btn-sm dash-btn-secondary"
                                            onClick={() => setShowAddProjectForm((p) => !p)}
                                        >
                                            {showAddProjectForm ? 'Cancel' : '+ New Project'}
                                        </button>
                                    </div>

                                    {showAddProjectForm && (
                                        <form onSubmit={handleAddProject} className="ai-entity-add-card">
                                            <div className="ai-entity-form-grid">
                                                <div className="ai-entity-form-field">
                                                    <label>Project Name *</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="e.g. Personal Portfolio V2"
                                                        value={newProjectName}
                                                        onChange={(e) => setNewProjectName(e.target.value)}
                                                    />
                                                </div>
                                                <div className="ai-entity-form-field">
                                                    <label>Target / Due Date</label>
                                                    <input
                                                        type="date"
                                                        value={newProjectTargetDate}
                                                        onChange={(e) => setNewProjectTargetDate(e.target.value)}
                                                    />
                                                </div>
                                                <div className="ai-entity-form-field">
                                                    <label>Tags / Tech Stack</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. React, Node, AI"
                                                        value={newProjectTags}
                                                        onChange={(e) => setNewProjectTags(e.target.value)}
                                                    />
                                                </div>
                                                <div className="ai-entity-form-field full-width">
                                                    <label>Project Scope / Description</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Migrating to modern responsive design with AI features"
                                                        value={newProjectDesc}
                                                        onChange={(e) => setNewProjectDesc(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="ai-entity-form-actions">
                                                <button
                                                    type="button"
                                                    className="dash-btn dash-btn-ghost"
                                                    onClick={() => setShowAddProjectForm(false)}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="dash-btn dash-btn-primary"
                                                    disabled={isSubmittingProject || !newProjectName.trim()}
                                                >
                                                    {isSubmittingProject ? 'Adding...' : 'Add Project'}
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {projects.length === 0 ? (
                                        <p className="admin-empty">No ongoing projects tracked yet. Click "+ New Project" above to create one.</p>
                                    ) : (
                                        <div className="ai-projects-grid">
                                            {projects.map((p) => (
                                                <div key={p.id} className="ai-project-card">
                                                    <div className="ai-project-top">
                                                        <span className="ai-project-name">{p.name}</span>
                                                        <div className="ai-project-card-actions">
                                                            {p.targetDate && (
                                                                <span className="ai-project-target">Due: {p.targetDate}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="ai-card-delete-btn"
                                                                onClick={() => handleDeleteProjectItem(p.id)}
                                                                title="Delete project"
                                                            >
                                                                <XIcon width={13} height={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="ai-project-desc">{p.description || 'Ongoing project'}</p>
                                                    <div className="ai-project-tags">
                                                        {p.tags?.map((t, idx) => (
                                                            <span key={idx} className="dash-tag">
                                                                #{t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {memoryTab === 'context' && (
                                <div className="ai-context-pane">
                                    <div className="ai-context-header-bar">
                                        <div className="ai-context-header-info">
                                            <span className="ai-modal-pane-subtitle">
                                                Configure persistent rules, monitored locations, news feeds, horizon thresholds, and custom AI behavior. All items are user-editable and deletable.
                                            </span>
                                        </div>
                                        <div className="ai-context-header-actions">
                                            <button
                                                type="button"
                                                className="dash-btn dash-btn-sm dash-btn-primary"
                                                disabled={isSavingPrefs}
                                                onClick={handleSaveContextPreferences}
                                            >
                                                {isSavingPrefs ? 'Saving...' : 'Save Context & Rules'}
                                            </button>
                                        </div>
                                    </div>

                                    {prefsSaveSuccess && (
                                        <div className="ai-context-alert ai-context-alert-success">
                                            <CheckCircleIcon width={14} height={14} />
                                            <span>{prefsSaveSuccess}</span>
                                        </div>
                                    )}

                                    {prefsError && (
                                        <div className="ai-context-alert ai-context-alert-error">
                                            <AlertTriangleIcon width={14} height={14} />
                                            <span>{prefsError}</span>
                                        </div>
                                    )}

                                    {/* 1. Identity & System Units */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">Identity & System Units</h4>
                                            <p className="ai-context-section-desc">
                                                User identity and default units used when formatting currency, weather, and assistant replies.
                                            </p>
                                        </div>
                                        <div className="ai-context-grid-2">
                                            <div className="ai-context-field">
                                                <label>Preferred Name</label>
                                                <input
                                                    type="text"
                                                    placeholder="Enter your name (leave blank for generic AI)"
                                                    value={contextPrefs.identity.userName}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            identity: { ...p.identity, userName: e.target.value },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Currency Symbol</label>
                                                <input
                                                    type="text"
                                                    maxLength={4}
                                                    placeholder="$"
                                                    value={contextPrefs.identity.currencySymbol}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            identity: { ...p.identity, currencySymbol: e.target.value },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Temperature Unit</label>
                                                <select
                                                    value={contextPrefs.identity.temperatureUnit}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            identity: { ...p.identity, temperatureUnit: e.target.value },
                                                        }))
                                                    }
                                                >
                                                    <option value="fahrenheit">Fahrenheit (°F)</option>
                                                    <option value="celsius">Celsius (°C)</option>
                                                </select>
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Wind Speed Unit</label>
                                                <select
                                                    value={contextPrefs.identity.windUnit}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            identity: { ...p.identity, windUnit: e.target.value },
                                                        }))
                                                    }
                                                >
                                                    <option value="mph">Miles per hour (mph)</option>
                                                    <option value="kmh">Kilometers per hour (km/h)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. System Instructions & Directives */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">System Instructions & Tone Directives</h4>
                                            <p className="ai-context-section-desc">
                                                User-managed base prompt instructions and operational rules for the AI assistant. Leave blank to use system direct defaults.
                                            </p>
                                        </div>
                                        <div className="ai-context-field full-width" style={{ marginBottom: '0.85rem' }}>
                                            <label>Base System Instructions</label>
                                            <textarea
                                                rows={4}
                                                className="ai-context-textarea"
                                                placeholder="Custom system instructions governing core AI behavior, response style, and formatting rules..."
                                                value={contextPrefs.systemInstructions}
                                                onChange={(e) =>
                                                    setContextPrefs((p) => ({
                                                        ...p,
                                                        systemInstructions: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="ai-context-field full-width">
                                            <label>Custom Persona Directives & Behavioral Rules</label>
                                            <textarea
                                                rows={3}
                                                className="ai-context-textarea"
                                                placeholder="e.g. Always prioritize high-impact engineering deliverables. When summarizing spending, highlight recurring subscriptions..."
                                                value={contextPrefs.customDirectives}
                                                onChange={(e) =>
                                                    setContextPrefs((p) => ({
                                                        ...p,
                                                        customDirectives: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* 3. Quick Action Prompts */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">Quick Action Prompts ({contextPrefs.quickActions.length})</h4>
                                            <p className="ai-context-section-desc">
                                                One-click shortcut chips rendered on the assistant input bar. All items are user-editable and deletable.
                                            </p>
                                        </div>

                                        <div className="ai-gap-topics-list">
                                            {contextPrefs.quickActions.map((qa, idx) => (
                                                <div key={idx} className="ai-gap-topic-row">
                                                    <div className="ai-gap-topic-info">
                                                        <span className="ai-gap-term-badge">{qa.label}</span>
                                                        <span className="ai-gap-label" title={qa.prompt}>
                                                            {qa.prompt.length > 60 ? `${qa.prompt.slice(0, 60)}...` : qa.prompt}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="ai-card-delete-btn"
                                                        title={`Remove ${qa.label}`}
                                                        onClick={() => handleDeleteQuickAction(idx)}
                                                    >
                                                        <XIcon width={12} height={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            {contextPrefs.quickActions.length === 0 && (
                                                <p className="ai-empty-context-hint">
                                                    ✨ No quick action prompts configured. Add custom prompt chips below to display on the chat interface.
                                                </p>
                                            )}
                                        </div>

                                        <form onSubmit={handleAddQuickAction} className="ai-context-add-dual">
                                            <input
                                                type="text"
                                                placeholder="Button label (e.g. Plan My Day)..."
                                                value={newActionLabel}
                                                onChange={(e) => setNewActionLabel(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Prompt text to dispatch..."
                                                value={newActionPrompt}
                                                onChange={(e) => setNewActionPrompt(e.target.value)}
                                            />
                                            <button type="submit" className="dash-btn dash-btn-sm dash-btn-secondary" disabled={!newActionLabel.trim() || !newActionPrompt.trim()}>
                                                + Add Prompt
                                            </button>
                                        </form>
                                    </div>

                                    {/* 4. Monitored Locations */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">Monitored Locations ({contextPrefs.locations.length})</h4>
                                            <p className="ai-context-section-desc">
                                                Cities tracked for weather forecasts, precipitation alerts, and local news. If all are deleted, the AI will automatically discover locations from your active projects, goals, notes, and facts.
                                            </p>
                                        </div>

                                        <div className="ai-chip-group">
                                            {contextPrefs.locations.map((loc, idx) => (
                                                <span key={idx} className="ai-context-chip">
                                                    <span>{loc}</span>
                                                    <button
                                                        type="button"
                                                        className="ai-chip-delete"
                                                        title={`Remove ${loc}`}
                                                        onClick={() => handleDeleteLocation(idx)}
                                                    >
                                                        <XIcon width={11} height={11} />
                                                    </button>
                                                </span>
                                            ))}
                                            {contextPrefs.locations.length === 0 && (
                                                <p className="ai-empty-context-hint">
                                                    ✨ No fixed locations configured. The AI will discover geographic context dynamically from notes and projects.
                                                </p>
                                            )}
                                        </div>

                                        <form onSubmit={handleAddLocation} className="ai-context-add-inline">
                                            <input
                                                type="text"
                                                placeholder="Add location (e.g. San Francisco, CA or London, UK)..."
                                                value={newLocationInput}
                                                onChange={(e) => setNewLocationInput(e.target.value)}
                                            />
                                            <button type="submit" className="dash-btn dash-btn-sm dash-btn-secondary" disabled={!newLocationInput.trim()}>
                                                + Add Location
                                            </button>
                                        </form>
                                    </div>

                                    {/* 3. News Topics & Exclusions */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">News Synthesis Feed</h4>
                                            <p className="ai-context-section-desc">
                                                Followed topics, noise filters, and publication freshness limits for daily news briefings.
                                            </p>
                                        </div>

                                        <div className="ai-context-subgroup">
                                            <label className="ai-subgroup-label">Followed Topics ({contextPrefs.newsPreferences.topics.length}):</label>
                                            <div className="ai-chip-group">
                                                {contextPrefs.newsPreferences.topics.map((top, idx) => (
                                                    <span key={idx} className="ai-context-chip">
                                                        <span>{top}</span>
                                                        <button
                                                            type="button"
                                                            className="ai-chip-delete"
                                                            title={`Remove ${top}`}
                                                            onClick={() => handleDeleteNewsTopic(idx)}
                                                        >
                                                            <XIcon width={11} height={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                                {contextPrefs.newsPreferences.topics.length === 0 && (
                                                    <p className="ai-empty-context-hint">
                                                        ✨ No explicit topics configured. The AI discovers topics dynamically from your active goals and project tags.
                                                    </p>
                                                )}
                                            </div>
                                            <form onSubmit={handleAddNewsTopic} className="ai-context-add-inline">
                                                <input
                                                    type="text"
                                                    placeholder="Add topic (e.g. Artificial Intelligence, Clean Energy)..."
                                                    value={newNewsTopicInput}
                                                    onChange={(e) => setNewNewsTopicInput(e.target.value)}
                                                />
                                                <button type="submit" className="dash-btn dash-btn-sm dash-btn-secondary" disabled={!newNewsTopicInput.trim()}>
                                                    + Add Topic
                                                </button>
                                            </form>
                                        </div>

                                        <div className="ai-context-subgroup" style={{ marginTop: '0.85rem' }}>
                                            <label className="ai-subgroup-label">Excluded Topics / Noise Filters ({contextPrefs.newsPreferences.excludedTopics.length}):</label>
                                            <div className="ai-chip-group">
                                                {contextPrefs.newsPreferences.excludedTopics.map((top, idx) => (
                                                    <span key={idx} className="ai-context-chip ai-context-chip-muted">
                                                        <span>{top}</span>
                                                        <button
                                                            type="button"
                                                            className="ai-chip-delete"
                                                            title={`Remove ${top}`}
                                                            onClick={() => handleDeleteExcludedTopic(idx)}
                                                        >
                                                            <XIcon width={11} height={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                                {contextPrefs.newsPreferences.excludedTopics.length === 0 && (
                                                    <p className="ai-empty-context-hint">No excluded topics set.</p>
                                                )}
                                            </div>
                                            <form onSubmit={handleAddExcludedTopic} className="ai-context-add-inline">
                                                <input
                                                    type="text"
                                                    placeholder="Exclude topic (e.g. Celebrity Gossip, Sports Rumors)..."
                                                    value={newExcludedTopicInput}
                                                    onChange={(e) => setNewExcludedTopicInput(e.target.value)}
                                                />
                                                <button type="submit" className="dash-btn dash-btn-sm dash-btn-secondary" disabled={!newExcludedTopicInput.trim()}>
                                                    + Add Exclusion
                                                </button>
                                            </form>
                                        </div>

                                        <div className="ai-context-grid-2" style={{ marginTop: '0.85rem' }}>
                                            <div className="ai-context-field">
                                                <label>Max Article Age (Days)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="30"
                                                    value={contextPrefs.newsPreferences.maxAgeDays}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            newsPreferences: {
                                                                ...p.newsPreferences,
                                                                maxAgeDays: parseInt(e.target.value, 10) || 3,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Action Gap Detection Concepts */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">Action Gap Detection Anchors ({contextPrefs.actionGapTopics.length})</h4>
                                            <p className="ai-context-section-desc">
                                                Concepts and keywords used to scan recent notes for unlogged tasks, commitments, or deadlines.
                                            </p>
                                        </div>

                                        <div className="ai-gap-topics-list">
                                            {contextPrefs.actionGapTopics.map((item, idx) => (
                                                <div key={idx} className="ai-gap-topic-row">
                                                    <div className="ai-gap-topic-info">
                                                        <span className="ai-gap-term-badge">"{item.term}"</span>
                                                        <span className="ai-gap-label">{item.label}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="ai-card-delete-btn"
                                                        title={`Remove ${item.term}`}
                                                        onClick={() => handleDeleteGapTopic(idx)}
                                                    >
                                                        <XIcon width={12} height={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            {contextPrefs.actionGapTopics.length === 0 && (
                                                <p className="ai-empty-context-hint">
                                                    ✨ No explicit gap concepts configured. The AI will use natural language detection for open commitments.
                                                </p>
                                            )}
                                        </div>

                                        <form onSubmit={handleAddGapTopic} className="ai-context-add-dual">
                                            <input
                                                type="text"
                                                placeholder="Term/keyword (e.g. prototype)..."
                                                value={newGapTermInput}
                                                onChange={(e) => setNewGapTermInput(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Concept label (e.g. Hardware Prototypes)..."
                                                value={newGapLabelInput}
                                                onChange={(e) => setNewGapLabelInput(e.target.value)}
                                            />
                                            <button type="submit" className="dash-btn dash-btn-sm dash-btn-secondary" disabled={!newGapTermInput.trim()}>
                                                + Add Concept
                                            </button>
                                        </form>
                                    </div>

                                    {/* 5. Horizons & Alert Thresholds */}
                                    <div className="ai-context-section">
                                        <div className="ai-context-section-header">
                                            <h4 className="ai-context-section-title">Horizons & Alert Thresholds</h4>
                                            <p className="ai-context-section-desc">
                                                Temporal windows for upcoming tasks, stale goal warnings, and weather/budget alert triggers.
                                            </p>
                                        </div>
                                        <div className="ai-context-grid-3">
                                            <div className="ai-context-field">
                                                <label>Upcoming Tasks (Days)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={contextPrefs.horizons.upcomingTaskDays}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                upcomingTaskDays: parseInt(e.target.value, 10) || 7,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Stale Goal Warning (Days)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    value={contextPrefs.horizons.goalWarningDays}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                goalWarningDays: parseInt(e.target.value, 10) || 30,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Goal Urgency Cutoff (Days)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="90"
                                                    value={contextPrefs.horizons.goalUrgencyDays}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                goalUrgencyDays: parseInt(e.target.value, 10) || 7,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Rain Alert Threshold (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={contextPrefs.weatherAlerts.rainChanceThreshold}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            weatherAlerts: {
                                                                ...p.weatherAlerts,
                                                                rainChanceThreshold: parseInt(e.target.value, 10) || 50,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Heat Alert ({contextPrefs.identity.temperatureUnit === 'celsius' ? '°C' : '°F'})</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="150"
                                                    value={contextPrefs.identity.temperatureUnit === 'celsius' ? contextPrefs.weatherAlerts.heatThresholdC : contextPrefs.weatherAlerts.heatThresholdF}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value, 10) || 0;
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            weatherAlerts: {
                                                                ...p.weatherAlerts,
                                                                ...(p.identity.temperatureUnit === 'celsius'
                                                                    ? { heatThresholdC: val, heatThresholdF: Math.round((val * 9) / 5 + 32) }
                                                                    : { heatThresholdF: val, heatThresholdC: Math.round(((val - 32) * 5) / 9) }),
                                                            },
                                                        }));
                                                    }}
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Budget Alert Ratio</label>
                                                <input
                                                    type="number"
                                                    step="0.05"
                                                    min="0.1"
                                                    max="2"
                                                    value={contextPrefs.horizons.budgetAlertRatio}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                budgetAlertRatio: parseFloat(e.target.value) || 0.9,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Cycle Duration (Months)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="24"
                                                    value={contextPrefs.horizons.ayanaMonths}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                ayanaMonths: parseInt(e.target.value, 10) || 6,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="ai-context-field">
                                                <label>Note Task Due Window (Days)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={contextPrefs.horizons.noteTaskDueDays}
                                                    onChange={(e) =>
                                                        setContextPrefs((p) => ({
                                                            ...p,
                                                            horizons: {
                                                                ...p.horizons,
                                                                noteTaskDueDays: parseInt(e.target.value, 10) || 7,
                                                            },
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Save Chat to Note Modal */}
            {showSaveNoteModal && (
                <div className="ai-memory-modal-backdrop" onClick={() => !isSavingNote && setShowSaveNoteModal(false)}>
                    <div className="ai-memory-modal ai-save-note-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="ai-memory-modal-header">
                            <div className="ai-memory-modal-title">
                                <h3>Save Chat to Note</h3>
                                <p>Export conversation into your personal notes collection</p>
                            </div>
                            <button
                                type="button"
                                className="ai-btn-ghost"
                                onClick={() => setShowSaveNoteModal(false)}
                                disabled={isSavingNote}
                            >
                                <XIcon width={16} height={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveChatToNote} className="ai-save-note-form">
                            <div className="ai-save-note-body">
                                {saveNoteSuccess && (
                                    <div className="ai-save-note-alert-success">
                                        <CheckCircleIcon width={16} height={16} />
                                        <span>{saveNoteSuccess}</span>
                                    </div>
                                )}

                                <div className="ai-modal-field">
                                    <label htmlFor="ai-note-title" className="ai-modal-label">
                                        Note Title
                                    </label>
                                    <input
                                        id="ai-note-title"
                                        type="text"
                                        className="ai-modal-input"
                                        value={saveNoteTitle}
                                        onChange={(e) => setSaveNoteTitle(e.target.value)}
                                        placeholder="e.g. AI Planning: Launch Strategy..."
                                        required
                                        disabled={isSavingNote}
                                    />
                                </div>

                                <div className="ai-modal-field">
                                    <div className="ai-modal-field-header">
                                        <label htmlFor="ai-note-folder" className="ai-modal-label">
                                            Destination Folder
                                        </label>
                                        <button
                                            type="button"
                                            className="ai-btn-link"
                                            onClick={() => setIsCreatingCustomFolder((p) => !p)}
                                        >
                                            {isCreatingCustomFolder ? 'Choose existing folder' : '+ New folder'}
                                        </button>
                                    </div>

                                    {isCreatingCustomFolder ? (
                                        <input
                                            type="text"
                                            className="ai-modal-input"
                                            value={customFolderName}
                                            onChange={(e) => setCustomFolderName(e.target.value)}
                                            placeholder="Enter new folder name (e.g. Brainstorming)..."
                                            autoFocus
                                            required
                                            disabled={isSavingNote}
                                        />
                                    ) : (
                                        <select
                                            id="ai-note-folder"
                                            className="ai-modal-select"
                                            value={saveNoteFolder}
                                            onChange={(e) => setSaveNoteFolder(e.target.value)}
                                            disabled={isSavingNote}
                                        >
                                            {availableFolders.map((f) => (
                                                <option key={f} value={f}>
                                                    📁 {f}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="ai-save-note-preview-box">
                                    <span className="ai-save-note-preview-label">
                                        Message Count: {messages.filter((m) => m.id !== 'welcome').length} messages
                                    </span>
                                    <p className="ai-save-note-preview-text">
                                        Will format the conversation into clean Markdown with user & AI sections, timestamps, and formatting.
                                    </p>
                                </div>
                            </div>

                            <div className="ai-save-note-footer">
                                <button
                                    type="button"
                                    className="dash-btn dash-btn-secondary"
                                    onClick={() => setShowSaveNoteModal(false)}
                                    disabled={isSavingNote}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="dash-btn dash-btn-primary"
                                    disabled={isSavingNote || !saveNoteTitle.trim()}
                                >
                                    {isSavingNote ? 'Saving...' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
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
