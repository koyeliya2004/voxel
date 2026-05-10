/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

window.addEventListener('error', (event) => {
  console.error('GLOBAL ERROR CAUGHT:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  let message = 'Unknown rejection';
  try {
    message = reason instanceof Error ? reason.message : (typeof reason === 'object' ? JSON.stringify(reason) : String(reason));
  } catch (e) {
    message = 'Unserializable rejection';
  }
  console.error('UNHANDLED PROMISE REJECTION:', message, reason);
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);