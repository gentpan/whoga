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
            <span className="nav-avatar-logo squircle" aria-hidden>
              <svg viewBox="0 0 512 512" width={20} height={20} role="img" aria-label="Whoga">
                <g transform="translate(-0.5,511.8633) scale(0.1,-0.1)">
                  <path
                    fill="currentColor"
                    d="M1566 3949 c84 -26 144 -81 189 -172 49 -100 65 -173 72 -313 10 -210 -16 -382 -146 -960 -75 -337 -97 -474 -88 -562 6 -74 23 -108 59 -123 25 -10 35 -9 66 5 104 50 212 163 347 366 101 153 160 260 219 406 l45 111 -10 157 c-17 253 6 502 62 676 60 184 170 313 292 340 45 11 62 10 112 -5 49 -14 70 -28 125 -83 104 -106 146 -215 157 -403 13 -229 -59 -497 -197 -741 l-50 -88 0 -112 c1 -191 28 -334 91 -464 101 -213 241 -227 416 -42 136 144 253 415 298 688 39 234 12 621 -65 933 -32 132 -30 156 19 224 41 57 106 107 187 145 58 27 81 32 144 33 133 0 223 -64 291 -209 56 -120 79 -244 86 -467 15 -480 -77 -921 -278 -1321 -216 -430 -535 -737 -836 -804 -100 -22 -245 -15 -325 15 -103 40 -201 130 -277 256 -67 110 -140 344 -171 544 l-13 83 -76 -154 c-195 -396 -431 -644 -696 -734 -105 -35 -231 -37 -317 -4 -123 46 -234 159 -291 295 -41 98 -57 199 -57 357 0 202 24 354 130 837 89 408 112 581 90 685 -18 89 -59 118 -139 96 -56 -15 -123 -81 -146 -145 -10 -27 -19 -51 -20 -53 -1 -1 -10 0 -19 4 -21 8 -21 80 -1 200 31 176 97 309 198 400 80 72 158 106 297 128 45 7 164 -6 226 -25z"
                  />
                </g>
              </svg>
            </span>
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
