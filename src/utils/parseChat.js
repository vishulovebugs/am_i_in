// src/utils/parseChat.js
//
// Pure function to parse raw pasted chat text into a ChatMessage array.
// Supports "alternating sender" mode (default) and "marked" mode ("Me:" / "Them:" prefixes).
//
// No DOM or side effects — fully unit-testable.

// ============================================
// Constants
// ============================================

const MAX_MESSAGES = 500;
const MAX_TOTAL_CHARS = 50000;
const MAX_PER_MESSAGE_CHARS = 2000;

const QUESTION_STARTERS = [
  'are', 'is', 'am', 'do', 'does', 'did', 'will', 'would',
  'can', 'could', 'should', 'have', 'has', 'was', 'were',
  'what', 'why', 'how', 'who', 'whom', 'when', 'where', 'which',
  'wanna', 'want',
];

// Simple emoji detection using Unicode property escapes
// This covers most common emoji without requiring a library
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?/gu;

// Timestamp patterns (ISO 8601 and common formats)
const TIMESTAMP_PATTERNS = [
  // ISO 8601 with timezone
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/,
  // Common chat formats: "Today, 2:14 PM" or "Yesterday, 10:30 AM"
  /(?:Today|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+\d{1,2}:\d{2}\s*(?:AM|PM)/i,
  // Date + time: "09/01/2026 2:14 PM" or "2026-09-01 14:14"
  /\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?/i,
  // Time only: "14:14" or "2:14 PM"
  /\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM))?/i,
];

// Marked mode patterns: "Me: ...", "Them: ...", "You: ...", etc.
const MARKED_SENDER_PATTERNS = [
  { regex: /^(?:Me|You|User|User1|Person1|A)\s*[:-]/i, sender: 'user' },
  { regex: /^(?:Them|Other|User2|Person2|B)\s*[:-]/i, sender: 'them' },
];

// ============================================
// Helper functions
// ============================================

/**
 * Generate a unique message ID.
 */
function generateId(index) {
  return `m${index + 1}`;
}

/**
 * Check if text is a question.
 */
function isQuestion(text) {
  const trimmed = text.trim();

  // Contains question mark
  if (trimmed.includes('?')) {
    return true;
  }

  // Starts with a question-starter word
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (QUESTION_STARTERS.includes(firstWord) && trimmed.length >= 4) {
    return true;
  }

  return false;
}

/**
 * Extract emoji from text.
 */
function extractEmoji(text) {
  const matches = text.match(EMOJI_REGEX) || [];
  return matches;
}

/**
 * Attempt to parse a timestamp from text.
 * Returns ISO 8601 string or null.
 */
function parseTimestamp(text) {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const date = new Date(match[0]);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }
  return null;
}

/**
 * Strip timestamp and sender prefix from a line, returning clean message text.
 */
