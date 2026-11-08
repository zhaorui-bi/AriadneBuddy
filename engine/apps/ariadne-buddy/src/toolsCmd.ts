import process from 'node:process';

import { resolveAriadneHome } from './harness';
import { resolveUserPath } from './paths';
import { describeBackend, resolveAriadneBackend } from './ariadne/backend';
import { ariadneToolAnnotations, ARIADNE_TOOLS } from './ariadne/tools';

export function runToolsList(json: boolean, homeDir: string = resolveAriadneHome()): void {
  const resolvedHomeDir = resolveUserPath(homeDir);
  let backend: ReturnType<typeof resolveAriadneBackend>;
  let backendError: string | undefined;
  try {
    backend = resolveAriadneBackend(process.env, resolvedHomeDir);
  } catch (error) {
    backendError = error instanceof Error ? error.message : String(error);
  }
  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          backend: backend === undefined ? null : describeBackend(backend),
          backendError,
          tools: ARIADNE_TOOLS.map((t) => ({
            name: t.name,
            title: t.title,
            description: t.description,
            parameters: Object.keys(t.inputSchema),
            annotations: ariadneToolAnnotations(t.name),
          })),
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }
  process.stdout.write(
    `Ariadne tools (backend: ${
      backendError === undefined ? describeBackend(backend) : `invalid configuration — ${backendError}`
    })\n\n`,
  );
  for (const tool of ARIADNE_TOOLS) {
    const params = Object.keys(tool.inputSchema).join(', ');
    process.stdout.write(`  ${tool.name}\n    ${tool.title}\n    params: ${params || '(none)'}\n\n`);
  }
}
