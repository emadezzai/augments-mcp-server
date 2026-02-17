/**
 * Tests for find_pattern_usage tool
 */

import { describe, it, expect } from 'vitest';
import { 
  findPatternUsage, 
  formatPatternUsageResponse, 
  FindPatternUsageInputSchema,
  getPatternKeywords,
  generateSuggestions,
  checkPatternMatch,
  PatternOccurrence,
  FindPatternUsageOutput,
} from './find-pattern-usage';

describe('find_pattern_usage', () => {
  describe('Input Schema', () => {
    it('validates required pattern field', () => {
      const result = FindPatternUsageInputSchema.safeParse({ pattern: 'singleton' });
      expect(result.success).toBe(true);
    });

    it('rejects empty pattern', () => {
      const result = FindPatternUsageInputSchema.safeParse({ pattern: '' });
      expect(result.success).toBe(false);
    });

    it('validates optional rootPath', () => {
      const result = FindPatternUsageInputSchema.safeParse({ pattern: 'singleton', rootPath: '/test' });
      expect(result.success).toBe(true);
    });

    it('validates optional filePattern', () => {
      const result = FindPatternUsageInputSchema.safeParse({ pattern: 'singleton', filePattern: '*.ts' });
      expect(result.success).toBe(true);
    });

    it('validates optional caseSensitive', () => {
      const result = FindPatternUsageInputSchema.safeParse({ pattern: 'singleton', caseSensitive: true });
      expect(result.success).toBe(true);
    });
  });

  describe('Pattern Keywords', () => {
    it('returns keywords for known design patterns', () => {
      const singletonResult = getPatternKeywords('singleton');
      expect(singletonResult.keywords).toContain('singleton');
      expect(singletonResult.keywords).toContain('getInstance');
      expect(singletonResult.description).toContain('Ensures a class');
    });

    it('returns pattern as keyword for unknown patterns', () => {
      const result = getPatternKeywords('customPattern');
      expect(result.keywords).toEqual(['customPattern']);
      expect(result.description).toContain('customPattern');
    });

    it('handles case-insensitive pattern lookup', () => {
      const result1 = getPatternKeywords('SINGLETON');
      const result2 = getPatternKeywords('singleton');
      expect(result1.keywords).toEqual(result2.keywords);
    });
  });

  describe('Pattern Matching', () => {
    it('matches exact pattern with word boundary', () => {
      const line = 'const instance = Singleton.getInstance();';
      const result = checkPatternMatch(line, ['singleton', 'getInstance'], false);
      expect(result.match).toBe(true);
      expect(result.matchType).toBe('exact');
    });

    it('matches partial pattern', () => {
      const line = 'const observer = new EventObserver();';
      const result = checkPatternMatch(line, ['event'], false);
      expect(result.match).toBe(true);
      expect(result.matchType).toBe('partial');
    });

    it('respects case sensitivity', () => {
      const line = 'const Singleton = new Singleton();';
      
      // Case insensitive match
      const result1 = checkPatternMatch(line, ['singleton'], false);
      expect(result1.match).toBe(true);
      
      // Case sensitive - no match
      const result2 = checkPatternMatch(line, ['singleton'], true);
      expect(result2.match).toBe(false);
    });

    it('handles special regex characters', () => {
      const line = 'const cache = new Map<string, any>();';
      const result = checkPatternMatch(line, ['map'], false);
      expect(result.match).toBe(true);
    });

    it('returns no match for non-matching line', () => {
      const line = 'const x = 5;';
      const result = checkPatternMatch(line, ['singleton'], false);
      expect(result.match).toBe(false);
      expect(result.matchType).toBe('related');
    });
  });

  describe('Suggestions Generation', () => {
    const mockOccurrence: PatternOccurrence = { 
      file: 'test.ts', 
      line: 1, 
      snippet: '', 
      context: '', 
      contextRange: { start: 1, end: 1 }, 
      matchType: 'exact' 
    };

    it('generates suggestions for singleton pattern', () => {
      const suggestions = generateSuggestions('singleton', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('thread-safety'))).toBe(true);
    });

    it('generates suggestions for observer pattern', () => {
      const suggestions = generateSuggestions('observer', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('unsubscribe'))).toBe(true);
    });

    it('generates suggestions for factory pattern', () => {
      const suggestions = generateSuggestions('factory', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('dependency injection'))).toBe(true);
    });

    it('generates suggestions for middleware pattern', () => {
      const suggestions = generateSuggestions('middleware', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('order'))).toBe(true);
    });

    it('generates suggestions for cache pattern', () => {
      const suggestions = generateSuggestions('cache', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('invalidation'))).toBe(true);
    });

    it('generates suggestions for unknown pattern', () => {
      const suggestions = generateSuggestions('custompattern', [mockOccurrence]);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('custompattern'))).toBe(true);
    });

    it('generates suggestions when no occurrences found', () => {
      const suggestions = generateSuggestions('singleton', []);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('No occurrences'))).toBe(true);
    });

    it('adds high usage warning for many occurrences', () => {
      const manyOccurrences = Array(15).fill(mockOccurrence);
      const suggestions = generateSuggestions('singleton', manyOccurrences);
      
      expect(suggestions.some(s => s.includes('High usage'))).toBe(true);
    });
  });

  describe('Response Formatting', () => {
    const mockOutput: FindPatternUsageOutput = {
      pattern: 'singleton',
      totalOccurrences: 2,
      occurrences: [
        {
          file: 'singleton.ts',
          line: 5,
          snippet: 'static getInstance()',
          context: 'class Singleton {\n  static getInstance()',
          contextRange: { start: 1, end: 5 },
          matchType: 'exact',
        },
      ],
      suggestions: ['Test suggestion'],
      filesAnalyzed: 10,
      rootPath: '/test',
      searchDuration: 100,
    };

    it('formats response with occurrences', () => {
      const formatted = formatPatternUsageResponse(mockOutput);
      
      expect(formatted).toContain('# Pattern Usage Search: "singleton"');
      expect(formatted).toContain('## Occurrences');
      expect(formatted).toContain('## Suggestions');
      expect(formatted).toContain('singleton.ts');
      expect(formatted).toContain('Test suggestion');
    });

    it('formats response with no occurrences', () => {
      const output: FindPatternUsageOutput = {
        pattern: 'nonexistent',
        totalOccurrences: 0,
        occurrences: [],
        suggestions: ['No occurrences found'],
        filesAnalyzed: 10,
        rootPath: '/test',
        searchDuration: 100,
      };
      
      const formatted = formatPatternUsageResponse(output);
      
      expect(formatted).toContain('## No Occurrences Found');
      expect(formatted).toContain('The specified pattern was not found');
    });

    it('includes search metadata in formatted response', () => {
      const output: FindPatternUsageOutput = {
        pattern: 'test',
        totalOccurrences: 1,
        occurrences: [],
        suggestions: [],
        filesAnalyzed: 5,
        rootPath: '/test',
        searchDuration: 50,
      };
      
      const formatted = formatPatternUsageResponse(output);
      
      expect(formatted).toContain('**Files Analyzed:** 5');
      expect(formatted).toContain('**Total Occurrences:** 1');
      expect(formatted).toContain('**Search Duration:** 50ms');
    });

    it('includes root path in formatted response', () => {
      const formatted = formatPatternUsageResponse(mockOutput);
      expect(formatted).toContain('**Root Path:** /test');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file content', async () => {
      const result = await findPatternUsage({
        pattern: 'test',
        rootPath: __dirname,
        filePattern: 'empty-file-test.ts',
        caseSensitive: false,
      });
      
      expect(result.totalOccurrences).toBe(0);
    });

    it('handles files with only comments', async () => {
      const result = await findPatternUsage({
        pattern: 'test',
        rootPath: __dirname,
        filePattern: '*.test.ts',
        caseSensitive: false,
      });
      
      // Should not throw, just return results
      expect(result.filesAnalyzed).toBeGreaterThanOrEqual(0);
    });
  });
});