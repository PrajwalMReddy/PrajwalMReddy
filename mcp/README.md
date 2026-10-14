# Prajwal Website MCP Server

A Model Context Protocol (MCP) server that connects LLMs (Claude Desktop, Antigravity, Cursor, remote cloud agents) to your personal website, database, notes, tasks, finances, CRM, and CMS.

---

## 🌐 Deployment Modes & Clean Endpoints

You can connect to this MCP server in two ways:

1. **Local Stdio (`node mcp/server.mjs`)**: For local tools like Claude Desktop or Cursor running directly on your laptop.
2. **Remote Hosted Endpoints (`https://prajwalmreddy.com/api/mcp`)**: For connecting from mobile devices, cloud agent environments, or web LLM clients over HTTPS/SSE with an API key or OAuth.

### Clean & Intuitive URL Map:
- **`POST /api/mcp`** — Standard JSON-RPC 2.0 transport (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get`, `ping`).
- **`GET /api/mcp/sse`** — Server-Sent Events (SSE) live connection stream.
- **`GET /api/mcp/tools`** — Human and LLM inspectable catalog of all 18+ registered tools and parameter schemas.
- **`GET /api/mcp/resources`** — Inspection of attached resource URI schemes (`website://todos/active`, etc.).
- **`GET /api/mcp/prompts`** — Available prompt templates (`daily_briefing`, `contact_prep`).
- **`GET /api/mcp/discovery`** (or `/.well-known/mcp`) — Protocol discovery metadata.
- **`GET /api/mcp/authorize`** & **`POST /api/mcp/token`** — Clean OAuth 2.0 PKCE authorization flow with Dark Mode & Locales.

---

## 🚀 Capabilities & Tools

### 1. 📝 Notes & Knowledge Base (`mcp/tools/notes.mjs`)
- `search_notes`: Search notes by keyword in title/body, folder name, or pinned status.
- `get_note`: Fetch full note content by ID or exact title.
- `create_note`: Create a new markdown note with folder, tags, and pin options.
- `update_note`: Edit title, content, folder, tags, pinned, or archive state.
- `delete_note`: Permanently remove a note.

### 2. ✅ Tasks & Todos (`mcp/tools/todos.mjs`)
- `list_todos`: Query tasks with filters (pending/completed, priority, tags, keywords).
- `create_todo`: Add a new task with due date, priority, estimated duration, and recurrence.
- `update_todo`: Mark completed, adjust priority, update due date, or edit description.
- `delete_todo`: Delete a todo item.

### 3. 💰 Budget & Finances (`mcp/tools/budget.mjs`)
- `get_budget_summary`: Total income, total expenses, net savings, and category breakdown for all-time, a year, or a month.
- `list_expenses`: View recent expenses with optional category filter.
- `add_expense`: Record a new expense (item, category, cost, date).
- `list_income`: View recent income entries.
- `add_income`: Record new income (item, value, type, date).

### 4. 👥 Networking CRM (`mcp/tools/networking.mjs`)
- `search_contacts`: Find contacts by name, company, role, tag, or follow-up status (`overdue`, `upcoming`, `pending`).
- `get_contact`: Retrieve complete contact profile and past interaction timeline.
- `create_contact`: Add a new person with company, role, LinkedIn, contact info, notes, and follow-up date.
- `log_interaction`: Record a meeting, coffee chat, call, or email, and set next follow-up date.

### 5. 🌐 CMS Content (`mcp/tools/cms.mjs`)
- `get_cms_content`: Fetch live website content for `projects`, `experiences`, `blog`, `quotes`, `research`, `photography`, or `konami`.
- `update_cms_content`: Update CMS JSON payload.

### 6. 📄 Resources & Prompts (`mcp/resources.mjs`, `mcp/prompts.mjs`)
- **Resources**:
  - `website://todos/active`: Direct attachment of pending tasks.
  - `website://notes/recent`: Markdown summary of recent notes.
  - `website://budget/summary`: Direct attachment of latest financial totals.
  - `website://crm/followups`: Direct attachment of contacts needing follow-up.
- **Prompts**:
  - `daily_briefing`: Morning executive summary of tasks, overdue followups, and pinned notes.
  - `contact_prep`: Briefing packet before meeting with a specific person.

---

## 🔒 Authentication & Environment Variables

For remote access over `https://prajwalmreddy.com/api/mcp`, configure in your Vercel / environment variables:
- `MCP_SECRET_KEY`: A random secure string used as your API Key (e.g. `mcp_sec_...`).
- *(Fallback)*: If `MCP_SECRET_KEY` is not set, it accepts `ADMIN_PASSWORD`.

Send requests with either header:
```http
Authorization: Bearer YOUR_MCP_SECRET_KEY
```
or
```http
x-api-key: YOUR_MCP_SECRET_KEY
```

---

## 🔌 Connecting to LLM Clients

### A. Remote Hosted MCP Client (Claude Desktop / Cursor / Remote Agent)

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "prajwal-website-remote": {
      "url": "https://prajwalmreddy.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_SECRET_KEY"
      }
    }
  }
}
```

---

### B. Local Stdio (Claude Desktop)

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "personal-website-local": {
      "command": "node",
      "args": [
        "c:\\Users\\prajw\\OneDrive\\Documents\\Programming Projects\\PersonalWebsite\\mcp\\server.mjs"
      ]
    }
  }
}
```

---

### C. Antigravity IDE / Workspace Config

In `mcp_config.json`:

```json
{
  "mcpServers": {
    "personal-website": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp/server.mjs"]
    }
  }
}
```

---

## 🧪 Testing

Test local database connection and stats:
```bash
npm run mcp:test
```

Test remote endpoint logic and JSON-RPC dispatch:
```bash
npm run mcp:test-remote
```

Run local stdio server:
```bash
npm run mcp
```
