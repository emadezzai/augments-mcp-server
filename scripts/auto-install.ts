#!/usr/bin/env node

/**
 * Augments MCP Server - Auto Installation Script
 * 
 * This script automatically:
 * 1. Detects if Cline or Claude Code is installed
 * 2. Configures the MCP server
 * 3. Starts the server in the background
 * 4. Provides a CLI for easy usage
 * 
 * Usage: npx augments-mcp install
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => 
  new Promise(resolve => rl.question(query, resolve));

interface InstallationResult {
  success: boolean;
  message: string;
  details?: any;
}

class AutoInstaller {
  private projectRoot: string;
  private isGlobal: boolean;

  constructor() {
    this.projectRoot = process.cwd();
    this.isGlobal = !existsSync(path.join(this.projectRoot, 'package.json'));
  }

  async run(): Promise<void> {
    console.log('');
    console.log('🚀 Augments MCP Server - Auto Installation');
    console.log('===========================================');
    console.log('');

    try {
      // Step 1: Detect environment
      const detection = await this.detectEnvironment();
      if (!detection.found) {
        console.log('⚠️  No supported environment detected');
        console.log('   Supported: Cline, Claude Code');
        console.log('');
        process.exit(1);
      }

      console.log(`✅ Detected: ${detection.environments.join(', ')}`);
      console.log('');

      // Step 2: Check if already installed
      const alreadyInstalled = await this.checkAlreadyInstalled();
      if (alreadyInstalled) {
        console.log('✅ Augments MCP is already configured');
        console.log('');
        
        const update = await question('Do you want to update the configuration? (y/n): ');
        if (update.toLowerCase() !== 'y') {
          console.log('👋 Installation cancelled');
          process.exit(0);
        }
      }

      // Step 3: Choose installation type
      console.log('');
      console.log('Choose installation type:');
      console.log('1. Local server (recommended for projects)');
      console.log('2. Hosted server (https://mcp.augments.dev/mcp)');
      console.log('3. Custom server URL');
      
      const choice = await question('\nEnter choice (1-3, default 1): ') || '1';

      let serverUrl: string;
      if (choice === '1') {
        serverUrl = await this.setupLocalServer();
      } else if (choice === '2') {
        serverUrl = 'https://mcp.augments.dev/mcp';
      } else {
        serverUrl = await question('Enter custom server URL: ');
      }

      // Step 4: Configure environments
      await this.configureEnvironments(detection.environments, serverUrl);

      // Step 5: Create helper scripts
      await this.createHelperScripts();

      console.log('');
      console.log('✅ Installation completed successfully!');
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Restart your IDE (Cline/Claude Code)');
      console.log('   2. Use: @augments get_api_context query="useEffect" framework="react"');
      console.log('');
      console.log('💡 Tip: Use "npx augments-mcp start" to start local server');
      console.log('');

    } catch (error) {
      console.error('❌ Installation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  private async detectEnvironment(): Promise<{ found: boolean; environments: string[] }> {
    const environments: string[] = [];

    // Check for Cline
    const clineConfigPath = this.isGlobal 
      ? path.join(process.env.HOME || '', '.cline', 'cline_mcp_config.json')
      : path.join(this.projectRoot, '.cline', 'cline_mcp_config.json');
    
    try {
      await fs.access(clineConfigPath);
      environments.push('Cline');
    } catch {}

    // Check for Claude Code config directory
    const claudeConfigDir = this.isGlobal
      ? path.join(process.env.HOME || '', '.claude', 'mcp')
      : path.join(this.projectRoot, '.claude', 'mcp');
    
    try {
      await fs.access(claudeConfigDir);
      environments.push('Claude Code');
    } catch {}

    // Check if running in VSCode/Cursor (for context)
    if (process.env.VSCODE_PID || process.env.CURSOR_PID) {
      environments.push('VSCode/Cursor');
    }

    return {
      found: environments.length > 0,
      environments
    };
  }

  private async checkAlreadyInstalled(): Promise<boolean> {
    // Check Cline config
    const clineConfigPath = this.isGlobal 
      ? path.join(process.env.HOME || '', '.cline', 'cline_mcp_config.json')
      : path.join(this.projectRoot, '.cline', 'cline_mcp_config.json');
    
    try {
      const content = await fs.readFile(clineConfigPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.mcpServers?.augments) {
        return true;
      }
    } catch {}

    // Check Claude Code config
    const claudeConfigPath = this.isGlobal
      ? path.join(process.env.HOME || '', '.claude', 'mcp', 'augments.json')
      : path.join(this.projectRoot, '.claude', 'mcp', 'augments.json');
    
    try {
      await fs.access(claudeConfigPath);
      return true;
    } catch {}

    return false;
  }

  private async setupLocalServer(): Promise<string> {
    console.log('');
    console.log('📁 Setting up local server...');

    // Check if package.json exists
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    let hasPackageJson = false;
    
    try {
      await fs.access(packageJsonPath);
      hasPackageJson = true;
    } catch {}

    if (!hasPackageJson) {
      console.log('⚠️  No package.json found in current directory');
      console.log('   Creating a minimal package.json...');
      
      const minimalPackageJson = {
        name: path.basename(this.projectRoot),
        version: "1.0.0",
        private: true,
        description: "Project with Augments MCP"
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(minimalPackageJson, null, 2));
    }

    // Check if augments-mcp-server is already in dependencies
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const isAlreadyDep = 
      packageJson.dependencies?.['augments-mcp-server'] || 
      packageJson.devDependencies?.['augments-mcp-server'];

    if (!isAlreadyDep) {
      console.log('📦 Installing augments-mcp-server...');
      
      try {
        execSync('npm install augments-mcp-server --save-dev', { 
          stdio: 'inherit',
          cwd: this.projectRoot 
        });
      } catch (error) {
        console.log('⚠️  Could not install via npm, using npx instead');
      }
    }

    // Create start script
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    packageJson.scripts['start:augments'] = 'npx augments-mcp-server';
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log('✅ Local server configured');
    console.log('   Command: npm run start:augments');
    console.log('   Or: npx augments-mcp-server');

    return 'http://localhost:3000/api/mcp';
  }

  private async configureEnvironments(environments: string[], serverUrl: string): Promise<void> {
    console.log('');
    console.log('⚙️  Configuring environments...');

    for (const env of environments) {
      if (env === 'Cline') {
        await this.configureCline(serverUrl);
      } else if (env === 'Claude Code') {
        await this.configureClaudeCode(serverUrl);
      }
    }
  }

  private async configureCline(serverUrl: string): Promise<void> {
    const configPath = this.isGlobal 
      ? path.join(process.env.HOME || '', '.cline', 'cline_mcp_config.json')
      : path.join(this.projectRoot, '.cline', 'cline_mcp_config.json');

    // Ensure directory exists
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    let config: any = { mcpServers: {} };

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(content);
    } catch {}

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    // Determine command based on server URL
    let command: string;
    let args: string[];
    let transport: string;

    if (serverUrl === 'http://localhost:3000/api/mcp') {
      // Local server
      command = 'npx';
      args = ['-y', 'mcp-remote', serverUrl];
      transport = 'http';
    } else {
      // Hosted or custom
      command = 'npx';
      args = ['-y', 'mcp-remote', serverUrl];
      transport = 'http';
    }

    config.mcpServers.augments = {
      command,
      args,
      transport,
      description: 'Augments MCP Server - 100% Local & Free Framework Documentation Provider'
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`   ✅ Cline configured: ${configPath}`);
  }

  private async configureClaudeCode(serverUrl: string): Promise<void> {
    const configDir = this.isGlobal
      ? path.join(process.env.HOME || '', '.claude', 'mcp')
      : path.join(this.projectRoot, '.claude', 'mcp');

    await fs.mkdir(configDir, { recursive: true });

    const configPath = path.join(configDir, 'augments.json');

    let command: string;
    let args: string[];

    if (serverUrl === 'http://localhost:3000/api/mcp') {
      command = 'npx';
      args = ['-y', 'mcp-remote', serverUrl];
    } else {
      command = 'npx';
      args = ['-y', 'mcp-remote', serverUrl];
    }

    const config = {
      command,
      args,
      description: 'Augments MCP Server'
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log(`   ✅ Claude Code configured: ${configPath}`);
  }

  private async createHelperScripts(): Promise<void> {
    console.log('');
    console.log('📝 Creating helper scripts...');

    // Create package.json script if it doesn't exist
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }

      // Add useful scripts
      packageJson.scripts['augments:start'] = 'npx augments-mcp-server';
      packageJson.scripts['augments:status'] = 'curl -s http://localhost:3000/api/mcp | jq .';
      packageJson.scripts['augments:test'] = 'curl -X POST http://localhost:3000/api/mcp -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}\'';

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('   ✅ Added npm scripts to package.json');
    } catch (error) {
      console.log('   ⚠️  Could not update package.json scripts');
    }

    // Create a simple README snippet
    const readmeSnippet = `## Augments MCP Integration

This project is configured with Augments MCP Server.

### Usage
\`\`\`bash
# Start the MCP server
npm run augments:start

# Test connection
npm run augments:test
\`\`\`

### In Cline/Claude Code
\`\`\`
@augments get_api_context query="useEffect" framework="react"
@augments search_apis query="state management"
\`\`\`
`;

    const readmePath = path.join(this.projectRoot, 'AUGMENTS.md');
    await fs.writeFile(readmePath, readmeSnippet);
    console.log('   ✅ Created AUGMENTS.md');
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Augments MCP Server - Auto Installation

Usage:
  npx augments-mcp install    Install and configure
  npx augments-mcp start      Start local server
  npx augments-mcp status     Check server status
  npx augments-mcp config     Show current configuration
  npx augments-mcp --help     Show this help

Examples:
  npx augments-mcp install
  npx augments-mcp start
  @augments get_api_context query="useState" framework="react"
    `);
    process.exit(0);
  }

  if (args.includes('install')) {
    const installer = new AutoInstaller();
    await installer.run();
    process.exit(0);
  }

  if (args.includes('start')) {
    console.log('🚀 Starting Augments MCP Server...');
    console.log('   URL: http://localhost:3000/api/mcp');
    console.log('');
    
    // Start the server
    const serverPath = path.join(__dirname, '..', 'src', 'server.ts');
    const child = spawn('npx', ['tsx', 'src/server.ts'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    // Keep process alive
    process.on('SIGINT', () => {
      child.kill();
      process.exit(0);
    });

    return;
  }

  if (args.includes('status')) {
    try {
      const response = await fetch('http://localhost:3000/api/mcp');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Server is running');
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log('❌ Server is not responding');
      }
    } catch (error) {
      console.log('❌ Server is not running');
      console.log('   Start with: npx augments-mcp start');
    }
    process.exit(0);
  }

  if (args.includes('config')) {
    console.log('📋 Current Configuration:');
    console.log('');
    
    // Show Cline config
    const clinePath = path.join(process.env.HOME || '', '.cline', 'cline_mcp_config.json');
    try {
      const content = await fs.readFile(clinePath, 'utf-8');
      const config = JSON.parse(content);
      if (config.mcpServers?.augments) {
        console.log('Cline:');
        console.log(JSON.stringify(config.mcpServers.augments, null, 2));
      }
    } catch {
      console.log('Cline: Not configured');
    }

    // Show Claude Code config
    const claudePath = path.join(process.env.HOME || '', '.claude', 'mcp', 'augments.json');
    try {
      const content = await fs.readFile(claudePath, 'utf-8');
      const config = JSON.parse(content);
      console.log('');
      console.log('Claude Code:');
      console.log(JSON.stringify(config, null, 2));
    } catch {
      console.log('Claude Code: Not configured');
    }

    process.exit(0);
  }

  // Default: show help
  console.log('Use "npx augments-mcp install" to get started');
  console.log('Or "npx augments-mcp --help" for more options');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AutoInstaller };
