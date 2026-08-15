/**
 * Onboarding answers.
 *
 * Stored locally for now. There is no accounts table yet, so this is honest
 * about being device-local rather than pretending to sync. When auth lands,
 * this module is the one place that changes.
 */

export type Path = 'consumer' | 'reseller';

export interface Setup {
  path: Path;
  zip: string;
  radiusMi: number;
  /** Consumer: products they want. Reseller: categories they flip. */
  watches: string[];
  alertsPerDay: number;
  quietHours: boolean;
  /** Reseller only — seeing verified finds requires contributing them. */
  willReport?: boolean;
  completedAt: string;
}

const KEY = 'setup';

export function readSetup(): Setup | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Setup) : null;
  } catch {
    return null;
  }
}

export function saveSetup(s: Setup) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSetup() {
  localStorage.removeItem(KEY);
}

/** Starting points so nobody faces an empty box. */
export const SUGGESTED_CONSUMER = [
  'Blender', 'Cordless drill', 'Air fryer', 'Vacuum',
  'Patio furniture', 'Space heater', 'Coffee maker', 'TV',
];

export const SUGGESTED_RESELLER = [
  'Power tools', 'Outdoor & garden', 'Appliances', 'Smart home',
  'Lighting', 'Plumbing', 'Storage', 'Seasonal',
];
