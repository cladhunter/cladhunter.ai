import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import App from '../App';
import '../styles/globals.css';

const manifestUrl = (() => {
  const explicit = import.meta.env.VITE_TON_MANIFEST_URL;
  if (explicit) {
    return explicit;
  }

  const FALLBACK_MANIFEST = 'https://cladhunter.app/tonconnect-manifest.json';

  if (typeof window !== 'undefined') {
    try {
      const origin = window.location.origin;

      if (!origin || origin === 'null') {
        return FALLBACK_MANIFEST;
      }

      const hostname = new URL(origin).hostname;
      const isTelegramHost = /(?:appassets|web)\.telegram\.org$/.test(hostname);
      const isTelegramWebApp = Boolean(window.Telegram?.WebApp);

      if (isTelegramHost || isTelegramWebApp) {
        return FALLBACK_MANIFEST;
      }

      return `${origin.replace(/\/$/, '')}/tonconnect-manifest.json`;
    } catch (error) {
      console.error('Failed to resolve TON manifest URL from current location:', error);
    }
  }

  return FALLBACK_MANIFEST;
})();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
