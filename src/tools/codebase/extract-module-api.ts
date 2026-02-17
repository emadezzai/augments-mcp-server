/**
 * extract_module_api Tool
 *
 * Extract the public API from a module including exports, types, interfaces,
 * and dependencies. Designed for understanding module contracts in large codebases.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('extract-module-api');

/**
 * Input schema for extract_module_api tool
 */
export const ExtractModuleApiInputSchema = z.object({
  modulePath: z.string().min(1).describe('Path to the module to analyze'),
  includePrivate: z.boolean().optional().describe('Include private/internal members'),
  rootPath: z.string().optional().describe('Root path for resolving imports'),
});

export type ExtractModuleApiInput = z.input<typeof ExtractModuleApiInputSchema> & {
  includePrivate?: boolean;
  rootPath?: string;
};

/**
 * Export information with full details
 */
export interface ModuleExportInfo {
  name: string;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'enum' | 'default' | 'namespace';
  line: number;
  isReExport: boolean;
  isDefault: boolean;
  isPrivate: boolean;
  signature?: string;
  returnType?: string;
  params?: string[];
  extends?: string[];
  implements?: string[];
  members?: ModuleExportMember[];
}

/**
 * Member of a class, interface, or namespace
 */
export interface ModuleExportMember {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
  isOptional: boolean;
  isReadonly: boolean;
  signature?: string;
}

/**
 * Type information
 */
export interface TypeInfo {
  name: string;
  line: number;
  definition: string;
  isExport: boolean;
  isPrivate: boolean;
  typeParams?: string[];
  unionTypes?: string[];
  intersectionTypes?: string[];
}

/**
 * Interface information
 */
export interface InterfaceInfo {
  name: string;
  line: number;
  isExport: boolean;
  isPrivate: boolean;
  extends?: string[];
  typeParams?: string[];
  properties: InterfaceProperty[];
  methods: InterfaceMethod[];
}

/**
 * Interface property
 */
export interface InterfaceProperty {
  name: string;
  type: string;
  isOptional: boolean;
  isReadonly: boolean;
  visibility: 'public' | 'private' | 'protected';
}

/**
 * Interface method
 */
export interface InterfaceMethod {
  name: string;
  params: string[];
  returnType: string;
  isOptional: boolean;
  visibility: 'public' | 'private' | 'protected';
}

/**
 * Output of extract_module_api tool
 */
export interface ExtractModuleApiOutput {
  module: string;
  absolutePath: string;
  language: string;
  exports: ModuleExportInfo[];
  types: TypeInfo[];
  interfaces: InterfaceInfo[];
  dependencies: string[];
  totalExports: number;
  totalTypes: number;
  totalInterfaces: number;
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
 * Parse imports to get dependencies
 */
function parseDependencies(content: string): string[] {
  const dependencies: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    // Match: import X from 'Y' or import { X } from 'Y' or import 'Y'
    const match = line.match(/import\s+(?:(?:\{[^}]*\}|[\w*]+)(?:\s*,\s*(?:\{[^}]*\}|\w+))?\s+from\s+)?['"]([^'"]+)['"]/);
    if (match) {
      const dep = match[1];
      if (!dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }
    // Handle require()
    const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (requireMatch) {
      const dep = requireMatch[1];
      if (!dependencies.includes(dep)) {
        dependencies.push(dep);
      }
    }
  }

  return dependencies;
}

/**
 * Parse exports from file content
 */
