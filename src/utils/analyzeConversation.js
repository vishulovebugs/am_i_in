// src/utils/analyzeConversation.js
//
// Thin async wrapper that POSTs messages to /api/analyze and returns
// the parsed result, with typed error handling.

// ============================================
// Error types
// ============================================

export const AnalysisError = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  SERVER: 'server',
  UNKNOWN: 'unknown',
};

// ============================================
// Main function
// ============================================

/**
 * Send messages to the scoring API and return the result.
 *
 * @param {Array} messages - Array of ChatMessage objects
 * @returns {Promise<{ success: boolean, data?: object, error?: { type: string, message: string } }>}
 */
export async function analyzeConversation(messages) {
  // Client-side validation
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      success: false,
      error: {
        type: AnalysisError.VALIDATION,
        message: 'No messages to analyze.',
      },
    };
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    // Handle rate limit
    if (response.status === 429) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          type: AnalysisError.RATE_LIMIT,
          message: data.error || 'Too many requests — please wait a moment and try again.',
        },
      };
    }

    // Handle other errors
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: {
          type: AnalysisError.SERVER,
          message: data.error || `Server error (${response.status})`,
        },
      };
    }

    // Parse response
    const result = await response.json();

    // Validate basic structure
    if (!result || typeof result !== 'object' || !('totalScore' in result)) {
      return {
        success: false,
        error: {
          type: AnalysisError.VALIDATION,
          message: 'Invalid response from server.',
        },
      };
    }

    return { success: true, data: result };
  } catch (err) {
    // Handle network/timeout errors
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      return {
        success: false,
        error: {
          type: AnalysisError.NETWORK,
          message: "Couldn't reach the AI service — please check your connection and try again.",
        },
      };
    }

    if (err.name === 'AbortError' || err.message?.includes('timeout')) {
      return {
        success: false,
        error: {
          type: AnalysisError.TIMEOUT,
          message: 'The request took too long — try a shorter conversation.',
        },
      };
    }

    // Unknown error
    console.error('[analyzeConversation] Unexpected error:', err);
    return {
      success: false,
      error: {
        type: AnalysisError.UNKNOWN,
        message: 'Something went wrong — please try again.',
      },
    };
  }
}
