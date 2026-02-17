/**
 * analyze_import_graph Tool
 *
 * Analyze import/export dependencies in a codebase.
 * Builds a dependency graph and detects circular dependencies.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('analyze-import-graph');

/**
 * Input schema for analyze_import_graph tool
 */
export const AnalyzeImportGraphInputSchema = z.object({
  rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
  includeHidden: z.boolean().optional().describe('Include hidden files and directories'),
  maxDepth: z.number().optional().describe('Maximum depth for analysis'),
});

export type AnalyzeImportGraphInput = z.input<typeof AnalyzeImportGraphInputSchema> & {
  includeHidden?: boolean;
  maxDepth?: number;
};

/**
 * Import/Export relationship
 */
export interface ImportRelationship {
  sourceFile: string;
  targetFile: string;
  targetModule: string;
  isReExport: boolean;
}

/**
 * Dependency node in the graph
 */
export interface DependencyNode {
  filePath: string;
  fileName: string;
  imports: string[];
  exports: string[];
  dependents: number;
  depth: number;
}

/**
 * Circular dependency chain
 */
export interface CircularDependency {
  chain: string[];
  length: number;
}

/**
 * Output of analyze_import_graph tool
 */
export interface AnalyzeImportGraphOutput {
  totalFiles: number;
  totalDependencies: number;
  circularDependencies: CircularDependency[];
  nodes: DependencyNode[];
  analysisDuration: number;
}

/**
 * Supported file extensions for import analysis
 */
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Check if a file should be analyzed
 */
function shouldAnalyze(filePath: string, includeHidden: boolean): boolean {
  const fileName = path.basename(filePath);
  
  // Skip hidden files
  if (!includeHidden && fileName.startsWith('.')) {
    return false;
  }
  
  // Skip non-code files
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return false;
  }
  
  // Skip test files (optional)
  if (fileName.includes('.test.') || fileName.includes('.spec.')) {
    return false;
  }
  
  return true;
}

/**
 * Extract imports from a file
 */
async function extractImports(filePath: string): Promise<string[]> {
  const imports: string[] = [];
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // Match import statements - include ALL imports (both relative and external)
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  } catch (e) {
    logger.debug('Failed to extract imports', { filePath, error: e });
  }
  
  return imports;
}

/**
 * Extract exports from a file
 */
async function extractExports(filePath: string): Promise<string[]> {
  const exports: string[] = [];
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // Match named exports
    const exportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Match export default
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }
    
    // Match re-exports
    const reExportRegex = /export\s+\{[^}]*\}\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = reExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
  } catch (e) {
    logger.debug('Failed to extract exports', { filePath, error: e });
  }
  
  return exports;
}

/**
 * Resolve a module import to a file path
 */
