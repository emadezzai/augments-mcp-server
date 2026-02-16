"use strict";
/**
 * Local Cache Implementation
 *
 * A hybrid cache that uses in-memory LRU + file-based persistence.
 * Replaces Upstash Redis for 100% local operation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KVCache = void 0;
exports.getCache = getCache;
const file_cache_1 = require("./file-cache");
const strategies_1 = require("./strategies");
const logger_1 = require("@/utils/logger");
const logger = (0, logger_1.getLogger)('kv-cache');
/**
 * Hybrid cache with LRU memory cache + file persistence
 */
class KVCache {
    constructor() {
        this.localCache = new Map();
        this.MAX_LOCAL_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES || '300', 10);
        this.fileCache = (0, file_cache_1.getFileCache)();
        logger.info('Local cache initialized (replaces Upstash Redis)');
    }
    /**
     * Get cached content
     */
    async get(framework, path = '', sourceType = 'docs') {
        const cacheKey = (0, strategies_1.generateCacheKey)(framework, path, sourceType);
        // Check local cache first (with LRU promotion)
        const localEntry = this.localCache.get(cacheKey);
        if (localEntry && !this.isExpired(localEntry)) {
            // LRU: move to end by deleting and re-inserting
            this.localCache.delete(cacheKey);
            this.localCache.set(cacheKey, localEntry);
            logger.debug('Cache hit (local)', { framework, path });
            return localEntry.content;
        }
        // Check file cache
        const fileEntry = await this.fileCache.get(cacheKey);
        if (fileEntry && !this.isExpired(fileEntry)) {
            // Promote to local cache
            this.addToLocalCache(cacheKey, fileEntry);
            logger.debug('Cache hit (file)', { framework, path });
            return fileEntry.content;
        }
        logger.debug('Cache miss', { framework, path });
        return null;
    }
    /**
     * Store content in cache
     */
    async set(framework, content, path = '', sourceType = 'docs', version = 'latest', branch = 'main') {
        const cacheKey = (0, strategies_1.generateCacheKey)(framework, path, sourceType);
        const ttl = (0, strategies_1.determineTTL)(version, branch);
        const entry = {
            content,
            cached_at: Date.now(),
            ttl,
            version,
            framework,
            source_type: sourceType,
        };
        // Store in local cache
        this.addToLocalCache(cacheKey, entry);
        // Store in file cache for persistence
        await this.fileCache.set(cacheKey, entry, ttl);
        logger.debug('Content cached', {
            framework,
            path,
            ttl,
            size: content.length,
        });
    }
    /**
     * Invalidate specific cached content
     */
    async invalidate(framework, path = '', sourceType = 'docs') {
        const cacheKey = (0, strategies_1.generateCacheKey)(framework, path, sourceType);
        // Remove from local cache
        this.localCache.delete(cacheKey);
        // Remove from file cache
        await this.fileCache.delete(cacheKey);
        logger.debug('Cache invalidated', { framework, path });
    }
    /**
     * Clear all cache for a specific framework
     */
    async clearFramework(framework) {
        let cleared = 0;
        // Clear from local cache
        for (const [key, entry] of this.localCache.entries()) {
            if (entry.framework === framework) {
                this.localCache.delete(key);
                cleared++;
            }
        }
        // For file cache, we clear all (simpler approach)
        // In a production system, you'd scan and delete only matching files
        await this.fileCache.clear();
        logger.info('Framework cache cleared', { framework, count: cleared });
        return cleared;
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memory_entries: this.localCache.size,
            memory_max_entries: this.MAX_LOCAL_ENTRIES,
            memory_utilization_pct: Math.round((this.localCache.size / this.MAX_LOCAL_ENTRIES) * 100),
            indexed_frameworks: this.getIndexedFrameworkCount(),
            ttl_strategies: { ...strategies_1.CacheTTL },
        };
    }
    /**
     * Get framework cache info
     */
    async getFrameworkCacheInfo(framework) {
        let memoryEntries = 0;
        let totalSize = 0;
        let lastCachedAt = null;
        for (const [key, entry] of this.localCache.entries()) {
            if (entry.framework === framework) {
                memoryEntries++;
                totalSize += entry.content.length;
                // Track the most recent cache timestamp for this framework
                if (lastCachedAt === null || entry.cached_at > lastCachedAt) {
                    lastCachedAt = entry.cached_at;
                }
            }
        }
        return {
            framework,
            memory_entries: memoryEntries,
            total_size_bytes: totalSize,
            last_cached_at: lastCachedAt,
        };
    }
    /**
     * Get cache timestamps for all entries
     */
    getCacheTimestamps() {
        if (this.localCache.size === 0) {
            return { oldest: null, newest: null, all: [] };
        }
        const timestamps = Array.from(this.localCache.values()).map((e) => e.cached_at);
        return {
            oldest: Math.min(...timestamps),
            newest: Math.max(...timestamps),
            all: timestamps,
        };
    }
    /**
     * Clear all caches
     */
    async clearAll() {
        this.localCache.clear();
        await this.fileCache.clear();
        logger.info('All caches cleared');
    }
    isExpired(entry) {
        const now = Date.now();
        const expiresAt = entry.cached_at + entry.ttl * 1000;
        return now > expiresAt;
    }
    addToLocalCache(key, entry) {
        // Remove oldest entries if at capacity
        while (this.localCache.size >= this.MAX_LOCAL_ENTRIES) {
            const firstKey = this.localCache.keys().next().value;
            if (firstKey) {
                this.localCache.delete(firstKey);
            }
        }
        this.localCache.set(key, entry);
    }
    getIndexedFrameworkCount() {
        const frameworks = new Set();
        for (const entry of this.localCache.values()) {
            frameworks.add(entry.framework);
        }
        return frameworks.size;
    }
}
exports.KVCache = KVCache;
// Singleton instance for serverless environments
let cacheInstance = null;
function getCache() {
    if (!cacheInstance) {
        cacheInstance = new KVCache();
    }
    return cacheInstance;
}
