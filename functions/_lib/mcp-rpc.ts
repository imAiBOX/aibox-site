// Read-only MCP JSON-RPC logic shared by both HTTP routes.
import { configCapability, CONFIG_CAPABILITY_VERSION, CONFIG_PLATFORMS, type ConfigPlatform } from './config-capability-v1.ts';
export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

export type ReadAppProfile = (appId: string) => Promise<unknown>;

const SERVER_INFO = { name: 'aibox-im', version: '1.0.0' };
const PROTOCOL_FALLBACK = '2025-03-26';
const SITE = 'https://aibox.im';
const TOOL = 'get_aibox_info';
const SECTIONS = ['product', 'download', 'apps', 'guidance'] as const;
const PLATFORMS = CONFIG_PLATFORMS;
type Platform = ConfigPlatform;
const LANGUAGES = ['en', 'zh'] as const;
type Language = typeof LANGUAGES[number];
const REGISTRY_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChoice<T extends string>(choices: readonly T[], value: unknown): value is T {
  return choices.some((choice) => choice === value);
}

function isRegistryId(value: unknown): value is string {
  return typeof value === 'string' && REGISTRY_ID.test(value);
}

function downloadText(lang: Language, platform?: Platform): string {
  const options = [
    { platform: 'windows', label: 'Windows x64 (.exe)' },
    { platform: 'macos', label: lang === 'zh' ? 'macOS 12+ 通用版（.dmg）' : 'macOS 12+ Universal (.dmg)' },
  ].filter((option) => !platform || option.platform === platform);
  const choice = options.map(({ label }) => label).join(lang === 'zh' ? '、' : ' or ');
  const url = `${SITE}/${lang}/download/`;
  return lang === 'zh'
    ? `打开官方下载页 ${url}，选择 ${choice}。请在下载页核对文件名和可用的 SHA-256 校验值。`
    : `Open the official download page ${url} and select ${choice}. Check the file name and any available SHA-256 checksum there.`;
}

function informationText(section: typeof SECTIONS[number], lang: Language, platform?: Platform): string {
  if (section === 'download') return downloadText(lang, platform);
  if (section === 'apps') {
    return lang === 'zh'
      ? `应用目录快照：${SITE}/meta/index.json\n应用清单（平台、安装资产及 SHA-256、配置和维护）：${SITE}/meta/apps/{id}/app.json\n中文应用教程：${SITE}/zh/apps/`
      : `App catalog snapshot: ${SITE}/meta/index.json\nApp profiles (platforms, install assets and SHA-256, configuration and maintenance): ${SITE}/meta/apps/{id}/app.json\nApp guides: ${SITE}/en/apps/`;
  }
  const overview = lang === 'zh'
    ? 'AiBOX 是面向 Windows 和 macOS 的桌面安装助手。它检查本机环境并校验下载。模型服务需按应用、平台和服务商选择配置方式，由用户在本机确认并验证。'
    : 'AiBOX — "Installed until it works." A desktop installation companion for Windows and macOS. It checks the local environment and verifies downloads. Model setup varies by app, platform and provider. Users confirm and test their setup locally.';
  return `${overview}\n${downloadText(lang)}\nhttps://github.com/imAiBOX/aibox-app`;
}

function guidanceText(profile: Record<string, unknown>, appId: string, providerId: string, platform: Platform, lang: Language, canUseWizard: boolean): string {
  const app = typeof profile.name === 'string' ? profile.name : appId;
  const version = typeof profile.version === 'string' ? ` (${profile.version})` : '';
  const os = platform === 'windows' ? 'Windows' : 'macOS';
  const guide = `${SITE}/${lang}/apps/${appId}/`;
  const source = `${SITE}/meta/apps/${appId}/app.json`;

  if (lang === 'zh') {
    const setup = canUseWizard
      ? '如果你的 AiBOX 版本提供辅助配置向导，并且向导支持这个应用和服务商，请在本机检查并确认；否则请按应用教程手动配置。完成后在应用中测试连接或发送一条测试消息。'
      : '请按应用教程在本机手动配置。完成后在应用中测试连接或发送一条测试消息。';
    return `${app}${version} · ${providerId} · ${os}\n${setup}\n这份只读指引依据应用目录和新版配置规则，不代表已发布的 AiBOX v0.1.21 的行为，也未核实你的 AiBOX 版本或本机配置。请在本机输入所需凭据并确认操作。\n教程：${guide}\n目录依据：${source}`;
  }
  const setup = canUseWizard
    ? 'If your AiBOX version offers the setup wizard for this app and provider, review and confirm the setup there; otherwise, use the app guide to configure it manually. Then test the connection or send a test message in the app.'
    : 'Configure the provider manually on your device using the app guide. Then test the connection or send a test message in the app.';
  return `${app}${version} · ${providerId} · ${os}\n${setup}\nThis read-only guidance follows the catalog and newer setup rules, not the behavior of the released AiBOX v0.1.21. It does not verify your AiBOX version or local setup. Enter any credentials and confirm changes on your own device.\nGuide: ${guide}\nCatalog source: ${source}`;
}

