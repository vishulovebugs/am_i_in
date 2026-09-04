#!/usr/bin/env node
// scripts/testApiStub.js
//
// Tests the /api/analyze serverless function stub by POSTing a fake
// messages array and asserting the response matches Phase 0's schema shape.
//
// Usage:
//   1. Start vercel dev in another terminal:  vercel dev
//   2. Run this script:  node scripts/testApiStub.js
//
// The script assumes vercel dev is running on http://localhost:3000.

const API_URL = 'http://localhost:3000/api/analyze';

const fakeMessages = [
  {
    id: 'm1',
    sender: 'user',
    text: 'hey you around tonight?',
    timestamp: '2026-09-01T20:02:00-07:00',
    hasEmoji: false,
    emojiList: [],
    isQuestion: true,
  },
  {
    id: 'm2',
    sender: 'them',
    text: 'for you? always 😍',
    timestamp: '2026-09-01T20:04:00-07:00',
    hasEmoji: true,
    emojiList: ['😍'],
    isQuestion: false,
  },
];

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL  ${message}`);
    failures += 1;
  } else {
    console.log(`  PASS  ${message}`);
  }
}

async function main() {
  console.log(`POSTing to ${API_URL}...\n`);

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: fakeMessages }),
    });
  } catch {
    console.error(`\nERROR: Could not reach ${API_URL}`);
    console.error('Make sure vercel dev is running: vercel dev\n');
    process.exit(1);
  }

  assert(response.ok, `Response status is 2xx (${response.status})`);

  const data = await response.json();

  // Check top-level keys
  assert('totalScore' in data, 'Response has totalScore');
  assert('signals' in data, 'Response has signals');
  assert('summary' in data, 'Response has summary');
  assert('disclaimer' in data, 'Response has disclaimer');

  // Check totalScore is a number
  assert(
    typeof data.totalScore === 'number',
    `totalScore is a number (got ${typeof data.totalScore})`
  );

  // Check disclaimer text matches exactly
  assert(
    data.disclaimer ===
      'For entertainment purposes only — not a scientifically validated measure of interest.',
    'disclaimer matches the exact expected string'
  );

  // Check signals object has all six keys
  const expectedSignals = [
    'replyTime',
    'emoji',
    'messageLengthRatio',
    'questionFrequency',
    'initiationRatio',
    'conversationalTone',
  ];

  for (const signal of expectedSignals) {
    assert(signal in data.signals, `signals has ${signal}`);
    assert(
      'score' in data.signals[signal],
      `signals.${signal} has score`
    );
    assert(
      'rawValue' in data.signals[signal],
      `signals.${signal} has rawValue`
    );
    assert(
      'label' in data.signals[signal],
      `signals.${signal} has label`
    );
  }

  // Check summary is a non-empty string
  assert(
    typeof data.summary === 'string' && data.summary.length > 0,
    'summary is a non-empty string'
  );

  console.log('');

  if (failures === 0) {
    console.log('All checks passed — /api/analyze stub matches Phase 0 schema.');
  } else {
    console.log(`${failures} check(s) FAILED.`);
    process.exit(1);
  }
}

main();
