/**
 * Augments MCP Server
 *
 * A comprehensive MCP server that provides real-time access to framework documentation
 * and context to enhance Claude Code's ability to generate accurate, up-to-date code.
 *
 * v4: Query-focused context extraction with TypeScript definition parsing.
 * Consolidated from 15 tools to 7 core tools for better LLM tool-use decisions.
 * Includes semantic code search for large codebases (50k+ lines).
 *
 * Uses the official MCP SDK for Claude Code compatibility.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRegistry, FrameworkRegistryManager } from '@/registry/manager';
import { getCache, KVCache } from '@/cache';
import { getGitHubProvider, GitHubProvider } from '@/providers/github';
import { getWebsiteProvider, WebsiteProvider } from '@/providers/website';
import {
  // Discovery tools
  listAvailableFrameworks,
  searchFrameworks,
  getFrameworkInfo,
  getRegistryStats,
  // Documentation tools
  getFrameworkDocs,
  getFrameworkExamples,
  searchDocumentation,
  // Context tools
  getFrameworkContext,
  analyzeCodeCompatibility,
  // Cache management tools
  checkFrameworkUpdates,
  refreshFrameworkCache,
  getCacheStats,
} from '@/tools';
// v4 Tools: Query-focused context extraction
import {
  getApiContext,
  formatApiContextResponse,
  searchApis,
  formatSearchApisResponse,
  getVersionInfo,
  formatVersionInfoResponse,
} from '@/tools/v4';
// Codebase Tools: For large codebases (50k+ lines)
import {
  semanticCodeSearch,
  formatSemanticSearchResponse,
  analyzeCodebaseStructure,
  formatCodebaseStructureResponse,
  getFileContext,
  formatFileContextResponse,
  findRelatedFiles,
  formatFindRelatedFilesResponse,
  extractModuleApi,
  formatExtractModuleApiResponse,
  detectArchitecturePattern,
  formatDetectArchitecturePatternResponse,
  analyzeImportGraph,
  formatAnalyzeImportGraphResponse,
  findPatternUsage,
  formatPatternUsageResponse,
  identifyPublicInterfaces,
  formatIdentifyPublicInterfacesResponse,
  generateCodeSummary,
  formatCodeSummaryResponse,
} from '@/tools/codebase';
import { FrameworkCategories } from '@/types';
import { getLogger } from '@/utils/logger';

const logger = getLogger('mcp-server');

// Server version
export const SERVER_VERSION = '4.1.0';

// Check if legacy tools are enabled via env var
const LEGACY_TOOLS_ENABLED = process.env.LEGACY_TOOLS_ENABLED === 'true';

// Singleton instance for serverless environments
let serverInstance: McpServer | null = null;

// Dependencies (cached)
let registry: FrameworkRegistryManager | null = null;
let cache: KVCache | null = null;
let githubProvider: GitHubProvider | null = null;
let websiteProvider: WebsiteProvider | null = null;

/**
 * Initialize dependencies
 */
async function initializeDependencies(): Promise<{
  registry: FrameworkRegistryManager;
  cache: KVCache;
  githubProvider: GitHubProvider;
  websiteProvider: WebsiteProvider;
}> {
  if (!registry) {
    registry = await getRegistry();
  }
  if (!cache) {
    cache = getCache();
  }
  if (!githubProvider) {
    githubProvider = getGitHubProvider();
  }
  if (!websiteProvider) {
    websiteProvider = getWebsiteProvider();
  }

  return { registry, cache, githubProvider, websiteProvider };
}

/**
 * Format tool result for MCP response
 */
