/**
 * Telegram Web App utilities
 * Helps detect and optimize for Telegram Mini App environment
 */

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (text: string) => void;
    onClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  viewportHeight: number;
  viewportStableHeight: number;
  isExpanded: boolean;
  headerColor: string;
  backgroundColor: string;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

/**
 * Check if app is running inside Telegram Web App
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp;
}

/**
 * Get Telegram WebApp instance
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (!isTelegramWebApp()) return null;
  return window.Telegram!.WebApp;
}

/**
 * Initialize Telegram Web App
 * Call this on app mount
 */
export function initTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  // Notify Telegram that the app is ready
  webApp.ready();

  // Expand to full height
  webApp.expand();

  // Set theme colors to match app
  webApp.setHeaderColor('#0A0A0A');
  webApp.setBackgroundColor('#0A0A0A');

  console.log('Telegram Web App initialized', {
    isExpanded: webApp.isExpanded,
    viewportHeight: webApp.viewportHeight,
    viewportStableHeight: webApp.viewportStableHeight,
  });
}

/**
 * Trigger haptic feedback (vibration)
 */
export function hapticFeedback(
  type: 'impact' | 'notification' | 'selection',
  style?: 'light' | 'medium' | 'heavy' | 'error' | 'success' | 'warning'
) {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  try {
    if (type === 'impact') {
      webApp.HapticFeedback.impactOccurred(
        (style as 'light' | 'medium' | 'heavy') || 'medium'
      );
    } else if (type === 'notification') {
      webApp.HapticFeedback.notificationOccurred(
        (style as 'error' | 'success' | 'warning') || 'success'
      );
    } else if (type === 'selection') {
      webApp.HapticFeedback.selectionChanged();
    }
  } catch (error) {
    console.warn('Haptic feedback not available:', error);
  }
}

/**
 * Get safe viewport height for mobile
 */
export function getSafeViewportHeight(): number {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    return webApp.viewportStableHeight || webApp.viewportHeight;
  }
  
  // Fallback to window height
  return window.innerHeight;
}

/**
 * Open link externally (in browser, not in Telegram)
 */
export function openExternalLink(url: string) {
  const webApp = getTelegramWebApp();
  
  if (webApp) {
    // Use Telegram's method to open external links
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    // Standard web browser
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Close Telegram Mini App
 */
export function closeTelegramWebApp() {
  const webApp = getTelegramWebApp();
  if (webApp) {
    webApp.close();
  }
}
