import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import App from '../App';
import '../styles/globals.css';

const manifestUrl = new URL('/tonconnect-manifest.json', window.location.origin).toString();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <App />
      </ThemeProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
