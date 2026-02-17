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

# Enable legacy tools (8 additional tools)
LEGACY_TOOLS_ENABLED=true
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
# LEGACY_TOOLS_ENABLED (optional)
```

## Code Style

- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier (implied via ESLint)
- **TypeScript**: Strict mode enabled

## MCP Server Configuration

The server exposes **14 tools by default** (plus 8 legacy tools behind env var):

### Primary Tools (3) - RECOMMENDED for most tasks
1. `get_api_context` - Get precise API signatures, parameters, return types, and code examples for any npm package
2. `search_apis` - Search for APIs across multiple frameworks
3. `get_version_info` - Get version info and breaking changes

### Alternative Tools (3) - For specific use cases
4. `search_frameworks` - Search for frameworks by name or feature
5. `get_framework_info` - Get framework metadata
6. `get_framework_docs` - Fetch documentation for a framework

### Codebase Tools (10) - For large codebases (50k+ lines)
7. `semantic_code_search` - Search code semantically in large codebases
8. `analyze_codebase_structure` - Analyze the complete structure of a project codebase
9. `get_file_context` - Get context for a specific file
10. `find_related_files` - Find files related to a given file
11. `extract_module_api` - Extract the public API from a module
12. `detect_architecture_pattern` - Detect design patterns and architecture styles
13. `analyze_import_graph` - Analyze import/export dependencies
14. `find_pattern_usage` - Search for specific design patterns in code
15. `identify_public_interfaces` - Identify public vs internal exports in packages
16. `generate_code_summary` - Generate summaries of code files or directories

### Legacy Tools (8) - Behind LEGACY_TOOLS_ENABLED env var
- `list_available_frameworks` - List all available frameworks
- `get_registry_stats` - Get statistics about the framework registry
- `get_framework_examples` - Get code examples for specific patterns
- `search_documentation` - Search within a framework's documentation
- `analyze_code_compatibility` - Analyze code for framework compatibility
- `check_framework_updates` - Check if framework documentation has been updated
- `refresh_framework_cache` - Refresh cached documentation
- `get_cache_stats` - Get detailed cache statistics

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
```