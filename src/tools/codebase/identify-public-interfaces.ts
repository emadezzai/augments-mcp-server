/**
 * identify_public_interfaces Tool
 *
 * Identify public interfaces and exports in a package/module.
 * Distinguishes between public, internal, and type exports.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('identify-public-interfaces');

/**
 * Input schema for identify_public_interfaces tool
 */
export const IdentifyPublicInterfacesInputSchema = z.object({
  packagePath: z.string().min(1).describe('Path to the package or module to analyze'),
  rootPath: z.string().optional().describe('Root path for resolving imports'),
});

export type IdentifyPublicInterfacesInput = z.infer<typeof IdentifyPublicInterfacesInputSchema>;

/**
 * Export information (local type, not exported)
 */
interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'enum' | 'default';
  line: number;
  isPublic: boolean;
  isPrivate: boolean;
  isReExport: boolean;
  signature?: string;
  returnType?: string;
  params?: string[];
}

/**
 * Type information (local type, not exported)
 */
interface TypeInfo {
  name: string;
  line: number;
  definition: string;
  isExport: boolean;
  isPrivate: boolean;
  typeParams?: string[];
}

/**
 * Output of identify_public_interfaces tool
 */
export interface IdentifyPublicInterfacesOutput {
  package: string;
  absolutePath: string;
  language: string;
  publicExports: ExportInfo[];
  internalExports: ExportInfo[];
  typeExports: TypeInfo[];
  totalPublicExports: number;
  totalInternalExports: number;
  totalTypeExports: number;
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
 * Determine if an export is public
 * Public exports:
 * - Don't start with underscore
 * - Are explicitly exported
 * - Are not private/internal
 */
function isPublicExport(exportName: string, isReExport: boolean): boolean {
  // Skip private exports (starting with _)
  if (exportName.startsWith('_')) {
    return false;
  }

  // Skip re-exports of private exports
  if (isReExport) {
    // Check if the export name starts with underscore
    if (exportName.startsWith('_')) {
      return false;
    }
  }

  return true;
}

/**
 * Parse exports from file content
 */
function parseExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for re-exports (export { X, Y } from 'Y')
    const reExportMatch = line.match(/export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
    if (reExportMatch) {
      const exportedItems = reExportMatch[1].split(',').map(s => s.trim());
      const fromPath = reExportMatch[2];
      
      for (const item of exportedItems) {
        const isPrivate = item.startsWith('_');
        exports.push({
          name: item,
          type: 'default',
          line: lineNum,
          isPublic: !isPrivate,
          isPrivate,
          isReExport: true,
          signature: `from '${fromPath}'`,
        });
      }
      continue;
    }

    // export function name(...)
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/);
    if (funcMatch) {
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      exports.push({
        name: funcMatch[1],
        type: 'function',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
        params,
        returnType: extractReturnType(lines, i),
      });
      continue;
    }

    // export const/let/var name = ...
    const constMatch = line.match(/export\s+(const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/);
    if (constMatch) {
      exports.push({
        name: constMatch[2],
        type: 'const',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
        returnType: constMatch[3]?.trim(),
      });
      continue;
    }

    // export class Name
    const classMatch = line.match(/export\s+class\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
      });
      continue;
    }

    // export type Name = ...
    const typeMatch = line.match(/export\s+type\s+(\w+)(?:\s*<[^>]+>)?\s*=\s*(.+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        type: 'type',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
        returnType: typeMatch[2].trim(),
      });
      continue;
    }

    // export interface Name
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
      });
      continue;
    }

    // export enum Name
    const enumMatch = line.match(/export\s+enum\s+(\w+)/);
    if (enumMatch) {
      exports.push({
        name: enumMatch[1],
        type: 'enum',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
      });
      continue;
    }

    // export default ...
    const defaultMatch = line.match(/export\s+default\s+(?:function\s+)?(?:class\s+)?(\w+)/);
    if (defaultMatch) {
      exports.push({
        name: defaultMatch[1],
        type: 'default',
        line: lineNum,
        isPublic: true,
        isPrivate: false,
        isReExport: false,
      });
      continue;
    }
  }

  return exports;
}

/**
 * Extract return type from function signature
 */