/** Dispatch one JSON-RPC message. Returns null for notifications. */
export async function handleRpc(msg: unknown, readAppProfile?: ReadAppProfile): Promise<JsonRpcResponse | null> {
  const id = isRecord(msg) && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
  const error = (code: number, message: string): JsonRpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });
  const result = (data: Record<string, unknown>): JsonRpcResponse => ({ jsonrpc: '2.0', id, result: data });
  const textResult = (text: string) => result({ content: [{ type: 'text', text }] });
  if (!isRecord(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string'
    || (msg.id !== undefined && msg.id !== null && id === null)) return error(-32600, 'Invalid Request');
  if (msg.id === undefined) return null;

  if (msg.method === 'initialize') {
    return result({
      protocolVersion: PROTOCOL_FALLBACK,
      serverInfo: SERVER_INFO,
      capabilities: { tools: {} },
    });
  }

  if (msg.method === 'tools/list') {
    return result({
      tools: [{
        name: TOOL,
        description: 'Read-only AiBOX overview, platform downloads, app catalog, or local setup guidance. The guidance section requires appId, provider, and platform.',
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            section: { type: 'string', enum: SECTIONS, default: 'product' },
            lang: { type: 'string', enum: LANGUAGES, default: 'en' },
            platform: { type: 'string', enum: PLATFORMS, description: 'For download or guidance.' },
            appId: { type: 'string', pattern: REGISTRY_ID.source, description: 'Catalog app ID for guidance.' },
            provider: { type: 'string', pattern: REGISTRY_ID.source, description: 'Catalog provider ID for guidance.' },
          },
        },
      }],
    });
  }

  if (msg.method !== 'tools/call') return error(-32601, 'Method not found');
  const params = msg.params;
  if (!isRecord(params) || typeof params.name !== 'string') return error(-32602, 'Expected a tool name');
  if (params.name !== TOOL) return error(-32602, 'Unknown tool');
  if (Object.keys(params).some((k) => k !== 'name' && k !== 'arguments' && k !== '_meta')) {
    return error(-32602, 'Unknown tool call parameter');
  }
  if (params._meta !== undefined && !isRecord(params._meta)) return error(-32602, 'Tool metadata must be an object');
  const args = params.arguments === undefined ? {} : params.arguments;
  if (!isRecord(args)) return error(-32602, 'Tool arguments must be an object');
  const { section = 'product', lang = 'en', platform, appId, provider } = args;
  if (!isChoice(SECTIONS, section)) return error(-32602, 'Unknown section');
  if (!isChoice(LANGUAGES, lang)) return error(-32602, 'Language must be en or zh');
  const allowed = ['section', 'lang'];
  if (section === 'download' || section === 'guidance') allowed.push('platform');
  if (section === 'guidance') allowed.push('appId', 'provider');
  if (Object.keys(args).some((k) => !allowed.includes(k))) return error(-32602, 'Unknown argument for this section');
  if (platform !== undefined && !isChoice(PLATFORMS, platform)) return error(-32602, 'Platform must be windows or macos');
  if (section !== 'guidance') return textResult(informationText(section, lang, platform));
  if (!isChoice(PLATFORMS, platform) || !isRegistryId(appId) || !isRegistryId(provider)) {
    return error(-32602, 'Guidance requires platform, appId and provider');
  }

  let profile: unknown;
  try {
    profile = await readAppProfile?.(appId);
  } catch {
    return error(-32603, 'App catalog snapshot is unavailable');
  }
  if (profile === null) return error(-32602, 'No catalog entry available for this app');
  if (!isRecord(profile) || profile.id !== appId || !Array.isArray(profile.packages) || !isRecord(profile.modelProviders)) {
    return error(-32603, 'App catalog profile is unavailable');
  }
  const hasAppPackage = profile.packages.some((pkg) => isRecord(pkg) && pkg.kind === 'app'
    && Array.isArray(pkg.platforms) && pkg.platforms.includes(platform));
  if (!hasAppPackage) return error(-32602, 'No app package listed for this platform');
  const providerInfo = Object.hasOwn(profile.modelProviders, provider) ? profile.modelProviders[provider] : undefined;
  if (!isRecord(providerInfo)) return error(-32602, 'Provider is not listed for this app');
  const capability = configCapability(profile, appId, provider, platform);
  return result({
    content: [{ type: 'text', text: guidanceText(profile, appId, provider, platform, lang, capability === 'assisted') }],
    _meta: { 'aibox.im/config-capability': { version: CONFIG_CAPABILITY_VERSION, capability } },
  });
}

export async function handleBody(body: string, readAppProfile?: ReadAppProfile): Promise<JsonRpcResponse | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
  }
  return handleRpc(parsed, readAppProfile);
}
