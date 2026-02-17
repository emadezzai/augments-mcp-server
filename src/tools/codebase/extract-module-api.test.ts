/**
 * Tests for extract_module_api tool
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractModuleApi,
  formatExtractModuleApiResponse,
  ExtractModuleApiInputSchema,
} from './extract-module-api';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
  };
});

// Test fixtures directory
const fixturesDir = path.join(__dirname, '__fixtures__');

// Create test fixture files
const testFixtures = {
  simple: `export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

export const PI = 3.14159;

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}

export type StringOrNumber = string | number;

export interface User {
  name: string;
  age: number;
}
`,
  withPrivate: `export function publicFunction() {
  return 'public';
}

function privateFunction() {
  return 'private';
}

export const publicConst = 42;

const privateConst = 100;

export class PublicClass {
  publicMethod() {}
}

class PrivateClass {
  privateMethod() {}
}
`,
  withExtends: `export class Animal {
  constructor(public name: string) {}
  speak(): void {
    console.log(\`\${this.name} makes a sound\`);
  }
}

export class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);
  }
  speak(): void {
    console.log(\`\${this.name} barks\`);
  }
}

export interface NamedEntity {
  id: string;
  name: string;
}

export interface UserEntity extends NamedEntity {
  email: string;
  age: number;
}
`,
  withImports: `import { useState, useEffect } from 'react';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import * as _ from 'lodash';

export function useData(url: string) {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios.get(url).then(setData);
  }, [url]);
  return data;
}

export const apiClient: AxiosInstance = axios.create();

export default function App() {
  return <div>Hello</div>;
}
`,
};

describe('extract_module_api', () => {
  // Create temp test files
  const tempFiles: string[] = [];

  beforeEach(() => {
    // Create temp test files for each test
    for (const [name, content] of Object.entries(testFixtures)) {
      const filePath = path.join(fixturesDir, `${name}.ts`);
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }
      fs.writeFileSync(filePath, content);
      tempFiles.push(filePath);
    }
  });

  describe('ExtractModuleApiInputSchema', () => {
    it('should validate valid input', () => {
      const validInput = {
        modulePath: './test.ts',
        includePrivate: false,
        rootPath: '/project',
      };
      expect(ExtractModuleApiInputSchema.safeParse(validInput).success).toBe(true);
    });

    it('should validate input with defaults', () => {
      const input = {
        modulePath: './test.ts',
      };
      const result = ExtractModuleApiInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        // includePrivate is optional, so it can be undefined
        expect(result.data.includePrivate ?? false).toBe(false);
      }
    });

    it('should reject empty modulePath', () => {
      const invalidInput = {
        modulePath: '',
      };
      expect(ExtractModuleApiInputSchema.safeParse(invalidInput).success).toBe(false);
    });
  });

  describe('extractModuleApi', () => {
    it('should extract exports from simple module', async () => {
      const filePath = path.join(fixturesDir, 'simple.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      expect(result.module).toBe('simple.ts');
      expect(result.language).toBe('TypeScript');
      expect(result.totalExports).toBe(5); // hello, PI, Calculator, StringOrNumber, User
      expect(result.exports).toContainEqual(
        expect.objectContaining({
          name: 'hello',
          type: 'function',
        })
      );
      expect(result.exports).toContainEqual(
        expect.objectContaining({
          name: 'Calculator',
          type: 'class',
        })
      );
    });

    it('should filter private exports by default', async () => {
      const filePath = path.join(fixturesDir, 'withPrivate.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      // Should only have public exports
      expect(result.totalExports).toBe(3); // publicFunction, publicConst, PublicClass
      expect(result.exports.some(e => e.name === 'privateFunction')).toBe(false);
      expect(result.exports.some(e => e.name === 'privateConst')).toBe(false);
    });

    it('should include private exports when includePrivate is true', async () => {
      const filePath = path.join(fixturesDir, 'withPrivate.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
        includePrivate: true,
      });

      // Should have the same exports (private items are not exported, just not exported)
      expect(result.totalExports).toBe(3);
    });

    it('should extract class extends information', async () => {
      const filePath = path.join(fixturesDir, 'withExtends.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      const dogExport = result.exports.find(e => e.name === 'Dog');
      expect(dogExport).toBeDefined();
      expect(dogExport?.extends).toContain('Animal');
    });

    it('should extract interface extends information', async () => {
      const filePath = path.join(fixturesDir, 'withExtends.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      const userEntityExport = result.exports.find(e => e.name === 'UserEntity');
      expect(userEntityExport).toBeDefined();
      expect(userEntityExport?.extends).toContain('NamedEntity');
    });

    it('should extract dependencies from imports', async () => {
      const filePath = path.join(fixturesDir, 'withImports.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('axios');
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        extractModuleApi({
          modulePath: './nonExistent.ts',
        })
      ).rejects.toThrow('Module not found');
    });

    it('should track analysis duration', async () => {
      const filePath = path.join(fixturesDir, 'simple.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      expect(result.analysisDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('formatExtractModuleApiResponse', () => {
    it('should format response correctly', async () => {
      const filePath = path.join(fixturesDir, 'simple.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      const formatted = formatExtractModuleApiResponse(result);

      expect(formatted).toContain('# Module API');
      expect(formatted).toContain('**Module:** simple.ts');
      expect(formatted).toContain('## Summary');
      expect(formatted).toContain('## Exports');
      // Type aliases and interfaces are exported, so they appear in Exports section
    });

    it('should show dependencies section', async () => {
      const filePath = path.join(fixturesDir, 'withImports.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      const formatted = formatExtractModuleApiResponse(result);
      expect(formatted).toContain('## Dependencies');
      expect(formatted).toContain('react');
    });

    it('should show class members', async () => {
      const filePath = path.join(fixturesDir, 'simple.ts');
      const result = await extractModuleApi({
        modulePath: filePath,
      });

      const formatted = formatExtractModuleApiResponse(result);
      expect(formatted).toContain('Calculator');
      expect(formatted).toContain('add');
    });
  });

  // Cleanup
  afterEach(() => {
    for (const filePath of tempFiles) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    tempFiles.length = 0;
  });
});