// src/__tests__/uiSkeleton.test.jsx
//
// Component tests for the UI skeleton: Landing, DisclaimerBanner,
// ScoreGauge, and SignalBar.

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Landing from '../pages/Landing';
import ConversationInput from '../pages/ConversationInput';
import DisclaimerBanner from '../components/DisclaimerBanner';
import ScoreGauge from '../components/ScoreGauge';
import SignalBar from '../components/SignalBar';

const DISCLAIMER_TEXT =
  'For entertainment purposes only — not a scientifically validated measure of interest.';

describe('Landing route', () => {
  it('shows the exact disclaimer text', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Landing />
      </MemoryRouter>
    );

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });

  it('clicking Get Started navigates to /input', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/input" element={<ConversationInput />} />
        </Routes>
      </MemoryRouter>
    );

    // Click the Get Started button
    const getStartedButton = screen.getByRole('link', { name: /get started/i });
    await user.click(getStartedButton);

    // Wait for navigation and verify we're on /input
    await waitFor(() => {
      expect(screen.getByText(/paste your chat/i)).toBeInTheDocument();
    });
  });
});

describe('DisclaimerBanner', () => {
  it('renders the exact disclaimer text when standalone', () => {
    render(<DisclaimerBanner standalone />);

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });

  it('renders the exact disclaimer text in default mode', () => {
    render(<DisclaimerBanner />);

    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });
});

describe('ScoreGauge', () => {
  it('renders without crashing when score is 0', () => {
    render(<ScoreGauge score={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('out of 100')).toBeInTheDocument();
  });

  it('renders without crashing when score is 50', () => {
    render(<ScoreGauge score={50} />);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('out of 100')).toBeInTheDocument();
  });

  it('renders without crashing when score is 100', () => {
    render(<ScoreGauge score={100} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('out of 100')).toBeInTheDocument();
  });

  it('renders insufficient data message when score is null', () => {
    render(<ScoreGauge score={null} />);

    expect(screen.getByText(/insufficient/i)).toBeInTheDocument();
    expect(screen.getByText(/data/i)).toBeInTheDocument();
  });

  it('displays custom label when provided', () => {
    render(<ScoreGauge score={75} label="Interest Score" />);

    expect(screen.getByText('Interest Score')).toBeInTheDocument();
  });
});

describe('SignalBar', () => {
  it('renders the label prop text', () => {
    render(<SignalBar label="Reply speed" score={80} rawValue="Fast replies" />);

    expect(screen.getByText('Reply speed')).toBeInTheDocument();
  });

  it('renders the rawValue prop text', () => {
    render(<SignalBar label="Reply speed" score={80} rawValue="Fast replies" />);

    expect(screen.getByText('Fast replies')).toBeInTheDocument();
  });

  it('renders score as N/A when null', () => {
    render(<SignalBar label="Emoji use" score={null} rawValue="No data" />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('renders numeric score when provided', () => {
    render(<SignalBar label="Emoji use" score={65} rawValue="Good" />);

    expect(screen.getByText('65/100')).toBeInTheDocument();
  });
});
