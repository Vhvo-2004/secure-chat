import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SecureChatProvider } from './contexts/SecureChatContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SecureChatProvider>
      <App />
    </SecureChatProvider>
  </StrictMode>,
);
