/**
 * detect_architecture_pattern Tool
 *
 * Detect design patterns and architecture styles used in a codebase.
 * Analyzes directory structure, file naming, and code patterns.
 */

import { z } from 'zod';
import { getLogger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = getLogger('detect-architecture-pattern');

/**
 * Input schema for detect_architecture_pattern tool
 */
export const DetectArchitecturePatternInputSchema = z.object({
  rootPath: z.string().optional().describe('Root path to analyze (defaults to current working directory)'),
  includeHidden: z.boolean().optional().describe('Include hidden files and directories'),
});

export type DetectArchitecturePatternInput = z.input<typeof DetectArchitecturePatternInputSchema> & {
  includeHidden?: boolean;
};

/**
 * Architecture pattern types
 */
export type ArchitecturePattern = 
  | 'MVC'
  | 'Clean Architecture'
  | 'DDD'
  | 'Hexagonal'
  | 'Microservices'
  | 'Monolithic'
  | 'Serverless'
  | 'Client-Server'
  | 'Layered'
  | 'Multi-Tier'
  | 'Unknown';

/**
 * Directory structure information
 */
export interface DirectoryStructure {
  name: string;
  path: string;
  fileCount: number;
  subdirectories: string[];
}

/**
 * Evidence for detected pattern
 */
export interface PatternEvidence {
  type: string;
  description: string;
  filePath?: string;
  confidence: number;
}

/**
 * Output of detect_architecture_pattern tool
 */
export interface DetectArchitecturePatternOutput {
  pattern: ArchitecturePattern;
  confidence: number;
  evidence: PatternEvidence[];
  suggestedStructure: DirectoryStructure[];
  totalDirectories: number;
  totalFiles: number;
  analysisDuration: number;
}

/**
 * Common directory patterns for different architectures
 */
const ARCHITECTURE_PATTERNS: Record<ArchitecturePattern, string[][]> = {
  'MVC': [
    ['app', 'models'],
    ['app', 'views'],
    ['app', 'controllers'],
    ['app', 'controllers', 'http'],
    ['app', 'views', 'layouts'],
  ],
  'Clean Architecture': [
    ['src', 'domain'],
    ['src', 'application'],
    ['src', 'infrastructure'],
    ['src', 'interfaces'],
    ['domain', 'entities'],
    ['domain', 'repositories'],
  ],
  'DDD': [
    ['domain'],
    ['domain', 'entities'],
    ['domain', 'value-objects'],
    ['domain', 'aggregates'],
    ['domain', 'events'],
    ['application'],
    ['application', 'services'],
    ['infrastructure'],
    ['infrastructure', 'persistence'],
    ['presentation'],
  ],
  'Hexagonal': [
    ['src', 'domain'],
    ['src', 'ports'],
    ['src', 'adapters'],
    ['src', 'primary'],
    ['src', 'secondary'],
  ],
  'Microservices': [
    ['services'],
    ['api-gateway'],
    ['service-a'],
    ['service-b'],
    ['docker-compose'],
    ['kubernetes'],
  ],
  'Monolithic': [
    ['app'],
    ['lib'],
    ['src'],
  ],
  'Serverless': [
    ['functions'],
    ['handlers'],
    ['src', 'handlers'],
    ['.serverless'],
  ],
  'Client-Server': [
    ['client'],
    ['server'],
    ['frontend'],
    ['backend'],
  ],
  'Layered': [
    ['src', 'presentation'],
    ['src', 'business'],
    ['src', 'data'],
    ['src', 'api'],
    ['src', 'services'],
    ['src', 'repositories'],
  ],
  'Multi-Tier': [
    ['presentation'],
    ['presentation', 'ui'],
    ['presentation', 'views'],
    ['business'],
    ['business', 'logic'],
    ['business', 'services'],
    ['data'],
    ['data', 'persistence'],
    ['data', 'repositories'],
    ['tier', 'presentation'],
    ['tier', 'business'],
    ['tier', 'data'],
  ],
  'Unknown': [],
};

/**
 * Count files in a directory recursively
 */
async function countFiles(dir: string, includeHidden: boolean = false): Promise<number> {
  let count = 0;
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith('.')) continue;
      if (['node_modules', 'dist', 'build', '.next', '.cache'].includes(entry.name)) continue;
      
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(fullPath, includeHidden);
      } else if (entry.isFile()) {
        count++;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return count;
}