function resolveModuleImport(
  importPath: string,
  sourceFile: string,
  rootPath: string,
  allFiles: Map<string, string>
): string | null {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    const sourceDir = path.dirname(sourceFile);
    let resolvedPath = path.resolve(sourceDir, importPath);
    
    // Try with different extensions
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      const tryPath = resolvedPath + ext;
      if (allFiles.has(tryPath)) {
        return tryPath;
      }
    }
  }
  
  // Handle package imports - check if it's a local module
  const normalizedImport = importPath.replace(/^@/, '').replace(/\//g, path.sep);
  
  for (const [filePath, relativePath] of allFiles) {
    if (relativePath.includes(normalizedImport) || filePath.includes(normalizedImport)) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * Build the import graph
 */
async function buildImportGraph(
  rootPath: string,
  includeHidden: boolean,
  maxDepth: number = 3
): Promise<{ nodes: Map<string, DependencyNode>; relationships: ImportRelationship[] }> {
  const nodes = new Map<string, DependencyNode>();
  const relationships: ImportRelationship[] = [];
  const allFiles = new Map<string, string>();
  
  // Collect all files
  async function collectFiles(dir: string, depth: number = 0): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!includeHidden && entry.name.startsWith('.')) continue;
          if (['node_modules', 'dist', 'build', '.next', '.cache'].includes(entry.name)) continue;
          
          await collectFiles(path.join(dir, entry.name), depth + 1);
        } else if (entry.isFile()) {
          const fullPath = path.join(dir, entry.name);
          if (shouldAnalyze(fullPath, includeHidden)) {
            const relativePath = path.relative(rootPath, fullPath);
            allFiles.set(fullPath, relativePath);
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  await collectFiles(rootPath);
  
  // Process each file
  for (const [filePath, relativePath] of allFiles) {
    const imports = await extractImports(filePath);
    const exports = await extractExports(filePath);
    
    const node: DependencyNode = {
      filePath: relativePath,
      fileName: path.basename(filePath),
      imports: imports.slice(0, 20), // Include all imports (both relative and external)
      exports,
      dependents: 0,
      depth: 0,
    };
    
    nodes.set(filePath, node);
    
    // Create relationships
    for (const importPath of imports) {
      const resolvedPath = resolveModuleImport(importPath, filePath, rootPath, allFiles);
      
      if (resolvedPath && resolvedPath !== filePath) {
        relationships.push({
          sourceFile: relativePath,
          targetFile: nodes.has(resolvedPath) ? allFiles.get(resolvedPath)! : importPath,
          targetModule: importPath,
          isReExport: false,
        });
      }
    }
  }
  
  // Calculate dependents
  for (const rel of relationships) {
    const targetNode = Array.from(nodes.values()).find(n => n.filePath === rel.targetFile);
    if (targetNode) {
      targetNode.dependents++;
    }
  }
  
  return { nodes, relationships };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCircularDependencies(nodes: Map<string, DependencyNode>): CircularDependency[] {
  const circularDeps: CircularDependency[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];
  
  function dfs(nodePath: string): boolean {
    visited.add(nodePath);
    recursionStack.add(nodePath);
    path.push(nodePath);
    
    const node = nodes.get(nodePath);
    if (!node) {
      path.pop();
      recursionStack.delete(nodePath);
      return false;
    }
    
    // Check imports for circular dependencies
    for (const importPath of node.imports) {
      const targetNode = Array.from(nodes.values()).find(n => 
        n.filePath.includes(importPath) || n.fileName.replace(/\.[^.]+$/, '') === importPath
      );
      
      if (targetNode) {
        const targetPath = Array.from(nodes.keys()).find(k => nodes.get(k) === targetNode)!;
        
        if (recursionStack.has(targetPath)) {
          // Found a cycle
          const cycleStart = path.indexOf(targetPath);
          const chain = path.slice(cycleStart).map(p => nodes.get(p)?.fileName || p);
          chain.push(targetNode.fileName);
          
          circularDeps.push({
            chain,
            length: chain.length,
          });
        } else if (!visited.has(targetPath)) {
          dfs(targetPath);
        }
      }
    }
    
    path.pop();
    recursionStack.delete(nodePath);
    return false;
  }
  
  // Run DFS from each node
  for (const nodePath of nodes.keys()) {
    if (!visited.has(nodePath)) {
      dfs(nodePath);
    }
  }
  
  // Remove duplicates and return unique cycles
  const uniqueChains = new Map<string, CircularDependency>();
  for (const dep of circularDeps) {
    const key = dep.chain.join(' -> ');
    if (!uniqueChains.has(key)) {
      uniqueChains.set(key, dep);
    }
  }
  
  return Array.from(uniqueChains.values()).slice(0, 10); // Limit to 10 cycles
}

/**
 * Analyze import graph
 */
export async function analyzeImportGraph(
  input: AnalyzeImportGraphInput
): Promise<AnalyzeImportGraphOutput> {
  const startTime = Date.now();
  logger.info('Analyzing import graph', { rootPath: input.rootPath });

  const rootPath = input.rootPath || process.cwd();
  const includeHidden = input.includeHidden ?? false;
  const maxDepth = input.maxDepth ?? 3;

  // Build the import graph
  const { nodes, relationships } = await buildImportGraph(rootPath, includeHidden, maxDepth);
  
  // Detect circular dependencies
  const circularDependencies = detectCircularDependencies(nodes);
  
  // Convert nodes to array and sort by dependents
  const nodesArray = Array.from(nodes.values())
    .sort((a, b) => b.dependents - a.dependents)
    .slice(0, 50); // Limit to top 50

  const analysisDuration = Date.now() - startTime;
  logger.info('Import graph analyzed', {
    rootPath,
    totalFiles: nodes.size,
    totalDependencies: relationships.length,
    circularDependenciesCount: circularDependencies.length,
    analysisDuration,
  });

  return {
    totalFiles: nodes.size,
    totalDependencies: relationships.length,
    circularDependencies,
    nodes: nodesArray,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatAnalyzeImportGraphResponse(output: AnalyzeImportGraphOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Import Graph Analysis');
  lines.push('');
  lines.push(`**Total Files:** ${output.totalFiles}`);
  lines.push(`**Total Dependencies:** ${output.totalDependencies}`);
  lines.push(`**Circular Dependencies:** ${output.circularDependencies.length}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Circular Dependencies
  if (output.circularDependencies.length > 0) {
    lines.push('## Circular Dependencies');
    lines.push('');
    
    for (const cycle of output.circularDependencies.slice(0, 5)) {
      lines.push(`- **Chain (${cycle.length} files):** ${cycle.chain.join(' → ')}`);
    }
    lines.push('');
  }

  // Top Dependencies
  if (output.nodes.length > 0) {
    lines.push('## Most Dependent Files');
    lines.push('');
    
    for (const node of output.nodes.slice(0, 10)) {
      if (node.dependents > 0) {
        lines.push(`- \`${node.fileName}\` (${node.dependents} dependents)`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Analyzed ${output.totalFiles} files with ${output.totalDependencies} dependencies in ${output.analysisDuration}ms`);

  return lines.join('\n');
}