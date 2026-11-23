import { parseArgs } from 'node:util';

export const PROVIDER_TYPES = [
  'anthropic',
  'openai',
  'kimi',
  'google-genai',
  'openai_responses',
  'vertexai',
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const RESEARCH_ACTIONS = ['create', 'status', 'list', 'advance', 'respond', 'cancel'] as const;
export type ResearchAction = (typeof RESEARCH_ACTIONS)[number];

export const PERMISSION_MODES = ['auto', 'manual', 'yolo'] as const;
export type PermissionMode = (typeof PERMISSION_MODES)[number];

export const CONFIG_ACTIONS = ['show'] as const;
export type ConfigAction = (typeof CONFIG_ACTIONS)[number];

export const TELEMETRY_DISABLE_FLAG = '--no-telemetry';

export type CliInvocation =
  | { readonly kind: 'tui' }
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | {
      readonly kind: 'run';
      readonly prompt: string;
      readonly homeDir?: string;
      readonly model?: string;
      readonly workDir?: string;
      readonly permission?: PermissionMode;
      readonly quiet?: boolean;
      readonly json?: boolean;
    }
  | {
      readonly kind: 'chat';
      readonly homeDir?: string;
      readonly model?: string;
      readonly workDir?: string;
      readonly permission?: PermissionMode;
    }
  | {
      readonly kind: 'web';
      readonly host?: string;
      readonly port?: number;
      readonly noOpen: boolean;
      readonly homeDir?: string;
    }
  | {
      readonly kind: 'doctor';
      readonly json: boolean;
      readonly probe: boolean;
      readonly probeModel: boolean;
      readonly homeDir?: string;
    }
  | {
      readonly kind: 'onboard';
      readonly yes: boolean;
      readonly homeDir?: string;
      readonly ariadneCommand?: string;
      readonly ariadneRepo?: string;
      readonly importFrom?: string;
      readonly provider?: string;
      readonly apiKey?: string;
      readonly apiKeyEnv?: string;
      readonly model?: string;
      readonly baseUrl?: string;
      readonly providerType?: ProviderType;
    }
  | { readonly kind: 'tools'; readonly json: boolean; readonly homeDir?: string }
  | {
      readonly kind: 'research';
      readonly action: ResearchAction;
      readonly inputFile?: string;
      readonly taskId?: string;
      readonly expectedVersion?: number;
      readonly homeDir?: string;
    }
  | { readonly kind: 'info'; readonly homeDir?: string }
  | { readonly kind: 'config'; readonly action: 'show'; readonly json: boolean; readonly homeDir?: string }
  | {
      readonly kind: 'reset';
      readonly homeDir?: string;
      readonly keepJobs: boolean;
      readonly yes: boolean;
    };

export class CliArgumentError extends Error {
  override readonly name = 'CliArgumentError';
}

type OptionDefinition = {
  readonly type: 'boolean' | 'string';
  readonly short?: string;
};

type ParsedOptions = {
  readonly values: Record<string, string | boolean | undefined>;
  readonly positionals: readonly string[];
};

const HELP_OPTION = { type: 'boolean', short: 'h' } as const;
const GLOBAL_BOOLEAN_FLAGS = new Set<string>([TELEMETRY_DISABLE_FLAG]);

export function parseCliInvocation(argv: readonly string[]): CliInvocation {
  const [command, ...args] = withoutGlobalFlags(argv);
  if (command === undefined) return { kind: 'tui' };
  if (command === '--help' || command === '-h' || command === 'help') {
    assertNoArguments(args, command);
    return { kind: 'help' };
  }
  if (command === '--version' || command === '-v' || command === 'version') {
    assertNoArguments(args, command);
    return { kind: 'version' };
  }

  switch (command) {
    case 'run': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        quiet: { type: 'boolean' },
        json: { type: 'boolean' },
        home: { type: 'string' },
        model: { type: 'string' },
        workdir: { type: 'string' },
        permission: { type: 'string' },
      }, true);
      if (parsed.values['help'] === true) return { kind: 'help' };
      const prompt = parsed.positionals.join(' ').trim();
      if (prompt === '') throw new CliArgumentError('run requires a prompt');
      return {
        kind: 'run',
        prompt,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
        model: optionalNonEmptyString(parsed.values['model'], '--model'),
        workDir: optionalNonEmptyString(parsed.values['workdir'], '--workdir'),
        permission: optionalPermissionMode(parsed.values['permission']),
        quiet: booleanFlag(parsed.values['quiet']),
        json: booleanFlag(parsed.values['json']),
      };
    }
    case 'chat': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        home: { type: 'string' },
        model: { type: 'string' },
        workdir: { type: 'string' },
        permission: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'chat',
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
        model: optionalNonEmptyString(parsed.values['model'], '--model'),
        workDir: optionalNonEmptyString(parsed.values['workdir'], '--workdir'),
        permission: optionalPermissionMode(parsed.values['permission']),
      };
    }
    case 'tui': {
      const parsed = parseCommandArgs(args, { help: HELP_OPTION });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return { kind: 'tui' };
    }
    case 'web': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        host: { type: 'string' },
        port: { type: 'string' },
        'no-open': { type: 'boolean' },
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'web',
        host: optionalNonEmptyString(parsed.values['host'], '--host'),
        port: optionalPort(parsed.values['port']),
        noOpen: parsed.values['no-open'] === true,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'doctor': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        json: { type: 'boolean' },
        probe: { type: 'boolean' },
        'probe-model': { type: 'boolean' },
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'doctor',
        json: parsed.values['json'] === true,
        probe: parsed.values['probe'] === true,
        probeModel: parsed.values['probe-model'] === true,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'onboard': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        yes: { type: 'boolean' },
        home: { type: 'string' },
        'ariadne-command': { type: 'string' },
        'ariadne-repo': { type: 'string' },
        'import-from': { type: 'string' },
        provider: { type: 'string' },
        'api-key': { type: 'string' },
        'api-key-env': { type: 'string' },
        model: { type: 'string' },
        'base-url': { type: 'string' },
        'provider-type': { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      if (parsed.values['api-key'] !== undefined && parsed.values['api-key-env'] !== undefined) {
        throw new CliArgumentError('--api-key and --api-key-env cannot be used together');
      }
      if (
        parsed.values['ariadne-command'] !== undefined &&
        parsed.values['ariadne-repo'] !== undefined
      ) {
        throw new CliArgumentError('--ariadne-command and --ariadne-repo cannot be used together');
      }
      return {
        kind: 'onboard',
        yes: parsed.values['yes'] === true,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
        ariadneCommand: optionalNonEmptyString(
          parsed.values['ariadne-command'],
          '--ariadne-command',
        ),
        ariadneRepo: optionalNonEmptyString(parsed.values['ariadne-repo'], '--ariadne-repo'),
        importFrom: optionalNonEmptyString(parsed.values['import-from'], '--import-from'),
        provider: optionalNonEmptyString(parsed.values['provider'], '--provider'),
        apiKey: optionalNonEmptyString(parsed.values['api-key'], '--api-key'),
        apiKeyEnv: optionalNonEmptyString(parsed.values['api-key-env'], '--api-key-env'),
        model: optionalNonEmptyString(parsed.values['model'], '--model'),
        baseUrl: optionalNonEmptyString(parsed.values['base-url'], '--base-url'),
        providerType: optionalProviderType(parsed.values['provider-type']),
      };
    }
    case 'tools': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        json: { type: 'boolean' },
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'tools',
        json: parsed.values['json'] === true,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'research': {
      const [action, ...actionArgs] = args;
      if (action === '--help' || action === '-h') {
        assertNoArguments(actionArgs, 'research --help');
        return { kind: 'help' };
      }
      if (!RESEARCH_ACTIONS.some((value) => value === action)) {
        throw new CliArgumentError(`research requires an action: ${RESEARCH_ACTIONS.join(', ')}`);
      }
      const parsed = parseCommandArgs(actionArgs, {
        help: HELP_OPTION,
        input: { type: 'string' },
        id: { type: 'string' },
        'expected-version': { type: 'string' },
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      const inputFile = optionalNonEmptyString(parsed.values['input'], '--input');
      const taskId = optionalNonEmptyString(parsed.values['id'], '--id');
      const expectedVersion = optionalVersion(parsed.values['expected-version']);
      if (inputFile !== undefined && (taskId !== undefined || expectedVersion !== undefined)) {
        throw new CliArgumentError('Use --input or --id/--expected-version, not both');
      }
      if (taskId !== undefined && action !== 'status' && action !== 'advance') {
        throw new CliArgumentError('--id is supported only for research status and advance');
      }
      if (expectedVersion !== undefined && action !== 'advance') {
        throw new CliArgumentError('--expected-version is supported only for research advance');
      }
      if (inputFile === undefined && action !== 'list' && taskId === undefined) {
        throw new CliArgumentError(`research ${String(action)} requires --input FILE${action === 'status' || action === 'advance' ? ' or --id ID' : ''}`);
      }
      return {
        kind: 'research',
        action: action as ResearchAction,
        inputFile,
        taskId,
        expectedVersion,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'info': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'info',
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'config': {
      const [action, ...actionArgs] = args;
      if (action === '--help' || action === '-h') {
        assertNoArguments(actionArgs, 'config --help');
        return { kind: 'help' };
      }
      if (!CONFIG_ACTIONS.some((value) => value === action)) {
        throw new CliArgumentError(`config requires an action: ${CONFIG_ACTIONS.join(', ')}`);
      }
      const parsed = parseCommandArgs(actionArgs, {
        help: HELP_OPTION,
        json: { type: 'boolean' },
        home: { type: 'string' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'config',
        action: action as ConfigAction,
        json: parsed.values['json'] === true,
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
      };
    }
    case 'reset': {
      const parsed = parseCommandArgs(args, {
        help: HELP_OPTION,
        home: { type: 'string' },
        'keep-jobs': { type: 'boolean' },
        yes: { type: 'boolean' },
      });
      if (parsed.values['help'] === true) return { kind: 'help' };
      return {
        kind: 'reset',
        homeDir: optionalNonEmptyString(parsed.values['home'], '--home'),
        keepJobs: parsed.values['keep-jobs'] === true,
        yes: parsed.values['yes'] === true,
      };
    }
    default:
      throw new CliArgumentError(`unknown command: ${command}`);
  }
}

function withoutGlobalFlags(argv: readonly string[]): readonly string[] {
  const separator = argv.indexOf('--');
  const head = separator === -1 ? argv : argv.slice(0, separator);
  const tail = separator === -1 ? [] : argv.slice(separator);
  return [...head.filter((arg) => !GLOBAL_BOOLEAN_FLAGS.has(arg)), ...tail];
}

function parseCommandArgs(
  args: readonly string[],
  options: Readonly<Record<string, OptionDefinition>>,
  allowPositionals = false,
): ParsedOptions {
  try {
    const parsed = parseArgs({
      args: [...args],
      options,
      allowPositionals,
      strict: true,
    });
    return {
      values: parsed.values as Record<string, string | boolean | undefined>,
      positionals: parsed.positionals,
    };
  } catch (error) {
    throw new CliArgumentError(error instanceof Error ? error.message : String(error));
  }
}

function assertNoArguments(args: readonly string[], command: string): void {
  if (args.length > 0) {
    throw new CliArgumentError(`${command} does not accept arguments`);
  }
}

function optionalNonEmptyString(
  value: string | boolean | undefined,
  flag: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new CliArgumentError(`${flag} requires a non-empty value`);
  }
  return value.trim();
}

function booleanFlag(value: string | boolean | undefined): boolean | undefined {
  return value === true ? true : undefined;
}

function optionalPort(value: string | boolean | undefined): number | undefined {
  const raw = optionalNonEmptyString(value, '--port');
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) {
    throw new CliArgumentError('--port must be an integer from 0 to 65535');
  }
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port > 65_535) {
    throw new CliArgumentError('--port must be an integer from 0 to 65535');
  }
  return port;
}

function optionalProviderType(value: string | boolean | undefined): ProviderType | undefined {
  const raw = optionalNonEmptyString(value, '--provider-type');
  if (raw === undefined) return undefined;
  if (!PROVIDER_TYPES.some((type) => type === raw)) {
    throw new CliArgumentError(
      `--provider-type must be one of: ${PROVIDER_TYPES.join(', ')}`,
    );
  }
  return raw as ProviderType;
}

function optionalPermissionMode(value: string | boolean | undefined): PermissionMode | undefined {
  const raw = optionalNonEmptyString(value, '--permission');
  if (raw === undefined) return undefined;
  if (!PERMISSION_MODES.some((mode) => mode === raw)) {
    throw new CliArgumentError(`--permission must be one of: ${PERMISSION_MODES.join(', ')}`);
  }
  return raw as PermissionMode;
}

function optionalVersion(value: string | boolean | undefined): number | undefined {
  const raw = optionalNonEmptyString(value, '--expected-version');
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1) {
    throw new CliArgumentError('--expected-version must be a positive safe integer');
  }
  return Number(raw);
}
