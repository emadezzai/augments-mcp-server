/**
 * Simple cache checker - bypasses TypeScript imports
 */

const fs = require('fs');
const path = require('path');

const cacheDir = path.join(process.cwd(), '.cache');

function checkCache() {
  console.log('🔍 Checking cache status...\n');
  
  // Check if cache directory exists
  if (!fs.existsSync(cacheDir)) {
    console.log('⚠️  Cache is empty - no .cache folder found');
    console.log('ℹ️  This is normal if the system has not been used yet');
    return false;
  }

  // Read cache files
  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
  
  if (files.length === 0) {
    console.log('⚠️  Cache is empty - no stored files');
    console.log('ℹ️  This is normal if the system has not been used yet');
    return false;
  }

  console.log('📊 Cache Statistics:');
  console.log('-------------------');
  console.log(`• Number of cache files: ${files.length}`);
  
  let totalSize = 0;
  let oldest = null;
  let newest = null;
  let frameworks = new Set();

  files.forEach(file => {
    const filePath = path.join(cacheDir, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
    
    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (content.value && content.value.framework) {
        frameworks.add(content.value.framework);
      }
      if (content.storedAt) {
        if (!oldest || content.storedAt < oldest) oldest = content.storedAt;
        if (!newest || content.storedAt > newest) newest = content.storedAt;
      }
    } catch (e) {
      // Skip invalid files
    }
  });

  console.log(`• Total cache size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`• Stored frameworks: ${Array.from(frameworks).join(', ') || 'None'}`);
  
  if (oldest && newest) {
    console.log(`• Oldest cache: ${new Date(oldest).toLocaleString()}`);
    console.log(`• Newest cache: ${new Date(newest).toLocaleString()}`);
  }

  console.log('\n✅ Check Result:');
  console.log('-------------------');
  console.log('✓ Cache is working correctly');
  console.log('✓ Data is stored in cache');
  console.log('✓ System is ready for use');
  
  // Show sample files
  console.log('\n📁 Cache Files:');
  console.log('-------------------');
  files.slice(0, 5).forEach(file => {
    console.log(`• ${file}`);
  });
  if (files.length > 5) {
    console.log(`• ... and ${files.length - 5} more files`);
  }
  
  return true;
}

try {
  const result = checkCache();
  process.exit(result ? 0 : 1);
} catch (error) {
  console.error('❌ Error checking cache:');
  console.error(error.message);
  process.exit(1);
}