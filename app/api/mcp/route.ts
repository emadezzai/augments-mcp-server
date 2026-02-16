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
import { searchFrameworks, getFrameworkInfo, getFrameworkDocs, getFrameworkContext } from '@/tools';
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
        tools: 7,
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

  return server;
}