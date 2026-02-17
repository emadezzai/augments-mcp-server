/**
 * analyze_codebase_structure Tool
 *
 * Analyzes the complete structure of a project codebase.
 * Provides insights into file organization, languages used, and entry points.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('analyze-codebase-structure');

/**
 * Input schema for analyze_codebase_structure tool
 */
export const AnalyzeCodebaseStructureInputSchema = z.object({
  rootPath: z.string().optional().describe('Root directory to analyze (defaults to current working directory)'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files and directories (starting with .)'),
  maxDepth: z.number().optional().default(5).describe('Maximum depth for directory tree'),
});

export type AnalyzeCodebaseStructureInput = z.infer<typeof AnalyzeCodebaseStructureInputSchema>;

/**
 * Directory node for tree structure
 */
export interface DirectoryNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  language?: string;
}

/**
 * Configuration file info
 */
export interface ConfigFile {
  name: string;
  path: string;
  type: string;
}

/**
 * Entry point info
 */
export interface EntryPoint {
  path: string;
  type: string;
  description: string;
}

/**
 * Output of analyze_codebase_structure tool
 */
export interface AnalyzeCodebaseStructureOutput {
  /** Total number of files */
  totalFiles: number;
  /** Total number of lines (estimated) */
  totalLines: number;
  /** Breakdown of files by language */
  languageBreakdown: Record<string, number>;
  /** Directory tree structure */
  directoryTree: DirectoryNode[];
  /** Detected entry points */
  entryPoints: EntryPoint[];
  /** Configuration files found */
  configFiles: ConfigFile[];
  /** Root path analyzed */
  rootPath: string;
  /** Analysis duration in ms */
  analysisDuration: number;
}

/**
 * Map file extensions to languages
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.zsh': 'Zsh',
  '.dockerfile': 'Dockerfile',
  '.xml': 'XML',
  '.toml': 'TOML',
  '.ini': 'INI',
  '.cfg': 'Config',
};

/**
 * Common entry point patterns
 */
