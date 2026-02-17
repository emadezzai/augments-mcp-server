/**
 * MCP API Route for Vercel
 *
 * Handles HTTP requests for the MCP server using the official MCP SDK transport.
 * Uses WebStandardStreamableHTTPServerTransport for Claude Code compatibility.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { getRegistry } from '@/registry/manager';
import { getCache } from '@/cache';
import { getGitHubProvider } from '@/providers/github';
import { getWebsiteProvider } from '@/providers/website';
import { getApiContext, searchApis, getVersionInfo, formatApiContextResponse, formatSearchApisResponse, formatVersionInfoResponse } from '@/tools/v4';
import { searchFrameworks, getFrameworkInfo, getFrameworkDocs, getFrameworkContext, listAvailableFrameworks, getRegistryStats, checkFrameworkUpdates, refreshFrameworkCache, getCacheStats } from '@/tools';
import { analyzeCodebaseStructure, formatCodebaseStructureResponse, semanticCodeSearch, formatSemanticSearchResponse, getFileContext, formatFileContextResponse, findRelatedFiles, formatFindRelatedFilesResponse, extractModuleApi, formatExtractModuleApiResponse, detectArchitecturePattern, formatDetectArchitecturePatternResponse, analyzeImportGraph, formatAnalyzeImportGraphResponse, findPatternUsage, formatPatternUsageResponse, identifyPublicInterfaces, formatIdentifyPublicInterfacesResponse, generateCodeSummary, formatCodeSummaryResponse } from '@/tools/codebase';
import { getLogger } from '@/utils/logger';

const logger = getLogger('api:mcp');
const SERVER_VERSION = '4.1.0';

// CORS headers for MCP protocol
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version',
};

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Handle GET requests - MCP protocol or health check
 */