function parseExports(content: string, includePrivate: boolean = false): ModuleExportInfo[] {
  const exports: ModuleExportInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for private exports (starting with _)
    const isPrivate = /^\s*export\s+(?:const|let|var|function|class)\s+_/.test(line);

    // export function name(...)
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/);
    if (funcMatch) {
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      exports.push({
        name: funcMatch[1],
        type: 'function',
        line: lineNum,
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
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
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
        returnType: constMatch[3]?.trim(),
      });
      continue;
    }

    // export class Name extends X implements Y
    const classMatch = line.match(/export\s+class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        line: lineNum,
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
        extends: classMatch[2] ? [classMatch[2]] : undefined,
        implements: classMatch[3]?.split(',').map(s => s.trim()),
        members: extractClassMembers(lines, i),
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
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
        returnType: typeMatch[2].trim(),
      });
      continue;
    }

    // export interface Name extends X
    const interfaceMatch = line.match(/export\s+interface\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+([\w,\s]+))?/);
    if (interfaceMatch) {
      exports.push({
        name: interfaceMatch[1],
        type: 'interface',
        line: lineNum,
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
        extends: interfaceMatch[2]?.split(',').map(s => s.trim()),
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
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
      });
      continue;
    }

    // export namespace Name
    const namespaceMatch = line.match(/export\s+namespace\s+(\w+)/);
    if (namespaceMatch) {
      exports.push({
        name: namespaceMatch[1],
        type: 'namespace',
        line: lineNum,
        isReExport: false,
        isDefault: false,
        isPrivate: isPrivate,
      });
      continue;
    }

    // export default
    const defaultMatch = line.match(/export\s+default\s+(?:function\s+)?(?:class\s+)?(?:type\s+)?(\w+)?/);
    if (defaultMatch) {
      exports.push({
        name: defaultMatch[1] || 'default',
        type: 'default',
        line: lineNum,
        isReExport: false,
        isDefault: true,
        isPrivate: false,
      });
      continue;
    }

    // export { a, b, c } or export { a as b }
    const namedExportMatch = line.match(/export\s+\{([^}]+)\}/);
    if (namedExportMatch) {
      const items = namedExportMatch[1].split(',');
      for (const item of items) {
        const asMatch = item.trim().match(/(\w+)(?:\s+as\s+(\w+))?/);
        if (asMatch) {
          exports.push({
            name: asMatch[2] || asMatch[1],
            type: 'const', // Assume const for re-exports
            line: lineNum,
            isReExport: true,
            isDefault: false,
            isPrivate: false,
          });
        }
      }
      continue;
    }

    // export * from 'module' or export * as name from 'module'
    const starExportMatch = line.match(/export\s+(?:\*\s+as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/);
    if (starExportMatch) {
      exports.push({
        name: starExportMatch[1],
        type: 'namespace',
        line: lineNum,
        isReExport: true,
        isDefault: false,
        isPrivate: false,
      });
    }
  }

  // Filter based on includePrivate
  if (!includePrivate) {
    return exports.filter(e => !e.isPrivate);
  }

  return exports;
}

/**
 * Extract return type from following lines
 */
function extractReturnType(lines: string[], startIndex: number): string | undefined {
  // Look for return type in function declaration
  for (let i = startIndex; i < Math.min(startIndex + 3, lines.length); i++) {
    const match = lines[i].match(/\)\s*(?::\s*([^=>{]+))?(?:\s*=|{)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Extract class members
 */
function extractClassMembers(lines: string[], classStartIndex: number): ModuleExportMember[] {
  const members: ModuleExportMember[] = [];
  const classEndIndex = findMatchingBrace(lines, classStartIndex);

  for (let i = classStartIndex + 1; i < classEndIndex; i++) {
    const line = lines[i];

    // Skip constructor and empty lines
    if (line.includes('constructor(') || line.trim() === '') {
      continue;
    }

    // Check visibility modifiers
    const isPrivate = /\bprivate\s+/.test(line);
    const isProtected = /\bprotected\s+/.test(line);
    const isPublic = /\bpublic\s+/.test(line);
    const visibility = isPrivate ? 'private' : isProtected ? 'protected' : 'public';

    // Method: name(...)
    const methodMatch = line.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^=>{]+))?/);
    if (methodMatch && methodMatch[1] !== 'constructor') {
      members.push({
        name: methodMatch[1],
        type: 'method',
        visibility,
        isOptional: false,
        isReadonly: false,
        signature: `${methodMatch[1]}(${methodMatch[2]}): ${methodMatch[3]?.trim() || 'void'}`,
      });
      continue;
    }

    // Property: name: type or name = value
    const propMatch = line.match(/(?:public|private|protected)?\s*(?:readonly\s+)?(\w+)\s*(?::\s*([^=]+))?\s*[=;]/);
    if (propMatch && propMatch[1]) {
      members.push({
        name: propMatch[1],
        type: 'property',
        visibility,
        isOptional: line.includes('?'),
        isReadonly: line.includes('readonly'),
        signature: propMatch[2]?.trim(),
      });
    }
  }

  return members;
}

/**
 * Find matching closing brace
 */
function findMatchingBrace(lines: string[], startIndex: number): number {
  let braceCount = 0;
  for (let i = startIndex; i < lines.length; i++) {
    for (const char of lines[i]) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    if (braceCount === 0) return i;
  }
  return lines.length;
}

/**
 * Parse type aliases
 */
function parseTypes(content: string, includePrivate: boolean = false): TypeInfo[] {
  const types: TypeInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip exports (already captured in parseExports)
    if (line.trim().startsWith('export')) {
      continue;
    }

    // type Name = ...
    const typeMatch = line.match(/type\s+(\w+)(?:\s*<[^>]+>)?\s*=\s*(.+)/);
    if (typeMatch) {
      const isPrivate = typeMatch[1].startsWith('_');
      if (!includePrivate && isPrivate) continue;

      const definition = typeMatch[2].trim();
      types.push({
        name: typeMatch[1],
        line: lineNum,
        definition,
        isExport: false,
        isPrivate,
        typeParams: extractTypeParams(typeMatch[0]),
        unionTypes: definition.includes('|') ? definition.split('|').map(s => s.trim()) : undefined,
        intersectionTypes: definition.includes('&') ? definition.split('&').map(s => s.trim()) : undefined,
      });
    }
  }

  return types;
}

