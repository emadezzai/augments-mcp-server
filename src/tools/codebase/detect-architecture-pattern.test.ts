/**
 * Tests for detect_architecture_pattern tool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectArchitecturePattern,
  formatDetectArchitecturePatternResponse,
  DetectArchitecturePatternInputSchema,
} from './detect-architecture-pattern';

describe('detect_architecture_pattern', () => {
  // Test directory
  const testDir = path.join(__dirname, '__fixtures__', 'architecture-test');
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Create test directories for different architectures
    // Each architecture has pairs of [parent, child] directories
    const architectures: Record<string, [string, string][]> = {
      mvc: [
        ['app', 'models'],
        ['app', 'views'],
        ['app', 'controllers'],
      ],
      clean: [
        ['src', 'domain'],
        ['src', 'application'],
        ['src', 'infrastructure'],
      ],
      ddd: [
        ['domain', 'entities'],
        ['domain', 'value-objects'],
        ['application', 'services'],
      ],
      serverless: [
        ['functions', 'placeholder'],
        ['handlers', 'placeholder'],
      ],
    };

    for (const [name, dirPairs] of Object.entries(architectures)) {
      for (const dirPair of dirPairs) {
        const parent = dirPair[0];
        const child = dirPair[1];
        const dirPath = path.join(testDir, name, parent, child);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
      tempDirs.push(path.join(testDir, name));
    }
  });

  describe('DetectArchitecturePatternInputSchema', () => {
    it('should validate valid input', () => {
      const validInput = {
        rootPath: '/project',
        includeHidden: false,
      };
      expect(DetectArchitecturePatternInputSchema.safeParse(validInput).success).toBe(true);
    });

    it('should validate input with defaults', () => {
      const input = {
        rootPath: '/project',
      };
      const result = DetectArchitecturePatternInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid input', () => {
      // Empty rootPath is optional, so it's valid - just use process.cwd() as default
      const invalidInput = {
        rootPath: 123, // Invalid type
      };
      expect(DetectArchitecturePatternInputSchema.safeParse(invalidInput).success).toBe(false);
    });
  });

  describe('detectArchitecturePattern', () => {
    it('should detect MVC pattern', async () => {
      const mvcDir = path.join(testDir, 'mvc');
      const result = await detectArchitecturePattern({
        rootPath: mvcDir,
      });

      expect(result.pattern).toBe('MVC');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.totalFiles).toBe(0);
      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });

    it('should detect Clean Architecture pattern', async () => {
      const cleanDir = path.join(testDir, 'clean');
      const result = await detectArchitecturePattern({
        rootPath: cleanDir,
      });

      expect(result.pattern).toBe('Clean Architecture');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect DDD pattern', async () => {
      const dddDir = path.join(testDir, 'ddd');
      const result = await detectArchitecturePattern({
        rootPath: dddDir,
      });

      expect(result.pattern).toBe('DDD');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Serverless pattern', async () => {
      const serverlessDir = path.join(testDir, 'serverless');
      const result = await detectArchitecturePattern({
        rootPath: serverlessDir,
      });

      expect(result.pattern).toBe('Serverless');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return evidence for detected patterns', async () => {
      const mvcDir = path.join(testDir, 'mvc');
      const result = await detectArchitecturePattern({
        rootPath: mvcDir,
      });

      expect(result.evidence.length).toBeGreaterThan(0);
      expect(result.evidence[0].type).toBe('directory');
    });

    it('should track analysis duration', async () => {
      const mvcDir = path.join(testDir, 'mvc');
      const result = await detectArchitecturePattern({
        rootPath: mvcDir,
      });

      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatDetectArchitecturePatternResponse', () => {
    it('should format response correctly', async () => {
      const mvcDir = path.join(testDir, 'mvc');
      const result = await detectArchitecturePattern({
        rootPath: mvcDir,
      });

      const formatted = formatDetectArchitecturePatternResponse(result);

      expect(formatted).toContain('# Architecture Pattern Detection');
      expect(formatted).toContain(`**Pattern:** ${result.pattern}`);
      expect(formatted).toContain(`**Confidence:**`);
      expect(formatted).toContain('## Evidence');
      expect(formatted).toContain('## Directory Structure');
    });

    it('should show evidence details', async () => {
      const mvcDir = path.join(testDir, 'mvc');
      const result = await detectArchitecturePattern({
        rootPath: mvcDir,
      });

      const formatted = formatDetectArchitecturePatternResponse(result);
      expect(formatted).toContain('Found');
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