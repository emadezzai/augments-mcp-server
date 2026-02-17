/**
 * generate_code_summary Tool
 *
 * Generate a summary of code in a file or directory.
 * Extracts key functions, classes, and main purpose.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('generate-code-summary');

/**
 * Input schema for generate_code_summary tool
 */
export const GenerateCodeSummaryInputSchema = z.object({
  path: z.string().min(1).describe('Path to file or directory to summarize'),
  maxLength: z.number().min(50).max(1000).optional().default(500).describe('Maximum length of summary'),
  includeFunctions: z.boolean().optional().default(true).describe('Include key functions'),
  includeClasses: z.boolean().optional().default(true).describe('Include key classes'),
});

export type GenerateCodeSummaryInput = z.infer<typeof GenerateCodeSummaryInputSchema>;

/**
 * Function summary
 */
export interface FunctionSummary {
  name: string;
  line: number;
  params: string[];
  returnType?: string;
  isAsync: boolean;
}

/**
 * Class summary
 */
export interface ClassSummary {
  name: string;
  line: number;
  methods: string[];
  properties: string[];
}

/**
 * Code summary output
 */
export interface CodeSummaryOutput {
  path: string;
  absolutePath: string;
  isDirectory: boolean;
  type: 'file' | 'directory';
  summary: string;
  keyFunctions: FunctionSummary[];
  keyClasses: ClassSummary[];
  mainPurpose: string;
  totalFunctions: number;
  totalClasses: number;
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
 * Parse functions from file content
 */
function parseFunctions(content: string): FunctionSummary[] {
  const functions: FunctionSummary[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export function name(...)
    const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/);
    if (funcMatch) {
      const params = funcMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: funcMatch[1],
        line: i + 1,
        params,
        isAsync: line.includes('async'),
      });
      continue;
    }

    // const/let/var name = async (...) => ...
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/);
    if (arrowMatch) {
      const params = arrowMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: arrowMatch[1],
        line: i + 1,
        params,
        isAsync: line.includes('async'),
      });
      continue;
    }

    // async function name(...)
    const asyncMatch = line.match(/(?:export\s+)?async\s+function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/);
    if (asyncMatch) {
      const params = asyncMatch[2].split(',').map(p => p.trim()).filter(Boolean);
      functions.push({
        name: asyncMatch[1],
        line: i + 1,
        params,
        isAsync: true,
      });
      continue;
    }
  }

  return functions;
}

/**
 * Parse classes from file content
 */
function parseClasses(content: string): ClassSummary[] {
  const classes: ClassSummary[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // export class Name
    const classMatch = line.match(/export\s+class\s+(\w+)/);
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
        methods,
        properties,
      });
      continue;
    }
  }

  return classes;
}

/**
 * Generate summary for a file
 */
async function generateFileSummary(filePath: string, options: GenerateCodeSummaryInput): Promise<CodeSummaryOutput> {
  const startTime = Date.now();
  logger.info('Generating file summary', { filePath });

  // Read file content
  const content = await fs.promises.readFile(filePath, 'utf-8');
  const stats = await fs.promises.stat(filePath);

  // Parse functions and classes
  const functions = parseFunctions(content);
  const classes = parseClasses(content);

  // Generate main purpose from comments and imports
  const mainPurpose = generateMainPurpose(content, functions, classes);

  // Generate summary text
  const summary = generateSummaryText(filePath, functions, classes, mainPurpose, options.maxLength);

  const analysisDuration = Date.now() - startTime;
  logger.info('File summary generated', {
    filePath,
    functionCount: functions.length,
    classCount: classes.length,
    analysisDuration,
  });

  return {
    path: path.basename(filePath),
    absolutePath: filePath,
    isDirectory: false,
    type: 'file',
    summary,
    keyFunctions: functions.slice(0, 5),
    keyClasses: classes.slice(0, 3),
    mainPurpose,
    totalFunctions: functions.length,
    totalClasses: classes.length,
    analysisDuration,
  };
}

/**
 * Generate summary for a directory
 */
