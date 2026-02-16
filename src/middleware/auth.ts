/**
 * API Key authentication middleware - Local Implementation
 *
 * All requests pass through as free tier.
 * Premium features are disabled for 100% local operation.
 */

import { getLogger } from '@/utils/logger';

const logger = getLogger('auth');

export interface AuthResult {
  authenticated: boolean;
  apiKey?: string;
  tier: 'free' | 'pro' | 'team' | 'enterprise';
  userId?: string;
}

/**
 * Validate API key from request headers
 *
 * All requests are authenticated as free tier for local operation.
 */
export async function validateApiKey(authHeader: string | null): Promise<AuthResult> {
  // Local mode - all requests are free tier
  if (!authHeader) {
    return {
      authenticated: true,
      tier: 'free',
    };
  }

  // Parse Bearer token if provided (for future use)
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      authenticated: true,
      tier: 'free',
    };
  }

  const apiKey = match[1];

  // Log if API key is provided (for debugging)
  if (apiKey.startsWith('aug_')) {
    logger.debug('API key provided (ignored in local mode)', { key: apiKey.substring(0, 8) + '...' });
  }

  return {
    authenticated: true,
    tier: 'free',
  };
}

/**
 * Check if a feature is available for the given tier
 * 
 * All features are available in local mode.
 */
export function checkFeatureAccess(_tier: AuthResult['tier'], _feature: string): boolean {
  // All features are available for local operation
  return true;
}