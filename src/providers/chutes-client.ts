/**
 * Chutes AI Client
 *
 * Integration with Chutes API for enhanced code examples.
 * This is OPTIONAL - the server works 100% without it using GitHub directly.
 * 
 * Chutes is used only for:
 * - Fetching additional code examples
 * - Alternative to GitHub for example extraction
 * 
 * TypeScript definitions are ALWAYS fetched from npm CDN (unpkg/jsdelivr),
 * NOT from Chutes or any AI service.
 */

import { getLogger } from '@/utils/logger';
import type { CodeExample } from '@/core/example-extractor';

const logger = getLogger('chutes-client');

/**
 * Chutes API configuration
 */
export interface ChutesConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Chutes API response for examples
 */
interface ChutesExamplesResponse {
  examples?: Array<{
    code: string;
    language: string;
    source?: string;
    context?: string;
  }>;
  error?: string;
}

/**
 * Chutes client for fetching code examples
 */
export class ChutesClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: ChutesConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.chutes.ai/v1';
    
    logger.info('Chutes client initialized');
  }

  /**
   * Extract code examples for a framework and concept
   */
  async extractExamples(framework: string, concept: string): Promise<CodeExample[]> {
    try {
      const response = await fetch(`${this.baseUrl}/examples`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          framework,
          concept,
          language: 'typescript',
        }),
      });

      if (!response.ok) {
        logger.warn('Chutes API error', {
          status: response.status,
          framework,
          concept,
        });
        return [];
      }

      const data: ChutesExamplesResponse = await response.json();

      if (data.error) {
        logger.warn('Chutes returned error', { error: data.error });
        return [];
      }

      if (!data.examples || data.examples.length === 0) {
        return [];
      }

      // Convert to CodeExample format
      const examples: CodeExample[] = data.examples.map((ex, index) => ({
        code: ex.code,
        language: ex.language || 'typescript',
        source: ex.source || `chutes.ai/${framework}/${concept}`,
        concepts: [concept.toLowerCase()],
        context: ex.context || `Example ${index + 1} for ${concept}`,
      }));

      logger.debug('Chutes examples fetched', {
        framework,
        concept,
        count: examples.length,
      });

      return examples;
    } catch (error) {
      logger.warn('Chutes request failed', {
        framework,
        concept,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Search for code examples across frameworks
   */
  async searchExamples(query: string, limit: number = 5): Promise<CodeExample[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit,
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data: ChutesExamplesResponse = await response.json();

      if (!data.examples) {
        return [];
      }

      return data.examples.map((ex, index) => ({
        code: ex.code,
        language: ex.language || 'typescript',
        source: ex.source || 'chutes.ai',
        concepts: [],
        context: ex.context || `Search result ${index + 1}`,
      }));
    } catch (error) {
      logger.warn('Chutes search failed', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if the client is configured
   */
  static isConfigured(): boolean {
    return !!process.env.CHUTES_API_KEY;
  }
}

// Singleton instance
let instance: ChutesClient | null = null;

/**
 * Get the Chutes client instance (if configured)
 */
export function getChutesClient(): ChutesClient | null {
  if (instance) {
    return instance;
  }

  const apiKey = process.env.CHUTES_API_KEY;
  if (!apiKey) {
    return null;
  }

  instance = new ChutesClient({
    apiKey,
    baseUrl: process.env.CHUTES_BASE_URL,
  });

  return instance;
}