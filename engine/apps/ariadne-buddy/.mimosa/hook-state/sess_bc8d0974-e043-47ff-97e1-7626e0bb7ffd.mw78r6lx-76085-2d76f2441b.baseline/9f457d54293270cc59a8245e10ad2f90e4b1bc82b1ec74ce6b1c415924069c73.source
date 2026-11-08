import path from 'node:path';
import process from 'node:process';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { packageVersion, resolveAriadneHome, resolveUserPath } from '../paths';
import {
  ariadneToolAnnotations,
  ARIADNE_TOOLS,
  type ToolContext,
} from '../ariadne/tools';

const homeDir = resolveAriadneHome();
const jobsRoot = resolveUserPath(
  process.env['ARIADNE_JOBS_DIR'] ?? path.join(process.cwd(), 'ariadne-jobs'),
);

const ctx: ToolContext = {
  homeDir,
  jobsRoot,
  env: process.env,
};

const server = new McpServer({
  name: 'ariadne',
  version: packageVersion(),
});

for (const tool of ARIADNE_TOOLS) {
  const inputSchema = tool.strictInput === true ? z.object(tool.inputSchema).strict() : tool.inputSchema;
  server.registerTool<Record<string, z.ZodType>, typeof inputSchema>(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema,
      annotations: ariadneToolAnnotations(tool.name),
    },
    async (args) => tool.run(args as Record<string, unknown>, ctx),
  );
}

await server.connect(new StdioServerTransport());
