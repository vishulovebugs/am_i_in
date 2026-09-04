// src/__tests__/scaffold.test.js
//
// Smoke tests confirming the scaffold is sound and Phase 0 artifacts
// (SCORING_SPEC.md, providerConfig.js) survived the move intact.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

describe('Scaffold integrity', () => {
  it('has the expected folder structure', async () => {
    const { existsSync } = await import('node:fs');
    expect(existsSync(join(PROJECT_ROOT, 'src', 'components'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'src', 'utils'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'src', 'hooks'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'src', 'styles'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'src', 'data'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'api', 'analyze.js'))).toBe(true);
    expect(existsSync(join(PROJECT_ROOT, 'docs', 'SCORING_SPEC.md'))).toBe(true);
  });
});

describe('Phase 0: providerConfig.js', async () => {
  const { PROVIDER_CONFIG } = await import('../data/providerConfig.js');

  it('exports PROVIDER_CONFIG', () => {
    expect(PROVIDER_CONFIG).toBeDefined();
    expect(typeof PROVIDER_CONFIG).toBe('object');
  });

  it('has required fields: provider, model, temperature, maxOutputTokens', () => {
    expect(PROVIDER_CONFIG).toHaveProperty('provider');
    expect(PROVIDER_CONFIG).toHaveProperty('model');
    expect(PROVIDER_CONFIG).toHaveProperty('temperature');
    expect(PROVIDER_CONFIG).toHaveProperty('maxOutputTokens');
  });

  it('has correct types for all fields', () => {
    expect(typeof PROVIDER_CONFIG.provider).toBe('string');
    expect(typeof PROVIDER_CONFIG.model).toBe('string');
    expect(typeof PROVIDER_CONFIG.temperature).toBe('number');
    expect(typeof PROVIDER_CONFIG.maxOutputTokens).toBe('number');
  });
});

describe('Phase 0: SCORING_SPEC.md', () => {
  let specContent;

  beforeAll(() => {
    specContent = readFileSync(
      join(PROJECT_ROOT, 'docs', 'SCORING_SPEC.md'),
      'utf8'
    );
  });

  it('exists and is readable', () => {
    expect(specContent).toBeDefined();
    expect(specContent.length).toBeGreaterThan(0);
  });

  it('contains the disclaimer string', () => {
    expect(specContent).toContain(
      'For entertainment purposes only — not a scientifically validated measure of interest.'
    );
  });

  it('contains all six signal names', () => {
    const signals = [
      'replyTime',
      'emoji',
      'messageLengthRatio',
      'questionFrequency',
      'initiationRatio',
      'conversationalTone',
    ];
    for (const signal of signals) {
      expect(specContent).toContain(signal);
    }
  });

  it('contains the LLM system prompt section', () => {
    expect(specContent).toContain('## 2. LLM System Prompt');
  });

  it('contains the JSON response schema section', () => {
    expect(specContent).toContain('## 3. JSON Response Schema');
  });
});
