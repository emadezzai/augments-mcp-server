/**
 * Rate limiting middleware - Local Implementation
 *
 * Simple in-memory rate limiting without Redis.
 * For production, consider using a distributed solution.
 */

import { config } from '@/config';
import { getLogger } from '@/utils/logger';

const logger = getLogger('rate-limit');

/**
 * In-memory rate limit store
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for an identifier (IP address or API key)
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (!config.rateLimitEnabled) {
    // Rate limiting disabled
    return {
      success: true,
      limit: -1,
      remaining: -1,
      reset: 0,
    };
  }

  const now = Date.now();
  const windowMs = config.rateLimitWindow * 1000;
  const resetAt = now + windowMs;

  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    // First request or window expired
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });

    return {
      success: true,
      limit: config.rateLimitRequests,
      remaining: config.rateLimitRequests - 1,
      reset: resetAt,
    };
  }

  if (entry.count >= config.rateLimitRequests) {
    // Rate limit exceeded
    logger.warn('Rate limit exceeded', {
      identifier: identifier.substring(0, 8) + '...',
      remaining: 0,
    });

    return {
      success: false,
      limit: config.rateLimitRequests,
      remaining: 0,
      reset: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;

  return {
    success: true,
    limit: config.rateLimitRequests,
    remaining: config.rateLimitRequests - entry.count,
    reset: entry.resetAt,
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  if (result.limit === -1) {
    return {};
  }

  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}