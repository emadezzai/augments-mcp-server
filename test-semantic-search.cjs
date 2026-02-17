/**
 * Manual test for semantic_code_search tool
 * 
 * Run: npx tsx test-semantic-search.cjs
 */

const { getCodeSearchEngine } = require('./src/core/code-search-engine.ts');

async function test() {
  console.log('=== Testing semantic_code_search ===\n');
  
  const engine = getCodeSearchEngine();
  const rootPath = process.cwd();
  
  // Test 1: Search for "cache"
  console.log('1. Search for "cache":');
  const results1 = await engine.search('cache', {
    rootPath,
    filePattern: '*.ts',
    maxResults: 3,
    contextLines: 2
  });
  console.log(`   Found: ${results1.length} results`);
  results1.forEach(r => console.log(`   - ${r.file}:${r.line} (${Math.round(r.relevance*100)}%)`));
  console.log('');
  
  // Test 2: Search for "auth"
  console.log('2. Search for "auth":');
  const results2 = await engine.search('auth', {
    rootPath,
    filePattern: '*.ts',
    maxResults: 3,
    contextLines: 2
  });
  console.log(`   Found: ${results2.length} results`);
  results2.forEach(r => console.log(`   - ${r.file}:${r.line} (${Math.round(r.relevance*100)}%)`));
  console.log('');
  
  // Test 3: Search for "import"
  console.log('3. Search for "import":');
  const results3 = await engine.search('import', {
    rootPath,
    filePattern: '*.ts',
    maxResults: 3,
    contextLines: 2
  });
  console.log(`   Found: ${results3.length} results`);
  results3.forEach(r => console.log(`   - ${r.file}:${r.line} (${Math.round(r.relevance*100)}%)`));
  console.log('');
  
  // Cache stats
  const stats = engine.getCacheStats();
  console.log('=== Cache Stats ===');
  console.log(`   Files: ${stats.files}`);
  console.log(`   Size: ${stats.estimatedSize}`);
  
  console.log('\n✅ Test completed!');
}

test().catch(console.error);
