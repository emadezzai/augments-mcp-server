/**
 * get_file_context Tool
 *
 * Get context for a specific file including imports, exports, functions, and classes.
 * Designed for understanding code quickly in large codebases.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('get-file-context');

/**
 * Input schema for get_file_context tool
 */
export const GetFileContextInputSchema = z.object({
  filePath: z.string().min(1).describe('Path to the file to analyze'),
  focusFunction: z.string().optional().describe('Focus on a specific function'),
  focusLine: z.number().optional().describe('Focus on a specific line number'),
  contextLines: z.number().min(1).max(100).optional().default(50).describe('Number of context lines around focus'),
  rootPath: z.string().optional().describe('Root path for resolving imports'),
});

export type GetFileContextInput = z.infer<typeof GetFileContextInputSchema>;

/**
 * Function information
 */
export interface FunctionInfo {
  name: string;
  line: number;
  params: string[];
  returnType?: string;
  isAsync: boolean;
  isExport: boolean;
}

/**
 * Class information
 */
export interface ClassInfo {
  name: string;
  line: number;
  methods: string[];
  properties: string[];
  extends?: string;
  implements?: string[];
  isExport: boolean;
}

/**
 * Export information
 */
export interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'default';
  line: number;
}

/**
 * Import information
 */
export interface ImportInfo {
  path: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

/**
 * Output of get_file_context tool
 */
export interface GetFileContextOutput {
  file: string;
  absolutePath: string;
  language: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  relatedFiles: string[];
  context: string;
  totalLines: number;
  analysisDuration: number;
}

/**
 * Get language from file extension
 */
function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const languageMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript (React)',
    '.py': 'Python',
    '.java': 'Java',
    '.cs': 'C#',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
  };
  return languageMap[ext] || 'Unknown';
}

/**
 * Parse imports from file content
 */
function parseImports(content: string, filePath: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split('\n');

  // Match: import X from 'Y' or import { X } from 'Y' or import 'Y'
  const importRegex = /import\s+(?:(?:\{[^}]*\}|[\w*]+)(?:\s*,\s*(?:\{[^}]*\}|\w+))?\s+from\s+)?['"]([^'"]+)['"]/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/import\s+(?:(?:\{([^}]*)\}|[\w*]+)(?:\s*,\s*(?:\{[^}]*\}|\w+))?\s+from\s+)?['"]([^'"]+)['"]/);
    
    if (match) {
      const importedItems = match[1] || '';
      const importPath = match[2];
      
      imports.push({
        path: importPath,
        imports: importedItems.split(',').map(s => s.trim()).filter(Boolean),
        isDefault: !importedItems.includes('{') && importedItems.trim() !== '',
        isNamespace: importedItems.includes('*'),
        line: i + 1,
      });
    }
  }

  return imports;
}

/**
 * Parse exports from file content
 */
function parseExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // export function X
    const funcMatch = line.match(/export\s+function\s+(\w+)/);
    if (funcMatch) {
      exports.push({
        name: funcMatch[1],
        type: 'function',
        line: i + 1,
      });
    }

    // export class X
    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        line: i + 1,
      });
    }

    // export const/let/var X
    const constMatch = line.match(/export\s+(const|let|var)\s+(\w+)/);
    if (constMatch) {
      exports.push({
        name: constMatch[2],
        type: 'const',
        line: i + 1,
      });
    }

    // export type X
    const typeMatch = line.match(/export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        type: 'type',
        line: i + 1,
      });
    }

    // export interface X
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: i + 1,
      });
    }

    // export default
    const defaultMatch = line.match(/export\s+default\s+(?:function\s+)?(?:class\s+)?(\w+)?/);
    if (defaultMatch) {
      exports.push({
        name: defaultMatch[1] || 'default',
        type: 'default',
        line: i + 1,
      });
    }
  }

  return exports;
}

/**
 * Parse functions from file content
 */