function cleanLine(line, senderPattern) {
  let cleaned = line;

  // Remove timestamp if present
  for (const pattern of TIMESTAMP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // Remove sender prefix if marked mode
  if (senderPattern) {
    cleaned = cleaned.replace(senderPattern.regex, '').trim();
  }

  return cleaned;
}

/**
 * Split raw text into lines, filtering out empty lines.
 */
function splitIntoLines(rawText) {
  return rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// ============================================
// Parse modes
// ============================================

/**
 * Parse in "alternating sender" mode.
 * Assumes messages alternate between user and them.
 * The first message is assumed to be from "user" unless it starts with a known sender prefix.
 */
function parseAlternating(lines) {
  const messages = [];
  let currentSender = 'user';

  for (const line of lines) {
    const timestamp = parseTimestamp(line);
    const text = cleanLine(line, null);

    if (text.length === 0) continue;

    messages.push({
      id: generateId(messages.length),
      sender: currentSender,
      text,
      timestamp,
      hasEmoji: extractEmoji(text).length > 0,
      emojiList: extractEmoji(text),
      isQuestion: isQuestion(text),
    });

    // Alternate sender
    currentSender = currentSender === 'user' ? 'them' : 'user';
  }

  return messages;
}

/**
 * Parse in "marked sender" mode.
 * Looks for "Me:", "Them:", "You:", "Other:" prefixes.
 */
function parseMarked(lines) {
  const messages = [];

  for (const line of lines) {
    const timestamp = parseTimestamp(line);

    // Try to match a sender pattern
    let sender = null;
    let text = line;

    for (const pattern of MARKED_SENDER_PATTERNS) {
      if (pattern.regex.test(line)) {
        sender = pattern.sender;
        text = cleanLine(line, pattern);
        break;
      }
    }

    // Skip lines without a valid sender prefix
    if (!sender) continue;

    if (text.length === 0) continue;

    messages.push({
      id: generateId(messages.length),
      sender,
      text,
      timestamp,
      hasEmoji: extractEmoji(text).length > 0,
      emojiList: extractEmoji(text),
      isQuestion: isQuestion(text),
    });
  }

  return messages;
}

// ============================================
// Validation
// ============================================

/**
 * Validate the parsed message array against guardrails.
 * Returns { valid: boolean, error?: string, messages?: ChatMessage[] }
 */
function validateMessages(messages) {
  // Check max message count
  if (messages.length > MAX_MESSAGES) {
    return {
      valid: false,
      error: `Conversation too long (${messages.length} messages). Maximum is ${MAX_MESSAGES}. Please trim your conversation and try again.`,
    };
  }

  // Check max total characters
  const totalChars = messages.reduce((sum, msg) => sum + msg.text.length, 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    return {
      valid: false,
      error: `Conversation too long (${totalChars.toLocaleString()} characters). Maximum is ${MAX_TOTAL_CHARS.toLocaleString()}. Please trim your conversation and try again.`,
    };
  }

  // Truncate per-message if needed (silently, as per guardrails)
  const truncated = messages.map(msg => {
    if (msg.text.length > MAX_PER_MESSAGE_CHARS) {
      return {
        ...msg,
        text: msg.text.slice(0, MAX_PER_MESSAGE_CHARS) + '…',
      };
    }
    return msg;
  });

  return { valid: true, messages: truncated };
}

// ============================================
// Main function
// ============================================

/**
 * Parse raw pasted chat text into a ChatMessage array.
 *
 * @param {string} rawText - The raw pasted text from the user
 * @param {Object} options - Parsing options
 * @param {'alternating' | 'marked'} options.mode - Parse mode (default: 'alternating')
 * @returns {{ messages: ChatMessage[], error?: string }} - Parsed messages or error
 */
export function parseChatText(rawText, options = {}) {
  const { mode = 'alternating' } = options;

  // Split into lines
  const lines = splitIntoLines(rawText);

  if (lines.length === 0) {
    return { messages: [], error: 'No messages found in the pasted text.' };
  }

  // Parse based on mode
  let messages;
  if (mode === 'marked') {
    messages = parseMarked(lines);
    if (messages.length === 0) {
      return {
        messages: [],
        error: 'No messages with valid sender prefixes found. Use "Me:" or "Them:" at the start of each line.',
      };
    }
  } else {
    messages = parseAlternating(lines);
  }

  // Validate against guardrails
  const validation = validateMessages(messages);
  if (!validation.valid) {
    return { messages: [], error: validation.error };
  }

  return { messages: validation.messages };
}

/**
 * Create a single message manually.
 *
 * @param {string} text - Message text
 * @param {'user' | 'them'} sender - Message sender
 * @param {number} index - Message index for ID generation
 * @returns {ChatMessage}
 */
export function createMessage(text, sender, index = 0) {
  const emojiList = extractEmoji(text);
  return {
    id: generateId(index),
    sender,
    text,
    timestamp: null,
    hasEmoji: emojiList.length > 0,
    emojiList,
    isQuestion: isQuestion(text),
  };
}

/**
 * Re-generate IDs for a message array (after edits/deletes).
 *
 * @param {ChatMessage[]} messages
 * @returns {ChatMessage[]}
 */
export function reindexMessages(messages) {
  return messages.map((msg, i) => ({
    ...msg,
    id: generateId(i),
  }));
}

// Export constants for testing
export const GUARDRAILS = {
  MAX_MESSAGES,
  MAX_TOTAL_CHARS,
  MAX_PER_MESSAGE_CHARS,
};
