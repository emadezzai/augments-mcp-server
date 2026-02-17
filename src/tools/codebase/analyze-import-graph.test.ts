/**
 * Tests for analyze_import_graph tool
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  analyzeImportGraph,
  formatAnalyzeImportGraphResponse,
  AnalyzeImportGraphInputSchema,
} from './analyze-import-graph';

describe('analyze_import_graph', () => {
  // Test directory
  const testDir = path.join(__dirname, '__fixtures__', 'import-graph-test');
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Create test directories with some TypeScript files
    const testFiles = {
      'src/index.ts': `import { add } from './math';
import { config } from './config';
export { add };
export const app = 'test';`,
      'src/math.ts': `export function add(a: number, b: number): number {
  return a + b;
}
export const PI = 3.14;`,
      'src/config.ts': `export const config = {
  apiKey: 'test',
  debug: true
};`,
      'src/utils/helper.ts': `import { add } from '../math';
export function helper() {
  return add(1, 2);
}`,
    };

    // Create directories
    if (!fs.existsSync(path.join(testDir, 'src', 'utils'))) {
      fs.mkdirSync(path.join(testDir, 'src', 'utils'), { recursive: true });
    }
    tempDirs.push(testDir);

    // Create files
    for (const [filePath, content] of Object.entries(testFiles)) {
      const fullPath = path.join(testDir, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
    }
  });

  describe('AnalyzeImportGraphInputSchema', () => {
    it('should validate valid input', () => {
      const validInput = {
        rootPath: '/project',
        includeHidden: false,
        maxDepth: 3,
      };
      expect(AnalyzeImportGraphInputSchema.safeParse(validInput).success).toBe(true);
    });

    it('should validate input with defaults', () => {
      const input = {
        rootPath: '/project',
      };
      const result = AnalyzeImportGraphInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
      const invalidInput = {
        rootPath: 123, // Invalid type
      };
      expect(AnalyzeImportGraphInputSchema.safeParse(invalidInput).success).toBe(false);
    });
  });

  describe('analyzeImportGraph', () => {
    it('should analyze import graph', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDependencies).toBeGreaterThan(0);
      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });

    it('should detect files with dependencies', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      // Should find files that have imports
      const filesWithImports = result.nodes.filter(n => n.imports.length > 0);
      expect(filesWithImports.length).toBeGreaterThan(0);
    });

    it('should track dependents', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      // math.ts should have dependents (imported by index.ts and helper.ts)
      const mathNode = result.nodes.find(n => n.fileName === 'math.ts');
      expect(mathNode).toBeDefined();
      expect(mathNode!.dependents).toBeGreaterThan(0);
    });

    it('should track analysis duration', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatAnalyzeImportGraphResponse', () => {
    it('should format response correctly', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      const formatted = formatAnalyzeImportGraphResponse(result);

      expect(formatted).toContain('# Import Graph Analysis');
      expect(formatted).toContain(`**Total Files:**`);
      expect(formatted).toContain(`**Total Dependencies:**`);
      expect(formatted).toContain('## Most Dependent Files');
    });

    it('should show circular dependencies section', async () => {
      const result = await analyzeImportGraph({
        rootPath: testDir,
      });

      const formatted = formatAnalyzeImportGraphResponse(result);
      expect(formatted).toContain('**Circular Dependencies:**');
    });
  });

  // Cleanup
  afterEach(() => {
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
    tempDirs.length = 0;
  });
});