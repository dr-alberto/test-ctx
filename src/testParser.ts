import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { TestDescription } from './types';

interface ParseContext {
  file: string;
  descriptions: TestDescription[];
  currentDescribe?: string;
}

export function parseTestFile(filePath: string, content: string, includeCode: boolean = false): TestDescription[] {
  const descriptions: TestDescription[] = [];
  const context: ParseContext = {
    file: filePath,
    descriptions,
  };

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'functionBind',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
      ],
    });

    traverse(ast, {
      CallExpression(path) {
        const callee = path.node.callee;
        const args = path.node.arguments;

        // Handle describe blocks
        if (
          (t.isIdentifier(callee) && callee.name === 'describe') ||
          (t.isMemberExpression(callee) &&
            t.isIdentifier(callee.object) &&
            callee.object.name === 'describe')
        ) {
          if (args.length > 0 && t.isStringLiteral(args[0])) {
            context.currentDescribe = args[0].value;
          }
        }

        // Handle it/test blocks
        if (
          (t.isIdentifier(callee) && (callee.name === 'it' || callee.name === 'test')) ||
          (t.isMemberExpression(callee) &&
            t.isIdentifier(callee.object) &&
            (callee.object.name === 'it' || callee.object.name === 'test'))
        ) {
          if (args.length > 0 && t.isStringLiteral(args[0])) {
            const testName = args[0].value;
            let code: string | undefined;

            if (includeCode && args.length > 1 && t.isFunctionExpression(args[1])) {
              const func = args[1];
              if (func.body && t.isBlockStatement(func.body)) {
                // Extract code snippet (limit to first 500 chars)
                const codeStart = func.body.start || 0;
                const codeEnd = func.body.end || content.length;
                code = content.substring(codeStart, codeEnd).slice(0, 500);
              }
            }

            descriptions.push({
              file: filePath,
              describe: context.currentDescribe,
              test: testName,
              code,
            });
          }
        }
      },
    });
  } catch (error) {
    // Fallback to regex parsing if AST parsing fails
    console.warn(`AST parsing failed for ${filePath}, falling back to regex:`, error);
    return parseWithRegex(filePath, content, includeCode);
  }

  return descriptions;
}

function parseWithRegex(filePath: string, content: string, includeCode: boolean): TestDescription[] {
  const descriptions: TestDescription[] = [];
  let currentDescribe: string | undefined;

  // Match describe blocks
  const describeRegex = /describe\s*[\(`'"]\s*([^`'"]+)[`'"]/g;
  const describeMatches = Array.from(content.matchAll(describeRegex));
  
  // Match it/test blocks
  const testRegex = /(?:it|test)\s*[\(`'"]\s*([^`'"]+)[`'"]/g;
  const testMatches = Array.from(content.matchAll(testRegex));

  // Simple approach: group tests by nearest describe
  for (const match of testMatches) {
    const testName = match[1];
    
    // Find the describe block before this test
    const testIndex = match.index || 0;
    let nearestDescribe: string | undefined;
    
    for (const descMatch of describeMatches) {
      const descIndex = descMatch.index || 0;
      if (descIndex < testIndex) {
        nearestDescribe = descMatch[1];
      } else {
        break;
      }
    }

    descriptions.push({
      file: filePath,
      describe: nearestDescribe,
      test: testName,
    });
  }

  return descriptions;
}
