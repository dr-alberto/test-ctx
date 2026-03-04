import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TestFile } from './types';

const TEST_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.test.js',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.spec.js',
  '**/*.spec.jsx',
];

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
];

export async function discoverTestFiles(rootDir: string = process.cwd()): Promise<TestFile[]> {
  const testFiles: TestFile[] = [];

  for (const pattern of TEST_PATTERNS) {
    const files = await glob(pattern, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        testFiles.push({
          path: filePath,
          content,
        });
      } catch (error) {
        console.warn(`Failed to read file ${filePath}:`, error);
      }
    }
  }

  // Remove duplicates
  const uniqueFiles = new Map<string, TestFile>();
  for (const file of testFiles) {
    uniqueFiles.set(file.path, file);
  }

  return Array.from(uniqueFiles.values());
}
