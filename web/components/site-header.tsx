import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  Code2,
  Database,
  HandHelping,
  Info,
  Zap
} from "lucide-react";
import { SITE_COPY, type SiteLocale } from "@/web/lib/site-copy";

interface SiteHeaderProps {
  locale: SiteLocale;
  activeNav?: string;
  onSectionClick?: (sectionId: string, navKey: string) => void;
}

export function SiteHeader({ locale, activeNav, onSectionClick }: SiteHeaderProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
          </div>
        </div>
      </div>
    </nav>
  );
}
