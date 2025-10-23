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

  if (typeof window !== 'undefined') {
    try {
      return new URL('tonconnect-manifest.json', window.location.href).toString();
    } catch (error) {
      console.error('Failed to resolve TON manifest URL from current location:', error);
    }
  }

  return 'https://cladhunter.app/tonconnect-manifest.json';
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
