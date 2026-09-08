const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../../db');
const { requireAuth } = require('../../auth');
const { buildContext } = require('../../ai/contextBuilder');
const { chat, checkHealth, getModel, getBaseUrl } = require('../../ai/ollamaClient');
const {
    OLLAMA_TOOLS,
    executeToolCall,
    remember_fact,
    forget_memory,
} = require('../../ai/memoryTools');
const { getDailyBriefing } = require('../../ai/briefingEngine');
const { getNewsBriefing } = require('../../ai/newsService');
const { resolveUserContext } = require('../../ai/userContextService');

/**
 * Extract structured action proposals from model output
 */
function extractActionProposals(content) {
    const actions = [];
    if (!content) return actions;

    // 1. Task proposals
    const taskRegex = /```(?:action:create_task|json:create_task)\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.title) {
                actions.push({
                    type: 'CREATE_TASK',
                    payload: {
                        title: String(parsed.title).trim(),
                        priority: ['high', 'medium', 'low'].includes(parsed.priority) ? parsed.priority : 'medium',
                        dueDate: parsed.dueDate ? String(parsed.dueDate).slice(0, 10) : null,
                    },
                });
            }
        } catch {
            // Ignore parse errors from LLM output
        }
    }

    // 2. Goal proposals
    const goalRegex = /```(?:action:create_goal|json:create_goal)\s*([\s\S]*?)\s*```/g;
    while ((match = goalRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.title) {
                actions.push({
                    type: 'CREATE_GOAL',
                    payload: {
                        title: String(parsed.title).trim(),
                        description: parsed.description ? String(parsed.description).trim() : '',
                        targetDate: parsed.targetDate ? String(parsed.targetDate).slice(0, 10) : null,
                        category: parsed.category || 'General',
                    },
                });
            }
        } catch {
            // Ignore parse errors
        }
    }

    // 3. Project proposals
    const projectRegex = /```(?:action:create_project|json:create_project)\s*([\s\S]*?)\s*```/g;
    while ((match = projectRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.name) {
                actions.push({
                    type: 'CREATE_PROJECT',
                    payload: {
                        name: String(parsed.name).trim(),
                        description: parsed.description ? String(parsed.description).trim() : '',
                        targetDate: parsed.targetDate ? String(parsed.targetDate).slice(0, 10) : null,
                        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    },
                });
            }
        } catch {
            // Ignore parse errors
        }
    }

    // 4. Remember fact proposals
    const rememberRegex = /```(?:action:remember_fact|json:remember_fact)\s*([\s\S]*?)\s*```/g;
    while ((match = rememberRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.fact) {
                actions.push({
                    type: 'REMEMBER_FACT',
                    payload: {
                        fact: String(parsed.fact).trim(),
                        category: parsed.category || 'general',
                        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
                    },
                });
            }
        } catch {
            // Ignore parse errors
        }
    }

    // 5. Forget memory proposals
    const forgetRegex = /```(?:action:forget_memory|json:forget_memory)\s*([\s\S]*?)\s*```/g;
    while ((match = forgetRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.query || parsed.id) {
                actions.push({
                    type: 'FORGET_MEMORY',
                    payload: {
                        query: parsed.query ? String(parsed.query).trim() : null,
                        id: parsed.id ? String(parsed.id).trim() : null,
                    },
                });
            }
        } catch {
            // Ignore parse errors
        }
    }

    return actions;
}

function buildSystemPrompt(context, userContext = null) {
    const todayStr = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const userName = userContext?.identity?.userName || '';
    const currencySymbol = userContext?.identity?.currencySymbol || '$';

    let prompt = `You are a helpful, responsive personal AI assistant${userName ? ` for ${userName}` : ''}. Today is ${todayStr}.
You are equipped with native live tools:
- get_weather(location): Get real-time weather and temperature for any city.
- search_expenses(query): Search user past expenses and purchases in chronological order.
- get_spending_summary(category, timeframe): Aggregated spending breakdown across categories or months.
- search_web(query): Search live web and news.
- get_tasks(status, query): Retrieve user tasks.
- get_notes(query): Retrieve user notes.
- search_memory(query): Search long-term persistent facts.
- remember_fact(fact): Save a fact to long-term memory.

CONVERSATIONAL GUIDELINES:
1. Interpret user intent naturally as a modern LLM. Follow the user's lead and do what they ask.
2. When the user greets you (e.g. "Hello", "Hi", "Hey", "Good morning", "How are you?"), respond warmly, naturally, and concisely in 1-2 sentences (e.g. "Hello Prajwal! How can I help you today?").
3. DO NOT unpromptedly list capabilities, suggestions, weather, tasks, or numbers when greeted.
4. DO NOT launch into an unprompted briefing, status report, task summary, or weather forecast unless the user specifically asks for it.
5. Answer what the user asks directly without unnecessary filler.

IMPORTANT TOOL PROTOCOL:
1. When asked about past purchases or expenses, live weather, web facts, tasks, or notes, YOU MUST INVOKE THE APPROPRIATE TOOL.
2. DO NOT simulate the tool execution. Output the tool call and stop.
3. DO NOT write "Please wait while I fetch the data..." or output fake/mock results.
4. The real data will be provided to you in the tool response.

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. NEVER invent, fabricate, or hallucinate numbers, expenses, categories, trips, dates, tasks, notes, or facts.
2. Every number, category, or detail you state MUST come directly from the provided database records or tool results.
3. If data, categories, or trips (e.g. Paris, Rent, Groceries, Healthcare) do NOT exist in the records, YOU MUST EXPLICITLY STATE that you have no record of them. NEVER invent placeholder, sample, or hypothetical examples.
4. Use neat Markdown tables for structured data (currency: ${currencySymbol}).`;

    if (userContext?.systemInstructions && userContext.systemInstructions.trim()) {
        prompt += `\n\nUser Instructions: ${userContext.systemInstructions.trim()}`;
    }

    if (userContext?.customDirectives && userContext.customDirectives.trim()) {
        prompt += `\n\nUser Directives: ${userContext.customDirectives.trim()}`;
    }

    if (context && context.trim()) {
        prompt += `\n\n<baseline_context>\n${context.trim().slice(0, 2000)}\n</baseline_context>\nNOTE: The baseline context above is background reference only. DO NOT recite or summarize it unless the user specifically asks for it.`;
    }

    return prompt;
}

/**
 * Handle explicit memory requests directly (e.g. "Remember that...", "Forget that...")
 */
async function handleExplicitMemoryTriggers(text, db) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();

    // Check "remember that" pattern
    const rememberMatch = clean.match(/^(?:please\s+)?remember\s+(?:that\s+)?(.+)$/i);
    if (rememberMatch && rememberMatch[1]) {
        const fact = rememberMatch[1].trim().replace(/[.!]+$/, '');
        if (fact.length > 3) {
            try {
                const mem = await remember_fact({ fact, category: 'fact', importance: 4 }, db);
                return {
                    action: 'remember',
                    fact: mem.fact,
                    message: `I've saved that to my long-term memory: "${mem.fact}". I'll keep this in mind across future conversations and sessions.`,
                };
            } catch (e) {
                console.warn('Auto-remember error:', e.message);
            }
        }
    }

    // Check "forget that" pattern
    const forgetMatch = clean.match(/^(?:please\s+)?forget\s+(?:that\s+)?(.+)$/i);
    if (forgetMatch && forgetMatch[1]) {
        const query = forgetMatch[1].trim().replace(/[.!]+$/, '');
        if (query.length > 2) {
            try {
                const res = await forget_memory({ query }, db);
                return {
                    action: 'forget',
                    query,
                    message: res.count > 0
                        ? `I have forgotten that information from long-term memory.`
                        : `I couldn't find any stored memory matching "${query}".`,
                };
            } catch (e) {
                console.warn('Auto-forget error:', e.message);
            }
        }
    }

    return null;
}

