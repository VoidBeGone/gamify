# LevelUp MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the **LevelUp** backend
(gamified self-improvement tracker) to Claude. It is both the natural-language **write
interface** and the **AI scheduling engine** trigger for the app.

```
Claude (desktop / claude.ai)
    │  MCP protocol (stdio)
    ▼
LevelUp MCP Server (this package, TypeScript)
    │  HTTP REST + x-api-key
    ▼
LevelUp App Backend (Express)  →  MongoDB Atlas
```

## What it exposes

**Tools**

| Group | Tools |
| --- | --- |
| Tasks & goals | `complete_task`, `add_task`, `complete_challenge`, `add_goal`, `add_subgoal` |
| Metrics | `log_metric`, `log_workout`, `log_run`, `log_nutrition`, `log_instagram` |
| Workout | `get_workout_template`, `set_workout_template`, `get_todays_workout` |
| Scheduling | `get_progress_summary`, `get_goal_deadlines`, `get_last_week_activity`, `get_running_history`, `get_instagram_metrics`, `create_weekly_schedule`, `update_scheduled_task` |
| Reading state | `get_dashboard_summary`, `get_pillar_status`, `get_streak_status`, `get_todays_tasks`, `get_xp_summary` |

**Prompt**

- `weekly_schedule` — gathers all six context sources (progress, goals, last week, running,
  Instagram, active program) and asks Claude to generate a concrete weekly plan, ready to save
  with `create_weekly_schedule`.

Every tool validates input with [Zod](https://zod.dev), calls the backend over HTTP, and returns
clean readable text. Errors (unreachable backend, 4xx/5xx, validation) come back as graceful,
descriptive messages.

## Setup

```bash
cd packages/mcp
npm install
cp .env.example .env      # then fill in API_KEY (and API_BASE_URL if not localhost:3001)
npm run build
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:3001/api/v1` | Base URL of the LevelUp backend |
| `API_KEY` | — (required) | Shared secret, sent as the `x-api-key` header |

### Run locally

The server supports two transports:

**stdio** (default — for Claude Desktop, no port/URL):

```bash
npm run dev          # ts-node, no build step
# or
npm run build && npm start
```

It prints only `[levelup-mcp] ready (stdio)` to stderr; stdout is reserved for the protocol.
There is nothing to open in a browser — a host (Claude) drives it over stdin/stdout.

**HTTP** (Streamable HTTP — gives it a real URL):

```bash
npm run dev:http     # ts-node
# or
npm run build && npm run start:http
```

It then listens at **`http://localhost:3001/mcp`** (POST JSON-RPC) with a `GET /health` probe.
Configure the port with `MCP_HTTP_PORT`. You can also force HTTP on the default scripts with
`MCP_TRANSPORT=http`.

| Transport | When to use | Address |
| --- | --- | --- |
| stdio | Claude Desktop (local) | none |
| http | URL-based clients, MCP Inspector, remote hosting | `http://localhost:3001/mcp` |

> The HTTP endpoint runs **stateless** (a fresh server per request) and is unauthenticated —
> fine for localhost. Put it behind HTTPS + auth before exposing it publicly.

## Registering with Claude

### Claude Desktop

Add an entry to your `claude_desktop_config.json`
(macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`,
Windows: `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "levelup": {
      "command": "node",
      "args": ["C:\\Users\\peter\\repos\\gamify\\packages\\mcp\\dist\\index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001/api/v1",
        "API_KEY": "your-backend-api-key"
      }
    }
  }
}
```

Use an **absolute path** to the built `dist/index.js`, and pass `API_KEY` in the `env` block
(the host injects it into the process environment, so a local `.env` is optional). Restart
Claude Desktop; the `levelup` tools and the `weekly_schedule` prompt appear in the 🔌 menu.

> Prefer not to build? Point `command` at `npx`/`ts-node` instead:
> `"command": "npx", "args": ["ts-node", "C:\\...\\packages\\mcp\\src\\index.ts"]`.

### claude.ai (remote MCP)

claude.ai connects to **remote** MCP servers over HTTP, not local stdio. To use this server
there, run it behind a public HTTPS URL with the Streamable HTTP transport and add it under
**Settings → Connectors → Add custom connector**. For personal/local use, Claude Desktop (above)
is the simplest path.

## Natural-language examples

- *"Generate my schedule for next week"* → runs the `weekly_schedule` prompt, then `create_weekly_schedule`.
- *"Log today's workout: cable rows 3x12 at 50kg, pull-ups 3x8, hammer curls 3x10 at 22kg"* → `log_workout`.
- *"I ran 3km today, no breaks, 8:45 per km"* → `log_run`.
- *"My followers are at 203 now"* → `log_instagram`.
- *"Mark my content task done — posted the reel"* → `get_todays_tasks` then `complete_task`.
- *"How am I doing this week?"* → `get_progress_summary` / `get_last_week_activity`.

## Notes on backend mapping

A few tools adapt the spec to the actual backend:

- **`add_task`** requires `subgoal_id` — the backend nests tasks under subgoals. Use
  `get_goal_deadlines` to find goal/subgoal ids.
- **`complete_challenge`** takes the challenge's **date** (defaults to today); challenges live
  inside the weekly schedule and are keyed by day.
- **`add_goal`** / **`get_pillar_status`** accept a pillar **name or alias** (e.g. `fitness`,
  `content`, `side quests`) and resolve it to the backend pillar id automatically.
- **`log_nutrition`** / **`log_instagram`** are stored via the generic metrics endpoint, attributed
  to the fitness and content pillars respectively, so they show up in pillar history.
```
