/**
 * find_pattern_usage Tool
 *
 * Search for specific design patterns and coding patterns in a codebase.
 * Helps identify where patterns like Singleton, Observer, Factory, etc. are used.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = getLogger('find-pattern-usage');

/**
 * Input schema for find_pattern_usage tool
 */
export const FindPatternUsageInputSchema = z.object({
  pattern: z.string().min(1).describe('Pattern to search for (e.g., "singleton", "observer", "factory", "decorator")'),
  rootPath: z.string().optional().describe('Root directory to search (defaults to current working directory)'),
  filePattern: z.string().optional().describe('File pattern to match (e.g., "*.ts", "*.{ts,tsx}")'),
  caseSensitive: z.boolean().optional().default(false).describe('Whether to match case exactly'),
});

export type FindPatternUsageInput = z.infer<typeof FindPatternUsageInputSchema>;

/**
 * Single occurrence of a pattern
 */
export interface PatternOccurrence {
  /** File path relative to root */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Code snippet containing the pattern */
  snippet: string;
  /** Context around the match */
  context: string;
  /** Line range for context */
  contextRange: { start: number; end: number };
  /** Match type */
  matchType: 'exact' | 'partial' | 'related';
}

/**
 * Output of find_pattern_usage tool
 */
export interface FindPatternUsageOutput {
  /** Pattern searched for */
  pattern: string;
  /** Total occurrences found */
  totalOccurrences: number;
  /** List of occurrences */
  occurrences: PatternOccurrence[];
  /** Suggestions for pattern usage */
  suggestions: string[];
  /** Files analyzed */
  filesAnalyzed: number;
  /** Root path searched */
  rootPath: string;
  /** Search duration in ms */
  searchDuration: number;
}

/**
 * Design patterns with their keywords and descriptions
 */
const DESIGN_PATTERNS: Record<string, { keywords: string[]; description: string }> = {
  singleton: {
    keywords: ['singleton', 'instance', 'getInstance', 'instance()', 'static instance'],
    description: 'Ensures a class has only one instance and provides global access',
  },
  observer: {
    keywords: ['observer', 'subscribe', 'unsubscribe', 'onNext', 'onComplete', 'observable', 'event emitter', 'eventEmitter'],
    description: 'Defines a one-to-many dependency between objects',
  },
  factory: {
    keywords: ['factory', 'create', 'newInstance', 'build', 'make', 'createInstance'],
    description: 'Creates objects without specifying the exact class',
  },
  decorator: {
    keywords: ['decorator', '@', 'decorate', 'wrapper', 'enhance'],
    description: 'Adds behavior to objects dynamically',
  },
  strategy: {
    keywords: ['strategy', 'algorithm', 'context', 'implement'],
    description: 'Defines a family of interchangeable algorithms',
  },
  adapter: {
    keywords: ['adapter', 'adapt', 'convert', 'wrapper', 'interface'],
    description: 'Converts interface of a class to another interface',
  },
  proxy: {
    keywords: ['proxy', 'intercept', 'handle', 'access control'],
    description: 'Provides a surrogate or placeholder for another object',
  },
  command: {
    keywords: ['command', 'execute', 'undo', 'invoke', 'request'],
    description: 'Encapsulates a request as an object',
  },
  mvc: {
    keywords: ['model', 'view', 'controller', 'component', 'state'],
    description: 'Model-View-Controller architecture pattern',
  },
  repository: {
    keywords: ['repository', 'findAll', 'findById', 'save', 'delete', 'aggregate'],
    description: 'Mediates between domain and data mapping layers',
  },
  service: {
    keywords: ['service', 'service', 'business logic', 'business logic'],
    description: 'Service layer pattern for business logic',
  },
  dependency_injection: {
    keywords: ['inject', 'constructor', 'provider', 'di', 'dependency injection'],
    description: 'Injects dependencies into components',
  },
  middleware: {
    keywords: ['middleware', 'interceptor', 'chain', 'next', 'handle'],
    description: 'Components that process requests in a chain',
  },
  event_bus: {
    keywords: ['event bus', 'eventBus', 'publish', 'subscribe', 'emit'],
    description: 'Communication mechanism between components',
  },
  cache: {
    keywords: ['cache', 'memoize', 'cache', 'cached', 'memory cache'],
    description: 'Stores frequently accessed data for quick retrieval',
  },
  lazy_loading: {
    keywords: ['lazy', 'lazyload', 'lazyLoad', 'defer', 'delayed'],
    description: 'Defers initialization of an object until needed',
  },
  factory_method: {
    keywords: ['factory method', 'factoryMethod', 'create', 'newInstance'],
    description: 'Defines an interface for creating objects but lets subclasses decide',
  },
  abstract_factory: {
    keywords: ['abstract factory', 'abstractFactory', 'family', 'product'],
    description: 'Creates families of related objects',
  },
  builder: {
    keywords: ['builder', 'build', 'configure', 'step'],
    description: 'Separates object construction from representation',
  },
  prototype: {
    keywords: ['prototype', 'clone', 'copy', 'duplicate'],
    description: 'Creates objects by cloning a prototype',
  },
  composite: {
    keywords: ['composite', 'component', 'leaf', 'tree', 'children'],
    description: 'Composes objects into tree structures',
  },
  facade: {
    keywords: ['facade', 'interface', 'simplified', 'wrapper'],
    description: 'Provides a simplified interface to a complex subsystem',
  },
  flyweight: {
    keywords: ['flyweight', 'shared', 'intrinsic', 'extrinsic'],
    description: 'Uses sharing to support large numbers of small objects',
  },
  chain_of_responsibility: {
    keywords: ['chain', 'handler', 'next', 'successor', 'pass'],
    description: 'Passes request along a chain of handlers',
  },
  state: {
    keywords: ['state', 'currentState', 'setState', 'transition'],
    description: 'Allows object to alter behavior when state changes',
  },
  template_method: {
    keywords: ['template', 'abstract', 'hook', 'override'],
    description: 'Defines skeleton of algorithm, deferring steps to subclasses',
  },
  visitor: {
    keywords: ['visitor', 'accept', 'visit', 'double dispatch'],
    description: 'Separates algorithm from object structure',
  },
};

