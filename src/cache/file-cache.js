"use strict";
/**
 * File-based Cache for Local Development
 *
 * A persistent file-based cache that stores data in .cache/ directory.
 * Replaces Upstash Redis for 100% local operation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCache = void 0;
exports.getFileCache = getFileCache;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("@/utils/logger");
const logger = (0, logger_1.getLogger)('file-cache');
/**
 * File-based cache implementation
 */
class FileCache {
    constructor(cacheDir) {
        this.initialized = false;
        this.cacheDir = cacheDir || process.env.CACHE_PATH || path_1.default.join(process.cwd(), '.cache');
    }
    /**
     * Ensure cache directory exists
     */
    async ensureDir() {
        if (this.initialized)
            return;
        try {
            await promises_1.default.mkdir(this.cacheDir, { recursive: true });
            this.initialized = true;
        }
        catch (error) {
            logger.error('Failed to create cache directory', {
                path: this.cacheDir,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Get file path for a key
     */
    getFilePath(key) {
        // Sanitize key for filesystem
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path_1.default.join(this.cacheDir, `${safeKey}.json`);
    }
    /**
     * Get a value from cache
     */
    async get(key) {
        try {
            await this.ensureDir();
            const filePath = this.getFilePath(key);
            const data = await promises_1.default.readFile(filePath, 'utf-8');
            const cached = JSON.parse(data);
            // Check if expired
            if (Date.now() > cached.expiry) {
                await this.delete(key);
                return null;
            }
            logger.debug('Cache hit', { key });
            return cached.value;
        }
        catch (error) {
            // File doesn't exist or parse error
            return null;
        }
    }
    /**
     * Store a value in cache
     */
    async set(key, value, ttl = 3600) {
        try {
            await this.ensureDir();
            const filePath = this.getFilePath(key);
            const entry = {
                value,
                expiry: Date.now() + ttl * 1000,
                storedAt: Date.now(),
            };
            await promises_1.default.writeFile(filePath, JSON.stringify(entry, null, 2));
            logger.debug('Cache set', { key, ttl });
        }
        catch (error) {
            logger.warn('Failed to write cache', {
                key,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Delete a specific key
     */
    async delete(key) {
        try {
            const filePath = this.getFilePath(key);
            await promises_1.default.unlink(filePath);
            logger.debug('Cache deleted', { key });
        }
        catch {
            // File doesn't exist, ignore
        }
    }
    /**
     * Check if key exists and is not expired
     */
    async has(key) {
        const value = await this.get(key);
        return value !== null;
    }
    /**
     * Clear all cache files
     */
    async clear() {
        try {
            await promises_1.default.rm(this.cacheDir, { recursive: true, force: true });
            this.initialized = false;
            logger.info('Cache cleared', { path: this.cacheDir });
        }
        catch (error) {
            logger.warn('Failed to clear cache', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            await this.ensureDir();
            const files = await promises_1.default.readdir(this.cacheDir);
            let totalSize = 0;
            let oldest = null;
            let newest = null;
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const filePath = path_1.default.join(this.cacheDir, file);
                const stats = await promises_1.default.stat(filePath);
                totalSize += stats.size;
                try {
                    const data = await promises_1.default.readFile(filePath, 'utf-8');
                    const entry = JSON.parse(data);
                    if (oldest === null || entry.storedAt < oldest)
                        oldest = entry.storedAt;
                    if (newest === null || entry.storedAt > newest)
                        newest = entry.storedAt;
                }
                catch {
                    // Skip invalid files
                }
            }
            return {
                totalEntries: files.filter(f => f.endsWith('.json')).length,
                totalSizeBytes: totalSize,
                oldestEntry: oldest,
                newestEntry: newest,
            };
        }
        catch {
            return {
                totalEntries: 0,
                totalSizeBytes: 0,
                oldestEntry: null,
                newestEntry: null,
            };
        }
    }
}
exports.FileCache = FileCache;
// Singleton instance
let instance = null;
function getFileCache() {
    if (!instance) {
        instance = new FileCache();
    }
    return instance;
}
