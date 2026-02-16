/**
 * Environment configuration for Augments MCP Server
 * 
 * Updated for 100% local operation - no Upstash Redis required.
 * Minimax and Chutes are optional enhancements.
 */

export interface Config {
  // Server settings
  port: number;
  host: string;
  env: 'development' | 'production' | 'test';

  // GitHub settings (optional - for examples fallback)
  githubToken?: string;

  // Minimax settings (optional - for enhanced query parsing)
  minimaxApiKey?: string;
  minimaxBaseUrl?: string;
  minimaxModel?: string;

  // Chutes settings (optional - for enhanced examples)
  chutesApiKey?: string;
  chutesBaseUrl?: string;

  // Cache settings
  cachePath: string;
  cacheMaxEntries: number;
  enableAutoCache: boolean;
  enableHotReload: boolean;

  // Rate limiting (local, no Redis)
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number; // in seconds

  // Logging
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Feature flags
  useAiQueryParsing: boolean;
  useChutesExamples: boolean;
}

function getEnvString(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

export function getConfig(): Config {
  const env = getEnvString('NODE_ENV', 'development') as Config['env'];

  return {
    // Server settings
    port: getEnvNumber('PORT', 3000),
    host: getEnvString('HOST', '0.0.0.0') || '0.0.0.0',
    env,

    // GitHub settings (optional)
    githubToken: getEnvString('GITHUB_TOKEN'),

    // Minimax settings (optional)
    minimaxApiKey: getEnvString('MINIMAX_API_KEY'),
    minimaxBaseUrl: getEnvString('MINIMAX_BASE_URL', 'https://api.minimax.chat/v1'),
    minimaxModel: getEnvString('MINIMAX_MODEL', 'abab6.5s-chat'),

    // Chutes settings (optional)
    chutesApiKey: getEnvString('CHUTES_API_KEY'),
    chutesBaseUrl: getEnvString('CHUTES_BASE_URL', 'https://api.chutes.ai/v1'),

    // Cache settings
    cachePath: getEnvString('CACHE_PATH', './.cache') || './.cache',
    cacheMaxEntries: getEnvNumber('CACHE_MAX_ENTRIES', 300),
    enableAutoCache: getEnvBoolean('ENABLE_AUTO_CACHE', false),
    enableHotReload: getEnvBoolean('ENABLE_HOT_RELOAD', env === 'development'),

    // Rate limiting (local)
    rateLimitEnabled: getEnvBoolean('RATE_LIMIT_ENABLED', false),
    rateLimitRequests: getEnvNumber('RATE_LIMIT_REQUESTS', 100),
    rateLimitWindow: getEnvNumber('RATE_LIMIT_WINDOW', 3600), // 1 hour

    // Logging
    logLevel: (getEnvString('LOG_LEVEL', env === 'production' ? 'info' : 'debug') || 'info') as Config['logLevel'],

    // Feature flags
    useAiQueryParsing: getEnvBoolean('USE_AI_QUERY_PARSING', false),
    useChutesExamples: getEnvBoolean('USE_CHUTES_EXAMPLES', false),
  };
}

// Export singleton config
export const config = getConfig();