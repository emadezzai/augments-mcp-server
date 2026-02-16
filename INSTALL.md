# Installation Guide - Augments MCP Server

## 🚀 The Easiest Way: Auto Installation

The new **Auto Installation** feature makes it incredibly easy to add Augments MCP to any project.

### One-Command Setup

```bash
npx augments-mcp install
```

**That's it!** The tool will automatically:
1. ✅ Detect your IDE (Cline, Claude Code, VSCode)
2. ✅ Configure the MCP server
3. ✅ Install dependencies if needed
4. ✅ Create helper scripts
5. ✅ Work 100% locally - no API keys!

---

## 📋 What You Need

Before running the installer, make sure you have:

- **Node.js 18+** installed
- **Cline** or **Claude Code** extension in your IDE
- **An internet connection** (for first-time setup)

---

## 🎯 Installation Options

### Option 1: Local Server (Recommended for Projects)

Perfect for projects where you want full control:

```bash
cd your-project
npx augments-mcp install
# Choose: 1 (Local server)
```

**What happens:**
- Installs `augments-mcp-server` as dev dependency
- Creates `npm run augments:start` script
- Creates `AUGMENTS.md` with usage guide
- Configures Cline/Claude Code to use local server

**Start the server:**
```bash
npm run augments:start
# Or: npx augments-mcp start
```

### Option 2: Hosted Server (Recommended for Quick Start)

Perfect for trying it out or personal use:

```bash
cd your-project
npx augments-mcp install
# Choose: 2 (Hosted server)
```

**What happens:**
- Uses `https://mcp.augments.dev/mcp`
- No local installation needed
- Always the latest version
- Zero setup time

### Option 3: Custom Server

For self-hosted or private instances:

```bash
cd your-project
npx augments-mcp install
# Choose: 3 (Custom URL)
# Enter your server URL
```

---

## 🛠️ After Installation

### 1. Restart Your IDE
Close and reopen VSCode/Cursor to load the new MCP configuration.

### 2. Test It Out

In Cline or Claude Code, try:

```
@augments get_api_context query="useEffect cleanup" framework="react"
```

You should see the API signature and examples!

### 3. Use It Everywhere

Now you can ask for any framework documentation:

```
# React hooks
@augments get_api_context query="useState" framework="react"

# Prisma queries
@augments get_api_context query="findMany" framework="prisma"

# Express routing
@augments get_api_context query="Router" framework="express"

# Version comparisons
@augments get_version_info framework="react" fromVersion="18" toVersion="19"

# Search for APIs
@augments search_apis query="state management hook"
```

---

## 📁 What Gets Created

### In Your Project
```
your-project/
├── package.json          (updated with augments scripts)
├── AUGMENTS.md          (usage guide)
└── .cline/              (if using Cline)
    └── cline_mcp_config.json
```

### In Your Home Directory
```
~/
├── .cline/
│   └── cline_mcp_config.json   (global Cline config)
└── .claude/
    └── mcp/
        └── augments.json        (Claude Code config)
```

---

## 🔧 Manual Commands

### Check Status
```bash
npx augments-mcp status
```

### View Configuration
```bash
npx augments-mcp config
```

### Start Local Server
```bash
npx augments-mcp start
# Or: npm run augments:start
```

---

## 🎯 Real-World Examples

### Example 1: React Developer
```bash
cd my-react-app
npx augments-mcp install
# Choose: 1 (Local)
npm run augments:start  # In another terminal
```

Then in Cline:
```
@augments get_api_context query="useEffect cleanup" framework="react"
@augments get_api_context query="useMemo" framework="react"
```

### Example 2: Full-Stack Project
```bash
cd my-fullstack-app
npx augments-mcp install
# Choose: 1 (Local)
```

Now you can get docs for both frontend and backend:
```
@augments get_api_context query="useForm" framework="react-hook-form"
@augments get_api_context query="createClient" framework="@supabase/supabase-js"
@augments get_api_context query="Router" framework="express"
```

### Example 3: Quick Experiment
```bash
mkdir test-project && cd test-project
npm init -y
npx augments-mcp install
# Choose: 2 (Hosted)
```

No server to start, just use immediately:
```
@augments search_apis query="database"
```

---

## 🔍 Troubleshooting

### "No supported environment detected"
**Solution:** Install Cline or Claude Code first, then run the installer again.

### "Server not running"
**Solution:** 
```bash
# Start the server
npx augments-mcp start

# Or if installed locally
npm run augments:start
```

### "Port already in use"
The server automatically tries ports 3000, 3001, 3002, etc.

### "Connection refused"
1. Check if server is running: `npx augments-mcp status`
2. Restart your IDE
3. Check firewall settings

### "Command not found: augments-mcp"
Use `npx augments-mcp` instead of `augments-mcp`

---

## 📚 Advanced Usage

### Multiple Projects
Each project can have its own configuration:
```bash
# Project 1 - Local
cd project1
npx augments-mcp install
# Choose: 1

# Project 2 - Hosted
cd project2
npx augments-mcp install
# Choose: 2
```

### Updating Configuration
If you want to change from local to hosted:
```bash
npx augments-mcp install
# It will detect existing config and ask if you want to update
# Choose: 2 (Hosted)
```

### Uninstalling
To remove Augments MCP:
1. Delete the MCP configuration:
   - Cline: Remove `augments` from `cline_mcp_config.json`
   - Claude Code: Delete `~/.claude/mcp/augments.json`
2. If installed locally: `npm uninstall augments-mcp-server`
3. Delete `AUGMENTS.md`

---

## 🎉 Benefits of Auto Installation

✅ **Zero Manual Configuration** - No editing JSON files by hand  
✅ **Smart Detection** - Finds your IDE automatically  
✅ **Safe Updates** - Won't overwrite existing configs  
✅ **Flexible** - Choose local, hosted, or custom  
✅ **Complete** - Creates scripts and documentation  
✅ **Works Everywhere** - Any project, any IDE  

---

## 🚀 Next Steps

After installation, you're ready to go! Try these:

1. **Learn the commands**: See [USAGE-GUIDE.md](USAGE-GUIDE.md)
2. **See examples**: Check [CLI-README.md](CLI-README.md)
3. **Explore features**: Read [README.md](README.md)

---

**Need help?** Open an issue on [GitHub](https://github.com/emadezzai/augments-mcp-server/issues)