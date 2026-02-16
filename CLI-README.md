# Augments MCP - CLI Tool

A powerful CLI tool that automatically installs and configures the Augments MCP Server in any project.

## 🚀 Installation & Usage

### Quick Start (Recommended)

```bash
# Install and configure in one command
npx augments-mcp install
```

That's it! The tool will:
- ✅ Detect your environment (Cline, Claude Code, VSCode)
- ✅ Configure the MCP server automatically
- ✅ Install dependencies if needed
- ✅ Create helper scripts
- ✅ Work 100% locally - no API keys needed!

### All Commands

```bash
# Install and configure
npx augments-mcp install

# Start local server
npx augments-mcp start

# Check server status
npx augments-mcp status

# Show current configuration
npx augments-mcp config

# Show help
npx augments-mcp --help
```

## 🎯 What It Does

### 1. Environment Detection
Automatically detects:
- **Cline** - Configures `~/.cline/cline_mcp_config.json` or `./.cline/cline_mcp_config.json`
- **Claude Code** - Configures `~/.claude/mcp/augments.json` or `./.claude/mcp/augments.json`
- **VSCode/Cursor** - Detects IDE context

### 2. Installation Options

#### Option A: Local Server (Recommended for Projects)
```bash
npx augments-mcp install
# Choose: 1 (Local server)
```
- Installs `augments-mcp-server` as dev dependency
- Creates npm scripts: `npm run augments:start`
- Creates `AUGMENTS.md` with usage guide

#### Option B: Hosted Server
```bash
npx augments-mcp install
# Choose: 2 (Hosted server)
```
- Uses `https://mcp.augments.dev/mcp`
- No local installation needed
- Always up-to-date

#### Option C: Custom Server
```bash
npx augments-mcp install
# Choose: 3 (Custom URL)
```
- Use your own server URL
- Self-hosted or private instances

### 3. Automatic Configuration

**For Cline:**
```json
{
  "mcpServers": {
    "augments": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
      "transport": "http",
      "description": "Augments MCP Server - 100% Local & Free Framework Documentation Provider"
    }
  }
}
```

**For Claude Code:**
```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"],
  "description": "Augments MCP Server"
}
```

### 4. Helper Scripts Created

**In package.json:**
```json
{
  "scripts": {
    "augments:start": "npx augments-mcp-server",
    "augments:status": "curl -s http://localhost:3000/api/mcp | jq .",
    "augments:test": "curl -X POST http://localhost:3000/api/mcp -H \"Content-Type: application/json\" -d '{\"jsonrpc\":\"2.0\",\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{},\"clientInfo\":{\"name\":\"test\",\"version\":\"1.0\"}},\"id\":1}'"
  }
}
```

**In AUGMENTS.md:**
```markdown
## Augments MCP Integration

This project is configured with Augments MCP Server.

### Usage
```bash
# Start the MCP server
npm run augments:start

# Test connection
npm run augments:test
```

### In Cline/Claude Code
```
@augments get_api_context query="useEffect" framework="react"
@augments search_apis query="state management"
```
```

## 🛠️ Manual Commands

### Start Local Server
```bash
# If installed locally
npm run augments:start

# Or directly
npx augments-mcp-server
```

### Check Status
```bash
npx augments-mcp status
```

Expected output:
```json
{
  "name": "augments-mcp-server",
  "version": "4.1.0",
  "status": "healthy",
  "transport": "streamable-http",
  "endpoint": "/api/mcp",
  "tools": 7
}
```

### View Configuration
```bash
npx augments-mcp config
```

Shows current MCP configuration for both Cline and Claude Code.

## 🎯 Usage in IDE

After installation, restart your IDE and use:

### In Cline
```
@augments get_api_context query="useState" framework="react"
@augments search_apis query="database query"
@augments get_version_info framework="react" fromVersion="18" toVersion="19"
```

### In Claude Code
```
@augments get_api_context query="useEffect cleanup" framework="react"
@augments search_apis query="state management hook"
```

## 🔧 Troubleshooting

### "No supported environment detected"
- Make sure you have Cline or Claude Code installed
- Or install one of them first

### "Server not running"
```bash
# Start the server
npx augments-mcp start

# Or if installed locally
npm run augments:start
```

### "Port already in use"
The server will automatically try port 3001, 3002, etc.

### "Connection refused"
1. Make sure server is running: `npx augments-mcp status`
2. Check firewall settings
3. Restart your IDE

## 📦 What Gets Installed

### Local Server Mode
- **augments-mcp-server** (dev dependency)
- Helper scripts in package.json
- AUGMENTS.md documentation file

### Hosted Mode
- No local installation
- Just MCP configuration
- Always latest version

## 🎯 Benefits

✅ **Zero Configuration** - Works out of the box  
✅ **Auto-Detection** - Finds your IDE automatically  
✅ **100% Local** - No API keys required  
✅ **Flexible** - Local or hosted options  
✅ **Smart** - Updates existing configs safely  
✅ **Complete** - Creates helper scripts and docs  

## 📚 Examples

### React Project
```bash
cd my-react-app
npx augments-mcp install
# Choose: 1 (Local server)
# Restart VSCode
# In Cline: @augments get_api_context query="useEffect" framework="react"
```

### Node.js Backend
```bash
cd my-backend
npx augments-mcp install
# Choose: 2 (Hosted server)
# In Claude Code: @augments get_api_context query="express Router" framework="express"
```

### New Project
```bash
mkdir my-project && cd my-project
npm init -y
npx augments-mcp install
# Now you have full MCP support!
```

## 🔗 Related

- [Main README](README.md) - Full project documentation
- [Usage Guide](USAGE-GUIDE.md) - Detailed usage examples
- [GitHub](https://github.com/emadezzai/augments-mcp-server) - Source code

---

**The fastest way to add Augments MCP to any project! 🚀**