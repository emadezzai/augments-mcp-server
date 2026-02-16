/**
 * Anonymous usage tracking middleware - Local Implementation
 *
 * Tracks usage statistics for analytics without collecting PII.
 * Stored in local file cache for aggregation.
 */

import { config } from '@/config';
import { getLogger } from '@/utils/logger';
import { getFileCache } from '@/cache/file-cache';

const logger = getLogger('usage-tracking');

export interface UsageEvent {
  tool: string;
  framework?: string;
  tier: string;
  timestamp: number;
  success: boolean;
  duration_ms?: number;
}

export interface UsageStats {
  tools: Record<string, number>;
  frameworks: Record<string, number>;
  tiers: Record<string, number>;
  total_requests: number;
  success_rate: number;
}

interface DailyUsage {
  tools: Record<string, number>;
  frameworks: Record<string, number>;
  tiers: Record<string, number>;
  success: number;
  failure: number;
}

/**
 * Get usage data for a specific date
 */
async function getDailyUsage(date: string): Promise<DailyUsage> {
  const cache = getFileCache();
  const key = `usage:${date}`;
  const data = await cache.get<DailyUsage>(key);
  
  return data || {
    tools: {},
    frameworks: {},
    tiers: {},
    success: 0,
    failure: 0,
  };
}

/**
 * Save usage data for a specific date
 */
async function saveDailyUsage(date: string, usage: DailyUsage): Promise<void> {
  const cache = getFileCache();
  const key = `usage:${date}`;
  // Keep for 90 days
  await cache.set(key, usage, 90 * 24 * 60 * 60);
}

/**
 * Track a tool usage event
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  try {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const usage = await getDailyUsage(date);

    // Increment tool usage
    usage.tools[event.tool] = (usage.tools[event.tool] || 0) + 1;

    // Increment framework usage (if applicable)
    if (event.framework) {
      usage.frameworks[event.framework] = (usage.frameworks[event.framework] || 0) + 1;
    }

    // Increment tier usage
    usage.tiers[event.tier] = (usage.tiers[event.tier] || 0) + 1;

    // Increment success/failure
    if (event.success) {
      usage.success++;
    } else {
      usage.failure++;
    }

    await saveDailyUsage(date, usage);

    logger.debug('Usage tracked', {
      tool: event.tool,
      framework: event.framework,
      tier: event.tier,
    });
  } catch (error) {
    // Don't fail the request if tracking fails
    logger.warn('Failed to track usage', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get usage statistics for a date range
 */
export async function getUsageStats(
  startDate: string,
  endDate: string
): Promise<UsageStats> {
  try {
    const tools: Record<string, number> = {};
    const frameworks: Record<string, number> = {};
    const tiers: Record<string, number> = {};
    let totalSuccess = 0;
    let totalFailure = 0;

    // Iterate through dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0];
      const usage = await getDailyUsage(date);

      // Aggregate tool usage
      for (const [tool, count] of Object.entries(usage.tools)) {
        tools[tool] = (tools[tool] || 0) + count;
      }

      // Aggregate framework usage
      for (const [framework, count] of Object.entries(usage.frameworks)) {
        frameworks[framework] = (frameworks[framework] || 0) + count;
      }

      // Aggregate tier usage
      for (const [tier, count] of Object.entries(usage.tiers)) {
        tiers[tier] = (tiers[tier] || 0) + count;
      }

      totalSuccess += usage.success;
      totalFailure += usage.failure;
    }

    const totalRequests = totalSuccess + totalFailure;
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;

    return {
      tools,
      frameworks,
      tiers,
      total_requests: totalRequests,
      success_rate: Math.round(successRate * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to get usage stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      tools: {},
      frameworks: {},
      tiers: {},
      total_requests: 0,
      success_rate: 0,
    };
  }
}