/**
 * Get directory structure
 */
async function getDirectoryStructure(
  dir: string,
  depth: number = 0,
  maxDepth: number = 3,
  includeHidden: boolean = false,
  basePath: string = ''
): Promise<DirectoryStructure[]> {
  if (depth > maxDepth) return [];
  
  const structures: DirectoryStructure[] = [];
  
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const directories = entries.filter(e => e.isDirectory() && !['node_modules', 'dist', 'build', '.next', '.cache'].includes(e.name));
    
    for (const entry of directories) {
      if (!includeHidden && entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dir, entry.name);
      const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
      const fileCount = await countFiles(fullPath, includeHidden);
      const subdirs = (await fs.promises.readdir(fullPath, { withFileTypes: true }))
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .slice(0, 10);
      
      structures.push({
        name: entry.name,
        path: relativePath,
        fileCount,
        subdirectories: subdirs,
      });
      
      // Recurse with updated basePath
      const subStructures = await getDirectoryStructure(fullPath, depth + 1, maxDepth, includeHidden, relativePath);
      structures.push(...subStructures);
    }
  } catch (e) {
    // Ignore errors
  }
  
  return structures;
}

/**
 * Check if a path exists in the directory tree
 */
function pathExists(structures: DirectoryStructure[], targetPath: string[]): boolean {
  const targetStr = path.join(...targetPath);
  return structures.some(s => s.path === targetStr);
}

/**
 * Detect architecture pattern
 */
