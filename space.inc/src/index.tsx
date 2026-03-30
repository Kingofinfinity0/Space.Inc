import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { initializeFetchLogger } from './utils/fetchLogger';
import { Analytics } from '@vercel/analytics/react';

import { BrowserRouter } from 'react-router-dom';

// TASK 2: Initialize global fetch logger to detect phantom requests
// This will log ALL fetch calls and highlight suspicious ones
initializeFetchLogger();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
          <Analytics />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
