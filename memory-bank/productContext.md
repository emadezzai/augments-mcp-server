# Product Context - Why Augments MCP Server Exists

## The Problem

When developers use AI assistants like Claude Code, they often need quick context about framework APIs. Current solutions have major issues:

1. **Context7 and similar**: 
   - Fetches entire documentation pages (~50KB per query)
   - Parsed prose docs can be outdated or wrong
   - LLM cost for ranking chunks is expensive
   - Limited to manually submitted frameworks

2. **Traditional documentation**:
   - Overwhelming amount of text
   - Hard to find exact API signatures
   - Examples buried in tutorials

## How Augments Solves This

### v4 Approach - TypeScript Definitions

Instead of fetching prose documentation, Augments fetches **TypeScript type definitions** directly from npm:

```
Query: "useEffect cleanup react"

Returns:
function useEffect(effect: EffectCallback, deps?: DependencyList): void

Related types:
- EffectCallback: () => void | (() => void)
- DependencyList: ReadonlyArray<any> | undefined
```

**Why TypeScript can't lie:**
- Compiled and must match actual API
- Source of truth for function signatures
- Always up-to-date with package versions

### Benefits

| Metric | Old Approach | Augments v4 |
|--------|-------------|-------------|
| Context size | ~50KB | ~500 tokens |
| Accuracy | Docs can be wrong | Types must be correct |
| Coverage | 85 frameworks | Any npm package |
| Freshness | Crawl schedule | On-demand from npm |
| Cost | Pays for ranking | Zero - pure retrieval |

## User Experience Goals

1. **Minimal context** - Only what AI needs to understand the API
2. **Instant results** - Cached types for fast retrieval
3. **Universal coverage** - Any npm package with TypeScript types
4. **100% free** - No paid subscriptions, works locally
5. **Version aware** - Query specific versions, compare changes

## Competitive Advantage

- **vs Context7**: Types are more accurate, smaller context, broader coverage
- **vs Traditional docs**: AI-optimized, exact signatures, no prose
- **vs Local alternatives**: Better query parsing, npm integration

## Target Use Cases

1. **Quick API lookups** - "What are the params for useEffect?"
2. **Version migration** - "What's different in React 19?"
3. **Cross-framework research** - "Show me similar hooks in Vue and React"
4. **Type exploration** - "What does this function return?"

## Current Tool Set

The server provides **16 tools by default**:

### Primary (3)
- `get_api_context` - Query TypeScript definitions
- `search_apis` - Search APIs across frameworks
- `get_version_info` - Version comparison

### Alternative (3)
- `search_frameworks` - Find frameworks
- `get_framework_info` - Framework details
- `get_framework_docs` - Full documentation

### Codebase (10)
- `semantic_code_search` - Semantic code search
- `analyze_codebase_structure` - Project structure
- `get_file_context` - File context with imports/exports
- `find_related_files` - Find related files
- `extract_module_api` - Module API extraction
- `detect_architecture_pattern` - Architecture detection
- `analyze_import_graph` - Dependency analysis
- `find_pattern_usage` - Pattern search
- `identify_public_interfaces` - Public API detection
- `generate_code_summary` - Code summarization

### Legacy (8 behind env var)
- Additional tools for backward compatibility