module.exports = async (req, res) => {
    const isCloudEnv = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const baseUrl = getBaseUrl();
    const isLocalHostUrl = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('0.0.0.0');

    if (req.method === 'GET') {
        if (isCloudEnv && isLocalHostUrl) {
            return res.status(200).json({
                status: 'cloud_fallback',
                isCloudEnv: true,
                configuredModel: getModel(),
                baseUrl,
                message: 'Vercel cloud deployment: local Ollama fallback active in client browser',
            });
        }
        const health = await checkHealth();
        return res.status(200).json(health);
    }

    if (!requireAuth(req, res)) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let { messages, message, action, noteId, query, contextOnly, model, conversationId } = req.body || {};

        // Resilient normalization of input messages
        if (!messages && message) {
            messages = [{ role: 'user', content: String(message) }];
        } else if (messages && !Array.isArray(messages) && typeof messages === 'object') {
            const raw = messages;
            messages = Array.isArray(raw.history) ? [...raw.history] : [];
            if (raw.message) {
                messages.push({ role: 'user', content: String(raw.message) });
            } else if (raw.content) {
                messages.push({ role: raw.role || 'user', content: String(raw.content) });
            }
            if (!action && raw.action) {
                action = raw.action;
            }
        } else if (!messages && query) {
            messages = [{ role: 'user', content: String(query) }];
        }

        if (!Array.isArray(messages)) {
            messages = [];
        }

        if (messages.length === 0 && !action && !contextOnly) {
            return res.status(400).json({ error: 'messages or action is required' });
        }

        let context = '';
        let db = null;
        let currentBriefing = null;
        let isBriefingRequest = false;
        let userContext = null;
        try {
            db = await connectToDatabase();
            try {
                userContext = await resolveUserContext(db);
            } catch (ctxErr) {
                console.warn('User context resolve warning:', ctxErr.message);
            }
            const recentUserMessages = (Array.isArray(messages) ? messages : [])
                .filter((m) => m.role === 'user')
                .slice(-3)
                .map((m) => m.content)
                .join(' ');
            const resolvedQuery = query || recentUserMessages || '';

            // Handle special actions directly if applicable
            isBriefingRequest =
                action === 'daily_briefing' ||
                /\b(?:daily\s+briefing|morning\s+briefing|executive\s+briefing|comprehensive\s+briefing|today's\s+briefing)\b/i.test(resolvedQuery) ||
                /\b(?:give\s+me\s+(?:my\s+)?briefing|what\s+is\s+my\s+briefing|show\s+(?:my\s+)?briefing|my\s+briefing)\b/i.test(resolvedQuery);

            if (isBriefingRequest) {
                currentBriefing = await getDailyBriefing({ forceRefresh: action === 'daily_briefing' && req.query?.refresh === 'true' }, db);
                context = currentBriefing.executiveSummary;

                const wantsStream = req.headers.accept?.includes('text/event-stream') || req.body?.stream === true;
                const proposedActions = [];
                for (const obs of currentBriefing.observations || []) {
                    if (obs.actionProposal) proposedActions.push(obs.actionProposal);
                }

                // If daily_briefing action, return the rich executive report directly without routing to slow/unstructured Ollama chat
                if (action === 'daily_briefing') {
                    if (wantsStream) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream; charset=utf-8',
                            'Cache-Control': 'no-cache, no-transform',
                            'Connection': 'keep-alive',
                        });
                        res.write(`data: ${JSON.stringify({ token: currentBriefing.executiveSummary, content: currentBriefing.executiveSummary })}\n\n`);
                        res.write(`data: ${JSON.stringify({ done: true, content: currentBriefing.executiveSummary, proposedActions, briefing: currentBriefing, model: 'briefing-engine' })}\n\n`);
                        return res.end();
                    } else {
                        return res.status(200).json({
                            success: true,
                            content: currentBriefing.executiveSummary,
                            proposedActions,
                            model: model || 'briefing-engine',
                            briefing: currentBriefing,
                        });
                    }
                }
            } else if (action === 'news_briefing' || action === 'news_update') {
                const newsResult = await getNewsBriefing({ model }, db);
                return res.status(200).json({
                    success: true,
                    content: newsResult.summary,
                    articles: newsResult.articles,
                    model: newsResult.model,
                    contextUsed: true,
                });
            } else {
                context = await buildContext(db, {
                    action,
                    query: resolvedQuery,
                    noteId,
                    userContext,
                });
            }

            // Check if the user message is an explicit memory command ("remember that...", "forget that...")
            const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
            if (lastUserMsg) {
                const memoryResult = await handleExplicitMemoryTriggers(lastUserMsg.content, db);
                if (memoryResult) {
                    return res.status(200).json({
                        success: true,
                        content: memoryResult.message,
                        proposedActions: [],
                        model: model || getModel(),
                        memoryAction: memoryResult.action,
                    });
                }
            }
        } catch (dbErr) {
            console.warn('Database context lookup warning:', dbErr.message);
            context = '';
        }

        const systemPrompt = buildSystemPrompt(context, userContext);

        // If client only asked for context or server is in cloud pointing to localhost
        if (contextOnly === true || action === 'context_only' || (isCloudEnv && isLocalHostUrl)) {
            return res.status(200).json({
                success: true,
                context,
                systemPrompt,
                model: model || getModel(),
                baseUrl,
                isCloudEnv,
                fallbackAvailable: true,
                tools: OLLAMA_TOOLS,
            });
        }

        // Try proxying to Ollama server
        try {
            const ollamaMessages = messages.map((m) => ({
                role: m.role,
                content: m.content,
            }));

            // If action is specified but messages is empty, construct user message
            if (ollamaMessages.length === 0 && action) {
                let dynamicPrompt = null;
                if (Array.isArray(userContext?.quickActions)) {
                    const matched = userContext.quickActions.find((qa) => qa.id === action);
                    if (matched && matched.prompt) {
                        dynamicPrompt = matched.prompt;
                    }
                }
                if (!dynamicPrompt) {
                    const actionPrompts = {
                        focus_today: 'What should I focus on today? Summarize my top priorities.',
                        summarize_overdue: 'Summarize all my overdue tasks and suggest what to tackle first.',
                        summarize_notes: 'Summarize my recent notes and highlight key action items.',
                        analyze_spending: 'Analyze my spending this month, top categories, and cash flow.',
                        unusual_spending: 'Identify any unusual or high spending this month.',
                        note_to_tasks: 'Turn the selected note into actionable tasks.',
                        plan_week: 'Plan my upcoming week step-by-step, prioritizing my active goals and overdue tasks.',
                        review_goals: 'Review all my active goals, assess progress, and highlight next deliverables.',
                        falling_through_cracks: "What is falling through the cracks? Check neglected goals, overdue tasks, and notes without tasks.",
                        daily_briefing: "Provide today's comprehensive executive daily briefing covering live weather forecasts, tasks to do, things to keep in mind, and the latest news across my monitored topics and locations.",
                    };
                    dynamicPrompt = actionPrompts[action] || 'Summarize my dashboard status.';
                }
                ollamaMessages.push({
                    role: 'user',
                    content: dynamicPrompt,
                });
            }

            const wantsStream = req.headers.accept?.includes('text/event-stream') || req.body?.stream === true;

            if (wantsStream) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache, no-transform',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });
            }

            // Agentic execution loop with native Ollama tools
            let currentMessages = [...ollamaMessages];
            let activeTools = OLLAMA_TOOLS;
            let finalContent = '';
            let finalModel = model || getModel();
            let toolTurns = 0;
            const MAX_TOOL_TURNS = 3;

            while (toolTurns < MAX_TOOL_TURNS) {
                toolTurns++;

                const isSynthesisTurn = toolTurns > 1;
                const shouldStreamThisTurn = Boolean(wantsStream && isSynthesisTurn);
                let accumulated = '';

                // On turn 1 check tools; on turn 2+ synthesize without tool schemas to prevent CPU overhead
                const turnRes = await chat({
                    model,
                    messages: currentMessages,
                    system: systemPrompt,
                    tools: isSynthesisTurn ? undefined : activeTools,
                    temperature: 0.1,
                    stream: shouldStreamThisTurn,
                    onToken: shouldStreamThisTurn ? (token, fullText) => {
                        accumulated = fullText;
                        res.write(`data: ${JSON.stringify({ token, content: fullText })}\n\n`);
                    } : undefined,
                    numPredict: 1024,
                    numCtx: 2048,
                    timeoutMs: 120000,
                });

                finalModel = turnRes.model;

                if (!isSynthesisTurn && turnRes.tool_calls && turnRes.tool_calls.length > 0) {
                    if (wantsStream) {
                        for (const tc of turnRes.tool_calls) {
                            res.write(`data: ${JSON.stringify({ status: 'tool_executing', tool: tc.function?.name, args: tc.function?.arguments })}\n\n`);
                        }
                    }

                    // Record assistant message with tool calls
                    currentMessages.push({
                        role: 'assistant',
                        content: '',
                        tool_calls: turnRes.tool_calls,
                    });

                    // Execute each tool requested by the model
                    for (const tc of turnRes.tool_calls) {
                        const fnName = tc.function?.name;
                        const fnArgs = tc.function?.arguments || {};
                        let toolOutput;
                        try {
                            toolOutput = await executeToolCall(fnName, fnArgs, db);
                        } catch (toolErr) {
                            toolOutput = { error: toolErr.message };
                        }

                        currentMessages.push({
                            role: 'tool',
                            name: fnName,
                            content: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
                        });
                    }

                    // Loop to next turn for synthesis
                    continue;
                }

                // Final content from direct turn 1 or streamed/completed synthesis
                finalContent = accumulated || turnRes.content;
                if (wantsStream && !shouldStreamThisTurn) {
                    res.write(`data: ${JSON.stringify({ token: finalContent, content: finalContent })}\n\n`);
                }
                break;
            }

            const proposedActions = extractActionProposals(finalContent);

            // Persist conversation message if conversationId provided
            if (db && conversationId && ObjectId.isValid(conversationId)) {
                try {
                    const now = new Date();
                    await db.collection('ai_conversations').updateOne(
                        { _id: new ObjectId(conversationId) },
                        {
                            $push: {
                                messages: {
                                    $each: [
                                        ...(lastUserMsg ? [{ ...lastUserMsg, id: `user-${Date.now()}` }] : []),
                                        {
                                            id: `ai-${Date.now()}`,
                                            role: 'assistant',
                                            content: finalContent,
                                            proposedActions,
                                            timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                        },
                                    ],
                                },
                            },
                            $set: { lastActive: now, updatedAt: now },
                        }
                    );
                } catch (persistErr) {
                    console.warn('Could not persist conversation message:', persistErr.message);
                }
            }

            if (wantsStream) {
                res.write(
                    `data: ${JSON.stringify({
                        done: true,
                        content: finalContent,
                        proposedActions,
                        model: finalModel,
                        contextUsed: true,
                        conversationId,
                    })}\n\n`
                );
                res.end();
                return;
            }

            return res.status(200).json({
                success: true,
                content: finalContent,
                proposedActions,
                model: finalModel,
                contextUsed: true,
                conversationId,
            });
        } catch (ollamaErr) {
            console.warn('Ollama proxy error:', ollamaErr.message);

            // If it was a briefing request and Ollama timed out or failed, gracefully deliver the pre-compiled executive briefing
            if (isBriefingRequest && currentBriefing?.executiveSummary) {
                if (res.headersSent) {
                    res.write(`data: ${JSON.stringify({ token: currentBriefing.executiveSummary, content: currentBriefing.executiveSummary })}\n\n`);
                    res.write(`data: ${JSON.stringify({ done: true, content: currentBriefing.executiveSummary, model: 'briefing-engine', proposedActions: [] })}\n\n`);
                    res.end();
                    return;
                }
                return res.status(200).json({
                    success: true,
                    content: currentBriefing.executiveSummary,
                    proposedActions: [],
                    model: 'briefing-engine',
                    briefing: currentBriefing,
                });
            }

            if (res.headersSent) {
                if (!res.writableEnded) {
                    res.write(
                        `data: ${JSON.stringify({
                            error: ollamaErr.message,
                            code: ollamaErr.code || 'OLLAMA_ERROR',
                            isCloudEnv,
                            context,
                            systemPrompt,
                            model: model || getModel(),
                            fallbackAvailable: true,
                        })}\n\n`
                    );
                    res.end();
                }
                return;
            }

            return res.status(200).json({
                success: false,
                code: ollamaErr.code || 'OLLAMA_ERROR',
                error: ollamaErr.message,
                isCloudEnv,
                context,
                systemPrompt,
                model: model || getModel(),
                fallbackAvailable: true,
            });
        }
    } catch (error) {
        console.error('AI chat handler error:', error);
        if (res.headersSent) {
            if (!res.writableEnded) {
                res.end();
            }
            return;
        }
        return res.status(500).json({
            error: 'Internal server error processing AI request',
            details: error.message,
        });
    }
};
