#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { discoverTestFiles } from './fileDiscovery';
import { parseTestFile } from './testParser';
import { processBatches } from './batchProcessor';
import { loadConfig } from './config';
import { TestDescription } from './types';
import { consolidateRules } from './consolidator';

const program = new Command();

program
  .name('test-ctx')
  .description('Generate test-ctx.md from test files using LLM')
  .version('1.0.0')
  .option('-m, --model <model>', 'Model name (e.g., gpt-4o-mini, claude-3-5-haiku-20241022, deepseek/deepseek-r1-0528:free). Provider is auto-detected from API keys.')
  .option('--dry-run', 'Show what files would be processed without calling API', false)
  .option('--include-code', 'Include test code snippets in LLM input', false)
  .option('--root <dir>', 'Root directory to scan', process.cwd())
  .parse(process.argv);

async function main() {
  const options = program.opts();

  try {
    if (!options.dryRun) {
      console.log('Checking API configuration...');
      const configCheck = loadConfig({
        model: options.model,
        outputFile: 'test-ctx.md',
        dryRun: false,
        includeCode: options.includeCode,
      });
      console.log(`✓ Using model: ${configCheck.model.provider} (${configCheck.model.model})`);
    }

    console.log('Discovering test files...');
    const testFiles = await discoverTestFiles(options.root);
    
    if (testFiles.length === 0) {
      console.log('No test files found matching patterns: **/*.test.*, **/*.spec.*');
      process.exit(1);
    }

    console.log(`✓ Found ${testFiles.length} test file(s)`);

    if (options.dryRun) {
      console.log('\nFiles that would be processed:');
      for (const file of testFiles) {
        console.log(`  - ${path.relative(options.root, file.path)}`);
      }
      return;
    }

    console.log('\nParsing test descriptions...');
    const descriptions: TestDescription[] = [];
    
    for (const file of testFiles) {
      const parsed = parseTestFile(file.path, file.content, options.includeCode);
      descriptions.push(...parsed);
    }

    console.log(`✓ Extracted ${descriptions.length} test description(s)`);

    if (descriptions.length === 0) {
      console.log('No test descriptions found in test files');
      process.exit(1);
    }

    console.log('\nLoading configuration...');
    const config = loadConfig({
      model: options.model, // Will be undefined if not provided, allowing DEFAULT_MODEL to be used
      outputFile: 'test-ctx.md',
      dryRun: false,
      includeCode: options.includeCode,
    });

    console.log('\nExtracting raw rules from tests...');
    const rawRules = await processBatches(descriptions, config.model);
    console.log(`✓ Extracted ${rawRules.length} raw signals.`);

    // --- THE NEW STEP ---
    console.log('\nRefining and creating rulebook...');
    // We pass the rawRules to the consolidator
    const finalMarkdown = await consolidateRules(rawRules, config.model);

    const finalPath = path.resolve(process.cwd(), 'test-ctx.md');
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.writeFile(finalPath, finalMarkdown, 'utf-8');

    console.log('\nSuccess! Extracted test rules to test-ctx.md.');
    console.log(
      'Next Step: Add this file to your AI\'s context (e.g., copy its contents into .cursorrules, reference it in CLAUDE.md, or simply @ tag it in your AI chat).'
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('No API key found')) {
        console.error(
          'No API key found. Set exactly one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPEN_ROUTER_API_KEY in your environment or .env file.'
        );
      } else if (error.message.includes('Multiple API keys found')) {
        console.error(
          'Multiple API keys detected. Please keep only one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPEN_ROUTER_API_KEY set.'
        );
      } else {
        console.error(error.message);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