function extractReturnType(lines: string[], startIndex: number): string | undefined {
  for (let i = startIndex; i < Math.min(startIndex + 10, lines.length); i++) {
    const match = lines[i].match(/:\s*([^=,\n]+)/);
    if (match) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Parse type definitions
 */
function parseTypes(content: string): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // type Name = ...
    const typeMatch = line.match(/type\s+(\w+)(?:\s*<[^>]+>)?\s*=\s*(.+)/);
    if (typeMatch) {
      types.push({
        name: typeMatch[1],
        line: i + 1,
        definition: typeMatch[2].trim(),
        isExport: line.includes('export'),
        isPrivate: line.includes('export _'),
        typeParams: extractTypeParams(line),
      });
      continue;
    }

    // interface Name
    const interfaceMatch = line.match(/interface\s+(\w+)/);
    if (interfaceMatch) {
      const isExport = line.includes('export');
      const isPrivate = line.includes('_');
      
      types.push({
        name: interfaceMatch[1],
        line: i + 1,
        definition: 'interface',
        isExport,
        isPrivate,
      });
      continue;
    }

    // enum Name
    const enumMatch = line.match(/enum\s+(\w+)/);
    if (enumMatch) {
      types.push({
        name: enumMatch[1],
        line: i + 1,
        definition: 'enum',
        isExport: line.includes('export'),
        isPrivate: line.includes('_'),
      });
      continue;
    }
  }

  return types;
}

/**
 * Extract type parameters from type definition
 */
function extractTypeParams(line: string): string[] | undefined {
  const match = line.match(/<([^>]+)>/);
  if (match) {
    return match[1].split(',').map(s => s.trim());
  }
  return undefined;
}

/**
 * Identify public interfaces
 */
export async function identifyPublicInterfaces(
  input: IdentifyPublicInterfacesInput
): Promise<IdentifyPublicInterfacesOutput> {
  const startTime = Date.now();
  logger.info('Identifying public interfaces', { packagePath: input.packagePath });

  const rootPath = input.rootPath || process.cwd();
  const packagePath = path.isAbsolute(input.packagePath)
    ? input.packagePath
    : path.resolve(rootPath, input.packagePath);

  // Check if path exists
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Path not found: ${packagePath}`);
  }

  // Read file content
  const content = await fs.promises.readFile(packagePath, 'utf-8');
  const stats = await fs.promises.stat(packagePath);

  // Parse exports and types
  const exports = parseExports(content);
  const types = parseTypes(content);

  // Categorize exports
  const publicExports: ExportInfo[] = [];
  const internalExports: ExportInfo[] = [];

  for (const exp of exports) {
    if (isPublicExport(exp.name, exp.isReExport)) {
      publicExports.push(exp);
    } else {
      internalExports.push(exp);
    }
  }

  const analysisDuration = Date.now() - startTime;
  logger.info('Public interfaces identified', {
    packagePath,
    publicCount: publicExports.length,
    internalCount: internalExports.length,
    typeCount: types.length,
    analysisDuration,
  });

  return {
    package: path.basename(packagePath),
    absolutePath: packagePath,
    language: getLanguage(packagePath),
    publicExports,
    internalExports,
    typeExports: types,
    totalPublicExports: publicExports.length,
    totalInternalExports: internalExports.length,
    totalTypeExports: types.length,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatIdentifyPublicInterfacesResponse(output: IdentifyPublicInterfacesOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Public Interfaces');
  lines.push('');
  lines.push(`**Package:** ${output.package}`);
  lines.push(`**Path:** ${output.absolutePath}`);
  lines.push(`**Language:** ${output.language}`);
  lines.push(`**Public Exports:** ${output.totalPublicExports}`);
  lines.push(`**Internal Exports:** ${output.totalInternalExports}`);
  lines.push(`**Type Exports:** ${output.totalTypeExports}`);
  lines.push('');

  // Public Exports
  if (output.publicExports.length > 0) {
    lines.push('## Public Exports');
    lines.push('');
    for (const exp of output.publicExports) {
      const signature = exp.signature || exp.returnType || '';
      const params = exp.params ? `(${exp.params.join(', ')})` : '';
      lines.push(`- \`${exp.name}${params}${signature ? ' → ' + signature : ''}\` - line ${exp.line}`);
    }
    lines.push('');
  }

  // Internal Exports
  if (output.internalExports.length > 0) {
    lines.push('## Internal Exports (Private)');
    lines.push('');
    for (const exp of output.internalExports) {
      const signature = exp.signature || exp.returnType || '';
      const params = exp.params ? `(${exp.params.join(', ')})` : '';
      lines.push(`- \`${exp.name}${params}${signature ? ' → ' + signature : ''}\` - line ${exp.line}`);
    }
    lines.push('');
  }

  // Type Exports
  if (output.typeExports.length > 0) {
    lines.push('## Type Exports');
    lines.push('');
    for (const type of output.typeExports) {
      if (type.isExport) {
        lines.push(`- \`${type.name}\` (${type.definition}) - line ${type.line}`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Analyzed in ${output.analysisDuration}ms`);

  return lines.join('\n');
}