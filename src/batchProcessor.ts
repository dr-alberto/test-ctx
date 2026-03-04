import pLimit from 'p-limit';
import { TestDescription, ModelConfig, Rule } from './types';
import { generateRules } from './llmClient';

const BATCH_SIZE = 20; // Process 20 tests at a time
const CONCURRENT_REQUESTS = 3; // Max 3 concurrent API calls

/** Extract JSON from LLM output that may include <think> blocks, markdown fences, or leading text. */
function extractJson(raw: string): string {
  let s = raw.trim();
  // Remove <think>...</think> block (models sometimes emit reasoning before JSON)
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Unwrap ```json ... ``` or ``` ... ```
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)```$/);
  if (fenceMatch) s = fenceMatch[1].trim();
  // Fallback: find first { ... } (balanced) in case of extra text
  const firstBrace = s.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = firstBrace; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end !== -1) s = s.slice(firstBrace, end + 1);
  }
  return s;
}

export async function processBatches(
  descriptions: TestDescription[],
  config: ModelConfig
): Promise<Rule[]> {
  const limit = pLimit(CONCURRENT_REQUESTS);
  const batches: TestDescription[][] = [];

  // Group by file first
  const byFile = new Map<string, TestDescription[]>();
  for (const desc of descriptions) {
    if (!byFile.has(desc.file)) {
      byFile.set(desc.file, []);
    }
    byFile.get(desc.file)!.push(desc);
  }

  // Create batches
  let currentBatch: TestDescription[] = [];
  for (const [file, tests] of byFile.entries()) {
    if (currentBatch.length + tests.length > BATCH_SIZE) {
      if (currentBatch.length > 0) {
        batches.push([...currentBatch]);
        currentBatch = [];
      }
    }
    currentBatch.push(...tests);
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  // Process batches with concurrency limit
  const results = await Promise.all(
    batches.map((batch, index) =>
      limit(async () => {
        console.log(`Processing batch ${index + 1}/${batches.length} (${batch.length} tests)...`);
        const raw = await generateRules(batch, config);
        const rawJson = extractJson(raw);
        try {
          const parsed = JSON.parse(rawJson);
          return (parsed.rules || []) as Rule[];
        } catch (error) {
          console.error(
            `Failed to parse LLM JSON for batch ${index + 1}. The model did not return valid JSON.`
          );
          return [];
        }
      })
    )
  );

  return results.flat();
}
