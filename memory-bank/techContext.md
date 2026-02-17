# Tech Context - Technologies & Development Setup

## Core Technologies

### Runtime & Language
- **Node.js**: >=18.0.0
- **TypeScript**: ^5.4.0
- **Next.js**: ^14.2.0 (MCP server host)

### MCP SDK
- **@modelcontextprotocol/sdk**: ^1.12.0

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^14.2.0 | Web framework |
| react | ^18.2.0 | UI library |
| zod | ^3.23.0 | Validation |
| @octokit/rest | ^21.0.0 | GitHub API |
| turndown | ^7.2.0 | HTML to Markdown |
| jsdom | ^24.0.0 | DOM parsing |

### Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.4.0 | Type checking |
| vitest | ^3.2.4 | Testing |
| eslint | ^8.57.0 | Linting |
| tsx | ^4.7.0 | TypeScript execution |

## Project Structure

```
augments-mcp-server/
├── app/                    # Next.js app router
│   ├── api/mcp/           # MCP server endpoint
│   │   └── route.ts       # Main MCP handler
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── cache/             # Caching layer
│   │   ├── file-cache.ts
│   │   ├── kv-cache.ts
│   │   ├── strategies.ts
│   │   └── unified-cache.ts
│   ├── config/            # Configuration
│   ├── core/              # Core processing
│   │   ├── query-parser.ts
│   │   ├── type-fetcher.ts
│   │   ├── type-parser.ts
│   │   ├── example-extractor.ts
│   │   └── version-registry.ts
│   ├── middleware/        # Express middleware
│   ├── providers/         # External providers
│   ├── registry/          # Framework registry
│   ├── tools/             # MCP tools
│   │   ├── v4/            # v4 API tools
│   │   ├── codebase/      # Code search
│   │   └── *.ts
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
├── frameworks/            # Framework configs (JSON)
│   ├── web/               # Web frameworks
│   ├── backend/           # Backend frameworks
│   ├── ai-ml/             # AI/ML frameworks
│   └── ...
├── scripts/               # Build scripts
└── memory-bank/           # This Memory Bank
```

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- npm or pnpm

### Installation
```bash
npm install
```

### Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run type-check` | Type check |
| `npm run lint` | Lint code |

### Local MCP Testing

```bash
# Setup local configuration
npm run setup:local

# Test MCP tools
curl http://localhost:3000/api/mcp
```

## Environment Variables

### Required (for local dev)
```bash
PORT=3000
HOST=localhost
NODE_ENV=development
```

### Optional
```bash
# GitHub - for higher rate limits and examples
GITHUB_TOKEN=your_token

# Minimax - for enhanced query parsing
MINIMAX_API_KEY=your_key

# Chutes - for additional examples
CHUTES_API_KEY=your_key
```

## Testing

- **Framework**: Vitest
- **Test files**: `*.test.ts` alongside source files
- **Run tests**: `npm run test`
- **Watch mode**: `npm run test:watch`

## Build & Deployment

### Local Build
```bash
npm run build
```

### Vercel Deployment
```bash
# Environment variables for Vercel:
# GITHUB_TOKEN (optional)
# UPSTASH_REDIS_REST_URL (optional - legacy)
# UPSTASH_REDIS_REST_TOKEN (optional - legacy)
```

## Code Style

- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier (implied via ESLint)
- **TypeScript**: Strict mode enabled

## MCP Server Configuration

The server exposes 16 tools:

### v4 API Context Tools
1. `get_api_context` - Get precise API signatures, parameters, return types, and code examples for any npm package
2. `search_apis` - Search for APIs across multiple frameworks
3. `get_version_info` - Get version info and breaking changes

### Framework Discovery
4. `search_frameworks` - Search for frameworks by name or feature
5. `get_framework_info` - Get framework metadata
6. `list_frameworks` - List all available frameworks, optionally filtered by category
7. `get_registry_stats` - Get statistics about the framework registry

### Documentation Access
8. `get_framework_docs` - Fetch documentation for a framework

### Context Enhancement
9. `get_framework_context` - Get multi-framework context for a task

### Cache Management
10. `check_framework_updates` - Check if framework documentation has been updated since last cache
11. `refresh_cache` - Refresh cached documentation for frameworks
12. `get_cache_stats` - Get comprehensive cache statistics

### Codebase Analysis
13. `analyze_codebase_structure` - Analyze the complete structure of a project codebase
14. `semantic_code_search` - Search code semantically in large codebases
15. `get_file_context` - Get context for a specific file including imports, exports, functions, and classes
16. `find_related_files` - Find files related to a given file based on imports, exports, and other relationships

## Tool Usage Patterns

### Via Cline/Claude Code
```
@augments get_api_context query="useEffect cleanup" framework="react"
@augments search_apis query="state management hook"
```

### Via MCP Client
```typescript
import { Client } from '@modelcontextprotocol/sdk/client';

const client = new Client({
  transport: 'http',
  url: 'https://mcp.augments.dev/mcp'
});

await client.connect();
const result = await client.callTool('get_api_context', {
  query: 'useEffect cleanup',
  framework: 'react'
});