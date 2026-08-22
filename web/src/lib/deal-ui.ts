/** Small display helpers shared by the Find page and the penny detail page. */

export const money = (n: number | null) => (n === null ? 'Unknown' : `$${n.toFixed(2)}`);

/** "5 hr ago". People judge freshness constantly on these screens. */
export function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * Append ?store=NNN to a homedepot.com URL so HD opens already in that store's
 * mode (header, pickup section, and stock state all switch — verified live
 * 2026-08-22). Non-HD URLs pass through untouched.
 */
export function hdStoreUrl(url: string | null, storeNumber: string | null): string | null {
  if (!url) return null;
  if (!storeNumber || !/homedepot\.com/i.test(url)) return url;
  return url + (url.includes('?') ? '&' : '?') + 'store=' + encodeURIComponent(storeNumber);
}

/**
 * Titleless source records arrive as "HD SKU <digits>" (ingest fallback).
 * A stranger reads that as broken; name it what it is instead.
 */
export function displayTitle(title: string): string {
  const m = title.match(/^(?:HD )?SKU (\S+)$/i);
  return m ? `Home Depot item #${m[1]}` : title;
}

/**
 * "CA,MO,NJ,FL,…" walls (Very Common pennies list 20+ states) drown the card.
 * Show the first three, count the rest; the full map lives on the detail page.
 */
export function statesLine(state: string | null): string | null {
  if (!state) return null;
  const parts = state.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 3) return parts.join(', ');
  return `${parts.slice(0, 3).join(', ')} +${parts.length - 3} more`;
}
