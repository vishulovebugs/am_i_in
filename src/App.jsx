// src/App.jsx
//
// Main app component with React Router and global layout.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import DisclaimerBanner from './components/DisclaimerBanner';
import Landing from './pages/Landing';
import ConversationInput from './pages/ConversationInput';
import Results from './pages/Results';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        {/* Global disclaimer banner visible on all screens */}
        <div className="disclaimer-wrapper">
          <DisclaimerBanner />
        </div>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/input" element={<ConversationInput />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
