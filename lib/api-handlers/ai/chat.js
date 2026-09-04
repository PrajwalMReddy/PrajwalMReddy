const {connectToDatabase} = require('../../db');
const {requireAuth} = require('../../auth');
const {buildContext} = require('../../ai/contextBuilder');
const {chat, checkHealth, getModel, getBaseUrl} = require('../../ai/ollamaClient');

/**
 * Extract structured action proposals from model output
 */
function extractActionProposals(content) {
    const actions = [];
    if (!content) return actions;

    const taskRegex = /```(?:action:create_task|json:create_task)\s*([\s\S]*?)\s*```/g;
    let match;
    while ((match = taskRegex.exec(content)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.title) {
                actions.push({
                    type: 'CREATE_TASK', payload: {
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

    return actions;
}

function buildSystemPrompt(context, isGreeting = false) {
    if (isGreeting) {
        return `You are a helpful, friendly AI assistant embedded in Prajwal's dashboard.
The user is greeting you. Respond warmly and naturally in 1-2 friendly sentences welcoming Prajwal, and ask how you can assist with his tasks, notes, or spending today.
Keep it brief. Do not output code blocks or make up data.`;
    }

    return `You are a helpful, precise executive assistant embedded in Prajwal's personal admin dashboard.
You help organize tasks, analyze spending and income, extract action items from notes, and suggest daily priorities.

CURRENT DASHBOARD CONTEXT:
${context}

CRITICAL INSTRUCTIONS:
1. Base your responses strictly on the provided dashboard context.
2. Be concise, direct, and actionable. Avoid unnecessary preamble.
3. If recommending focus items, prioritize overdue and today's high-priority tasks first.
4. When analyzing spending, highlight major categories, anomalies, and net cash flow.
5. If the user asks you to create a task or turn a note into tasks, provide your response and include a structured proposal code block for each task:
\`\`\`action:create_task
{"title": "Task title", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD"}
\`\`\`
6. You do NOT have direct database write access. The dashboard UI will present your proposals to the user for explicit confirmation before anything is created or modified.`;
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
        return res.status(405).json({error: 'Method not allowed'});
    }

    try {
        let {messages, message, action, noteId, query, contextOnly, model} = req.body || {};

        // Resilient normalization of input messages
        if (!messages && message) {
            messages = [{role: 'user', content: String(message)}];
        } else if (messages && !Array.isArray(messages) && typeof messages === 'object') {
            const raw = messages;
            messages = Array.isArray(raw.history) ? [...raw.history] : [];
            if (raw.message) {
                messages.push({role: 'user', content: String(raw.message)});
            } else if (raw.content) {
                messages.push({role: raw.role || 'user', content: String(raw.content)});
            }
            if (!action && raw.action) {
                action = raw.action;
            }
        } else if (!messages && query) {
            messages = [{role: 'user', content: String(query)}];
        }

        if (!Array.isArray(messages)) {
            messages = [];
        }

        if (messages.length === 0 && !action && !contextOnly) {
            return res.status(400).json({error: 'messages or action is required'});
        }

        let context = '';
        try {
            const db = await connectToDatabase();
            const lastUserMessage = messages.length > 0 ? [...messages].reverse().find((m) => m.role === 'user')?.content || '' : query || '';

            context = await buildContext(db, {
                action, query: query || lastUserMessage, noteId,
            });
        } catch (dbErr) {
            console.warn('Database context lookup warning:', dbErr.message);
            context = 'Dashboard database is currently offline or unreachable. Provide general assistance.';
        }

        const isUserGreeting = !action && (context.includes('The user is greeting you') || context.length < 300);
        const systemPrompt = buildSystemPrompt(context, isUserGreeting);

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
            });
        }

        // Try proxying to Ollama server
        try {
            const ollamaMessages = messages.map((m) => ({
                role: m.role, content: m.content,
            }));

            // If action is specified but messages is empty, construct user message
            if (ollamaMessages.length === 0 && action) {
                const actionPrompts = {
                    focus_today: 'What should I focus on today? Summarize my top priorities.',
                    summarize_overdue: 'Summarize all my overdue tasks and suggest what to tackle first.',
                    summarize_notes: 'Summarize my recent notes and highlight key action items.',
                    analyze_spending: 'Analyze my spending this month, top categories, and cash flow.',
                    unusual_spending: 'Identify any unusual or high spending this month.',
                    note_to_tasks: 'Turn the selected note into actionable tasks.',
                };
                ollamaMessages.push({
                    role: 'user', content: actionPrompts[action] || 'Summarize my dashboard status.',
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

                let accumulated = '';
                const result = await chat({
                    model, messages: ollamaMessages, system: systemPrompt, stream: true, onToken: (token, fullText) => {
                        accumulated = fullText;
                        res.write(`data: ${JSON.stringify({token, content: fullText})}\n\n`);
                    }, timeoutMs: 90000,
                });

                const proposedActions = extractActionProposals(accumulated || result.content);

                res.write(`data: ${JSON.stringify({
                    done: true,
                    content: accumulated || result.content,
                    proposedActions,
                    model: result.model,
                    contextUsed: true,
                })}\n\n`);
                res.end();
                return;
            }

            const result = await chat({
                model, messages: ollamaMessages, system: systemPrompt, numPredict: 250, timeoutMs: 90000,
            });

            const proposedActions = extractActionProposals(result.content);

            return res.status(200).json({
                success: true, content: result.content, proposedActions, model: result.model, contextUsed: true,
            });
        } catch (ollamaErr) {
            console.warn('Ollama proxy error:', ollamaErr.message);

            if (res.headersSent) {
                res.write(`data: ${JSON.stringify({
                    error: ollamaErr.message,
                    code: ollamaErr.code || 'OLLAMA_ERROR',
                    isCloudEnv,
                    context,
                    systemPrompt,
                    model: model || getModel(),
                    fallbackAvailable: true,
                })}\n\n`);
                res.end();
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
        return res.status(500).json({
            error: 'Internal server error processing AI request', details: error.message,
        });
    }
};
