/**
 * Minimax AI Client
 *
 * Integration with Minimax API for enhanced query parsing.
 * This is OPTIONAL - the server works 100% without it using npm CDN directly.
 * 
 * Minimax is used only for:
 * - Improving natural language query parsing
 * - Better framework/concept detection
 * 
 * TypeScript definitions are ALWAYS fetched from npm CDN (unpkg/jsdelivr),
 * NOT from Minimax or any AI service.
 */

import { getLogger } from '@/utils/logger';

const logger = getLogger('minimax-client');

/**
 * Minimax API configuration
 */
export interface MinimaxConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Parsed query result from Minimax
 */
export interface ParsedQueryResult {
  framework: string;
  concept: string;
  version?: string;
  confidence: number;
}

/**
 * Chat message for Minimax API
 */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Minimax API response
 */
interface MinimaxResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Minimax client for enhanced query parsing
 */
export class MinimaxClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: MinimaxConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.minimax.chat/v1';
    this.model = config.model || 'abab6.5s-chat';
    
    logger.info('Minimax client initialized', { model: this.model });
  }

  /**
   * Parse a natural language query to extract framework, concept, and version
   */
  async parseQuery(userQuery: string): Promise<ParsedQueryResult | null> {
    const prompt = `Extract structured information from this programming query:

Query: "${userQuery}"

Return ONLY a JSON object (no markdown, no explanation):
{
  "framework": "framework name (e.g., react, vue, next, express)",
  "concept": "API or concept name (e.g., useState, useEffect, useRouter)",
  "version": "version if mentioned (e.g., 19, 18.2)",
  "confidence": 0.0 to 1.0
}

Rules:
- framework should be lowercase
- concept should be the exact API name if identifiable
- version should be null if not mentioned
- confidence should reflect how certain you are`;

    try {
      const response = await this.chat([
        { role: 'system', content: 'You are a query parser for programming frameworks. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ]);

      if (!response) {
        return null;
      }

      // Parse the JSON response
      const result = this.parseJsonResponse(response);
      
      if (result) {
        logger.debug('Query parsed by Minimax', { query: userQuery, result });
      }

      return result;
    } catch (error) {
      logger.warn('Minimax query parsing failed', {
        query: userQuery,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Send a chat request to Minimax
   */
  private async chat(messages: ChatMessage[]): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Minimax API error', {
          status: response.status,
          error: errorText,
        });
        return null;
      }

      const data: MinimaxResponse = await response.json();
      return data.choices[0]?.message?.content || null;
    } catch (error) {
      logger.error('Minimax request failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Parse JSON from Minimax response
   */
  private parseJsonResponse(response: string): ParsedQueryResult | null {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        jsonStr = lines.slice(1, -1).join('\n');
      }

      const parsed = JSON.parse(jsonStr);

      return {
        framework: parsed.framework?.toLowerCase() || '',
        concept: parsed.concept || '',
        version: parsed.version || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if the client is configured
   */
  static isConfigured(): boolean {
    return !!process.env.MINIMAX_API_KEY;
  }
}

// Singleton instance
let instance: MinimaxClient | null = null;

/**
 * Get the Minimax client instance (if configured)
 */
export function getMinimaxClient(): MinimaxClient | null {
  if (instance) {
    return instance;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return null;
  }

  instance = new MinimaxClient({
    apiKey,
    baseUrl: process.env.MINIMAX_BASE_URL,
    model: process.env.MINIMAX_MODEL,
  });

  return instance;
}