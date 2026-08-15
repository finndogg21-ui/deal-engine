/**
 * Theme: system by default, with an explicit override the user can set.
 *
 * Three states, not two. "system" stamps nothing and lets prefers-color-scheme
 * decide; "light"/"dark" stamp data-theme on <html> so the choice wins in both
 * directions. Read once on load so there is no flash of the wrong theme.
 */

import { useEffect, useState, useCallback } from 'react';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'theme';

function read(): Theme {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function apply(t: Theme) {
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

/** Whether the page is currently rendering dark, whatever the source. */
export function isDark(t: Theme): boolean {
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === 'undefined' ? 'system' : read()));

  useEffect(() => {
    apply(theme);
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  }, [theme]);

  // Toggle flips to the opposite of what is currently on screen, which is what
  // a person means when they press it, even if they are on "system".
  const toggle = useCallback(() => {
    setTheme((current) => (isDark(current) ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}
