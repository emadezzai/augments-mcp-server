/**
 * Simple script to check cache status
 */

import { getCache } from './src/cache/kv-cache.js';

async function checkCacheStatus() {
  console.log('🔍 التحقق من حالة الكاش...\n');
  
  try {
    // Get cache instance
    const cache = getCache();
    
    // Get cache statistics
    const stats = cache.getStats();
    
    console.log('📊 إحصائيات الكاش:');
    console.log('-------------------');
    console.log(`• إدخالات الذاكرة: ${stats.memory_entries}`);
    console.log(`• سعة الذاكرة القصوى: ${stats.memory_max_entries}`);
    console.log(`• نسبة الاستخدام: ${stats.memory_utilization_pct}%`);
    console.log(`• الأطر المخزنة: ${stats.indexed_frameworks}`);
    console.log(`• استراتيجيات TTL: ${JSON.stringify(stats.ttl_strategies, null, 2)}`);
    
    // Get cache timestamps
    const timestamps = cache.getCacheTimestamps();
    if (timestamps.all.length > 0) {
      console.log('\n⏰ توقيتات الكاش:');
      console.log('-------------------');
      console.log(`• أقدم كاش: ${new Date(timestamps.oldest).toLocaleString()}`);
      console.log(`• أحدث كاش: ${new Date(timestamps.newest).toLocaleString()}`);
      console.log(`• إجمالي الإدخالات: ${timestamps.all.length}`);
    } else {
      console.log('\n⚠️  الكاش فارغ - لا توجد إدخالات مخزنة');
    }
    
    // Check if cache is working
    const isWorking = stats.memory_entries > 0 || stats.indexed_frameworks > 0;
    
    console.log('\n✅ نتيجة التحقق:');
    console.log('-------------------');
    if (isWorking) {
      console.log('✓ الكاش يعمل بشكل صحيح');
      console.log('✓ يوجد بيانات مخزنة في الكاش');
      console.log('✓ النظام جاهز للاستخدام');
    } else {
      console.log('⚠️ الكاش فارغ حاليًا');
      console.log('ℹ️  هذا طبيعي إذا لم يتم استخدام النظام بعد');
      console.log('ℹ️  سيتم ملء الكاش تلقائيًا عند أول استخدام');
    }
    
    return isWorking;
    
  } catch (error) {
    console.error('❌ خطأ في التحقق من الكاش:');
    console.error(error.message);
    return false;
  }
}

// Run the check
checkCacheStatus().then(isWorking => {
  process.exit(isWorking ? 0 : 1);
});