/**
 * Extract type parameters from a type declaration
 */
function extractTypeParams(declaration: string): string[] | undefined {
  const match = declaration.match(/<([^>]+)>/);
  if (match) {
    return match[1].split(',').map(s => s.trim());
  }
  return undefined;
}

/**
 * Parse interfaces
 */
function parseInterfaces(content: string, includePrivate: boolean = false): InterfaceInfo[] {
  const interfaces: InterfaceInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip exports (already captured in parseExports)
    if (line.trim().startsWith('export')) {
      continue;
    }

    // interface Name extends X
    const interfaceMatch = line.match(/interface\s+(\w+)(?:\s*<[^>]+>)?(?:\s+extends\s+([\w,\s]+))?\s*\{/);
    if (interfaceMatch) {
      const isPrivate = interfaceMatch[1].startsWith('_');
      if (!includePrivate && isPrivate) continue;

      const interfaceEndIndex = findMatchingBrace(lines, i);
      const interfaceBody = lines.slice(i, interfaceEndIndex + 1).join('\n');

      const properties: InterfaceProperty[] = [];
      const methods: InterfaceMethod[] = [];

      // Parse properties and methods
      for (let j = i + 1; j < interfaceEndIndex; j++) {
        const bodyLine = lines[j].trim();
        if (!bodyLine || bodyLine.startsWith('//')) continue;

        // Property: name: type;
        const propMatch = bodyLine.match(/(?:readonly\s+)?(\w+)(?:\?)?\s*:\s*([^;]+)/);
        if (propMatch && !bodyLine.includes('(')) {
          properties.push({
            name: propMatch[1],
            type: propMatch[2].trim(),
            isOptional: bodyLine.includes('?'),
            isReadonly: bodyLine.includes('readonly'),
            visibility: 'public',
          });
        }

        // Method: name(): type;
        const methodMatch = bodyLine.match(/(\w+)(?:\?)?\s*\(([^)]*)\)\s*:\s*([^;]+)/);
        if (methodMatch) {
          methods.push({
            name: methodMatch[1],
            params: methodMatch[2].split(',').map(p => p.trim()).filter(Boolean),
            returnType: methodMatch[3].trim(),
            isOptional: bodyLine.includes('?'),
            visibility: 'public',
          });
        }
      }

      interfaces.push({
        name: interfaceMatch[1],
        line: lineNum,
        isExport: false,
        isPrivate,
        extends: interfaceMatch[2]?.split(',').map(s => s.trim()),
        typeParams: extractTypeParams(interfaceMatch[0]),
        properties,
        methods,
      });
    }
  }

  return interfaces;
}

/**
 * Extract module API
 */
