/**
 * Tests for semantic_code_search tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  semanticCodeSearch,
  formatSemanticSearchResponse,
  type SemanticCodeSearchOutput,
} from './semantic-code-search';
import { getCodeSearchEngine, type CodeSearchResult } from '@/core/code-search-engine';
import * as path from 'path';

describe('semantic_code_search', () => {
  const testRootPath = path.resolve(__dirname, '../../../'); // Project root

  describe('semanticCodeSearch', () => {
    it('should search for code with a simple query', async () => {
      const result = await semanticCodeSearch({
        query: 'cache',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
        contextLines: 3,
      });

      expect(result).toBeDefined();
      expect(result.query).toBe('cache');
      expect(result.results).toBeInstanceOf(Array);
      expect(result.totalMatches).toBeGreaterThanOrEqual(0);
    });

    it('should respect maxResults parameter', async () => {
      const result = await semanticCodeSearch({
        query: 'function',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 3,
        contextLines: 3,
      });

      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('should handle file patterns', async () => {
      const result = await semanticCodeSearch({
        query: 'import',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
        contextLines: 3,
      });

      expect(result).toBeDefined();
    });

    it('should return search strategy', async () => {
      const result = await semanticCodeSearch({
        query: 'auth login',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
        contextLines: 3,
      });

      expect(result.searchStrategy).toBe('auth-search');
    });

    it('should handle identifier queries', async () => {
      const result = await semanticCodeSearch({
        query: 'getCodeSearchEngine',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
        contextLines: 3,
      });

      expect(result.searchStrategy).toBe('identifier-exact');
    });

    it('should return empty results for non-matching query', async () => {
      const result = await semanticCodeSearch({
        query: 'zzzzzzzzzzzzzzzzzzzzzznonexistent12345',
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
        contextLines: 3,
      });

      // Should have very few or no results for a completely random string
      expect(result.results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('formatSemanticSearchResponse', () => {
    it('should format results correctly', () => {
      const output: SemanticCodeSearchOutput = {
        query: 'test query',
        results: [
          {
            file: '/src/test.ts',
            line: 10,
            snippet: 'const test = "hello";',
            relevance: 0.9,
            matchType: 'exact',
            context: 'line 8\nline 9\nconst test = "hello";\nline 11\nline 12',
            contextRange: { start: 8, end: 12 },
          },
        ],
        totalMatches: 1,
        filesSearched: 10,
        searchStrategy: 'semantic-keyword',
        rootPath: '/src',
      };

      const formatted = formatSemanticSearchResponse(output);

      expect(formatted).toContain('# Semantic Code Search Results');
      expect(formatted).toContain('test query');
      expect(formatted).toContain('/src/test.ts');
      expect(formatted).toContain('90% relevance');
    });

    it('should handle empty results', () => {
      const output: SemanticCodeSearchOutput = {
        query: 'nonexistent',
        results: [],
        totalMatches: 0,
        filesSearched: 10,
        searchStrategy: 'semantic-keyword',
        rootPath: '/src',
      };

      const formatted = formatSemanticSearchResponse(output);

      expect(formatted).toContain('No matches found');
      expect(formatted).toContain('Suggestions');
    });
  });

  describe('CodeSearchEngine', () => {
    it('should cache files for repeated searches', async () => {
      const engine = getCodeSearchEngine();

      // First search
      await engine.search('cache', {
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
      });

      const stats1 = engine.getCacheStats();

      // Second search (should use cache)
      await engine.search('cache', {
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 5,
      });

      const stats2 = engine.getCacheStats();

      expect(stats2.files).toBeGreaterThanOrEqual(stats1.files);
    });

    it('should clear cache', async () => {
      const engine = getCodeSearchEngine();

      await engine.search('test', {
        rootPath: testRootPath,
        filePattern: '*.ts',
        maxResults: 1,
      });

      const statsBefore = engine.getCacheStats();
      expect(statsBefore.files).toBeGreaterThan(0);

      engine.clearCache();

      const statsAfter = engine.getCacheStats();
      expect(statsAfter.files).toBe(0);
    });
  });
});