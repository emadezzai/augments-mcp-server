/**
 * Setup Script for Local Development
 *
 * Prepares the Augments MCP Server for 100% local operation.
 * Run with: npm run setup:local
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const CACHE_DIR = '.cache';
const ENV_FILE = '.env';
const ENV_EXAMPLE = '.env.example';

async function main() {
  console.log('');
  console.log('🚀 Augments MCP Server - Local Setup');
  console.log('=====================================');
  console.log('');

  // Step 1: Create cache directory
  console.log('📁 Step 1: Creating cache directory...');
  const cachePath = path.join(process.cwd(), CACHE_DIR);
  
  try {
    await fs.mkdir(cachePath, { recursive: true });
    console.log(`   ✅ Created: ${cachePath}`);
  } catch (error) {
    console.log(`   ⚠️  Could not create cache directory: ${error}`);
  }

  // Step 2: Check/Create .env file
  console.log('');
  console.log('⚙️  Step 2: Setting up environment variables...');
  const envPath = path.join(process.cwd(), ENV_FILE);
  const envExamplePath = path.join(process.cwd(), ENV_EXAMPLE);

  if (existsSync(envPath)) {
    console.log(`   ✅ ${ENV_FILE} already exists`);
  } else if (existsSync(envExamplePath)) {
    await fs.copyFile(envExamplePath, envPath);
    console.log(`   ✅ Created ${ENV_FILE} from ${ENV_EXAMPLE}`);
  } else {
    // Create minimal .env
    const minimalEnv = `# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# Cache Settings
CACHE_PATH=./.cache
CACHE_MAX_ENTRIES=300

# Logging
LOG_LEVEL=debug
`;
    await fs.writeFile(envPath, minimalEnv);
    console.log(`   ✅ Created minimal ${ENV_FILE}`);
  }

  // Step 3: Check dependencies
  console.log('');
  console.log('📦 Step 3: Checking dependencies...');
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  
  if (existsSync(nodeModulesPath)) {
    console.log('   ✅ node_modules exists');
  } else {
    console.log('   ⚠️  node_modules not found. Run: npm install');
  }

  // Step 4: Summary
  console.log('');
  console.log('✨ Setup Complete!');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. (Optional) Edit .env to add API keys:');
  console.log('      - MINIMAX_API_KEY for enhanced query parsing');
  console.log('      - CHUTES_API_KEY for enhanced examples');
  console.log('      - GITHUB_TOKEN for higher GitHub API limits');
  console.log('');
  console.log('   2. Start the server:');
  console.log('      npm run dev');
  console.log('');
  console.log('   3. Test the API:');
  console.log('      curl http://localhost:3000/mcp');
  console.log('');
  console.log('💡 The server works 100% locally without any API keys!');
  console.log('   TypeScript definitions are fetched from npm CDN directly.');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});