/**
 * Get pattern keywords for a given pattern name
 */
export function getPatternKeywords(pattern: string): { keywords: string[]; description: string } {
  const patternLower = pattern.toLowerCase();
  
  // Check if it's a known design pattern
  if (DESIGN_PATTERNS[patternLower]) {
    return DESIGN_PATTERNS[patternLower];
  }
  
  // For custom patterns, use the pattern itself as a keyword
  return {
    keywords: [pattern],
    description: `Custom pattern: ${pattern}`,
  };
}

/**
 * Generate suggestions based on pattern
 */
export function generateSuggestions(pattern: string, occurrences: PatternOccurrence[]): string[] {
  const suggestions: string[] = [];
  const patternLower = pattern.toLowerCase();
  
  if (occurrences.length === 0) {
    suggestions.push(`No occurrences of "${pattern}" found in the codebase.`);
    suggestions.push('Consider implementing this pattern if it fits your architecture.');
    return suggestions;
  }
  
  // Pattern-specific suggestions
  switch (patternLower) {
    case 'singleton':
      suggestions.push('Ensure thread-safety if used in multi-threaded environments');
      suggestions.push('Consider dependency injection as an alternative');
      break;
      
    case 'observer':
      suggestions.push('Remember to unsubscribe to prevent memory leaks');
      suggestions.push('Consider using RxJS or custom event emitters');
      break;
      
    case 'factory':
      suggestions.push('Consider using dependency injection containers');
      suggestions.push('Factory patterns can be replaced with modern frameworks');
      break;
      
    case 'decorator':
      suggestions.push('TypeScript decorators may have runtime overhead');
      suggestions.push('Consider composition over decoration');
      break;
      
    case 'middleware':
      suggestions.push('Ensure middleware order is correct');
      suggestions.push('Consider error-handling middleware placement');
      break;
      
    case 'cache':
      suggestions.push('Implement cache invalidation strategy');
      suggestions.push('Consider cache size limits and eviction policies');
      break;
  }
  
  // General suggestions based on usage
  if (occurrences.length > 10) {
    suggestions.push(`High usage detected (${occurrences.length} occurrences)`);
    suggestions.push('Consider if this pattern is overused');
  }
  
  if (occurrences.length > 0) {
    suggestions.push(`Found ${occurrences.length} usage(s) of "${pattern}" pattern`);
    suggestions.push('Review for consistency and best practices');
  }
  
  return suggestions;
}

/**
 * Check if a line matches the pattern
 */
