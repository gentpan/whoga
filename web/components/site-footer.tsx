import { useLocation } from "@tanstack/react-router";
import { Menu } from "@base-ui/react/menu";
import { Check, Languages, Palette } from "lucide-react";
import { GitHubBrandIcon, XBrandIcon } from "@/web/components/brand-icons";
import { SITE_COPY, type SiteLocale } from "@/web/lib/site-copy";
import { THEME_IDS, useTheme, type Theme } from "@/web/lib/use-theme";

interface SiteFooterProps {
  locale: SiteLocale;
  onLocaleChange: (locale: SiteLocale) => void;
}

function learnLocaleFromPath(pathname: string): SiteLocale | null {
  if (pathname === "/learn/en" || pathname.startsWith("/learn/en/")) {
    return "en";
  }
  if (pathname === "/learn" || pathname.startsWith("/learn/")) {
    return "zh";
  }
  return null;
}

function learnPathForLocale(pathname: string, locale: SiteLocale): string | null {
  if (locale === "en") {
    if (pathname === "/learn") {
      return "/learn/en";
    }
    if (pathname.startsWith("/learn/") && !pathname.startsWith("/learn/en")) {
      return `/learn/en${pathname.slice("/learn".length)}`;
    }
    return null;
  }

  if (pathname === "/learn/en") {
    return "/learn";
  }
  if (pathname.startsWith("/learn/en/")) {
    return `/learn${pathname.slice("/learn/en".length)}`;
  }
  return null;
}

export function SiteFooter({ locale, onLocaleChange }: SiteFooterProps) {
  const { pathname } = useLocation();
  const learnLocale = learnLocaleFromPath(pathname);
  const menuLocale = learnLocale ?? locale;
  const t = SITE_COPY[locale];
  const [theme, setTheme] = useTheme();

  const themeLabels: Record<Theme, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    terminal: t.themeTerminal
  };

  function handleLocaleSelect(next: SiteLocale) {
    const learnTarget = learnPathForLocale(pathname, next);
    if (learnTarget) {
      window.location.assign(learnTarget);
      return;
    }
    onLocaleChange(next);
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-bottom">
          <div className="footer-copyright">
            <p>{t.copyright}</p>
          </div>
          <div className="footer-controls">
            <Menu.Root>
              <Menu.Trigger className="footer-control squircle" aria-label="Language">
                <Languages aria-hidden size={14} strokeWidth={1.8} />
                <img
                  className="lang-flag"
                  src={menuLocale === "zh" ? "/flags/cn.svg" : "/flags/us.svg"}
                  alt=""
                  width={18}
                  height={14}
                  decoding="async"
                />
                <span>{menuLocale === "zh" ? "中文" : "English"}</span>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="lang-menu-positioner" side="top" sideOffset={8}>
                  <Menu.Popup className="lang-menu squircle" aria-label="Language options">
                    <Menu.Item
                      className={`lang-option squircle ${menuLocale === "zh" ? "active" : ""}`}
                      onClick={() => {
                        handleLocaleSelect("zh");
                      }}
                    >
                      <img
                        className="lang-flag"
                        src="/flags/cn.svg"
                        alt=""
                        width={18}
                        height={14}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="lang-option-label">中文</span>
                      {menuLocale === "zh" ? (
                        <Check className="lang-option-check" aria-hidden size={14} strokeWidth={2.4} />
                      ) : null}
                    </Menu.Item>
                    <Menu.Item
                      className={`lang-option squircle ${menuLocale === "en" ? "active" : ""}`}
                      onClick={() => {
                        handleLocaleSelect("en");
                      }}
                    >
                      <img
                        className="lang-flag"
                        src="/flags/us.svg"
                        alt=""
                        width={18}
                        height={14}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="lang-option-label">English</span>
                      {menuLocale === "en" ? (
                        <Check className="lang-option-check" aria-hidden size={14} strokeWidth={2.4} />
                      ) : null}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger className="footer-control squircle" aria-label={t.themeMenuLabel}>
                <Palette aria-hidden size={14} strokeWidth={1.8} />
                <span>{themeLabels[theme]}</span>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="lang-menu-positioner" side="top" sideOffset={8}>
                  <Menu.Popup className="lang-menu squircle" aria-label={t.themeMenuLabel}>
                    {THEME_IDS.map((themeId) => (
                      <Menu.Item
                        key={themeId}
                        className={`lang-option squircle ${theme === themeId ? "active" : ""}`}
                        onClick={() => {
                          setTheme(themeId);
                        }}
                      >
                        <span className="theme-swatch" data-swatch={themeId} aria-hidden />
                        <span className="lang-option-label">{themeLabels[themeId]}</span>
                        {theme === themeId ? (
                          <Check className="lang-option-check" aria-hidden size={14} strokeWidth={2.4} />
                        ) : null}
                      </Menu.Item>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
          <div className="footer-social">
            <a
              className="footer-social-link squircle"
              href="https://x.com/gentpan"
              target="_blank"
              rel="noreferrer"
              aria-label="X"
              title="X"
            >
              <XBrandIcon />
            </a>
            <a
              className="footer-social-link squircle"
              href="https://github.com/gentpan"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              title="GitHub"
            >
              <GitHubBrandIcon />
            </a>
            <a
              href="https://giantaccel.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Powered by GiantAccel"
              title="Powered by GiantAccel"
              data-tooltip="Powered by GiantAccel"
              className="footer-giantaccel footer-social-link squircle"
            >
              <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M512 851.456c187.904 0 340.992-152.064 343.04-339.456h-145.408c-2.048 107.52-89.6 194.048-197.632 194.048S316.416 619.52 314.368 512H168.96c2.048 187.392 155.136 339.456 343.04 339.456zM550.912 216.064H855.04v145.408h-304.128z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