export async function detectArchitecturePattern(
  input: DetectArchitecturePatternInput
): Promise<DetectArchitecturePatternOutput> {
  const startTime = Date.now();
  logger.info('Detecting architecture pattern', { rootPath: input.rootPath });

  const rootPath = input.rootPath || process.cwd();
  const includeHidden = input.includeHidden ?? false;

  // Get directory structure
  const structures = await getDirectoryStructure(rootPath, 0, 3, includeHidden);
  const totalFiles = await countFiles(rootPath, includeHidden);
  
  // Debug: log the structures found
  logger.debug('Directory structures found', { structures: structures.map(s => s.path) });
  
  const evidence: PatternEvidence[] = [];
  const patternScores: Record<string, number> = {};
  
  // Score each pattern - directory-based scoring (higher weight)
  for (const [pattern, paths] of Object.entries(ARCHITECTURE_PATTERNS)) {
    if (pattern === 'Unknown') continue;
    
    let matches = 0;
    
    for (const targetPath of paths) {
      const exists = pathExists(structures, targetPath);
      if (exists) {
        matches++;
        
        evidence.push({
          type: 'directory',
          description: `Found "${targetPath.join('/')}" directory`,
          filePath: path.join(rootPath, ...targetPath),
          confidence: 0.9,
        });
      }
    }
    
    // Normalize score based on number of expected paths - use directory matches as primary score
    if (paths.length > 0) {
      patternScores[pattern] = matches / paths.length;
    }
  }
  
  // Check for specific file patterns
  const filePatterns: { pattern: string; architecture: ArchitecturePattern; weight: number }[] = [
    { pattern: 'docker-compose.yml', architecture: 'Microservices', weight: 0.9 },
    { pattern: 'docker-compose.yaml', architecture: 'Microservices', weight: 0.9 },
    { pattern: 'Dockerfile', architecture: 'Microservices', weight: 0.7 },
    { pattern: 'kubernetes.yml', architecture: 'Microservices', weight: 0.9 },
    { pattern: 'serverless.yml', architecture: 'Serverless', weight: 0.9 },
    { pattern: 'package.json', architecture: 'Monolithic', weight: 0.3 },
    { pattern: 'next.config', architecture: 'Serverless', weight: 0.6 },
    { pattern: 'vercel.json', architecture: 'Serverless', weight: 0.8 },
    { pattern: 'routes.ts', architecture: 'MVC', weight: 0.6 },
    { pattern: 'routes.js', architecture: 'MVC', weight: 0.6 },
  ];
  
  // Only check for file patterns if no clear directory-based pattern was found
  const hasClearPattern = Object.values(patternScores).some(s => s >= 0.5);
  
  if (!hasClearPattern) {
    try {
      const files = await fs.promises.readdir(rootPath);
      for (const file of files) {
        for (const fp of filePatterns) {
          if (file.includes(fp.pattern)) {
            // Only add file pattern score if the pattern doesn't already have a better directory score
            const currentScore = patternScores[fp.architecture] || 0;
            if (currentScore < 0.5) {
              patternScores[fp.architecture] = currentScore + (fp.weight * 0.5);
            }
            
            evidence.push({
              type: 'file',
              description: `Found "${file}" configuration`,
              filePath: path.join(rootPath, file),
              confidence: fp.weight * 0.5,
            });
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  // Find best matching pattern
  let bestPattern: ArchitecturePattern = 'Unknown';
  let bestScore = 0;
  
  for (const [pattern, score] of Object.entries(patternScores)) {
    if (score > bestScore) {
      bestScore = score;
      bestPattern = pattern as ArchitecturePattern;
    }
  }
  
  // Calculate confidence
  const confidence = bestScore > 0 ? Math.min(bestScore, 1) : 0;
  
  // If no clear pattern, determine based on file count
  if (bestPattern === 'Unknown') {
    if (totalFiles < 50) {
      bestPattern = 'Monolithic';
    } else {
      bestPattern = 'Client-Server';
    }
    evidence.push({
      type: 'inference',
      description: `Based on project size (${totalFiles} files), defaulting to ${bestPattern}`,
      confidence: 0.3,
    });
  }
  
  const analysisDuration = Date.now() - startTime;
  logger.info('Architecture pattern detected', {
    rootPath,
    pattern: bestPattern,
    confidence,
    evidenceCount: evidence.length,
    analysisDuration,
  });

  return {
    pattern: bestPattern,
    confidence,
    evidence,
    suggestedStructure: structures.slice(0, 20),
    totalDirectories: structures.length,
    totalFiles,
    analysisDuration,
  };
}

/**
 * Format the output for MCP response
 */
export function formatDetectArchitecturePatternResponse(output: DetectArchitecturePatternOutput): string {
  const lines: string[] = [];

  // Header
  lines.push('# Architecture Pattern Detection');
  lines.push('');
  lines.push(`**Pattern:** ${output.pattern}`);
  lines.push(`**Confidence:** ${(output.confidence * 100).toFixed(0)}%`);
  lines.push(`**Total Files:** ${output.totalFiles}`);
  lines.push(`**Total Directories:** ${output.totalDirectories}`);
  lines.push(`**Analysis Duration:** ${output.analysisDuration}ms`);
  lines.push('');

  // Evidence
  if (output.evidence.length > 0) {
    lines.push('## Evidence');
    lines.push('');
    
    // Group by type
    const byType: Record<string, PatternEvidence[]> = {};
    for (const ev of output.evidence) {
      if (!byType[ev.type]) {
        byType[ev.type] = [];
      }
      byType[ev.type].push(ev);
    }
    
    for (const [type, items] of Object.entries(byType)) {
      lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}`);
      for (const ev of items.slice(0, 10)) {
        const conf = (ev.confidence * 100).toFixed(0);
        lines.push(`- ${ev.description} (${conf}%)`);
      }
      lines.push('');
    }
  }

  // Directory Structure
  if (output.suggestedStructure.length > 0) {
    lines.push('## Directory Structure');
    lines.push('');
    
    // Show top-level directories
    const topLevel = output.suggestedStructure.filter(s => !s.path.includes(path.sep));
    for (const dir of topLevel.slice(0, 15)) {
      lines.push(`- \`${dir.name}/\` (${dir.fileCount} files)`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Detected ${output.pattern} architecture with ${(output.confidence * 100).toFixed(0)}% confidence in ${output.analysisDuration}ms`);

  return lines.join('\n');
}