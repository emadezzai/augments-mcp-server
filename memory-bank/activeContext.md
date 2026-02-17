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

4. **Tool Registration Complete**
   - Added `get_file_context` to server.ts
   - Added `find_related_files` to server.ts
   - Total tools now: 14 (up from 12)

## Current Work Focus

### All Codebase Tools Now Registered ✅

**Completed:**
- ✅ `semantic_code_search` - Search code by meaning, not just text
- ✅ `analyze_codebase_structure` - Analyze project structure
- ✅ `get_file_context` - Get file context with imports, exports, functions, classes (NOW REGISTERED)
- ✅ `find_related_files` - Find related files by imports/exports (NOW REGISTERED)
- ✅ `extract_module_api` - Extract public API from modules
- ✅ `detect_architecture_pattern` - Detect design patterns
- ✅ `analyze_import_graph` - Analyze import/export dependencies, detect circular dependencies
- ✅ `find_pattern_usage` - Search for design patterns in code

**14 Tools Registered in MCP Server by Default:**
1. `get_api_context` - Query TypeScript definitions from npm (PRIMARY)
2. `search_apis` - Search APIs across frameworks (PRIMARY)
3. `get_version_info` - Version comparison from npm (PRIMARY)
4. `search_frameworks` - Search frameworks (ALTERNATIVE)
5. `get_framework_info` - Framework details (ALTERNATIVE)
6. `get_framework_docs` - Documentation (ALTERNATIVE)
7. `semantic_code_search` - Semantic code search
8. `analyze_codebase_structure` - Project structure analysis
9. `get_file_context` - Get file context (NEWLY REGISTERED)
10. `find_related_files` - Find related files (NEWLY REGISTERED)
11. `extract_module_api` - Extract public API from modules
12. `detect_architecture_pattern` - Detect architecture patterns
13. `analyze_import_graph` - Analyze import/export dependencies
14. `find_pattern_usage` - Search for design patterns

**Legacy Tools (behind LEGACY_TOOLS_ENABLED):**
- `list_available_frameworks`
- `get_registry_stats`
- `get_framework_examples`
- `search_documentation`
- `analyze_code_compatibility`
- `check_framework_updates`
- `refresh_framework_cache`
- `get_cache_stats`

## Next Steps

1. **Implement `identify_public_interfaces` tool**
   - Public API detection for packages

2. **Implement `generate_code_summary` tool**
   - Code summarization for files/folders

3. **Improve query parser**
   - Better framework detection
   - More accurate concept extraction

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

### Tool Registration
- All new tools MUST be registered in `src/server.ts`
- Export from `src/tools/codebase/index.ts`
- Export from `src/tools/index.ts`
- Register using `server.tool()` method

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
- **Complete registration**: All implemented tools are now registered ✅