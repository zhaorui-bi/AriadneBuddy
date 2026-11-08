export interface InteractiveHostBrand {
  readonly id: 'kimi-code' | 'ariadne-buddy';
  readonly productName: string;
  readonly assistantName: string;
  readonly commandName: string;
  readonly processName: string;
  readonly logo: readonly [string, string];
  readonly welcomeArt?: readonly string[];
  readonly welcomeTagline?: string;
  readonly welcomeDescription?: string;
  readonly welcomeSpecialties?: string;
  readonly transcriptMarker: string;
  readonly promptSymbol: string;
  readonly promptLabel?: string;
  readonly modelSetupHint: string;
  readonly modelMissingHint: string;
  readonly showRemoteBanners: boolean;
  readonly hiddenCommands: readonly string[];
  readonly identity?: {
    readonly productName: string;
    readonly platform: string;
    readonly uiMode: string;
  };
  readonly version?: string;
}

const KIMI_CODE_BRAND: InteractiveHostBrand = {
  id: 'kimi-code',
  productName: 'Kimi Code',
  assistantName: 'Kimi',
  commandName: 'kimi',
  processName: 'kimi-code',
  logo: ['▐█▛█▛█▌', '▐█████▌'],
  transcriptMarker: '● ',
  promptSymbol: '>',
  modelSetupHint: 'Run /login or /provider to get started.',
  modelMissingHint: 'not set, run /login or /provider',
  showRemoteBanners: true,
  hiddenCommands: [],
};

function ariadneBuddyVersion(env: NodeJS.ProcessEnv): string | undefined {
  const value = env['ARIADNE_VERSION']?.trim();
  if (value === undefined || value.length === 0 || value.length > 64) return undefined;
  return /^[0-9A-Za-z.+-]+$/.test(value) ? value : undefined;
}

export function resolveInteractiveHostBrand(
  env: NodeJS.ProcessEnv = process.env,
): InteractiveHostBrand {
  if (env['ARIADNE_TUI'] !== '1') return KIMI_CODE_BRAND;
  return {
    id: 'ariadne-buddy',
    productName: 'AriadneBuddy',
    assistantName: 'Ariadne',
    commandName: 'ariadnebuddy',
    processName: 'ariadne-buddy',
    logo: ['<~THREAD~>', ' LABYRINTH'],
    welcomeArt: [
      '    ___                              __  __                   ',
      '   /   |  _________ ___  _______   / / / /____  _______ ____ ',
      '  / /| | / ___/ __ `/ / / / ___/  / / / __/ _ \\/ ___/ __ `/ _ \\',
      ' / ___ |/ /  / /_/ / /_/ (__  )  / / / /_/  __/ /  / /_/ /  __/',
      '/_/  |_/_/   \\__, /\\__,_/____/  /_/  \\__/\\___/_/   \\__, /\\___/ ',
      '            /____/                                /____/',
      '       <=====[ T H R E A D   T H R O U G H ]=====>',
    ],
    welcomeTagline: 'MULTI-AGENT SCIENTIFIC DISCOVERY',
    welcomeDescription: 'Natural-product candidate nomination on deterministic Ariadne engines',
    welcomeSpecialties: 'SURVEY :: HYPOTHESIZE :: NOMINATE :: VALIDATE',
    transcriptMarker: '› ',
    promptSymbol: '›',
    promptLabel: 'DISCOVERY',
    modelSetupHint: 'Run /provider to configure a model.',
    modelMissingHint: 'not set, run /provider',
    showRemoteBanners: false,
    hiddenCommands: ['desktop', 'feedback', 'login', 'plugins', 'remote-control', 'web'],
    identity: {
      productName: 'ariadne-buddy',
      platform: 'ariadne_buddy',
      uiMode: 'ariadne-buddy',
    },
    version: ariadneBuddyVersion(env),
  };
}

export const INTERACTIVE_HOST = resolveInteractiveHostBrand();

export function isInteractiveHostCommandEnabled(commandName: string): boolean {
  return !INTERACTIVE_HOST.hiddenCommands.includes(commandName);
}