function parseFunctions(content: string, exports: ExportInfo[]): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');
  const exportNames = new Set(exports.filter(e => e.type === 'function').map(e => e.name));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // function name(...)
    const funcMatch = line.match(/(?:export\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (funcMatch) {
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: funcMatch[1],
        line: i + 1,
        params,
        isAsync: false,
        isExport: exportNames.has(funcMatch[1]),
      });
    }

    // const/let/var name = async (...) => or name = (...)
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/);
    if (arrowMatch) {
      const params = arrowMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: arrowMatch[1],
        line: i + 1,
        params,
        isAsync: line.includes('async'),
        isExport: exportNames.has(arrowMatch[1]),
      });
    }

    // async function name(...)
    const asyncMatch = line.match(/(?:export\s+)?async\s+function\s+(\w+)\s*\(([^)]*)\)/);
    if (asyncMatch) {
      const params = asyncMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: asyncMatch[1],
        line: i + 1,
        params,
        isAsync: true,
        isExport: exportNames.has(asyncMatch[1]),
      });
    }
  }

  return functions;
}

/**
 * Parse classes from file content
 */
function parseClasses(content: string, exports: ExportInfo[]): ClassInfo[] {
  const classes: ClassInfo[] = [];
  const lines = content.split('\n');
  const exportNames = new Set(exports.filter(e => e.type === 'class').map(e => e.name));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // class Name extends X implements Y
    const classMatch = line.match(/(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
    if (classMatch) {
      const methods: string[] = [];
      const properties: string[] = [];
      
      // Look for methods in next ~20 lines
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const methodLine = lines[j];
        const methodMatch = methodLine.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/);
        if (methodMatch && methodMatch[1] !== 'constructor') {
          methods.push(methodMatch[1]);
        }
        const propMatch = methodLine.match(/(?:public|private|protected)?\s*(?:readonly\s+)?(\w+)\s*[=:]/);
        if (propMatch) {
          properties.push(propMatch[1]);
        }
      }

      classes.push({
        name: classMatch[1],
        line: i + 1,
        methods: [...new Set(methods)],
        properties: [...new Set(properties)],
        extends: classMatch[2],
        implements: classMatch[3]?.split(',').map(s => s.trim()),
        isExport: exportNames.has(classMatch[1]),
      });
    }
  }

  return classes;
}

/**
 * Find related files based on imports
 */
async function findRelatedFiles(
  filePath: string,
  rootPath: string,
  imports: ImportInfo[]
): Promise<string[]> {
  const related: string[] = [];
  const fileDir = path.dirname(filePath);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];

  for (const imp of imports) {
    const impPath = imp.path;
    
    // Skip node_modules
    if (impPath.startsWith('.') || !impPath.startsWith('/')) {
      // Relative import
      let resolvedPath = path.resolve(fileDir, impPath);
      
      // Try adding extensions
      for (const ext of extensions) {
        const withExt = resolvedPath + ext;
        if (fs.existsSync(withExt)) {
          related.push(withExt);
          break;
        }
        const indexPath = path.resolve(fileDir, impPath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          related.push(indexPath);
          break;
        }
      }
    }
  }

  return related;
}

/**
 * Get context around a specific line or function
 */
function getContext(
  content: string,
  focusLine?: number,
  focusFunction?: string,
  contextLines: number = 50
): string {
  const lines = content.split('\n');
  
  if (focusLine) {
    const start = Math.max(0, focusLine - contextLines - 1);
    const end = Math.min(lines.length, focusLine + contextLines);
    return lines.slice(start, end).join('\n');
  }

  if (focusFunction) {
    // Find the function and get context around it
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`function ${focusFunction}`) || 
          lines[i].includes(`const ${focusFunction}`) ||
          lines[i].includes(`async ${focusFunction}`)) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines);
        return lines.slice(start, end).join('\n');
      }
    }
  }

  // Return first N lines as default context
  return lines.slice(0, Math.min(100, lines.length)).join('\n');
}

