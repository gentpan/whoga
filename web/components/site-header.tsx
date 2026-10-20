import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu } from "@base-ui/react/menu";
import {
  BarChart3,
  BookOpen,
  Check,
  Code2,
  Database,
  HandHelping,
  Info,
  Languages,
  Palette,
  Zap
} from "lucide-react";
import { SITE_COPY, type SiteLocale } from "@/web/lib/site-copy";
import { THEME_IDS, useTheme, type Theme } from "@/web/lib/use-theme";

interface SiteHeaderProps {
  locale: SiteLocale;
  onLocaleChange: (locale: SiteLocale) => void;
  activeNav?: string;
  onSectionClick?: (sectionId: string, navKey: string) => void;
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

export function SiteHeader({ locale, onLocaleChange, activeNav, onSectionClick }: SiteHeaderProps) {
  const navigate = useNavigate();
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

  const resolvedActiveNav =
    activeNav ??
    (pathname.startsWith("/learn")
      ? "learn"
      : pathname.startsWith("/requests")
        ? "requests"
        : pathname === "/"
          ? "home"
          : "");

  function handleSectionClick(sectionId: string, navKey: string) {
    if (onSectionClick) {
      onSectionClick(sectionId, navKey);
      return;
    }
    if (pathname === "/") {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    void navigate({ to: "/", hash: sectionId });
  }

  function handleLocaleSelect(next: SiteLocale) {
    const learnTarget = learnPathForLocale(pathname, next);
    if (learnTarget) {
      window.location.assign(learnTarget);
      return;
    }
    onLocaleChange(next);
  }

  return (
    <nav className="site-nav-bar" aria-label="Primary">
      <div className="nav-pill squircle">
        <div className="nav-row">
          <Link
            to="/"
            className={`nav-avatar ${resolvedActiveNav === "home" ? "active" : ""}`}
            aria-label="WHO.GA"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img
              className="nav-avatar-img squircle"
              src="/logo.svg"
              alt=""
              width={28}
              height={28}
              decoding="async"
            />
          </Link>

          <div className="nav-main-links">
            <button
              type="button"
              className={`nav-link squircle ${resolvedActiveNav === "stats" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-stats", "stats")}
            >
              <BarChart3 className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navStats}</span>
            </button>
            <button
              type="button"
              className={`nav-link squircle ${resolvedActiveNav === "api" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-api", "api")}
            >
              <Code2 className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navApi}</span>
            </button>
            <button
              type="button"
              className={`nav-link squircle ${resolvedActiveNav === "tlds" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-tlds", "tlds")}
            >
              <Database className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navTlds}</span>
            </button>
            <button
              type="button"
              className={`nav-link squircle ${resolvedActiveNav === "faq" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-faq", "faq")}
            >
              <Info className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navFaq}</span>
            </button>
            <Link
              to="/learn"
              className={`nav-link plain-link squircle ${resolvedActiveNav === "learn" ? "active" : ""}`}
            >
              <BookOpen className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navLearn}</span>
            </Link>
            <Link
              to="/requests"
              className={`nav-link plain-link squircle ${resolvedActiveNav === "requests" ? "active" : ""}`}
            >
              <HandHelping className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navRequests}</span>
            </Link>
          </div>

          <div className="nav-actions">
            <a
              className="nav-cta squircle"
              href="https://api.who.ga/example.com"
              target="_blank"
              rel="noreferrer"
            >
              <Zap aria-hidden size={15} strokeWidth={2.2} />
              <span>{t.navApiCta}</span>
            </a>
            <Menu.Root>
              <Menu.Trigger className="nav-lang-trigger squircle" aria-label="Language">
                <Languages aria-hidden size={16} strokeWidth={1.8} />
                <img
                  className="lang-flag"
                  src={menuLocale === "zh" ? "/flags/cn.svg" : "/flags/us.svg"}
                  alt=""
                  width={18}
                  height={14}
                  decoding="async"
                />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="lang-menu-positioner" sideOffset={8}>
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
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger className="nav-lang-trigger squircle" aria-label={t.themeMenuLabel}>
                <Palette aria-hidden size={16} strokeWidth={1.8} />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="lang-menu-positioner" sideOffset={8}>
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
        </div>
      </div>
    </nav>
  );
}
