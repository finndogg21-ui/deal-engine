/**
 * Meta Pixel — browser-side funnel events.
 *
 * Split of responsibility (deliberate):
 *   - BROWSER (this file): the funnel — PageView, ViewContent, CompleteRegistration,
 *     InitiateCheckout. These can afford to lose ~20-30% to iOS/ad-blockers.
 *   - SERVER (src/vendors/meta-capi.ts): the MONEY event — Purchase, fired from
 *     the Stripe subscription.created webhook. That one must never be lost, so it
 *     goes server-to-server, not through a browser that Safari may have gutted.
 *
 * Env-gated on VITE_META_PIXEL_ID. Unset (dev, or before the owner creates the
 * pixel) → every call here is a silent no-op. No console noise, no broken ad.
 *
 * Why this exists: the Meta AI ad creator optimizes toward whatever you report
 * as a conversion. With no signal it optimizes blind and burns budget on free
 * signups. CompleteRegistration + the server Purchase give it a real target.
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

let started = false;

/** Load the Meta Pixel once, on first app mount. No-op without a pixel id. */
export function initPixel(): void {
  if (started || !PIXEL_ID || typeof window === 'undefined') return;
  started = true;

  // Standard Meta bootstrap, inlined (no external snippet to trust).
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement; t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0]!;
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */

  window.fbq!('init', PIXEL_ID);
  window.fbq!('track', 'PageView');
}

/** Fire on client-side route changes (SPA — the pixel only auto-fires once). */
export function trackPageView(): void {
  if (!PIXEL_ID) return;
  window.fbq?.('track', 'PageView');
}

/** A visitor finished signup. The top-of-funnel conversion the ad optimizes to. */
export function trackSignup(): void {
  if (!PIXEL_ID) return;
  window.fbq?.('track', 'CompleteRegistration');
}

/** A visitor started Stripe checkout. Mid-funnel intent; the Purchase that
 *  follows is confirmed server-side, so this is not the money event. */
export function trackInitiateCheckout(valueUsd = 20): void {
  if (!PIXEL_ID) return;
  window.fbq?.('track', 'InitiateCheckout', { value: valueUsd, currency: 'USD' });
}
