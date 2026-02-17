# Project Brief - Augments MCP Server

## Project Overview

**Augments MCP Server** is a next-generation framework documentation provider for Claude Code via Model Context Protocol (MCP). It provides **query-focused API context** by extracting TypeScript definitions directly from npm packages.

## Core Purpose

Deliver minimal, accurate API information to AI assistants instead of dumping entire documentation pages. Uses TypeScript definitions as the source of truth (which cannot lie unlike prose documentation).

## Key Features

1. **v4 API Context Tools**
   - `get_api_context` - Query-focused TypeScript extraction
   - `search_apis` - Search APIs across frameworks
   - `get_version_info` - Version comparison and breaking changes

2. **Framework Discovery**
   - Auto-discovery via npm (millions of packages)
   - Manual registry for 85+ frameworks (v3 compatibility)

3. **Documentation Access**
   - Framework docs fetching
   - Code examples from GitHub
   - Multi-framework context

4. **Local-First Architecture**
   - 100% free - no paid services required
   - Local caching (memory + file-based)
   - Works without API keys

## Target Users

- Claude Code / Cline users
- Developers needing quick API context
- Projects requiring framework documentation

## Version

Current: **4.1.0**

## Repository

https://github.com/emadezzai/augments-mcp-server