const ENTRY_POINT_PATTERNS = [
  { pattern: /^(index|main|app)\.[jt]sx?$/i, type: 'entry', description: 'Main entry point' },
  { pattern: /^server\.[jt]s$/i, type: 'server', description: 'Server entry' },
  { pattern: /^api\.[jt]s$/i, type: 'api', description: 'API entry' },
  { pattern: /\/routes\//i, type: 'route', description: 'Route file' },
  { pattern: /\/pages\//i, type: 'page', description: 'Page component' },
  { pattern: /\/components\//i, type: 'component', description: 'Component' },
];

/**
 * Configuration file patterns
 */
const CONFIG_FILE_PATTERNS = [
  { pattern: /^package\.json$/i, type: 'npm' },
  { pattern: /^tsconfig.*\.json$/i, type: 'typescript' },
  { pattern: /^jest\.config\.[jt]s$/i, type: 'jest' },
  { pattern: /^vitest\.config\.[jt]s$/i, type: 'vitest' },
  { pattern: /^\.eslintrc.*$/i, type: 'eslint' },
  { pattern: /^eslint\.config\.[jt]s$/i, type: 'eslint' },
  { pattern: /^\.prettierrc.*$/i, type: 'prettier' },
  { pattern: /^prettier\.config\.[jt]s$/i, type: 'prettier' },
  { pattern: /^next\.config\.[jt]s$/i, type: 'next' },
  { pattern: /^vite\.config\.[jt]s$/i, type: 'vite' },
  { pattern: /^webpack\.config\.[jt]s$/i, type: 'webpack' },
  { pattern: /^rollup\.config\.[jt]s$/i, type: 'rollup' },
  { pattern: /^tailwind\.config\.[jt]s$/i, type: 'tailwind' },
  { pattern: /^postcss\.config\.[jt]s$/i, type: 'postcss' },
  { pattern: /^dockerfile$/i, type: 'docker' },
  { pattern: /^\.dockerignore$/i, type: 'docker' },
  { pattern: /^docker-compose.*\.ya?ml$/i, type: 'docker' },
  { pattern: /^\.gitignore$/i, type: 'git' },
  { pattern: /^\.env.*$/i, type: 'env' },
  { pattern: /^Makefile$/i, type: 'make' },
  { pattern: /^CMakeLists\.txt$/i, type: 'cmake' },
  { pattern: /^pyproject\.toml$/i, type: 'python' },
  { pattern: /^setup\.py$/i, type: 'python' },
  { pattern: /^requirements.*\.txt$/i, type: 'python' },
  { pattern: /^Pipfile$/i, type: 'python' },
  { pattern: /^Cargo\.toml$/i, type: 'rust' },
  { pattern: /^go\.mod$/i, type: 'go' },
  { pattern: /^composer\.json$/i, type: 'php' },
  { pattern: /^Gemfile$/i, type: 'ruby' },
  { pattern: /^Podfile$/i, type: 'ios' },
  { pattern: /^gradle$/i, type: 'gradle' },
  { pattern: /^pom\.xml$/i, type: 'maven' },
];

/**
 * Get language from file extension
 */
function getLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'Other';
}

/**
 * Check if a file is a configuration file
 */
function getConfigFileType(fileName: string): string | null {
  for (const config of CONFIG_FILE_PATTERNS) {
    if (config.pattern.test(fileName)) {
      return config.type;
    }
  }
  return null;
}

/**
 * Check if a file is an entry point
 */
function getEntryPointType(filePath: string): { isEntry: boolean; type: string; description: string } {
  const fileName = path.basename(filePath);
  
  for (const pattern of ENTRY_POINT_PATTERNS) {
    if (pattern.pattern.test(fileName)) {
      return { isEntry: true, type: pattern.type, description: pattern.description };
    }
  }
  
  return { isEntry: false, type: '', description: '' };
}

/**
 * Count lines in a file
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Build directory tree recursively
 */
async function buildDirectoryTree(
  dirPath: string,
  currentDepth: number,
  maxDepth: number,
  includeHidden: boolean
): Promise<DirectoryNode[]> {
  if (currentDepth >= maxDepth) {
    return [];
  }

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const nodes: DirectoryNode[] = [];

    for (const entry of entries) {
      // Skip hidden files if not included
      if (!includeHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip common ignored directories
      if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage'].includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await buildDirectoryTree(fullPath, currentDepth + 1, maxDepth, includeHidden);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'directory',
          children: children.length > 0 ? children : undefined,
        });
      } else {
        const language = getLanguageFromExtension(entry.name);
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: 'file',
          language,
        });
      }
    }

    return nodes.sort((a, b) => {
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    logger.warn('Error reading directory', { dirPath, error });
    return [];
  }
}

/**
 * Analyze the codebase structure
 */
