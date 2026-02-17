/**
 * find_related_files Tool
 *
 * Find files related to a given file based on imports, exports, and other relationships.
 * Designed for understanding code dependencies in large codebases.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('find-related-files');

/**
 * Input schema for find_related_files tool
 */
export const FindRelatedFilesInputSchema = z.object({
  filePath: z.string().min(1).describe('Path to the file to find relations for'),
  relationTypes: z.array(z.enum(['imports', 'exports', 'inherits', 'calls', 'tests'])).optional().default(['imports']).describe('Types of relations to find'),
  rootPath: z.string().optional().describe('Root path for resolving imports'),
  maxDepth: z.number().min(1).max(10).optional().default(3).describe('Maximum depth for indirect relations'),
});

export type FindRelatedFilesInput = z.infer<typeof FindRelatedFilesInputSchema>;

/**
 * Related file information
 */
export interface RelatedFile {
  path: string;
  relativePath: string;
  relation: 'import' | 'export' | 'inherit' | 'call' | 'test';
  line?: number;
  isDirect: boolean;
}

/**
 * Output of find_related_files tool
 */
export interface FindRelatedFilesOutput {
  file: string;
  absolutePath: string;
  direct: RelatedFile[];
  indirect: RelatedFile[];
  dependencyDepth: number;
  totalRelated: number;
  analysisDuration: number;
}

/**
 * Parse imports from file content
 */
function parseImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/import\s+(?:\{[^}]*\}|[\w*]+(?:\s*,\s*[\w*]+)*)\s+from\s+['"]([^'"]+)['"]/);
    if (match) {
      imports.push(match[1]);
    }
    // Handle dynamic imports
    const dynamicMatch = line.match(/import\s*\(['"]([^'"]+)['"]\)/);
    if (dynamicMatch) {
      imports.push(dynamicMatch[1]);
    }
  }

  return imports;
}

/**
 * Parse exports from file content
 */
function parseExports(content: string): string[] {
  const exports: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // export function/class/const
    const match = line.match(/export\s+(?:function|class|const|interface|type)\s+(\w+)/);
    if (match) {
      exports.push(match[1]);
    }
    // export { ... }
    const namedMatch = line.match(/export\s+\{([^}]+)\}/);
    if (namedMatch) {
      namedMatch[1].split(',').forEach(e => exports.push(e.trim()));
    }
  }

  return exports;
}

/**
 * Find test files for a given source file
 */
function findTestFiles(filePath: string, rootPath: string): string[] {
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath, path.extname(filePath));
  const testPatterns = [
    `${basename}.test.ts`,
    `${basename}.test.js`,
    `${basename}.spec.ts`,
    `${basename}.spec.js`,
    `${basename}.test.tsx`,
    `${basename}.test.jsx`,
    `__tests__/${basename}.ts`,
    `__tests__/${basename}.js`,
  ];

  const testFiles: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  for (const pattern of testPatterns) {
    for (const ext of extensions) {
      const testPath = path.join(dir, pattern.replace(/\.(ts|js|tsx|jsx)$/, '') + ext);
      if (fs.existsSync(testPath)) {
        testFiles.push(testPath);
      }
    }
    // Check in __tests__ subdirectory
    const testsDirPath = path.join(dir, '__tests__', pattern);
    if (fs.existsSync(testsDirPath)) {
      testFiles.push(testsDirPath);
    }
  }

  return testFiles;
}

/**
 * Resolve import path to actual file path
 */
function resolveImportPath(importPath: string, fromFile: string, rootPath: string): string | null {
  const fromDir = path.dirname(fromFile);
  
  // Handle relative imports
  if (importPath.startsWith('.')) {
    let resolved = path.resolve(fromDir, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
    
    for (const ext of extensions) {
      if (fs.existsSync(resolved + ext)) {
        return resolved + ext;
      }
      if (fs.existsSync(path.join(resolved, ext.replace('/', '')))) {
        return path.join(resolved, ext.replace('/', ''));
      }
    }
  }
  
  return null;
}

/**
 * Find files that import the given file
 */
async function findImporters(targetFile: string, rootPath: string, maxDepth: number = 3): Promise<RelatedFile[]> {
  const importers: RelatedFile[] = [];
  const targetBasename = path.basename(targetFile, path.extname(targetFile));
  
  async function searchDirectory(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
          continue;
        }
        
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDirectory(fullPath, depth + 1);
        } else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const imports = parseImports(content);
            
            for (const imp of imports) {
              if (imp.includes(targetBasename) || imp === `./${targetBasename}` || imp === `../${targetBasename}`) {
                importers.push({
                  path: fullPath,
                  relativePath: path.relative(rootPath, fullPath),
                  relation: 'import',
                  isDirect: depth <= 1,
                });
              }
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    } catch (e) {
      // Skip directories that can't be read
    }
  }
  
  await searchDirectory(rootPath, 0);
  return importers;
}

