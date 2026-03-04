import * as dotenv from 'dotenv';
import { Config, ModelConfig } from './types';

dotenv.config();

type Provider = 'openai' | 'anthropic' | 'openrouter';

function detectProvider(): {
  provider: Provider;
  apiKey: string;
} {
  const providers = [
    { name: 'openai', key: process.env.OPENAI_API_KEY },
    { name: 'anthropic', key: process.env.ANTHROPIC_API_KEY },
    { name: 'openrouter', key: process.env.OPEN_ROUTER_API_KEY },
  ] as const;

  const active = providers.filter(p => p.key);

  if (active.length === 0) {
    throw new Error(
      'No API key found. Set exactly one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, OPEN_ROUTER_API_KEY'
    );
  }

  if (active.length > 1) {
    throw new Error(
      `Multiple API keys found (${active
        .map(p => p.name)
        .join(', ')}). Please keep only one.`
    );
  }

  return {
    provider: active[0].name,
    apiKey: active[0].key!,
  };
}

export function loadConfig(options: {
  model?: string;
  outputFile?: string;
  dryRun?: boolean;
  includeCode?: boolean;
}): Config {
  const { provider, apiKey } = detectProvider();

  const model =
    options.model ||
    process.env.DEFAULT_MODEL ||
    getDefaultModel(provider);

  const modelConfig: ModelConfig = {
    provider,
    model,
    apiKey,
  };

  return {
    model: modelConfig,
    outputFile: options.outputFile ?? 'rules.md',
    dryRun: options.dryRun ?? false,
    includeCode: options.includeCode ?? false,
  };
}

function getDefaultModel(provider: Provider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-3-5-haiku-20241022';
    case 'openrouter':
      return 'openai/gpt-4o-mini';
    case 'openai':
    default:
      return 'gpt-4o-mini';
  }
}