async function generateDirectorySummary(dirPath: string, options: GenerateCodeSummaryInput): Promise<CodeSummaryOutput> {
  const startTime = Date.now();
  logger.info('Generating directory summary', { dirPath });

  const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const tsFiles = files
    .filter(f => f.isFile() && /\.(ts|tsx|js|jsx)$/.test(f.name))
    .map(f => path.join(dirPath, f.name));

  // Parse files and combine information
  const allFunctions: FunctionSummary[] = [];
  const allClasses: ClassSummary[] = [];

  for (const file of tsFiles) {
    try {
      const content = await fs.promises.readFile(file, 'utf-8');
      allFunctions.push(...parseFunctions(content));
      allClasses.push(...parseClasses(content));
    } catch (e) {
      // Skip files that can't be read
    }
  }

  // Generate main purpose
  const mainPurpose = generateMainPurposeByFiles(allFunctions, allClasses);

  // Generate summary text
  const summary = generateSummaryText(
    dirPath,
    allFunctions,
    allClasses,
    mainPurpose,
    options.maxLength
  );

  const analysisDuration = Date.now() - startTime;
  logger.info('Directory summary generated', {
    dirPath,
    fileCount: tsFiles.length,
    functionCount: allFunctions.length,
    classCount: allClasses.length,
    analysisDuration,
  });

  return {
    path: path.basename(dirPath),
    absolutePath: dirPath,
    isDirectory: true,
    type: 'directory',
    summary,
    keyFunctions: allFunctions.slice(0, 5),
    keyClasses: allClasses.slice(0, 3),
    mainPurpose,
    totalFunctions: allFunctions.length,
    totalClasses: allClasses.length,
    analysisDuration,
  };
}

/**
 * Generate main purpose from file content
 */
