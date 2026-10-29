/**
 * In-App Browser Detector & Escaper
 * Resolves the Google Sign-In `disallowed_useragent` issue on Messenger, Instagram, TikTok, Telegram.
 */

export function detectInAppBrowser() {
  if (typeof window === 'undefined') return { isInApp: false, isAndroid: false, isIOS: false, appName: null };

  const ua = navigator.userAgent || navigator.vendor || window.opera || '';

  const isAndroid = /android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  // Specific App Detectors
  const isFB = /FBAN|FBAV/i.test(ua);
  const isMessenger = /FB_IAB|FBAN\/Messenger/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isTelegram = /Telegram/i.test(ua);
  const isTikTok = /musical_ly|ByteDance|TikTok/i.test(ua);
  const isTwitter = /Twitter/i.test(ua);
  const isLine = /Line\//i.test(ua);
  const isWeChat = /MicroMessenger/i.test(ua);

  const isInApp = isFB || isMessenger || isInstagram || isTelegram || isTikTok || isTwitter || isLine || isWeChat;

  let appName = null;
  if (isMessenger) appName = 'Messenger';
  else if (isInstagram) appName = 'Instagram';
  else if (isTelegram) appName = 'Telegram';
  else if (isTikTok) appName = 'TikTok';
  else if (isFB) appName = 'Facebook';
  else if (isLine) appName = 'Line';
  else if (isInApp) appName = 'In-App Browser';

  return {
    isInApp,
    isAndroid,
    isIOS,
    appName
  };
}

export function getChromeIntentUrl(targetUrl) {
  if (typeof window === 'undefined') return targetUrl;
  const url = targetUrl || window.location.href;
  const noScheme = url.replace(/^https?:\/\//i, '');
  // Chrome Android intent with fallback
  return `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;end`;
}

export function escapeToExternalBrowser(targetUrl) {
  if (typeof window === 'undefined') return;
  const { isInApp, isAndroid, isIOS } = detectInAppBrowser();
  if (!isInApp) return;

  // Mobile keeps the explicit CTA so Messenger does not show an unexpected
  // external-app confirmation while the page is loading.
  if (isAndroid || isIOS) return;

  // Desktop in-app browsers can open a normal new tab without the Android
  // intent dialog. The session flag prevents a popup/new-tab loop.
  try {
    if (window.sessionStorage.getItem('smartshop-desktop-browser-opened') === '1') return;
    window.sessionStorage.setItem('smartshop-desktop-browser-opened', '1');
    const url = targetUrl || window.location.href;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.sessionStorage.removeItem('smartshop-desktop-browser-opened');
  } catch (e) {
    // The page remains usable and the visible browser CTA is the fallback.
  }
}
