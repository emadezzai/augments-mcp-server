/**
 * File-based Cache for Local Development
 *
 * A persistent file-based cache that stores data in .cache/ directory.
 * Replaces Upstash Redis for 100% local operation.
 */

import fs from 'fs/promises';
import path from 'path';
import { getLogger } from '@/utils/logger';

const logger = getLogger('file-cache');

/**
 * Cache entry stored in file
 */
interface FileCacheEntry<T> {
  value: T;
  expiry: number;
  storedAt: number;
}

/**
 * File-based cache implementation
 */
export class FileCache {
  private cacheDir: string;
  private initialized: boolean = false;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || process.env.CACHE_PATH || path.join(process.cwd(), '.cache');
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to create cache directory', {
        path: this.cacheDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get file path for a key
   */
  private getFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureDir();
      
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      const cached: FileCacheEntry<T> = JSON.parse(data);

      // Check if expired
      if (Date.now() > cached.expiry) {
        await this.delete(key);
        return null;
      }

      logger.debug('Cache hit', { key });
      return cached.value;
    } catch (error) {
      // File doesn't exist or parse error
      return null;
    }
  }

  /**
   * Store a value in cache
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      await this.ensureDir();
      
      const filePath = this.getFilePath(key);
      const entry: FileCacheEntry<T> = {
        value,
        expiry: Date.now() + ttl * 1000,
        storedAt: Date.now(),
      };

      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.warn('Failed to write cache', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
      logger.debug('Cache deleted', { key });
    } catch {
      // File doesn't exist, ignore
    }
  }

  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Clear all cache files
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      this.initialized = false;
      logger.info('Cache cleared', { path: this.cacheDir });
    } catch (error) {
      logger.warn('Failed to clear cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalSizeBytes: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    try {
      await this.ensureDir();
      const files = await fs.readdir(this.cacheDir);
      
      let totalSize = 0;
      let oldest: number | null = null;
      let newest: number | null = null;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        try {
          const data = await fs.readFile(filePath, 'utf-8');
          const entry: FileCacheEntry<unknown> = JSON.parse(data);
          
          if (oldest === null || entry.storedAt < oldest) oldest = entry.storedAt;
          if (newest === null || entry.storedAt > newest) newest = entry.storedAt;
        } catch {
          // Skip invalid files
        }
      }

      return {
        totalEntries: files.filter(f => f.endsWith('.json')).length,
        totalSizeBytes: totalSize,
        oldestEntry: oldest,
        newestEntry: newest,
      };
    } catch {
      return {
        totalEntries: 0,
        totalSizeBytes: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }
}

// Singleton instance
let instance: FileCache | null = null;

export function getFileCache(): FileCache {
  if (!instance) {
    instance = new FileCache();
  }
  return instance;
}