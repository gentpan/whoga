import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { SiteShell } from "@/web/components/site-shell";
import { SearchHero } from "@/web/components/home/search-hero";
import { LookupResult } from "@/web/components/home/lookup-result";
import { StatsSection } from "@/web/components/home/stats-section";
import { ApiConsole } from "@/web/components/home/api-console";
import { TldBrowser } from "@/web/components/home/tld-browser";
import { FaqSection } from "@/web/components/home/faq-section";
import { I18N } from "@/web/lib/i18n";
import { useLookup } from "@/web/lib/use-lookup";
import { useSiteLocale } from "@/web/lib/use-site-locale";

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [showBackTop, setShowBackTop] = useState(false);
  const [locale] = useSiteLocale();
  const t = I18N[locale];
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  const isHomePage = pathname === "/";
  const [activeNav, setActiveNav] = useState<string>("home");
  const lookup = useLookup();

  const scrollToSection = useCallback(
    (sectionId: string, navKey: string) => {
      setActiveNav(navKey);
      if (!isHomePage) {
        void navigate({ to: "/", hash: sectionId });
        return;
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [isHomePage, navigate]
  );

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash || !isHomePage) {
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveNav(hash.replace(/^section-/, ""));
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isHomePage, location.hash]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackTop(window.scrollY > 320);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <SiteShell
      activeNav={activeNav}
      onSectionClick={scrollToSection}
      trailing={
        <button
          type="button"
          className={`back-top squircle ${showBackTop ? "is-visible" : ""}`}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label={t.backToTop}
        >
          <ArrowUp aria-hidden size={16} strokeWidth={2.4} />
          <span>{t.backToTop}</span>
        </button>
      }
    >
      <div className="home-narrow">
        <section className="hero">
          <SearchHero
            t={t}
            domain={lookup.domain}
            loading={lookup.loading}
            error={lookup.error}
            unsupportedSuffix={lookup.unsupportedSuffix}
            supportFeedback={lookup.supportFeedback}
            hasResult={lookup.data !== null}
            onDomainChange={lookup.handleDomainChange}
            onDomainFocus={lookup.handleDomainFocus}
            onSubmit={(event) => void lookup.handleSubmit(event)}
            onQuickQuery={lookup.navigateToQuery}
            onRequestSupport={() => void lookup.handleRequestSupport()}
          />
        </section>
        <LookupResult data={lookup.data} domain={lookup.domain} locale={locale} />
      </div>

      {isHomePage ? (
        <>
          <StatsSection t={t} numberLocale={numberLocale} />
          <ApiConsole t={t} />
          <TldBrowser t={t} numberLocale={numberLocale} onSelectSuffix={lookup.navigateToQuery} />
          <FaqSection t={t} />
        </>
      ) : null}
    </SiteShell>
  );
}