export async function GET(request: Request) {
  // Check if this is an MCP protocol request (has Accept header for SSE or JSON)
  const acceptHeader = request.headers.get('Accept') || '';
  const isMcpRequest = acceptHeader.includes('text/event-stream') || acceptHeader.includes('application/json');

  if (!isMcpRequest) {
    // Return health check response for non-MCP requests
        return new Response(
      JSON.stringify({
        name: 'augments-mcp-server',
        version: SERVER_VERSION,
        status: 'healthy',
        transport: 'streamable-http',
        endpoint: '/api/mcp',
        tools: 16,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle MCP GET request (for SSE streams)
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for serverless
      enableJsonResponse: true, // JSON instead of SSE for serverless compatibility
    });

    const server = await createServer();
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    logger.error('MCP GET request failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle POST requests - MCP protocol messages
 */
export async function POST(request: Request) {
  try {
    // Create a new server instance for each request to avoid conflicts
    const server = await createServer();
    
    // Create a new transport for this request
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for serverless
      enableJsonResponse: true, // JSON instead of SSE for serverless compatibility
    });

    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    const response = await transport.handleRequest(request);

    // Disconnect after handling
    await transport.close();

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    logger.error('MCP POST request failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Handle DELETE requests - Session termination
 */
export async function DELETE(request: Request) {
  try {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for serverless
      enableJsonResponse: true,
    });

    const server = await createServer();
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // Add CORS headers to the response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    logger.error('MCP DELETE request failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal server error',
        },
        id: null,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
}

/**
 * Create and configure MCP server
 */
async function createServer(): Promise<McpServer> {
  const server = new McpServer({
    name: 'augments-mcp-server',
    version: SERVER_VERSION,
  });

  // Initialize dependencies
  const registry = await getRegistry();
  const cache = getCache();
  const githubProvider = getGitHubProvider();
  const websiteProvider = getWebsiteProvider();

  // Register tools
  // Tool 1: get_api_context
  server.tool(
    'get_api_context',
    'Get precise API signatures, parameters, return types, and code examples for any npm package.',
    {
      query: z.string().min(1).describe('Natural language query'),
      framework: z.string().optional().describe('Specific framework'),
      version: z.string().optional().describe('Specific version'),
      includeExamples: z.boolean().default(true).describe('Include code examples'),
      maxExamples: z.number().min(0).max(5).default(2).describe('Max examples'),
    },
    async ({ query, framework, version, includeExamples, maxExamples }) => {
      const result = await getApiContext({
        query,
        framework,
        version,
        includeExamples: includeExamples ?? true,
        maxExamples: maxExamples ?? 2,
      });
      return { content: [{ type: 'text', text: formatApiContextResponse(result) }] };
    }
  );

  // Tool 2: search_apis
  server.tool(
    'search_apis',
    'Search for APIs across multiple frameworks.',
    {
      query: z.string().min(1).describe('Search query'),
      frameworks: z.array(z.string()).optional().describe('Limit to frameworks'),
      limit: z.number().min(1).max(20).default(5).describe('Max results'),
    },
    async ({ query, frameworks, limit }) => {
      const result = await searchApis({ query, frameworks, limit: limit ?? 5 });
      return { content: [{ type: 'text', text: formatSearchApisResponse(result) }] };
    }
  );

  // Tool 3: get_version_info
  server.tool(
    'get_version_info',
    'Get version info and breaking changes.',
    {
      framework: z.string().min(1).describe('Framework name'),
      fromVersion: z.string().optional().describe('From version'),
      toVersion: z.string().optional().describe('To version'),
    },
    async ({ framework, fromVersion, toVersion }) => {
      const result = await getVersionInfo({ framework, fromVersion, toVersion });
      return { content: [{ type: 'text', text: formatVersionInfoResponse(result) }] };
    }
  );

  // Tool 4: search_frameworks
  server.tool(
    'search_frameworks',
    'Search for frameworks.',
    {
      query: z.string().min(1).describe('Search query'),
    },
    async ({ query }) => {
      const result = await searchFrameworks(registry, { query });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 5: get_framework_info
  server.tool(
    'get_framework_info',
    'Get framework metadata.',
    {
      framework: z.string().min(1).describe('Framework name'),
    },
    async ({ framework }) => {
      const result = await getFrameworkInfo(registry, { framework });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 6: get_framework_docs
  server.tool(
    'get_framework_docs',
    'Fetch documentation.',
    {
      framework: z.string().min(1).describe('Framework name'),
      section: z.string().optional().describe('Section'),
      use_cache: z.boolean().default(true).describe('Use cache'),
    },
    async ({ framework, section, use_cache }) => {
      const result = await getFrameworkDocs(registry, cache, githubProvider, websiteProvider, {
        framework,
        section,
        use_cache: use_cache ?? true,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 7: get_framework_context
  server.tool(
    'get_framework_context',
    'Get multi-framework context.',
    {
      frameworks: z.array(z.string().min(1)).min(1).describe('Frameworks'),
      task_description: z.string().min(1).describe('Task description'),
    },
    async ({ frameworks, task_description }) => {
      const result = await getFrameworkContext(registry, cache, { frameworks, task_description });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 8: list_frameworks
  server.tool(
    'list_frameworks',
    'List all available frameworks, optionally filtered by category.',
    {
      category: z.enum(['web', 'backend', 'mobile', 'ai-ml', 'design', 'tools', 'database', 'devops', 'testing', 'state-management']).optional().describe('Filter by category'),
    },
    async ({ category }) => {
      const result = await listAvailableFrameworks(registry, { category });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 9: get_registry_stats
  server.tool(
    'get_registry_stats',
    'Get statistics about the framework registry.',
    {},
    async () => {
      const result = await getRegistryStats(registry);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 10: check_framework_updates
  server.tool(
    'check_framework_updates',
    'Check if framework documentation has been updated since last cache.',
    {
      framework: z.string().min(1).describe('Framework name to check for updates'),
    },
    async ({ framework }) => {
      const result = await checkFrameworkUpdates(registry, cache, githubProvider, { framework });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 11: refresh_cache
  server.tool(
    'refresh_cache',
    'Refresh cached documentation for frameworks.',
    {
      framework: z.string().optional().describe('Specific framework to refresh, or omit for all frameworks'),
      force: z.boolean().default(false).describe('Force refresh even if cache is still valid'),
    },
    async ({ framework, force }) => {
      const result = await refreshFrameworkCache(registry, cache, githubProvider, websiteProvider, { framework, force });
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Tool 12: get_cache_stats
  server.tool(
    'get_cache_stats',
    'Get comprehensive cache statistics.',
    {},
    async () => {
      const result = await getCacheStats(registry, cache);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 13: analyze_codebase_structure
  server.tool(
    'analyze_codebase_structure',
    'Analyze the complete structure of a project codebase. Provides file counts, language breakdown, directory tree, entry points, and configuration files.',
    {
      rootPath: z.string().optional().describe('Root directory to analyze'),
      includeHidden: z.boolean().default(false).describe('Include hidden files'),
      maxDepth: z.number().min(1).max(10).default(5).describe('Maximum depth for directory tree'),
    },
    async ({ rootPath, includeHidden, maxDepth }) => {
      const result = await analyzeCodebaseStructure({
        rootPath,
        includeHidden: includeHidden ?? false,
        maxDepth: maxDepth ?? 5,
      });
      return { content: [{ type: 'text', text: formatCodebaseStructureResponse(result) }] };
    }
  );

  // Tool 14: semantic_code_search
  server.tool(
    'semantic_code_search',
    'Search code semantically in large codebases. Understands meaning, not just text. Use for finding code by concept.',
    {
      query: z.string().min(1).describe('Natural language search query'),
      rootPath: z.string().optional().describe('Root directory to search'),
      filePattern: z.string().optional().describe('File pattern to match'),
      maxResults: z.number().min(1).max(100).default(10).describe('Maximum number of results'),
      contextLines: z.number().min(0).max(20).default(3).describe('Number of context lines'),
    },
    async ({ query, rootPath, filePattern, maxResults, contextLines }) => {
      const result = await semanticCodeSearch({
        query,
        rootPath,
        filePattern,
        maxResults: maxResults ?? 10,
        contextLines: contextLines ?? 3,
      });
      return { content: [{ type: 'text', text: formatSemanticSearchResponse(result) }] };
    }
  );

  // Tool 15: get_file_context
  server.tool(
    'get_file_context',
    'Get context for a specific file including imports, exports, functions, and classes. Designed for understanding code quickly.',
    {
      filePath: z.string().min(1).describe('Path to the file to analyze'),
      focusFunction: z.string().optional().describe('Focus on a specific function'),
      focusLine: z.number().optional().describe('Focus on a specific line number'),
      contextLines: z.number().min(1).max(100).default(50).describe('Number of context lines around focus'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ filePath, focusFunction, focusLine, contextLines, rootPath }) => {
      const result = await getFileContext({
        filePath,
        focusFunction,
        focusLine,
        contextLines: contextLines ?? 50,
        rootPath,
      });
      return { content: [{ type: 'text', text: formatFileContextResponse(result) }] };
    }
  );

  // Tool 16: find_related_files
  server.tool(
    'find_related_files',
    'Find files related to a given file based on imports, exports, and other relationships.',
    {
      filePath: z.string().min(1).describe('Path to the file to find relations for'),
      relationTypes: z.array(z.enum(['imports', 'exports', 'inherits', 'calls', 'tests'])).optional().describe('Types of relations to find'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
      maxDepth: z.number().min(1).max(10).optional().describe('Maximum depth for indirect relations'),
    },
    async ({ filePath, relationTypes, rootPath, maxDepth }) => {
      const result = await findRelatedFiles({
        filePath,
        relationTypes: relationTypes ?? ['imports'],
        rootPath,
        maxDepth: maxDepth ?? 3,
      });
      return { content: [{ type: 'text', text: formatFindRelatedFilesResponse(result) }] };
    }
  );

  // Tool 17: identify_public_interfaces
  server.tool(
    'identify_public_interfaces',
    'Identify public vs internal exports in packages/modules. Distinguishes between public, internal, and type exports. Detects re-exports and private exports.',
    {
      packagePath: z.string().min(1).describe('Path to the package or module to analyze'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ packagePath, rootPath }) => {
      const result = await identifyPublicInterfaces({
        packagePath,
        rootPath,
      });
      return { content: [{ type: 'text', text: formatIdentifyPublicInterfacesResponse(result) }] };
    }
  );

  // Tool 18: generate_code_summary
  server.tool(
    'generate_code_summary',
    'Generate summaries of code files or directories. Extracts key functions and classes, infers main purpose from code patterns. Supports both individual files and entire directories.',
    {
      path: z.string().min(1).describe('Path to file or directory to summarize'),
      maxLength: z.number().min(50).max(1000).optional().default(500).describe('Maximum length of summary'),
      includeFunctions: z.boolean().optional().default(true).describe('Include key functions'),
      includeClasses: z.boolean().optional().default(true).describe('Include key classes'),
    },
    async ({ path, maxLength, includeFunctions, includeClasses }) => {
      const result = await generateCodeSummary({
        path,
        maxLength: maxLength ?? 500,
        includeFunctions: includeFunctions ?? true,
        includeClasses: includeClasses ?? true,
      });
      return { content: [{ type: 'text', text: formatCodeSummaryResponse(result) }] };
    }
  );

  // Tool 19: extract_module_api
  server.tool(
    'extract_module_api',
    'Extract the public API from a module including exports, types, interfaces, and dependencies. Essential for understanding module contracts.',
    {
      modulePath: z.string().min(1).describe('Path to the module to analyze'),
      includePrivate: z.boolean().optional().describe('Include private/internal members'),
      rootPath: z.string().optional().describe('Root path for resolving imports'),
    },
    async ({ modulePath, includePrivate, rootPath }) => {
      const result = await extractModuleApi({
        modulePath,
        includePrivate: includePrivate ?? false,
        rootPath,
      });
      return { content: [{ type: 'text', text: formatExtractModuleApiResponse(result) }] };
    }
  );

  // Tool 20: detect_architecture_pattern
  server.tool(
    'detect_architecture_pattern',
    'Detect design patterns and architecture styles used in a codebase. Analyzes directory structure, file naming, and code patterns to identify MVC, Clean Architecture, DDD, Hexagonal, Microservices, etc.',
    {
      rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
      includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
    },
    async ({ rootPath, includeHidden }) => {
      const result = await detectArchitecturePattern({
        rootPath,
        includeHidden: includeHidden ?? false,
      });
      return { content: [{ type: 'text', text: formatDetectArchitecturePatternResponse(result) }] };
    }
  );

  // Tool 21: analyze_import_graph
  server.tool(
    'analyze_import_graph',
    'Analyze import/export dependencies in a codebase. Builds a dependency graph and detects circular dependencies. Essential for understanding code relationships and finding potential issues.',
    {
      rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
      includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories'),
      maxDepth: z.number().optional().describe('Maximum depth for analysis (1-10)'),
    },
    async ({ rootPath, includeHidden, maxDepth }) => {
      const result = await analyzeImportGraph({
        rootPath,
        includeHidden: includeHidden ?? false,
        maxDepth: maxDepth ? Math.min(Math.max(1, maxDepth), 10) : undefined,
      });
      return { content: [{ type: 'text', text: formatAnalyzeImportGraphResponse(result) }] };
    }
  );

  // Tool 20: find_pattern_usage
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
      const result = await findPatternUsage({
        pattern,
        rootPath,
        filePattern,
        caseSensitive: caseSensitive ?? false,
      });
      return { content: [{ type: 'text', text: formatPatternUsageResponse(result) }] };
    }
  );

  return server;
}