export async function analyzeCodebaseStructure(
  input: AnalyzeCodebaseStructureInput
): Promise<AnalyzeCodebaseStructureOutput> {
  const startTime = Date.now();
  logger.info('Starting codebase structure analysis', { input });

  const rootPath = input.rootPath || process.cwd();
  const includeHidden = input.includeHidden ?? false;
  const maxDepth = input.maxDepth ?? 5;

  // Initialize counters
  let totalFiles = 0;
  let totalLines = 0;
  const languageBreakdown: Record<string, number> = {};
  const configFiles: ConfigFile[] = [];
  const entryPoints: EntryPoint[] = [];

  /**
   * Recursively analyze files
   */
  async function analyzeDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files if not included
        if (!includeHidden && entry.name.startsWith('.')) {
          continue;
        }

        // Skip common ignored directories
        if (['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.cache'].includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await analyzeDirectory(fullPath);
        } else {
          totalFiles++;
          
          // Get language
          const language = getLanguageFromExtension(entry.name);
          languageBreakdown[language] = (languageBreakdown[language] || 0) + 1;

          // Count lines
          const lines = await countLines(fullPath);
          totalLines += lines;

          // Check if config file
          const configType = getConfigFileType(entry.name);
          if (configType) {
            configFiles.push({
              name: entry.name,
              path: fullPath,
              type: configType,
            });
          }

          // Check if entry point
          const entryInfo = getEntryPointType(fullPath);
          if (entryInfo.isEntry) {
            entryPoints.push({
              path: fullPath,
              type: entryInfo.type,
              description: entryInfo.description,
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Error analyzing directory', { dirPath, error });
    }
  }

  // Start analysis
  await analyzeDirectory(rootPath);

  // Build directory tree
  const directoryTree = await buildDirectoryTree(rootPath, 0, maxDepth, includeHidden);

  const analysisDuration = Date.now() - startTime;
  logger.info('Codebase structure analysis completed', {
    totalFiles,
    totalLines,
    languageCount: Object.keys(languageBreakdown).length,
    configFilesCount: configFiles.length,
    entryPointsCount: entryPoints.length,
    analysisDuration,
  });

  return {
    totalFiles,
    totalLines,
    languageBreakdown,
    directoryTree,
    entryPoints,
    configFiles,
    rootPath,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatCodebaseStructureResponse(output: AnalyzeCodebaseStructureOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Codebase Structure Analysis');
  lines.push('');
  lines.push(`**Root Path:** ${output.rootPath}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Files:** ${output.totalFiles.toLocaleString()}`);
  lines.push(`- **Total Lines:** ${output.totalLines.toLocaleString()}`);
  lines.push(`- **Languages:** ${Object.keys(output.languageBreakdown).length}`);
  lines.push('');

  // Language breakdown
  lines.push('## Language Breakdown');
  lines.push('');
  const sortedLanguages = Object.entries(output.languageBreakdown)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [language, count] of sortedLanguages) {
    const percentage = ((count / output.totalFiles) * 100).toFixed(1);
    lines.push(`- **${language}:** ${count} files (${percentage}%)`);
  }
  lines.push('');

  // Entry points
  if (output.entryPoints.length > 0) {
    lines.push('## Entry Points');
    lines.push('');
    for (const entry of output.entryPoints.slice(0, 10)) {
      const relativePath = path.relative(output.rootPath, entry.path);
      lines.push(`- \`${relativePath}\` - ${entry.description}`);
    }
    if (output.entryPoints.length > 10) {
      lines.push(`- *...and ${output.entryPoints.length - 10} more*`);
    }
    lines.push('');
  }

  // Config files
  if (output.configFiles.length > 0) {
    lines.push('## Configuration Files');
    lines.push('');
    const configByType: Record<string, ConfigFile[]> = {};
    for (const config of output.configFiles) {
      if (!configByType[config.type]) {
        configByType[config.type] = [];
      }
      configByType[config.type].push(config);
    }
    
    for (const [type, configs] of Object.entries(configByType)) {
      lines.push(`### ${type.toUpperCase()}`);
      for (const config of configs) {
        const relativePath = path.relative(output.rootPath, config.path);
        lines.push(`- \`${relativePath}\``);
      }
      lines.push('');
    }
  }

  // Directory tree (limited)
  lines.push('## Directory Structure');
  lines.push('');
  lines.push('```');
  lines.push(formatDirectoryTree(output.directoryTree, 0, 2));
  lines.push('```');
  lines.push('');

  // Footer
  lines.push('---');
  lines.push(`Analyzed ${output.totalFiles} files in ${output.rootPath}`);

  return lines.join('\n');
}

/**
 * Format directory tree as text
 */
function formatDirectoryTree(nodes: DirectoryNode[], depth: number, maxDisplayDepth: number): string {
  if (depth >= maxDisplayDepth) {
    return '';
  }

  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  const maxChildren = 5;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const prefix = isLast ? '└── ' : '├── ';
    
    if (node.type === 'directory') {
      lines.push(`${indent}${prefix}${node.name}/`);
      if (node.children && node.children.length > 0) {
        const childOutput = formatDirectoryTree(node.children, depth + 1, maxDisplayDepth);
        if (childOutput) {
          lines.push(childOutput);
        }
      }
    } else {
      lines.push(`${indent}${prefix}${node.name}`);
    }
  }

  return lines.join('\n');
}