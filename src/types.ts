export interface TestFile {
  path: string;
  content: string;
}

export interface Rule {
  category: string;
  rule: string;
  source: string;
}

export interface TestDescription {
  file: string;
  describe?: string;
  test: string;
  code?: string;
}

export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'openrouter';
  model: string;
  apiKey: string;
}

export interface Config {
  model: ModelConfig;
  outputFile: string;
  dryRun: boolean;
  includeCode: boolean;
}
