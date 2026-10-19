import { useEffect, useState } from 'react';
import type { MainTab } from '../types';

export const TAB_TO_PATH: Record<MainTab, string> = {
  Home: '/home',
  Dashboard: '/dash',
  Exchange: '/exchange',
  Wallet: '/wallet',
  CordScan: '/scan',
  Guide: '/guide',
  Manage: '/manage',
  Leaderboard: '/leaderboard',
  Portfolio: '/portfolio',
  Settings: '/settings',
};

const PATH_TO_TAB: Record<string, MainTab> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab]),
) as Record<string, MainTab>;

export const PUBLIC_TABS: MainTab[] = ['Home', 'CordScan', 'Guide'];
export const DEFAULT_TAB: MainTab = 'Home';
export const APP_HOME_TAB: MainTab = 'Dashboard';

// Legacy /login bookmarks resolve to the app home (no separate login page).
const LEGACY_PATHS: Record<string, string> = { '/login': '/home' };

const listeners = new Set<() => void>();

export function normalizePath(raw: string): string {
  let clean = ('/' + raw).replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
  if (LEGACY_PATHS[clean]) clean = LEGACY_PATHS[clean];
  if (clean === '/') return TAB_TO_PATH[DEFAULT_TAB];
  return PATH_TO_TAB[clean] ? clean : TAB_TO_PATH[DEFAULT_TAB];
}

export function pathToTab(raw: string): MainTab {
  return PATH_TO_TAB[normalizePath(raw)] ?? DEFAULT_TAB;
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = normalizePath(path);
  if (target === normalizePath(window.location.pathname)) return;
  if (opts.replace) {
    window.history.replaceState(null, '', target);
  } else {
    window.history.pushState(null, '', target);
  }
  listeners.forEach((listener) => listener());
}

export function useRoute(): MainTab {
  const [tab, setTab] = useState<MainTab>(() => pathToTab(window.location.pathname));
  useEffect(() => {
    const update = () => {
      // Preserve search and hash params; never wipe OAuth callback params (?code=... or #access_token=...)
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const resolved = pathToTab(window.location.pathname);

      if (search.includes('code=') || hash.includes('access_token=')) {
        setTab(resolved);
        return;
      }

      if (window.location.pathname !== TAB_TO_PATH[resolved]) {
        window.history.replaceState(null, '', TAB_TO_PATH[resolved] + search + hash);
      }
      setTab(resolved);
    };
    update();
    window.addEventListener('popstate', update);
    listeners.add(update);
    return () => {
      window.removeEventListener('popstate', update);
      listeners.delete(update);
    };
  }, []);
  return tab;
}
