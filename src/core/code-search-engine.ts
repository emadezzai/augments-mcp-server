/**
 * Code Search Engine
 *
 * Semantic code search engine for large codebases (50k+ lines).
 * Provides intelligent search that understands meaning, not just text matching.
 */

import { getLogger } from '@/utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = getLogger('code-search-engine');

/**
 * Code search result item
 */
export interface CodeSearchResult {
  /** File path relative to root */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Code snippet */
  snippet: string;
  /** Relevance score (0-1) */
  relevance: number;
  /** Type of match */
  matchType: 'exact' | 'semantic' | 'related';
  /** Surrounding context */
  context: string;
  /** Line range for context */
  contextRange: { start: number; end: number };
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Root directory to search */
  rootPath: string;
  /** File pattern (glob) */
  filePattern?: string;
  /** Maximum results */
  maxResults?: number;
  /** Context lines around match */
  contextLines?: number;
  /** Exclude patterns */
  excludePatterns?: string[];
}

/**
 * Indexed file information
 */
interface IndexedFile {
  path: string;
  content: string;
  lines: string[];
  language: string;
}

/**
 * Keyword with weight
 */
interface WeightedKeyword {
  word: string;
  weight: number;
  type: 'identifier' | 'concept' | 'operator' | 'keyword';
}

/**
 * Default exclude patterns
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/**
 * Language detection from file extension
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.m': 'objectivec',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.astro': 'astro',
};

/**
 * Code Search Engine
 */
export class CodeSearchEngine {
  private fileCache: Map<string, IndexedFile> = new Map();
  private lastIndexPath: string | null = null;

