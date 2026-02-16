/**
 * Cache status checker using TypeScript
 */

import { getCache } from './src/cache/kv-cache';

async function checkCacheStatus(): Promise<boolean> {
  console.log('🔍 Checking cache status...\n');
  
  try {
    // Get cache instance
    const cache = getCache();
    
    // Get cache statistics
    const stats = cache.getStats();
    
    console.log('📊 Cache Statistics:');
    console.log('-------------------');
    console.log(`• Memory entries: ${stats.memory_entries}`);
    console.log(`• Max memory capacity: ${stats.memory_max_entries}`);
    console.log(`• Usage percentage: ${stats.memory_utilization_pct}%`);
    console.log(`• Indexed frameworks: ${stats.indexed_frameworks}`);
    console.log(`• TTL strategies: ${JSON.stringify(stats.ttl_strategies, null, 2)}`);
    
    // Get cache timestamps
    const timestamps = cache.getCacheTimestamps();
    if (timestamps.all.length > 0) {
      console.log('\n⏰ Cache Timestamps:');
      console.log('-------------------');
      console.log(`• Oldest cache: ${new Date(timestamps.oldest!).toLocaleString()}`);
      console.log(`• Newest cache: ${new Date(timestamps.newest!).toLocaleString()}`);
      console.log(`• Total entries: ${timestamps.all.length}`);
    } else {
      console.log('\n⚠️  Cache is empty - no stored entries');
    }
    
    // Check if cache is working
    const isWorking = stats.memory_entries > 0 || stats.indexed_frameworks > 0;
    
    console.log('\n✅ Check Result:');
    console.log('-------------------');
    if (isWorking) {
      console.log('✓ Cache is working correctly');
      console.log('✓ Data is stored in cache');
      console.log('✓ System is ready for use');
    } else {
      console.log('⚠️ Cache is currently empty');
      console.log('ℹ️  This is normal if the system has not been used yet');
      console.log('ℹ️  Cache will be automatically filled on first use');
    }
    
    return isWorking;
    
  } catch (error) {
    console.error('❌ Error checking cache:');
    console.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Run the check
checkCacheStatus().then(isWorking => {
  process.exit(isWorking ? 0 : 1);
});