import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

// Estilo global básico
const globalStyle = document.createElement('style');
globalStyle.textContent = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background-color: #f8f9fa;
  }
  
  * {
    box-sizing: border-box;
  }
  
  input, button {
    font-family: inherit;
  }
  
  button:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  button:disabled {
    cursor: not-allowed;
  }
`;
document.head.appendChild(globalStyle);

createRoot(document.getElementById('root')!).render(<App />);