  /**
   * Search for code semantically
   */
  async search(
    query: string,
    options: SearchOptions
  ): Promise<CodeSearchResult[]> {
    const startTime = Date.now();
    logger.info('Starting semantic search', { query, options });

    const {
      rootPath,
      filePattern,
      maxResults = 10,
      contextLines = 3,
      excludePatterns = DEFAULT_EXCLUDE_PATTERNS,
    } = options;

    // Extract keywords from query
    const keywords = this.extractKeywords(query);
    logger.debug('Extracted keywords', { keywords });

    // Get matching files
    const files = await this.findMatchingFiles(rootPath, filePattern, excludePatterns);
    logger.debug('Found matching files', { count: files.length });

    // Search each file
    const allResults: CodeSearchResult[] = [];

    for (const filePath of files) {
      try {
        const indexedFile = await this.indexFile(filePath);
        if (!indexedFile) continue;

        const fileResults = this.searchInFile(indexedFile, keywords, contextLines);
        allResults.push(...fileResults);
      } catch (error) {
        logger.debug('Error indexing file', {
          file: filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Sort by relevance and limit results
    allResults.sort((a, b) => b.relevance - a.relevance);
    const limitedResults = allResults.slice(0, maxResults);

    const duration = Date.now() - startTime;
    logger.info('Search completed', {
      query,
      totalMatches: allResults.length,
      returnedResults: limitedResults.length,
      duration,
    });

    return limitedResults;
  }

  /**
   * Extract weighted keywords from a query
   */
  private extractKeywords(query: string): WeightedKeyword[] {
    const keywords: WeightedKeyword[] = [];
    const normalizedQuery = query.toLowerCase().trim();

    // Split into words
    const words = normalizedQuery.split(/\s+/).filter((w) => w.length > 0);

    // Programming keywords
    const programmingKeywords = new Set([
      'function', 'class', 'interface', 'type', 'const', 'let', 'var',
      'import', 'export', 'return', 'if', 'else', 'for', 'while',
      'async', 'await', 'try', 'catch', 'throw', 'new',
    ]);

    // Concept words (higher weight for semantic matching)
    const conceptWords = new Set([
      'payment', 'auth', 'user', 'login', 'logout', 'register',
      'api', 'route', 'handler', 'controller', 'service', 'model',
      'database', 'cache', 'session', 'token', 'validation',
      'error', 'success', 'create', 'read', 'update', 'delete',
      'get', 'post', 'put', 'patch', 'fetch', 'request', 'response',
      'hook', 'component', 'page', 'layout', 'middleware',
      'test', 'spec', 'mock', 'stub',
    ]);

    for (const word of words) {
      // Skip common stop words
      if (this.isStopWord(word)) continue;

      let weight = 1.0;
      let type: WeightedKeyword['type'] = 'identifier';

      // Check for camelCase or snake_case (likely identifier)
      if (/[a-z][A-Z]/.test(word) || /_/.test(word)) {
        weight = 1.5;
        type = 'identifier';
      }
      // Check for concept words
      else if (conceptWords.has(word)) {
        weight = 1.3;
        type = 'concept';
      }
      // Check for programming keywords
      else if (programmingKeywords.has(word)) {
        weight = 0.8;
        type = 'keyword';
      }

      keywords.push({ word, weight, type });
    }

    return keywords;
  }

  /**
   * Check if a word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
      'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all',
      'each', 'few', 'more', 'most', 'other', 'some', 'such',
      'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because',
      'until', 'while', 'although', 'though', 'i', 'me', 'my',
      'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your',
      'yours', 'yourself', 'yourselves', 'he', 'him', 'his',
      'himself', 'she', 'her', 'hers', 'herself', 'it', 'its',
      'itself', 'they', 'them', 'their', 'theirs', 'themselves',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these',
      'those', 'am', 'about', 'how', 'what', 'where', 'when',
    ]);
    return stopWords.has(word);
  }

  /**
   * Find files matching the pattern
   */
  private async findMatchingFiles(
    rootPath: string,
    filePattern?: string,
    excludePatterns: string[] = DEFAULT_EXCLUDE_PATTERNS
  ): Promise<string[]> {
    const files: string[] = [];
    const pattern = filePattern || '*.{ts,tsx,js,jsx,py,go,rs,java}';

    // Convert glob pattern to regex
    const regex = this.globToRegex(pattern);

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Check exclude patterns
          const shouldExclude = excludePatterns.some((pattern) => {
            if (pattern.startsWith('*.')) {
              return fullPath.endsWith(pattern.slice(1));
            }
            return fullPath.includes(pattern);
          });

          if (shouldExclude) continue;

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
  private globToRegex(glob: string): RegExp {
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
   * Index a file for searching
   */
  private async indexFile(filePath: string): Promise<IndexedFile | null> {
    // Check cache
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const ext = path.extname(filePath);
      const language = EXTENSION_TO_LANGUAGE[ext] || 'unknown';

      const indexed: IndexedFile = {
        path: filePath,
        content,
        lines,
        language,
      };

      // Cache for future searches
      this.fileCache.set(filePath, indexed);

      return indexed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Search within an indexed file
   */
  private searchInFile(
    file: IndexedFile,
    keywords: WeightedKeyword[],
    contextLines: number
  ): CodeSearchResult[] {
    const results: CodeSearchResult[] = [];

    for (let lineIndex = 0; lineIndex < file.lines.length; lineIndex++) {
      const line = file.lines[lineIndex];
      const lineLower = line.toLowerCase();

      // Skip empty lines and comments
      if (line.trim().length === 0) continue;
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;
      if (line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;

      // Calculate relevance for this line
      let totalRelevance = 0;
      let matchedKeywords = 0;
      let matchType: CodeSearchResult['matchType'] = 'related';

      for (const { word, weight, type } of keywords) {
        // Exact match
        if (lineLower.includes(word)) {
          totalRelevance += weight;
          matchedKeywords++;

          // Check if it's an exact identifier match
          const identifierPattern = new RegExp(`\\b${word}\\b`, 'i');
          if (identifierPattern.test(line)) {
            totalRelevance += weight * 0.5;
            matchType = 'exact';
          }
        }

        // Semantic match (partial word match)
        const partialMatches = keywords.filter((k) =>
          lineLower.includes(k.word.substring(0, Math.min(4, k.word.length)))
        );
        if (partialMatches.length > 0) {
          matchType = 'semantic';
        }
      }

      // Only include if we have matches
      if (matchedKeywords > 0) {
        // Normalize relevance to 0-1
        const normalizedRelevance = Math.min(totalRelevance / (keywords.length * 2), 1);

        // Get context
        const startLine = Math.max(0, lineIndex - contextLines);
        const endLine = Math.min(file.lines.length - 1, lineIndex + contextLines);
        const context = file.lines.slice(startLine, endLine + 1).join('\n');

        results.push({
          file: file.path,
          line: lineIndex + 1, // 1-indexed
          snippet: line.trim(),
          relevance: normalizedRelevance,
          matchType,
          context,
          contextRange: { start: startLine + 1, end: endLine + 1 },
        });
      }
    }

    return results;
  }

  /**
   * Clear the file cache
   */
  clearCache(): void {
    this.fileCache.clear();
    this.lastIndexPath = null;
    logger.debug('File cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { files: number; estimatedSize: string } {
    let totalSize = 0;
    for (const file of this.fileCache.values()) {
      totalSize += file.content.length;
    }

    return {
      files: this.fileCache.size,
      estimatedSize: `${(totalSize / 1024).toFixed(2)} KB`,
    };
  }
}

// Singleton instance
let instance: CodeSearchEngine | null = null;

export function getCodeSearchEngine(): CodeSearchEngine {
  if (!instance) {
    instance = new CodeSearchEngine();
  }
  return instance;
}