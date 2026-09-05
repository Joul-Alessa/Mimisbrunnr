import { useEffect, useState } from 'react';

const STORAGE_KEY = 'mimisbrunnr-theme';

// 'system' leaves color-scheme resolution to the OS/browser (prefers-color-scheme);
// 'light'/'dark' force it via a data-theme attribute that index.css matches.
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable (private mode, etc.) — theme just won't persist.
    }
  }, [theme]);

  return [theme, setTheme];
}