function generateMainPurpose(content: string, functions: FunctionSummary[], classes: ClassSummary[]): string {
  const lines = content.split('\n');

  // Look for JSDoc comments
  for (const line of lines) {
    const docMatch = line.match(/\/\*\*\s*([\s\S]*?)\*\//);
    if (docMatch) {
      const docContent = docMatch[1];
      if (docContent.includes('Main purpose') || docContent.includes('Main goal') || docContent.includes('Purpose')) {
        return docContent
          .replace(/\*\s*/g, ' ')
          .replace(/\n\s*\*\s*/g, ' ')
          .trim()
          .substring(0, 200);
      }
    }
  }

  // Look for file-level comments
  for (const line of lines) {
    if (line.startsWith('//') || line.startsWith('#')) {
      const comment = line.substring(2).trim();
      if (comment.length > 20 && comment.length < 200) {
        return comment;
      }
    }
  }

  // Infer from functions and classes
  const inferredPurpose = inferPurposeFromCode(functions, classes);
  if (inferredPurpose) {
    return inferredPurpose;
  }

  return 'A code file containing functions and classes for unspecified purpose.';
}

/**
 * Generate main purpose by analyzing multiple files
 */
function generateMainPurposeByFiles(functions: FunctionSummary[], classes: ClassSummary[]): string {
  // Look for common patterns
  const functionNames = functions.map(f => f.name.toLowerCase());
  const classNames = classes.map(c => c.name.toLowerCase());

  // Check for common patterns
  if (functionNames.some(n => n.includes('auth') || n.includes('login') || n.includes('register'))) {
    return 'Authentication and user management functionality.';
  }
  if (functionNames.some(n => n.includes('payment') || n.includes('transaction') || n.includes('checkout'))) {
    return 'Payment processing and transaction management.';
  }
  if (functionNames.some(n => n.includes('api') || n.includes('http') || n.includes('request'))) {
    return 'API client and HTTP request handling.';
  }
  if (classNames.some(n => n.includes('Service') || n.includes('Handler') || n.includes('Controller'))) {
    return 'Service layer for business logic and request handling.';
  }
  if (classNames.some(n => n.includes('Repository') || classNames.some(n => n.includes('Model')))) {
    return 'Data access layer with repository and model classes.';
  }
  if (functionNames.some(n => n.includes('router') || n.includes('route'))) {
    return 'API routing and endpoint configuration.';
  }

  // Default
  return 'A code file containing business logic, data processing, or utility functions.';
}

/**
 * Infer purpose from code structure
 */
function inferPurposeFromCode(functions: FunctionSummary[], classes: ClassSummary[]): string | null {
  if (functions.length === 0 && classes.length === 0) {
    return null;
  }

  if (functions.length > 0 && classes.length === 0) {
    return `Contains ${functions.length} function(s) for ${functions.map(f => f.name).join(', ')}.`;
  }

  if (classes.length > 0 && functions.length === 0) {
    return `Contains ${classes.length} class(es) for ${classes.map(c => c.name).join(', ')}.`;
  }

  return `Contains ${functions.length} function(s) and ${classes.length} class(es).`;
}

/**
 * Generate summary text
 */
function generateSummaryText(
  path: string,
  functions: FunctionSummary[],
  classes: ClassSummary[],
  mainPurpose: string,
  maxLength: number
): string {
  const lines: string[] = [];

  // Main purpose
  lines.push(`**Purpose:** ${mainPurpose}`);

  // Key functions
  if (functions.length > 0) {
    lines.push('');
    lines.push(`**Functions (${functions.length}):**`);
    for (const func of functions.slice(0, 5)) {
      const asyncStr = func.isAsync ? 'async ' : '';
      const params = func.params.length > 0 ? `(${func.params.join(', ')})` : '()';
      lines.push(`  - ${asyncStr}\`${func.name}${params}\``);
    }
    if (functions.length > 5) {
      lines.push(`  - ...and ${functions.length - 5} more`);
    }
  }

  // Key classes
  if (classes.length > 0) {
    lines.push('');
    lines.push(`**Classes (${classes.length}):**`);
    for (const cls of classes.slice(0, 3)) {
      lines.push(`  - \`${cls.name}\``);
      if (cls.methods.length > 0 || cls.properties.length > 0) {
        const details: string[] = [];
        if (cls.methods.length > 0) details.push(`${cls.methods.length} method(s)`);
        if (cls.properties.length > 0) details.push(`${cls.properties.length} property(ies)`);
        lines.push(`    - ${details.join(', ')}`);
      }
    }
  }

  // Combine and truncate
  let summary = lines.join('\n');
  if (summary.length > maxLength) {
    summary = summary.substring(0, maxLength - 3) + '...';
  }

  return summary;
}

/**
 * Generate code summary
 */
export async function generateCodeSummary(
  input: GenerateCodeSummaryInput
): Promise<CodeSummaryOutput> {
  const rootPath = process.cwd();
  const targetPath = path.isAbsolute(input.path)
    ? input.path
    : path.resolve(rootPath, input.path);

  // Check if path exists
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Path not found: ${targetPath}`);
  }

  const stats = await fs.promises.stat(targetPath);

  if (stats.isDirectory()) {
    return await generateDirectorySummary(targetPath, input);
  } else {
    return await generateFileSummary(targetPath, input);
  }
}

/**
 * Format the output for MCP response
 */
export function formatCodeSummaryResponse(output: CodeSummaryOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Code Summary');
  lines.push('');
  lines.push(`**Path:** ${output.path}`);
  lines.push(`**Type:** ${output.type}`);
  lines.push(`**Functions:** ${output.totalFunctions}`);
  lines.push(`**Classes:** ${output.totalClasses}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Main purpose
  lines.push('## Summary');
  lines.push('');
  lines.push(output.summary);
  lines.push('');

  // Key functions
  if (output.keyFunctions.length > 0) {
    lines.push('## Key Functions');
    lines.push('');
    for (const func of output.keyFunctions) {
      const asyncStr = func.isAsync ? 'async ' : '';
      const params = func.params.length > 0 ? `(${func.params.join(', ')})` : '()';
      lines.push(`- ${asyncStr}\`${func.name}${params}\` - line ${func.line}`);
    }
    lines.push('');
  }

  // Key classes
  if (output.keyClasses.length > 0) {
    lines.push('## Key Classes');
    lines.push('');
    for (const cls of output.keyClasses) {
      lines.push(`- \`${cls.name}\` - line ${cls.line}`);
      if (cls.methods.length > 0) {
        lines.push(`  - Methods: ${cls.methods.join(', ')}`);
      }
      if (cls.properties.length > 0) {
        lines.push(`  - Properties: ${cls.properties.join(', ')}`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Analyzed in ${output.analysisDuration}ms`);

  return lines.join('\n');
}