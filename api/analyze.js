// api/analyze.js
//
// Vercel serverless function that accepts a POST body with a messages array
// and returns a hardcoded fake response matching the JSON schema from SCORING_SPEC.md.
// This is a stub — the real implementation will call the OpenAI API.
//
// Endpoint: POST /api/analyze
// Request body: { messages: [...] }
// Response: JSON matching InterestScore schema

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    // Validate input
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required and must not be empty' });
    }

    // Stub: return a hardcoded fake response
    const fakeResponse = {
      totalScore: 72,
      signals: {
        replyTime: {
          score: 85,
          rawValue: 'Them replied within 2-5 minutes consistently throughout the conversation.',
          label: 'Reply speed',
        },
        emoji: {
          score: 60,
          rawValue: 'Moderate emoji use with some flirty ones (hearts, winks) mixed in.',
          label: 'Emoji use',
        },
        messageLengthRatio: {
          score: 70,
          rawValue: 'Their messages average about 1.5x longer than yours, showing engagement.',
          label: 'Message length vs. yours',
        },
        questionFrequency: {
          score: 65,
          rawValue: 'About 1 in 4 of their messages are questions, showing interest in your life.',
          label: 'Questions they ask',
        },
        initiationRatio: {
          score: 55,
          rawValue: 'They initiated about half of the conversation threads.',
          label: 'Who starts conversations',
        },
        conversationalTone: {
          score: 80,
          rawValue: 'Warm, playful tone with compliments and teasing — definitely flirtatious.',
          label: 'Conversational tone',
        },
      },
      summary:
        "They seem genuinely interested and engaged — fast replies, real questions, and a flirty vibe. This looks promising!",
      disclaimer:
        'For entertainment purposes only — not a scientifically validated measure of interest.',
    };

    return res.status(200).json(fakeResponse);
  } catch (error) {
    console.error('Error in /api/analyze:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