/**
 * Find related files
 */
export async function findRelatedFiles(
  input: FindRelatedFilesInput
): Promise<FindRelatedFilesOutput> {
  const startTime = Date.now();
  logger.info('Finding related files', { filePath: input.filePath });

  const rootPath = input.rootPath || process.cwd();
  const filePath = path.isAbsolute(input.filePath) 
    ? input.filePath 
    : path.resolve(rootPath, input.filePath);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Read file content
  const content = await fs.promises.readFile(filePath, 'utf-8');
  
  const direct: RelatedFile[] = [];
  const indirect: RelatedFile[] = [];
  
  // Find imports
  if (input.relationTypes?.includes('imports')) {
    const imports = parseImports(content);
    
    for (const imp of imports) {
      const resolved = resolveImportPath(imp, filePath, rootPath);
      if (resolved && fs.existsSync(resolved)) {
        direct.push({
          path: resolved,
          relativePath: path.relative(rootPath, resolved),
          relation: 'import',
          isDirect: true,
        });
      }
    }
  }
  
  // Find exports (what this file exports)
  if (input.relationTypes?.includes('exports')) {
    const exports = parseExports(content);
    // For now, just mark that this file has exports
    // In a full implementation, we'd find files that import these exports
  }
  
  // Find test files
  if (input.relationTypes?.includes('tests')) {
    const testFiles = findTestFiles(filePath, rootPath);
    for (const testFile of testFiles) {
      direct.push({
        path: testFile,
        relativePath: path.relative(rootPath, testFile),
        relation: 'test',
        isDirect: true,
      });
    }
  }
  
  // Find files that import this file (reverse lookup)
  const importers = await findImporters(filePath, rootPath, input.maxDepth ?? 3);
  for (const imp of importers) {
    if (!direct.find(d => d.path === imp.path)) {
      indirect.push(imp);
    }
  }

  const analysisDuration = Date.now() - startTime;
  logger.info('Related files found', {
    filePath,
    directCount: direct.length,
    indirectCount: indirect.length,
    analysisDuration,
  });

  return {
    file: path.basename(filePath),
    absolutePath: filePath,
    direct,
    indirect,
    dependencyDepth: indirect.length > 0 ? 2 : 1,
    totalRelated: direct.length + indirect.length,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatFindRelatedFilesResponse(output: FindRelatedFilesOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Related Files');
  lines.push('');
  lines.push(`**File:** ${output.file}`);
  lines.push(`**Path:** ${output.absolutePath}`);
  lines.push(`**Total Related:** ${output.totalRelated}`);
  lines.push(`**Dependency Depth:** ${output.dependencyDepth}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Direct relations
  if (output.direct.length > 0) {
    lines.push('## Direct Relations');
    lines.push('');
    
    const byType: Record<string, RelatedFile[]> = {};
    for (const rel of output.direct) {
      if (!byType[rel.relation]) {
        byType[rel.relation] = [];
      }
      byType[rel.relation].push(rel);
    }
    
    for (const [type, files] of Object.entries(byType)) {
      lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}`);
      for (const file of files) {
        lines.push(`- \`${file.relativePath}\``);
      }
      lines.push('');
    }
  }

  // Indirect relations
  if (output.indirect.length > 0) {
    lines.push('## Indirect Relations (Files that import this)');
    lines.push('');
    
    for (const rel of output.indirect.slice(0, 20)) {
      lines.push(`- \`${rel.relativePath}\``);
    }
    
    if (output.indirect.length > 20) {
      lines.push(`- *...and ${output.indirect.length - 20} more*`);
    }
    lines.push('');
  }

  // Summary
  lines.push('---');
  lines.push(`Found ${output.direct.length} direct and ${output.indirect.length} indirect relations in ${output.analysisDuration}ms`);

  return lines.join('\n');
}