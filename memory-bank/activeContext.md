# Active Context - Current Work Focus

## Current Status

The project is in active development. Version 4.1.0 is released and stable.

## Recent Changes (v4.0 → v4.1)

1. **Local-First Architecture**
   - Removed Upstash/Redis dependency
   - Implemented file-based caching in `.cache/`
   - Added LRU memory cache

2. **Optional AI Providers**
   - Minimax: For enhanced query parsing (optional)
   - Chutes: For additional code examples (optional)
   - Server works 100% without them

3. **TypeScript Definition Focus**
   - Types fetched from npm CDN (unpkg/jsdelivr)
   - Any npm package with types works automatically
   - No manual framework registration needed

## Current Work Focus

### Primary Focus: TOOLS-ROADMAP.md Implementation

The project has a roadmap for adding tools for large codebases (50k+ lines). See `TOOLS-ROADMAP.md` for details.

**Completed:**
- ✅ `semantic_code_search` - Search code by meaning, not just text (IMPLEMENTED in `src/tools/codebase/semantic-code-search.ts`)
- ✅ `analyze_codebase_structure` - Analyze project structure (IMPLEMENTED in `src/tools/codebase/analyze-codebase-structure.ts`)

**All 16 Tools Registered in MCP Server:**
The following tools are now registered and accessible via MCP at `/api/mcp`:
1. `get_api_context` - Query TypeScript definitions from npm
2. `search_apis` - Search APIs across frameworks
3. `get_version_info` - Version comparison from npm
4. `search_frameworks` - Search frameworks
5. `get_framework_info` - Framework details
6. `get_framework_docs` - Documentation
7. `get_framework_context` - Multi-framework context
8. `list_frameworks` - List frameworks by category
9. `get_registry_stats` - Registry statistics
10. `check_framework_updates` - Check for updates
11. `refresh_cache` - Refresh cache
12. `get_cache_stats` - Cache statistics
13. `analyze_codebase_structure` - Project structure analysis
14. `semantic_code_search` - Semantic code search
15. `get_file_context` - File context with imports, exports, functions, classes
16. `find_related_files` - Find related files by imports/exports

**In Progress / Planned:**
- `get_file_context` - Get file context with imports/exports
- `find_related_files` - Find related files by imports
- `extract_module_api` - Extract public API from modules
- `detect_architecture_pattern` - Detect design patterns
- `analyze_import_graph` - Dependency graph analysis

### Secondary Focus: Query Parser Improvement

The local query parser needs improvement for:
- Better framework detection
- More accurate concept extraction
- Handling edge cases

## Next Steps

1. **Implement `get_file_context` tool**
   - Extract imports/exports
   - Find functions and classes
   - Identify related files

2. **Implement `find_related_files` tool**
   - Find files by import relationships
   - Build dependency graph

3. **Improve semantic code search**
   - Better relevance scoring
   - Support more file types

## Important Patterns & Preferences

### Code Organization
- Tools go in `src/tools/`
- Core processing in `src/core/`
- Tests alongside source files (`*.test.ts`)
- Framework configs in `frameworks/` directory (JSON)

### Testing
- Use Vitest for unit tests
- Test files should be co-located
- Run `npm test` before committing

### TypeScript
- Strict mode enabled
- Use explicit types over `any`
- Prefer interfaces over types for public APIs

### Git Workflow
- Feature branches for new tools
- Update CHANGELOG.md for releases
- Keep version in package.json

## Known Issues / Technical Debt

1. **Query Parser**: Basic implementation, needs improvement
2. **Type Parser**: Some edge cases with complex types
3. **Framework Registry**: v3 registry needs updating
4. **Tests**: More test coverage needed

## Documentation Notes

- Main docs: `README.md`
- CLI docs: `CLI-README.md`
- Usage guide: `USAGE-GUIDE.md`
- Plan/status: `plan.md`
- Tools roadmap: `TOOLS-ROADMAP.md`

## Preferences

- **Local-first**: Always prefer local solutions over external services
- **Minimal context**: Tools should return focused, minimal results
- **TypeScript truth**: Use .d.ts files as source of truth
- **Free tier**: Ensure everything works without paid services