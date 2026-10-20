import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "terminal";

export const THEME_IDS: readonly Theme[] = ["light", "dark", "terminal"];

const STORAGE_KEY = "theme";
const DEFAULT_THEME: Theme = "light";
export const THEME_CHANGE_EVENT = "who-ga-theme-change";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "terminal";
}

function systemTheme(): Theme {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return DEFAULT_THEME;
}

export function readTheme(): Theme {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const fromDom = document.documentElement.dataset.theme;
  if (isTheme(fromDom)) {
    return fromDom;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : systemTheme();
}

export function writeTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setThemeState(readTheme());

    function syncTheme() {
      setThemeState(readTheme());
    }

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    writeTheme(next);
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}
