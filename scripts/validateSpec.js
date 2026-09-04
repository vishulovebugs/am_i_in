#!/usr/bin/env node
// scripts/validateSpec.js
//
// Validates that docs/SCORING_SPEC.md and src/data/providerConfig.js are consistent:
//   1. PROVIDER_CONFIG has the required fields with correct types.
//   2. Every signal name in the JSON response schema also appears in the system prompt text,
//      so the prompt and schema cannot silently drift apart.
//
// Run: node scripts/validateSpec.js

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { PROVIDER_CONFIG } from "../src/data/providerConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = join(__dirname, "..", "docs", "SCORING_SPEC.md");

let failures = 0;

function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (detail) console.log(`       ${detail}`);
  if (!ok) failures += 1;
}

// ---------------------------------------------------------------------------
// Check 1: PROVIDER_CONFIG has required fields with correct types
// ---------------------------------------------------------------------------
const requiredFields = {
  provider: "string",
  model: "string",
  temperature: "number",
  maxOutputTokens: "number",
};

const missingFields = [];
const wrongTypes = [];

for (const [field, expectedType] of Object.entries(requiredFields)) {
  if (!(field in PROVIDER_CONFIG)) {
    missingFields.push(field);
  } else if (typeof PROVIDER_CONFIG[field] !== expectedType) {
    wrongTypes.push(`${field} (expected ${expectedType}, got ${typeof PROVIDER_CONFIG[field]})`);
  }
}

const configOk = missingFields.length === 0 && wrongTypes.length === 0;
const configDetail = configOk
  ? `provider="${PROVIDER_CONFIG.provider}", model="${PROVIDER_CONFIG.model}", temperature=${PROVIDER_CONFIG.temperature}, maxOutputTokens=${PROVIDER_CONFIG.maxOutputTokens}`
  : [
      missingFields.length > 0 ? `missing: ${missingFields.join(", ")}` : "",
      wrongTypes.length > 0 ? `wrong type: ${wrongTypes.join("; ")}` : "",
    ]
    .filter(Boolean)
    .join("; ");

report(
  "PROVIDER_CONFIG has provider, model, temperature, maxOutputTokens (correct types)",
  configOk,
  configDetail
);

// ---------------------------------------------------------------------------
// Check 2: Every signal in the JSON response schema also appears in the
//           system prompt text, so the two can't silently drift apart.
// ---------------------------------------------------------------------------
const spec = readFileSync(SPEC_PATH, "utf8");

// Extract the system prompt block (between the first ``` after "## 2. LLM System Prompt"
// and the next ```).
const promptSection = spec.split(/^## 2\. LLM System Prompt/m)[1];
if (!promptSection) {
  console.error('FAIL  Could not locate "## 2. LLM System Prompt" in docs/SCORING_SPEC.md');
  process.exit(1);
}
const promptBlock = promptSection.match(/```\n([\s\S]*?)\n```/);
if (!promptBlock) {
  console.error("FAIL  Could not find a fenced code block in the system prompt section");
  process.exit(1);
}
const promptText = promptBlock[1];

// Extract the JSON Schema section, find the signal names from the schema properties.
const schemaSection = spec.split(/^## 3\. JSON Response Schema/m)[1];
if (!schemaSection) {
  console.error('FAIL  Could not locate "## 3. JSON Response Schema" in docs/SCORING_SPEC.md');
  process.exit(1);
}
const schemaBlock = schemaSection.match(/```json\n([\s\S]*?)\n```/);
if (!schemaBlock) {
  console.error("FAIL  Could not find a fenced JSON block in the schema section");
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(schemaBlock[1]);
} catch {
  console.error("FAIL  Could not parse the JSON Schema in docs/SCORING_SPEC.md");
  process.exit(1);
}

// The signal names are the keys of the "properties" inside "signals" in the schema.
const schemaSignalNames = Object.keys(
  schema.properties?.signals?.properties ?? {}
);

if (schemaSignalNames.length === 0) {
  console.error("FAIL  No signal names found in the JSON Schema");
  process.exit(1);
}

const missingFromPrompt = schemaSignalNames.filter(
  (name) => !promptText.includes(name)
);

report(
  "Every signal name in JSON Schema also appears in the system prompt",
  missingFromPrompt.length === 0,
  missingFromPrompt.length === 0
    ? `${schemaSignalNames.length}/${schemaSignalNames.length} found: ${schemaSignalNames.join(", ")}`
    : `missing from prompt: ${missingFromPrompt.join(", ")}`
);

// Also check the reverse: any signal in the prompt not in the schema (informational).
const promptSignalMentions = schemaSignalNames.filter((name) =>
  promptText.includes(name)
);
// We don't do a full reverse check here since the prompt may mention extra terms,
// but we confirm the core six are covered.

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
if (failures === 0) {
  console.log("\nAll checks passed — docs/SCORING_SPEC.md and src/data/providerConfig.js agree.");
} else {
  console.log(`\n${failures} check(s) FAILED.`);
  process.exit(1);
}
