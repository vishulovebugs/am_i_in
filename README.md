# Am I In?

A web app that analyzes a chat conversation you paste in and produces a fun, heuristic "interest score" to answer the eternal question: _are they into me?_

## What It Does

Paste a conversation (from iMessage, WhatsApp, Instagram, etc.) and the app will analyze it for signals of romantic interest — reply speed, emoji usage, message length, question frequency, conversation initiation, and overall tone.

## How It Works

1. **You paste your conversation** — the app processes only text you manually provide. There is no scraping, no automated pulling from any app, no monitoring of messages.
2. **An LLM analyzes the conversation** — a server-side proxy sends your pasted text to an AI model for analysis (your API key never reaches the browser).
3. **You get a fun score** — a breakdown of six signals plus an overall "interest score" with a plain-language summary.

## Important Disclaimer

**For entertainment purposes only — not a scientifically validated measure of interest.**

This app is a fun thought experiment, not a relationship advisor. Real human interest is complex, contextual, and can't be reduced to a number. Use the score as a lighthearted conversation starter with friends, not as a basis for life decisions.

## Privacy

- **No data is stored.** Your conversation text is sent to the AI API for analysis and immediately discarded.
- **No scraping.** The app only processes text you manually paste in. It never connects to any messaging app or service.
- **API key stays secret.** The OpenAI API key is kept server-side only (in a Vercel serverless function) and never exposed to the browser.

## Tech Stack

- React (Vite)
- Vercel Serverless Functions
- OpenAI API (via server-side proxy)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local and add your OPENAI_API_KEY

# Start development server
npm run dev

# Start Vercel dev server (includes /api/analyze)
npx vercel dev
```

## Scripts

- `npm run dev` — Start Vite dev server
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
- `npm run format` — Run Prettier
