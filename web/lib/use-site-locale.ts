import { useCallback, useEffect, useState } from "react";
import type { SiteLocale } from "@/web/lib/site-copy";

const STORAGE_KEY = "who-ga-locale";
export const SITE_LOCALE_EVENT = "who-ga-locale-change";

export function readSiteLocale(): SiteLocale {
  if (typeof window === "undefined") {
    return "zh";
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "zh";
}

export function writeSiteLocale(locale: SiteLocale): void {
  window.localStorage.setItem(STORAGE_KEY, locale);
  window.dispatchEvent(new Event(SITE_LOCALE_EVENT));
}

export function useSiteLocale(): [SiteLocale, (locale: SiteLocale) => void] {
  const [locale, setLocaleState] = useState<SiteLocale>("zh");

  useEffect(() => {
    setLocaleState(readSiteLocale());

    function syncLocale() {
      setLocaleState(readSiteLocale());
    }

    window.addEventListener(SITE_LOCALE_EVENT, syncLocale);
    window.addEventListener("storage", syncLocale);
    return () => {
      window.removeEventListener(SITE_LOCALE_EVENT, syncLocale);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  const setLocale = useCallback((next: SiteLocale) => {
    writeSiteLocale(next);
    setLocaleState(next);
  }, []);

  return [locale, setLocale];
}
