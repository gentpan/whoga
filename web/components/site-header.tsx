import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu } from "@base-ui/react/menu";
import {
  BarChart3,
  BookOpen,
  Code2,
  Database,
  HandHelping,
  Info,
  Languages,
  Zap
} from "lucide-react";
import { ThemeToggle } from "@/web/components/theme-toggle";
import { SITE_COPY, type SiteLocale } from "@/web/lib/site-copy";

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
      <div className="nav-pill">
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
              className="nav-avatar-img"
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
              className={`nav-link ${resolvedActiveNav === "stats" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-stats", "stats")}
            >
              <BarChart3 className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navStats}</span>
            </button>
            <button
              type="button"
              className={`nav-link ${resolvedActiveNav === "api" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-api", "api")}
            >
              <Code2 className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navApi}</span>
            </button>
            <button
              type="button"
              className={`nav-link ${resolvedActiveNav === "tlds" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-tlds", "tlds")}
            >
              <Database className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navTlds}</span>
            </button>
            <button
              type="button"
              className={`nav-link ${resolvedActiveNav === "faq" ? "active" : ""}`}
              onClick={() => handleSectionClick("section-faq", "faq")}
            >
              <Info className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navFaq}</span>
            </button>
            <Link
              to="/learn"
              className={`nav-link ${resolvedActiveNav === "learn" ? "active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              <BookOpen className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navLearn}</span>
            </Link>
            <Link
              to="/requests"
              className={`nav-link ${resolvedActiveNav === "requests" ? "active" : ""}`}
              style={{ textDecoration: "none" }}
            >
              <HandHelping className="nav-link-icon" aria-hidden size={16} strokeWidth={2} />
              <span>{t.navRequests}</span>
            </Link>
          </div>

          <div className="nav-actions">
            <a
              className="nav-cta"
              href="https://api.who.ga/example.com"
              target="_blank"
              rel="noreferrer"
            >
              <Zap aria-hidden size={15} strokeWidth={2.2} />
              <span>{t.navApiCta}</span>
            </a>
            <Menu.Root>
              <Menu.Trigger className="nav-lang-trigger" aria-label="Language">
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
                  <Menu.Popup className="lang-menu" aria-label="Language options">
                    <Menu.Item
                      className={`lang-option ${menuLocale === "zh" ? "active" : ""}`}
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
                      className={`lang-option ${menuLocale === "en" ? "active" : ""}`}
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
            <ThemeToggle compact />
          </div>
        </div>
      </div>
    </nav>
  );
}
