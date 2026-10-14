import { z } from 'zod';
import { connectToDatabase } from './db.mjs';

export function registerPrompts(server) {
    // 1. Daily Briefing Prompt
    server.prompt(
        'daily_briefing',
        'Generate an executive morning briefing summarizing pending tasks, overdue contacts, and recent notes',
        {},
        async () => {
            const db = await connectToDatabase();
            const todayStr = new Date().toISOString().slice(0, 10);

            // Active tasks
            const activeTodos = await db.collection('todos')
                .find({ completed: { $ne: true } })
                .sort({ dueDate: 1, priority: 1 })
                .limit(10)
                .toArray();

            // Contacts needing attention
            const pendingContacts = await db.collection('networking_people')
                .find({
                    nextFollowUpAt: { $exists: true, $ne: null },
                    followUpStatus: { $ne: 'completed' }
                })
                .sort({ nextFollowUpAt: 1 })
                .limit(5)
                .toArray();

            // Pinned/recent notes
            const pinnedNotes = await db.collection('notes')
                .find({ pinned: true, archived: { $ne: true } })
                .limit(5)
                .toArray();

            const promptText = `
You are Prajwal's executive AI assistant. Generate a crisp, structured morning briefing based on today's dashboard status (${todayStr}):

### 1. High Priority Tasks (${activeTodos.length} pending items retrieved)
${activeTodos.map(t => `- [ ] **${t.title}** (Priority: ${t.priority || 'medium'}, Due: ${t.dueDate || 'No date'})`).join('\n') || 'None'}

### 2. Networking & Follow-ups (${pendingContacts.length} contacts needing follow-up)
${pendingContacts.map(c => `- **${c.name}** (${c.company || 'N/A'}) - Due: ${c.nextFollowUpAt} | Goal: ${c.followUpNotes || 'General check-in'}`).join('\n') || 'No overdue follow-ups'}

### 3. Pinned Notes & Context
${pinnedNotes.map(n => `- **${n.title}**: ${n.content?.slice(0, 100)}...`).join('\n') || 'No pinned notes'}

Please format the briefing with:
1. **Top 3 Priorities for Today**
2. **Key People to Contact**
3. **Suggested Schedule & Focus Blocks**
            `.trim();

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: promptText
                        }
                    }
                ]
            };
        }
    );

    // 2. Contact Meeting Preparation Prompt
    server.prompt(
        'contact_prep',
        'Prepare briefing notes before meeting with a specific networking contact',
        {
            contactName: z.string().describe('Name of the person you are preparing to meet')
        },
        async ({ contactName }) => {
            const db = await connectToDatabase();
            const person = await db.collection('networking_people').findOne({
                name: new RegExp(contactName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            });

            if (!person) {
                return {
                    messages: [
                        {
                            role: 'user',
                            content: {
                                type: 'text',
                                text: `Could not find a contact matching "${contactName}". Please review the contact name.`
                            }
                        }
                    ]
                };
            }

            const interactions = await db.collection('networking_interactions')
                .find({ personId: person._id.toString() })
                .sort({ date: -1 })
                .toArray();

            const promptText = `
I am preparing to meet with **${person.name}**. Here is the context from my CRM:

- **Company / Role**: ${person.company || 'N/A'} - ${person.role || 'N/A'}
- **Location**: ${person.location || 'N/A'}
- **Email / Phone**: ${person.email || 'N/A'} | ${person.phone || 'N/A'}
- **LinkedIn**: ${person.linkedin || 'N/A'}
- **Tags**: ${(person.tags || []).join(', ') || 'None'}
- **Profile Notes**: ${person.notes || 'No notes'}
- **Past Interactions (${interactions.length} recorded)**:
${interactions.map(i => `  - [${i.date ? new Date(i.date).toISOString().slice(0, 10) : 'Date N/A'}] (${i.type}): ${i.notes}`).join('\n') || '  No prior logged interactions'}

Please provide:
1. **Executive Summary** of who they are and how we know each other.
2. **Key Discussion Points & Questions** based on previous chats and mutual interests.
3. **Recommended Next Steps or Asks** for this conversation.
            `.trim();

            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: promptText
                        }
                    }
                ]
            };
        }
    );
}
