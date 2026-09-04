// src/data/providerConfig.js
//
// LLM provider configuration for the interest-score generation call.
// The provider is swappable by changing this object — the rest of the
// app should not reference a provider directly.
//
// See docs/SCORING_SPEC.md §4 for rationale on the chosen values.

export const PROVIDER_CONFIG = {
  provider: 'openai', // 'openai' | 'anthropic' | 'other'
  model: 'gpt-4o-mini', // fast, cheap, and good at structured JSON output
  temperature: 0.4, // low-ish for consistent scoring; some creativity for summary tone
  maxOutputTokens: 800, // enough for full JSON response without waste
};