/**
 * Get file context
 */
export async function getFileContext(
  input: GetFileContextInput
): Promise<GetFileContextOutput> {
  const startTime = Date.now();
  logger.info('Getting file context', { filePath: input.filePath });

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
  const stats = await fs.promises.stat(filePath);
  
  // Parse file
  const imports = parseImports(content, filePath);
  const exports = parseExports(content);
  const functions = parseFunctions(content, exports);
  const classes = parseClasses(content, exports);
  
  // Find related files
  const relatedFiles = await findRelatedFiles(filePath, rootPath, imports);
  
  // Get context
  const context = getContext(
    content,
    input.focusLine,
    input.focusFunction,
    input.contextLines ?? 50
  );

  const analysisDuration = Date.now() - startTime;
  logger.info('File context retrieved', {
    filePath,
    importsCount: imports.length,
    exportsCount: exports.length,
    functionsCount: functions.length,
    classesCount: classes.length,
    analysisDuration,
  });

  return {
    file: path.basename(filePath),
    absolutePath: filePath,
    language: getLanguage(filePath),
    imports,
    exports,
    functions,
    classes,
    relatedFiles,
    context,
    totalLines: content.split('\n').length,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatFileContextResponse(output: GetFileContextOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# File Context');
  lines.push('');
  lines.push(`**File:** ${output.file}`);
  lines.push(`**Path:** ${output.absolutePath}`);
  lines.push(`**Language:** ${output.language}`);
  lines.push(`**Lines:** ${output.totalLines}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Imports
  if (output.imports.length > 0) {
    lines.push('## Imports');
    lines.push('');
    for (const imp of output.imports) {
      const imported = imp.imports.length > 0 ? `{ ${imp.imports.join(', ')} }` : '';
      lines.push(`- \`${imp.path}\` ${imported} (line ${imp.line})`);
    }
    lines.push('');
  }

  // Exports
  if (output.exports.length > 0) {
    lines.push('## Exports');
    lines.push('');
    for (const exp of output.exports) {
      lines.push(`- \`${exp.name}\` (${exp.type}) - line ${exp.line}`);
    }
    lines.push('');
  }

  // Functions
  if (output.functions.length > 0) {
    lines.push('## Functions');
    lines.push('');
    for (const func of output.functions) {
      const asyncStr = func.isAsync ? 'async ' : '';
      const exportStr = func.isExport ? '📤 ' : '';
      const params = func.params.join(', ');
      lines.push(`- ${exportStr}\`${asyncStr}${func.name}(${params})\` - line ${func.line}`);
    }
    lines.push('');
  }

  // Classes
  if (output.classes.length > 0) {
    lines.push('## Classes');
    lines.push('');
    for (const cls of output.classes) {
      const exportStr = cls.isExport ? '📤 ' : '';
      const extendsStr = cls.extends ? ` extends ${cls.extends}` : '';
      lines.push(`- ${exportStr}\`${cls.name}\`${extendsStr} - line ${cls.line}`);
      if (cls.methods.length > 0) {
        lines.push(`  - Methods: ${cls.methods.join(', ')}`);
      }
      if (cls.properties.length > 0) {
        lines.push(`  - Properties: ${cls.properties.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Related Files
  if (output.relatedFiles.length > 0) {
    lines.push('## Related Files');
    lines.push('');
    for (const rel of output.relatedFiles.slice(0, 10)) {
      const relativePath = path.relative(output.absolutePath, rel);
      lines.push(`- \`${relativePath}\``);
    }
    if (output.relatedFiles.length > 10) {
      lines.push(`- *...and ${output.relatedFiles.length - 10} more*`);
    }
    lines.push('');
  }

  // Context
  lines.push('## Code Context');
  lines.push('');
  lines.push('```');
  lines.push(output.context);
  lines.push('```');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push(`Analyzed in ${output.analysisDuration}ms`);

  return lines.join('\n');
}