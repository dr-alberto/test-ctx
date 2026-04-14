import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { TestDescription, ModelConfig } from './types';


const SYSTEM_PROMPT = `You are a Senior QA Architect extracting strict business rules and architectural invariants from test cases.

CRITICAL INSTRUCTIONS - FILTERING:
1. IGNORE TRIVIALITIES: Do NOT output rules like 'Function must be defined', 'Class must instantiate', 'It must return a value', or 'It should execute'. The AI already knows how to code.
2. EXTRACT ONLY INVARIANTS: Focus exclusively on edge cases, non-obvious default behaviors, validation constraints, and specific error states.
3. ACTIONABLE FORMATTING: Write rules as direct technical constraints.

BAD EXAMPLES (Do NOT write these):
- 'The omit function must be defined.'
- 'HTTP requests must be executable.'

GOOD EXAMPLES (Write these):
- 'Form-data payloads must strictly reject Arrays.'
- 'Path parameters must enforce UUID format by default.'

Output strictly a JSON object with this structure. Do not output Markdown or explanations. Only valid JSON:
{
  "rules": [
    {
      "category": "The file or module name (e.g., 'UserController' or 'Architecture')",
      "rule": "The strict, actionable rule (e.g., 'Controllers must not import Repositories')",
      "source": "The exact name of the test case"
    }
  ]
}`;


export async function generateRules(
  descriptions: TestDescription[],
  config: ModelConfig
): Promise<string> {
  if (config.provider === 'openai') {
    return generateWithOpenAI(descriptions, config);
  } else if (config.provider === 'openrouter') {
    return generateWithOpenRouter(descriptions, config);
  } else {
    return generateWithAnthropic(descriptions, config);
  }
}

async function generateWithOpenAI(
  descriptions: TestDescription[],
  config: ModelConfig
): Promise<string> {
  const openai = new OpenAI({
    apiKey: config.apiKey,
  });

  const userPrompt = formatTestDescriptions(descriptions);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    return response?.choices?.[0]?.message?.content ?? '{}';
  } catch (error: any) {
    const status = error?.status;
    if (status === 401) {
      throw new Error(
        'OpenAI API error (401 Unauthorized). Check that OPENAI_API_KEY is set correctly and has access to the requested model.'
      );
    }
    if (status === 429) {
      throw new Error(
        'OpenAI API error (429 Rate Limit). You have hit the rate limit. Try again later or reduce concurrency.'
      );
    }
    if (status >= 500) {
      throw new Error(
        'OpenAI API error (server-side issue). Please try again later or switch to a different model/provider.'
      );
    }
    throw new Error(
      `OpenAI API request failed: ${error?.message || 'Unknown error. Check your network connection and API key.'}`
    );
  }
}

async function generateWithOpenRouter(
  descriptions: TestDescription[],
  config: ModelConfig
): Promise<string> {
  // OpenRouter uses OpenAI-compatible API
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/dr-alberto/test-ctx', // Optional: for tracking
      'X-Title': 'test-ctx', // Optional: for tracking
    },
  });

  const userPrompt = formatTestDescriptions(descriptions);

  try {
    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    return response?.choices?.[0]?.message?.content ?? '{}';
  } catch (error: any) {
    const status = error?.status;
    if (status === 401) {
      throw new Error(
        'OpenRouter API error (401 Unauthorized). Check that OPEN_ROUTER_API_KEY is set correctly and has access to the requested model.'
      );
    }
    if (status === 404) {
      throw new Error(
        `OpenRouter API error (404 Model Not Found). The model "${config.model}" is not available on OpenRouter. Please choose a valid model ID from the OpenRouter models list and update DEFAULT_MODEL (or the --model flag).`
      );
    }
    if (status === 429) {
      throw new Error(
        'OpenRouter API error (429 Rate Limit). You have hit the rate limit. Try again later or reduce concurrency.'
      );
    }
    if (status >= 500) {
      throw new Error(
        'OpenRouter API error (server-side issue). Please try again later or switch to a different model/provider.'
      );
    }
    throw new Error(
      `OpenRouter API request failed: ${error?.message || 'Unknown error. Check your network connection and API key.'}`
    );
  }
}

async function generateWithAnthropic(
  descriptions: TestDescription[],
  config: ModelConfig
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: config.apiKey,
  });

  const userPrompt = formatTestDescriptions(descriptions);

  try {
    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response?.content?.[0];
    if (content?.type === 'text') {
      return content.text;
    }
    return '{}';
  } catch (error: any) {
    const status = error?.status;
    if (status === 401) {
      throw new Error(
        'Anthropic API error (401 Unauthorized). Check that ANTHROPIC_API_KEY is set correctly and has access to the requested model.'
      );
    }
    if (status === 429) {
      throw new Error(
        'Anthropic API error (429 Rate Limit). You have hit the rate limit. Try again later or reduce concurrency.'
      );
    }
    if (status >= 500) {
      throw new Error(
        'Anthropic API error (server-side issue). Please try again later or switch to a different model/provider.'
      );
    }
    throw new Error(
      `Anthropic API request failed: ${error?.message || 'Unknown error. Check your network connection and API key.'}`
    );
  }
}

function formatTestDescriptions(descriptions: TestDescription[]): string {
  const grouped = new Map<string, TestDescription[]>();

  for (const desc of descriptions) {
    const key = desc.file;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(desc);
  }

  let prompt = 'Test Cases:\n\n';
  for (const [file, tests] of grouped.entries()) {
    prompt += `File: ${file}\n`;
    for (const test of tests) {
      if (test.describe) {
        prompt += `  Context: ${test.describe}\n`;
      }
      prompt += `  Test: ${test.test}\n`;
      if (test.code) {
        prompt += `  Code: ${test.code.substring(0, 200)}...\n`;
      }
    }
    prompt += '\n';
  }

  return prompt;
}
