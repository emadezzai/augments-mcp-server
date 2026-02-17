# System Patterns - Architecture & Design Decisions

## Overall Architecture

```
┌─────────────────────────────────────────────────────────┐
│  User Query: "useEffect cleanup react 19"              │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Query Parser (src/core/query-parser.ts)               │
│  • Extract framework: react                             │
│  • Extract concept: useEffect                           │
│  • Extract version: 19                                  │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Type Fetcher (src/core/type-fetcher.ts)               │
│  • Fetch @types/react@19 from npm CDN                  │
│  • Handle barrel exports                               │
│  • Cache with TTL                                      │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Type Parser (src/core/type-parser.ts)                 │
│  • Extract function signatures                         │
│  • Resolve related types                               │
│  • Find overloads                                      │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│  Return ~500 tokens of focused context                 │
└─────────────────────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Local-First Caching
- **Pattern**: LRU Memory Cache + File Cache
- **Location**: `src/cache/`
- **Implementation**: 
  - In-memory LRU for hot data
  - File-based cache in `.cache/` directory
  - No external Redis required

### 2. Query Parsing Pipeline
- **Pattern**: Chain of Responsibility
- **Location**: `src/core/query-parser.ts`
- **Stages**:
  1. Extract framework name
  2. Extract version constraints
  3. Extract concept/query terms

### 3. Type Extraction Pipeline
- **Pattern**: Pipeline
- **Location**: `src/core/type-fetcher.ts` → `src/core/type-parser.ts`
- **Stages**:
  1. Fetch .d.ts from npm CDN (unpkg/jsdelivr)
  2. Parse with TypeScript Compiler API
  3. Extract relevant signatures
  4. Resolve related types

### 4. MCP Tool Structure
- **Pattern**: Strategy Pattern
- **Location**: `src/tools/v4/`
- **Each tool**: Independent strategy with consistent interface

### 5. Framework Registry
- **Pattern**: Registry Pattern
- **Location**: `src/registry/manager.ts`
- **Purpose**: Fallback for v3 manual frameworks

## Component Relationships

```
app/api/mcp/route.ts (MCP Server Entry)
    ↓
src/server.ts (Server Configuration)
    ↓
src/tools/ (Tool Implementations)
    ├── v4/ (v4 API Context Tools)
    │   ├── get-api-context.ts
    │   ├── search-apis.ts
    │   └── get-version-info.ts
    ├── discovery.ts (Framework Discovery)
    ├── documentation.ts (Docs Access)
    └── cache-management.ts
    ↓
src/core/ (Core Processing)
    ├── query-parser.ts
    ├── type-fetcher.ts
    ├── type-parser.ts
    └── example-extractor.ts
    ↓
src/cache/ (Caching Layer)
    ├── unified-cache.ts
    ├── file-cache.ts
    └── kv-cache.ts
    ↓
src/registry/ (Framework Registry)
    └── manager.ts
```

## Critical Implementation Paths

### Path 1: get_api_context
1. Parse query → extract framework, concept, version
2. Fetch type definitions from npm CDN
3. Parse TypeScript → find matching API
4. Extract signature + related types
5. Return minimal context (~500 tokens)

### Path 2: search_apis
1. Parse query → extract framework, keywords
2. Search in type definitions
3. Rank by relevance
4. Return top matches

### Path 3: get_version_info
1. Query npm registry for package versions
2. Compare versions
3. Detect breaking changes (if possible)
4. Return version info

## Data Flow

```
npm CDN (unpkg/jsdelivr)
    ↓ (fetch .d.ts)
Type Fetcher
    ↓ (raw types)
Type Parser (TS Compiler API)
    ↓ (AST)
Extracted Signatures
    ↓ (filter/format)
MCP Response
    ↓ (cache)
Local Cache
```

## Configuration

- **Framework configs**: `frameworks/` directory (JSON files)
- **Package metadata**: `src/registry/models.ts`
- **Server config**: `src/config/index.ts`

## External Dependencies

| Service | Purpose | Required |
|---------|---------|----------|
| unpkg.com | Fetch npm packages | Yes (free) |
| cdn.jsdelivr.net | Alternative CDN | Yes (free) |
| npmjs.com | Version info | Yes (free) |
| GitHub | Code examples | Optional |
| Minimax | Query parsing | Optional |
| Chutes | Examples enhancement | Optional |