export async function extractModuleApi(
  input: ExtractModuleApiInput
): Promise<ExtractModuleApiOutput> {
  const startTime = Date.now();
  logger.info('Extracting module API', { modulePath: input.modulePath });

  const rootPath = input.rootPath || process.cwd();
  const modulePath = path.isAbsolute(input.modulePath)
    ? input.modulePath
    : path.resolve(rootPath, input.modulePath);

  // Check if file exists
  if (!fs.existsSync(modulePath)) {
    throw new Error(`Module not found: ${modulePath}`);
  }

  // Read file content
  const content = await fs.promises.readFile(modulePath, 'utf-8');

  // Parse the module
  const exports = parseExports(content, input.includePrivate ?? false);
  const types = parseTypes(content, input.includePrivate ?? false);
  const interfaces = parseInterfaces(content, input.includePrivate ?? false);
  const dependencies = parseDependencies(content);

  const analysisDuration = Date.now() - startTime;
  logger.info('Module API extracted', {
    modulePath,
    exportsCount: exports.length,
    typesCount: types.length,
    interfacesCount: interfaces.length,
    dependenciesCount: dependencies.length,
    analysisDuration,
  });

  return {
    module: path.basename(modulePath),
    absolutePath: modulePath,
    language: getLanguage(modulePath),
    exports,
    types,
    interfaces,
    dependencies,
    totalExports: exports.length,
    totalTypes: types.length,
    totalInterfaces: interfaces.length,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatExtractModuleApiResponse(output: ExtractModuleApiOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Module API');
  lines.push('');
  lines.push(`**Module:** ${output.module}`);
  lines.push(`**Path:** ${output.absolutePath}`);
  lines.push(`**Language:** ${output.language}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Exports:** ${output.totalExports}`);
  lines.push(`- **Types:** ${output.totalTypes}`);
  lines.push(`- **Interfaces:** ${output.totalInterfaces}`);
  lines.push(`- **Dependencies:** ${output.dependencies.length}`);
  lines.push('');

  // Dependencies
  if (output.dependencies.length > 0) {
    lines.push('## Dependencies');
    lines.push('');
    for (const dep of output.dependencies) {
      lines.push(`- \`${dep}\``);
    }
    lines.push('');
  }

  // Exports
  if (output.exports.length > 0) {
    lines.push('## Exports');
    lines.push('');
    
    // Group by type
    const byType: Record<string, ModuleExportInfo[]> = {};
    for (const exp of output.exports) {
      if (!byType[exp.type]) {
        byType[exp.type] = [];
      }
      byType[exp.type].push(exp);
    }

    for (const [type, items] of Object.entries(byType)) {
      lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      for (const exp of items) {
        const visibility = exp.isPrivate ? '🔒 ' : exp.isReExport ? '🔄 ' : '📤 ';
        const defaultStr = exp.isDefault ? ' (default)' : '';
        const signature = exp.params ? `(${exp.params.join(', ')})` : '';
        const returnType = exp.returnType ? `: ${exp.returnType}` : '';
        
        lines.push(`- ${visibility}\`${exp.name}${signature}${returnType}\`${defaultStr} (line ${exp.line})`);
        
        // Show extends/implements for classes
        if (exp.extends) {
          lines.push(`  - extends: ${exp.extends.join(', ')}`);
        }
        if (exp.implements) {
          lines.push(`  - implements: ${exp.implements.join(', ')}`);
        }
        
        // Show members for classes
        if (exp.members && exp.members.length > 0) {
          for (const member of exp.members.slice(0, 5)) {
            const visIcon = member.visibility === 'private' ? '🔒' : member.visibility === 'protected' ? '🔐' : '📍';
            lines.push(`  - ${visIcon} ${member.name}: ${member.type}`);
          }
          if (exp.members.length > 5) {
            lines.push(`  - *...and ${exp.members.length - 5} more*`);
          }
        }
      }
      lines.push('');
    }
  }

  // Types
  if (output.types.length > 0) {
    lines.push('## Type Aliases');
    lines.push('');
    for (const type of output.types) {
      const visibility = type.isPrivate ? '🔒 ' : '';
      lines.push(`- ${visibility}\`${type.name}\` = ${type.definition} (line ${type.line})`);
    }
    lines.push('');
  }

  // Interfaces
  if (output.interfaces.length > 0) {
    lines.push('## Interfaces');
    lines.push('');
    for (const iface of output.interfaces) {
      const visibility = iface.isPrivate ? '🔒 ' : '';
      lines.push(`### ${visibility}${iface.name}`);
      lines.push(`Line: ${iface.line}`);
      
      if (iface.extends && iface.extends.length > 0) {
        lines.push(`Extends: ${iface.extends.join(', ')}`);
      }
      
      if (iface.properties.length > 0) {
        lines.push('Properties:');
        for (const prop of iface.properties) {
          const optional = prop.isOptional ? '?' : '';
          const readonly = prop.isReadonly ? 'readonly ' : '';
          lines.push(`- \`${readonly}${prop.name}${optional}: ${prop.type}\``);
        }
      }
      
      if (iface.methods.length > 0) {
        lines.push('Methods:');
        for (const method of iface.methods) {
          const optional = method.isOptional ? '?' : '';
          lines.push(`- \`${method.name}${optional}(${method.params.join(', ')}): ${method.returnType}\``);
        }
      }
      
      lines.push('');
    }
  }

  // Footer
  lines.push('---');
  lines.push(`Extracted in ${output.analysisDuration}ms`);

  return lines.join('\n');
}