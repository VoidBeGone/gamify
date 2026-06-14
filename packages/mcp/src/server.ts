/** Builds a fully-registered LevelUp MCP server (tools + prompts). */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerTaskTools } from './tools/tasks.js';
import { registerMetricTools } from './tools/metrics.js';
import { registerWorkoutTools } from './tools/workout.js';
import { registerSchedulingTools } from './tools/scheduling.js';
import { registerDashboardTools } from './tools/dashboard.js';
import { registerWeeklySchedulePrompt } from './prompts/weekly-schedule.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'levelup',
    version: '1.0.0',
  });

  // Tools, grouped by domain.
  registerTaskTools(server);
  registerMetricTools(server);
  registerWorkoutTools(server);
  registerSchedulingTools(server);
  registerDashboardTools(server);

  // Prompts.
  registerWeeklySchedulePrompt(server);

  return server;
}