function formatResult(result: unknown): { content: Array<{ type: 'text'; text: string }> } {
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Format error result for MCP response
 */
function formatError(error: unknown): { content: Array<{ type: 'text'; text: string }>; isError: true } {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Get the MCP server instance, creating it if necessary
 */
export async function getServer(): Promise<McpServer> {
  if (serverInstance) {
    return serverInstance;
  }

  logger.info('Initializing Augments MCP Server', { version: SERVER_VERSION });

  // Initialize dependencies
  const deps = await initializeDependencies();

  logger.info('Dependencies initialized', {
    frameworks: deps.registry.getFrameworkCount(),
    categories: deps.registry.getCategories(),
  });

  // Create SDK McpServer
  const server = new McpServer({
    name: 'augments-mcp-server',
    version: SERVER_VERSION,
  });

  let toolCount = 0;

  // ==================== Primary Tools (3) ====================
  // These are the main tools LLMs should use for most tasks

  server.tool(
    'get_api_context',
    'RECOMMENDED: Get precise API signatures, parameters, return types, and code examples for any npm package. Handles natural language like "react useEffect cleanup". Always try this first.',
    {
      query: z.string().min(1).describe('Natural language query (e.g., "useEffect cleanup" or "prisma findMany")'),
      framework: z.string().optional().describe('Specific framework to search in (e.g., "react", "prisma")'),
      version: z.string().optional().describe('Specific version (e.g., "19.0.0" or "latest")'),
      includeExamples: z.boolean().default(true).describe('Whether to include code examples'),
      maxExamples: z.number().min(0).max(5).default(2).describe('Maximum number of examples to include'),
    },
    async ({ query, framework, version, includeExamples, maxExamples }) => {
      try {
        const result = await getApiContext({
          query,
          framework,
          version,
          includeExamples: includeExamples ?? true,
          maxExamples: maxExamples ?? 2,
        });
        return formatResult(formatApiContextResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'get_api_context', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'search_apis',
    "Search for APIs across multiple frameworks when you don't know the exact name. Use for exploration like 'state management hooks'.",
    {
      query: z.string().min(1).describe('Search query (e.g., "state management hook")'),
      frameworks: z.array(z.string()).optional().describe('Limit search to specific frameworks'),
      limit: z.number().min(1).max(20).default(5).describe('Maximum results per framework'),
    },
    async ({ query, frameworks, limit }) => {
      try {
        const result = await searchApis({
          query,
          frameworks,
          limit: limit ?? 5,
        });
        return formatResult(formatSearchApisResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'search_apis', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'get_version_info',
    'Get version info, available versions, and breaking change detection for any npm package.',
    {
      framework: z.string().min(1).describe('Framework or package name'),
      fromVersion: z.string().optional().describe('Compare from this version'),
      toVersion: z.string().optional().describe('Compare to this version'),
    },
    async ({ framework, fromVersion, toVersion }) => {
      try {
        const result = await getVersionInfo({
          framework,
          fromVersion,
          toVersion,
        });
        return formatResult(formatVersionInfoResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'get_version_info', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  // ==================== Secondary Tools (4) ====================
  // Alternative tools for specific use cases

  server.tool(
    'search_frameworks',
    'ALTERNATIVE: Search for frameworks by name or keyword. Use when you need to discover which framework to use.',
    {
      query: z.string().min(1).describe('Search query'),
    },
    async ({ query }) => {
      try {
        const result = await searchFrameworks(deps.registry, { query });
        return formatResult(result);
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'search_frameworks', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'get_framework_info',
    'ALTERNATIVE: Get detailed framework metadata, features, and patterns.',
    {
      framework: z.string().min(1).describe('Framework name'),
    },
    async ({ framework }) => {
      try {
        const result = await getFrameworkInfo(deps.registry, { framework });
        return formatResult(result);
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'get_framework_info', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'get_framework_docs',
    "ALTERNATIVE: Fetch full documentation pages. Use only when get_api_context doesn't have enough detail.",
    {
      framework: z.string().min(1).describe('Framework name'),
      section: z.string().optional().describe('Specific documentation section'),
      use_cache: z.boolean().default(true).describe('Whether to use cached documentation'),
    },
    async ({ framework, section, use_cache }) => {
      try {
        const result = await getFrameworkDocs(deps.registry, deps.cache, deps.githubProvider, deps.websiteProvider, {
          framework,
          section,
          use_cache: use_cache ?? true,
        });
        return formatResult(result);
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'get_framework_docs', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'semantic_code_search',
    'Search code semantically in large codebases. Understands meaning, not just text. Use for finding code by concept (e.g., "payment processing", "auth logic").',
    {
      query: z.string().min(1).describe('Natural language search query (e.g., "payment processing logic")'),
      rootPath: z.string().optional().describe('Root directory to search (defaults to current working directory)'),
      filePattern: z.string().optional().describe('File pattern to match (e.g., "*.ts", "*.{ts,tsx}")'),
      maxResults: z.number().min(1).max(100).default(10).describe('Maximum number of results to return'),
      contextLines: z.number().min(0).max(20).default(3).describe('Number of context lines around each match'),
    },
    async ({ query, rootPath, filePattern, maxResults, contextLines }) => {
      try {
        const result = await semanticCodeSearch({
          query,
          rootPath,
          filePattern,
          maxResults: maxResults ?? 10,
          contextLines: contextLines ?? 3,
        });
        return formatResult(formatSemanticSearchResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'semantic_code_search', error });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'analyze_codebase_structure',
    'Analyze the complete structure of a project codebase. Provides file counts, language breakdown, directory tree, entry points, and configuration files. Essential for understanding large projects.',
    {
      rootPath: z.string().optional().describe('Root directory to analyze (defaults to current working directory)'),
      includeHidden: z.boolean().default(false).describe('Include hidden files and directories (starting with .)'),
      maxDepth: z.number().min(1).max(10).default(5).describe('Maximum depth for directory tree'),
    },
    async ({ rootPath, includeHidden, maxDepth }) => {
      try {
        const result = await analyzeCodebaseStructure({
          rootPath,
          includeHidden: includeHidden ?? false,
          maxDepth: maxDepth ?? 5,
        });
        return formatResult(formatCodebaseStructureResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'analyze_codebase_structure' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'get_file_context',
    'Get context for a specific file including imports, exports, functions, and classes. Essential for understanding individual files quickly.',
    {
      filePath: z.string().min(1).describe('Path to the file to analyze'),
      focusFunction: z.string().optional().describe('Focus on a specific function'),
      focusLine: z.number().optional().describe('Focus on a specific line number'),
      contextLines: z.number().min(1).max(100).optional().default(50).describe('Number of context lines around focus'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ filePath, focusFunction, focusLine, contextLines, rootPath }) => {
      try {
        const result = await getFileContext({
          filePath,
          focusFunction,
          focusLine,
          contextLines: contextLines ?? 50,
          rootPath,
        });
        return formatResult(formatFileContextResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'get_file_context' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'find_related_files',
    'Find files related to a given file based on imports, exports, and other relationships. Essential for understanding code dependencies.',
    {
      filePath: z.string().min(1).describe('Path to the file to find relations for'),
      relationTypes: z.array(z.enum(['imports', 'exports', 'inherits', 'calls', 'tests'])).optional().default(['imports']).describe('Types of relations to find'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
      maxDepth: z.number().min(1).max(10).optional().default(3).describe('Maximum depth for indirect relations'),
    },
    async ({ filePath, relationTypes, rootPath, maxDepth }) => {
      try {
        const result = await findRelatedFiles({
          filePath,
          relationTypes: relationTypes ?? ['imports'],
          rootPath,
          maxDepth: maxDepth ?? 3,
        });
        return formatResult(formatFindRelatedFilesResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'find_related_files' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'extract_module_api',
    'Extract the public API from a module including exports, types, interfaces, and dependencies. Essential for understanding module contracts and contracts in large codebases.',
    {
      modulePath: z.string().min(1).describe('Path to the module to analyze'),
      includePrivate: z.boolean().optional().default(false).describe('Include private/internal members'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ modulePath, includePrivate, rootPath }) => {
      try {
        const result = await extractModuleApi({
          modulePath,
          includePrivate: includePrivate ?? false,
          rootPath,
        });
        return formatResult(formatExtractModuleApiResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'extract_module_api' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'detect_architecture_pattern',
    'Detect design patterns and architecture styles used in a codebase. Analyzes directory structure, file naming, and code patterns to identify MVC, Clean Architecture, DDD, Hexagonal, Microservices, etc.',
    {
      rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
      includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
    },
    async ({ rootPath, includeHidden }) => {
      try {
        const result = await detectArchitecturePattern({
          rootPath,
          includeHidden: includeHidden ?? false,
        });
        return formatResult(formatDetectArchitecturePatternResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'detect_architecture_pattern' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'analyze_import_graph',
    'Analyze import/export dependencies in a codebase. Builds a dependency graph and detects circular dependencies. Essential for understanding code relationships and finding potential issues.',
    {
      rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
      includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
      maxDepth: z.number().optional().describe('Maximum depth for analysis (1-10)'),
    },
    async ({ rootPath, includeHidden, maxDepth }) => {
      try {
        const result = await analyzeImportGraph({
          rootPath,
          includeHidden: includeHidden ?? false,
          maxDepth: maxDepth ? Math.min(Math.max(1, maxDepth), 10) : undefined,
        });
        return formatResult(formatAnalyzeImportGraphResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'analyze_import_graph' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  server.tool(
    'find_pattern_usage',
    'Search for specific design patterns and coding patterns in a codebase. Find where patterns like singleton, observer, factory, middleware, etc. are used.',
    {
      pattern: z.string().min(1).describe('Pattern to search for (e.g., "singleton", "observer", "factory", "middleware", "decorator")'),
      rootPath: z.string().optional().describe('Root directory to search (defaults to current working directory)'),
      filePattern: z.string().optional().describe('File pattern to match (e.g., "*.ts", "*.{ts,tsx}")'),
      caseSensitive: z.boolean().optional().default(false).describe('Whether to match case exactly'),
    },
    async ({ pattern, rootPath, filePattern, caseSensitive }) => {
      try {
        const result = await findPatternUsage({
          pattern,
          rootPath,
          filePattern,
          caseSensitive: caseSensitive ?? false,
        });
        return formatResult(formatPatternUsageResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'find_pattern_usage' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  // Identify Public Interfaces
  server.tool(
    'identify_public_interfaces',
    'Identify public interfaces and exports in a package/module. Distinguishes between public, internal, and type exports.',
    {
      packagePath: z.string().min(1).describe('Path to the package or module to analyze'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ packagePath, rootPath }) => {
      try {
        const result = await identifyPublicInterfaces({
          packagePath,
          rootPath,
        });
        return formatResult(formatIdentifyPublicInterfacesResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'identify_public_interfaces' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  // Generate Code Summary
  server.tool(
    'generate_code_summary',
    'Generate a summary of code in a file or directory. Extracts key functions, classes, and main purpose.',
    {
      path: z.string().min(1).describe('Path to file or directory to summarize'),
      maxLength: z.number().min(50).max(1000).optional().default(500).describe('Maximum length of summary'),
      includeFunctions: z.boolean().optional().default(true).describe('Include key functions'),
      includeClasses: z.boolean().optional().default(true).describe('Include key classes'),
    },
    async ({ path, maxLength, includeFunctions, includeClasses }) => {
      try {
        const result = await generateCodeSummary({
          path,
          maxLength,
          includeFunctions,
          includeClasses,
        });
        return formatResult(formatCodeSummaryResponse(result));
      } catch (error) {
        logger.error('Tool execution failed', { tool: 'generate_code_summary' });
        return formatError(error);
      }
    }
  );
  toolCount++;

  // ==================== Legacy Tools (gated behind LEGACY_TOOLS_ENABLED) ====================
  // These tools are removed by default but can be re-enabled for backward compatibility

  if (LEGACY_TOOLS_ENABLED) {
    server.tool(
      'list_available_frameworks',
      'List all available frameworks, optionally filtered by category.',
      {
        category: z.enum(FrameworkCategories).optional().describe('Filter by framework category'),
      },
      async ({ category }) => {
        try {
          const result = await listAvailableFrameworks(deps.registry, { category });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'list_available_frameworks', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'get_registry_stats',
      'Get statistics about the framework registry.',
      {},
      async () => {
        try {
          const result = await getRegistryStats(deps.registry);
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'get_registry_stats', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'get_framework_examples',
      'Get code examples for specific patterns within a framework.',
      {
        framework: z.string().min(1).describe('Framework name'),
        pattern: z.string().optional().describe('Specific pattern to get examples for'),
      },
      async ({ framework, pattern }) => {
        try {
          const result = await getFrameworkExamples(deps.registry, deps.cache, deps.githubProvider, deps.websiteProvider, {
            framework,
            pattern,
          });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'get_framework_examples', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'search_documentation',
      "Search within a framework's documentation for specific topics or keywords.",
      {
        framework: z.string().min(1).describe('Framework name'),
        query: z.string().min(1).describe('Search query'),
        limit: z.number().min(1).max(50).default(10).describe('Maximum number of results'),
      },
      async ({ framework, query, limit }) => {
        try {
          const result = await searchDocumentation(deps.registry, deps.cache, deps.githubProvider, deps.websiteProvider, {
            framework,
            query,
            limit: limit ?? 10,
          });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'search_documentation', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'analyze_code_compatibility',
      'Analyze code for framework compatibility and suggest improvements.',
      {
        code: z.string().min(1).describe('Code to analyze'),
        frameworks: z.array(z.string().min(1)).min(1).describe('List of frameworks to check compatibility with'),
      },
      async ({ code, frameworks }) => {
        try {
          const result = await analyzeCodeCompatibility(deps.registry, { code, frameworks });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'analyze_code_compatibility', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'check_framework_updates',
      'Check if framework documentation has been updated since last cache.',
      {
        framework: z.string().min(1).describe('Framework name'),
      },
      async ({ framework }) => {
        try {
          const result = await checkFrameworkUpdates(deps.registry, deps.cache, deps.githubProvider, { framework });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'check_framework_updates', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'refresh_framework_cache',
      'Refresh cached documentation for frameworks.',
      {
        framework: z.string().optional().describe('Framework name (optional, refreshes all if not specified)'),
        force: z.boolean().default(false).describe('Force refresh even if cache is valid'),
      },
      async ({ framework, force }) => {
        try {
          const result = await refreshFrameworkCache(deps.registry, deps.cache, deps.githubProvider, deps.websiteProvider, {
            framework,
            force: force ?? false,
          });
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'refresh_framework_cache', error });
          return formatError(error);
        }
      }
    );
    toolCount++;

    server.tool(
      'get_cache_stats',
      'Get detailed cache statistics and performance metrics.',
      {},
      async () => {
        try {
          const result = await getCacheStats(deps.registry, deps.cache);
          return formatResult(result);
        } catch (error) {
          logger.error('Tool execution failed', { tool: 'get_cache_stats', error });
          return formatError(error);
        }
      }
    );
    toolCount++;
  }

  logger.info('MCP Server initialized successfully', {
    tools: toolCount,
    legacyToolsEnabled: LEGACY_TOOLS_ENABLED,
    version: SERVER_VERSION,
  });

  serverInstance = server;

  // Cache warming: pre-fetch types for popular frameworks (non-blocking)
  warmPopularFrameworks().catch((error) => {
    logger.warn('Cache warming failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return server;
}

/**
 * Pre-fetch types for the most commonly queried frameworks.
 * Runs in the background after server initialization to eliminate cold-start latency.
 */
async function warmPopularFrameworks(): Promise<void> {
  const { getTypeFetcher } = await import('@/core');
  const typeFetcher = getTypeFetcher();

  const popularPackages = [
    'react',
    'next',
    'vue',
    'zod',
    'express',
    '@prisma/client',
    '@tanstack/react-query',
    'react-dom',
  ];

  // Warm in batches of 3 to avoid overwhelming the network
  const batchSize = 3;
  for (let i = 0; i < popularPackages.length; i += batchSize) {
    const batch = popularPackages.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map((pkg) => typeFetcher.fetchTypes(pkg))
    );
  }

  logger.info('Cache warming completed', {
    packages: popularPackages.length,
  });
}
