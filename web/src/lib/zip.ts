/**
 * The effective ZIP for stock/nearby, decoupled from the account.
 *
 * The account ZIP (users.zip, mirrored as me.zip) is the source of truth for a
 * signed-in user. But in PUBLIC_PREVIEW the visitor is a synthetic user whose
 * /me always returns zip:null and whose PATCH /me/zip cannot persist — so the
 * "Closest to me" feed, which keyed only off me.zip, was permanently empty for
 * every anonymous visitor even after they typed a ZIP and pressed Save.
 *
 * This keeps the entered ZIP in localStorage so it survives with no account, and
 * a same-tab event lets the feed react the moment it changes (the native
 * 'storage' event only fires in OTHER tabs). Effective ZIP = me.zip ?? local.
 */

const KEY = 'zip';
const EVT = 'zip-changed';

export function getLocalZip(): string | null {
  try {
    const z = localStorage.getItem(KEY);
    return z && /^\d{5}$/.test(z) ? z : null;
  } catch {
    return null;
  }
}

export function setLocalZip(zip: string): void {
  try {
    if (/^\d{5}$/.test(zip)) localStorage.setItem(KEY, zip);
  } catch {
    /* private mode / storage disabled — the ZIP just won't persist */
  }
  window.dispatchEvent(new Event(EVT));
}

/** Subscribe to same-tab ZIP changes. Returns an unsubscribe fn. */
export function onZipChange(cb: () => void): () => void {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}
