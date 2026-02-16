"use strict";
/**
 * Cache TTL strategies based on content stability
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = void 0;
exports.determineTTL = determineTTL;
exports.generateCacheKey = generateCacheKey;
exports.CacheTTL = {
    // Stable releases - 24 hours
    stable: 86400,
    // Beta versions - 6 hours
    beta: 21600,
    // Development branches - 1 hour
    dev: 3600,
    // Default TTL - 3 hours
    default: 10800,
};
/**
 * Determine TTL based on framework version and branch
 */
function determineTTL(version, branch = 'main') {
    const versionLower = version.toLowerCase();
    const branchLower = branch.toLowerCase();
    // Development branches get shorter TTL
    if (branchLower === 'dev' || branchLower === 'develop' || branchLower === 'development') {
        return exports.CacheTTL.dev;
    }
    // Alpha versions get shortest TTL
    if (versionLower.includes('dev') || versionLower.includes('alpha')) {
        return exports.CacheTTL.dev;
    }
    // Beta and RC versions get medium TTL
    if (versionLower.includes('beta') || versionLower.includes('rc')) {
        return exports.CacheTTL.beta;
    }
    // Stable or latest versions get longest TTL
    if (versionLower === 'stable' || versionLower === 'latest') {
        return exports.CacheTTL.stable;
    }
    return exports.CacheTTL.default;
}
/**
 * Generate a cache key for framework documentation
 */
function generateCacheKey(framework, path = '', sourceType = 'docs') {
    // Create a consistent key format
    const normalizedPath = path.replace(/\//g, ':').toLowerCase();
    const key = `augments:${sourceType}:${framework}:${normalizedPath || 'main'}`;
    return key;
}