export function checkPatternMatch(line: string, keywords: string[], caseSensitive: boolean): { match: boolean; matchType: PatternOccurrence['matchType'] } {
  const checkLine = caseSensitive ? line : line.toLowerCase();
  
  for (const keyword of keywords) {
    const checkKeyword = caseSensitive ? keyword : keyword.toLowerCase();
    
    // Exact match (word boundary)
    const exactPattern = new RegExp(`\\b${checkKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (exactPattern.test(checkLine)) {
      return { match: true, matchType: 'exact' };
    }
    
    // Partial match
    if (checkLine.includes(checkKeyword)) {
      return { match: true, matchType: 'partial' };
    }
  }
  
  return { match: false, matchType: 'related' };
}

/**
 * Find pattern usage in a codebase
 */
export async function findPatternUsage(
  input: FindPatternUsageInput
): Promise<FindPatternUsageOutput> {
  const startTime = Date.now();
  logger.info('Starting pattern usage search', { pattern: input.pattern });

  const rootPath = input.rootPath || process.cwd();
  const filePattern = input.filePattern || '*.{ts,tsx,js,jsx}';
  const caseSensitive = input.caseSensitive ?? false;
  
  // Get pattern keywords
  const { keywords, description } = getPatternKeywords(input.pattern);
  logger.debug('Pattern keywords', { keywords, description });

  // Find matching files
  const files = await findMatchingFiles(rootPath, filePattern);
  logger.debug('Found matching files', { count: files.length });

  // Search for pattern in each file
  const occurrences: PatternOccurrence[] = [];
  const filesWithMatches = new Set<string>();

  for (const filePath of files) {
    try {
      const fileOccurrences = await searchFileForPattern(filePath, rootPath, keywords, caseSensitive);
      if (fileOccurrences.length > 0) {
        occurrences.push(...fileOccurrences);
        filesWithMatches.add(filePath);
      }
    } catch (error) {
      logger.warn('Error searching file', {
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Generate suggestions
  const suggestions = generateSuggestions(input.pattern, occurrences);

  const searchDuration = Date.now() - startTime;
  logger.info('Pattern usage search completed', {
    pattern: input.pattern,
    totalOccurrences: occurrences.length,
    filesAnalyzed: files.length,
    filesWithMatches: filesWithMatches.size,
    searchDuration,
  });

  return {
    pattern: input.pattern,
    totalOccurrences: occurrences.length,
    occurrences,
    suggestions,
    filesAnalyzed: files.length,
    rootPath,
    searchDuration,
  };
}

/**
 * Find files matching the pattern
 */
async function findMatchingFiles(
  rootPath: string,
  filePattern: string
): Promise<string[]> {
  const files: string[] = [];
  
  // Convert glob pattern to regex
  const regex = globToRegex(filePattern);

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip common ignored directories
        if (['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.cache'].includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          if (regex.test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await walk(rootPath);
  return files;
}

/**
 * Convert glob pattern to regex
 */
function globToRegex(glob: string): RegExp {
  let regex = glob
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .replace(/,/g, '|');

  return new RegExp(`^${regex}$`);
}

/**
 * Search a file for pattern occurrences
 */
async function searchFileForPattern(
  filePath: string,
  rootPath: string,
  keywords: string[],
  caseSensitive: boolean
): Promise<PatternOccurrence[]> {
  const occurrences: PatternOccurrence[] = [];
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(rootPath, filePath);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Skip empty lines and pure comments
      if (line.trim().length === 0) continue;
      if (line.trim().startsWith('//')) continue;
      if (line.trim().startsWith('/*')) continue;
      if (line.trim().startsWith('*')) continue;
      if (line.trim().startsWith('#')) continue;

      const { match, matchType } = checkPatternMatch(line, keywords, caseSensitive);
      
      if (match) {
        // Get context (5 lines before and after)
        const startLine = Math.max(0, lineIndex - 5);
        const endLine = Math.min(lines.length - 1, lineIndex + 5);
        const context = lines.slice(startLine, endLine + 1).join('\n');

        occurrences.push({
          file: relativePath,
          line: lineIndex + 1, // 1-indexed
          snippet: line.trim(),
          context,
          contextRange: { start: startLine + 1, end: endLine + 1 },
          matchType,
        });
      }
    }
  } catch (error) {
    logger.warn('Error reading file', {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return occurrences;
}

/**
 * Maximum response size in characters
 */
const MAX_RESPONSE_SIZE = 15000;

/**
 * Format the output for MCP response
 */
export function formatPatternUsageResponse(output: FindPatternUsageOutput): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Pattern Usage Search: "${output.pattern}"`);
  lines.push('');
  lines.push(`**Root Path:** ${output.rootPath}`);
  lines.push(`**Files Analyzed:** ${output.filesAnalyzed}`);
  lines.push(`**Total Occurrences:** ${output.totalOccurrences}`);
  lines.push(`**Search Duration:** ${output.searchDuration}ms`);
  lines.push('');

  // Occurrences
  if (output.occurrences.length === 0) {
    lines.push('## No Occurrences Found');
    lines.push('');
    lines.push('The specified pattern was not found in the codebase.');
    lines.push('');
  } else {
    lines.push('## Occurrences');
    lines.push('');

    let currentSize = 0;
    let displayedCount = 0;
    const maxDisplay = 50;

    // Group by file
    const byFile = new Map<string, PatternOccurrence[]>();
    for (const occurrence of output.occurrences) {
      const existing = byFile.get(occurrence.file) || [];
      existing.push(occurrence);
      byFile.set(occurrence.file, existing);
    }

    for (const [file, fileOccurrences] of byFile) {
      if (displayedCount >= maxDisplay) {
        lines.push('');
        lines.push(`*...and ${output.occurrences.length - displayedCount} more occurrences*`);
        break;
      }

      lines.push(`### ${file}`);
      lines.push('');

      for (const occurrence of fileOccurrences) {
        if (currentSize > MAX_RESPONSE_SIZE) {
          lines.push('');
          lines.push(`*...response truncated*`);
          break;
        }

        const matchTypeLabel = occurrence.matchType.charAt(0).toUpperCase() + occurrence.matchType.slice(1);
        lines.push(`- **Line ${occurrence.line}** (${matchTypeLabel})`);
        lines.push('```');
        lines.push(occurrence.snippet);
        lines.push('```');
        lines.push('');

        currentSize += lines.join('\n').length;
        displayedCount++;
      }
    }
  }

  // Suggestions
  if (output.suggestions.length > 0) {
    lines.push('## Suggestions');
    lines.push('');
    for (const suggestion of output.suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Searched ${output.filesAnalyzed} files for "${output.pattern}" pattern`);

  return lines.join('\n');
}