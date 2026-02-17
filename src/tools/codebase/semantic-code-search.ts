/**
 * semantic_code_search Tool
 *
 * Intelligent code search that understands meaning, not just text matching.
 * Designed for large codebases (50k+ lines).
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import {
  getCodeSearchEngine,
  type CodeSearchResult,
  type SearchOptions,
} from '@/core/code-search-engine';

const logger = getLogger('semantic-code-search');

/**
 * Input schema for semantic_code_search tool
 */
export const SemanticCodeSearchInputSchema = z.object({
  query: z.string().min(1).describe('Natural language search query (e.g., "payment processing logic")'),
  rootPath: z.string().optional().describe('Root directory to search (defaults to current working directory)'),
  filePattern: z.string().optional().describe('File pattern to match (e.g., "*.ts", "*.{ts,tsx}")'),
  maxResults: z.number().min(1).max(100).optional().default(10).describe('Maximum number of results to return'),
  contextLines: z.number().min(0).max(20).optional().default(3).describe('Number of context lines around each match'),
});

export type SemanticCodeSearchInput = z.infer<typeof SemanticCodeSearchInputSchema>;

/**
 * Output of semantic_code_search tool
 */
export interface SemanticCodeSearchOutput {
  /** Search query */
  query: string;
  /** Search results */
  results: CodeSearchResult[];
  /** Total matches found */
  totalMatches: number;
  /** Files searched */
  filesSearched: number;
  /** Search strategy used */
  searchStrategy: string;
  /** Root path searched */
  rootPath: string;
}

/**
 * Perform semantic code search
 */
export async function semanticCodeSearch(
  input: SemanticCodeSearchInput
): Promise<SemanticCodeSearchOutput> {
  const startTime = Date.now();
  logger.info('Starting semantic code search', { query: input.query });

  const searchEngine = getCodeSearchEngine();

  // Determine root path
  const rootPath = input.rootPath || process.cwd();

  // Build search options
  const options: SearchOptions = {
    rootPath,
    filePattern: input.filePattern,
    maxResults: input.maxResults ?? 10,
    contextLines: input.contextLines ?? 3,
  };

  // Perform search
  const results = await searchEngine.search(input.query, options);

  // Determine search strategy
  const searchStrategy = determineSearchStrategy(input.query);

  // Get cache stats
  const cacheStats = searchEngine.getCacheStats();

  const duration = Date.now() - startTime;
  logger.info('Semantic code search completed', {
    query: input.query,
    resultsCount: results.length,
    cacheStats,
    duration,
  });

  return {
    query: input.query,
    results,
    totalMatches: results.length,
    filesSearched: cacheStats.files,
    searchStrategy,
    rootPath,
  };
}

/**
 * Determine the search strategy based on query
 */
function determineSearchStrategy(query: string): string {
  const queryLower = query.toLowerCase();

  // Check for specific patterns
  if (/[a-z][A-Z]/.test(query)) {
    return 'identifier-exact';
  }

  if (query.includes('function') || query.includes('class')) {
    return 'definition-search';
  }

  if (query.includes('test') || query.includes('spec')) {
    return 'test-search';
  }

  if (query.includes('api') || query.includes('route') || query.includes('handler')) {
    return 'api-search';
  }

  if (query.includes('auth') || query.includes('login') || query.includes('user')) {
    return 'auth-search';
  }

  return 'semantic-keyword';
}

/**
 * Maximum response size in characters
 */
const MAX_RESPONSE_SIZE = 10000;

/**
 * Format the output for MCP response
 */
export function formatSemanticSearchResponse(output: SemanticCodeSearchOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Semantic Code Search Results');
  lines.push(`**Query:** "${output.query}"`);
  lines.push(`**Strategy:** ${output.searchStrategy}`);
  lines.push(`**Files Searched:** ${output.filesSearched}`);
  lines.push(`**Matches Found:** ${output.totalMatches}`);
  lines.push('');

  if (output.results.length === 0) {
    lines.push('No matches found.');
    lines.push('');
    lines.push('**Suggestions:**');
    lines.push('- Try different keywords');
    lines.push('- Check the file pattern');
    lines.push('- Use more specific terms');
    lines.push('- Verify the root path is correct');
    return lines.join('\n');
  }

  // Group results by file
  const byFile = new Map<string, CodeSearchResult[]>();
  for (const result of output.results) {
    const existing = byFile.get(result.file) || [];
    existing.push(result);
    byFile.set(result.file, existing);
  }

  // Format each file's results
  let currentSize = 0;
  for (const [file, results] of byFile) {
    // Check if we're exceeding the response size
    if (currentSize > MAX_RESPONSE_SIZE) {
      lines.push('');
      lines.push(`*...and ${output.results.length - currentSize} more results*`);
      break;
    }

    lines.push(`## ${file}`);
    lines.push('');

    for (const result of results) {
      const relevancePercent = Math.round(result.relevance * 100);
      lines.push(`### Line ${result.line} (${result.matchType}, ${relevancePercent}% relevance)`);

      // Code context
      lines.push('```');
      lines.push(result.context);
      lines.push('```');
      lines.push('');

      currentSize += lines.join('\n').length;
    }
  }

  // Summary
  lines.push('---');
  lines.push(`Searched ${output.filesSearched} files in ${output.rootPath}`);

  return lines.join('\n');
}