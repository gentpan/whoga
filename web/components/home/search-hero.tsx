import { FormEvent, useMemo } from "react";
import { Search } from "lucide-react";
import type { HomeCopy } from "@/web/lib/i18n";
import type { SupportFeedback } from "@/web/lib/use-lookup";
import { detectQueryType } from "@/web/lib/rdap-format";

interface SearchHeroProps {
  t: HomeCopy;
  domain: string;
  loading: boolean;
  error: string | null;
  unsupportedSuffix: { suffix: string; query: string } | null;
  supportFeedback: SupportFeedback;
  hasResult: boolean;
  onDomainChange: (value: string) => void;
  onDomainFocus: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuickQuery: (query: string) => void;
  onRequestSupport: () => void;
}

const QUICK_QUERIES = ["google.com", "8.8.8.8", "AS15169"];

export function SearchHero({
  t,
  domain,
  loading,
  error,
  unsupportedSuffix,
  supportFeedback,
  hasResult,
  onDomainChange,
  onDomainFocus,
  onSubmit,
  onQuickQuery,
  onRequestSupport
}: SearchHeroProps) {
  const queryType = useMemo(() => detectQueryType(domain), [domain]);
  const queryTypeLabel = useMemo(() => {
    switch (queryType) {
      case "domain":
        return t.domainLabel;
      case "ipv4":
        return t.ipv4Label;
      case "ipv6":
        return t.ipv6Label;
      case "asn":
        return t.asnLabel;
      default:
        return t.unknownLabel;
    }
  }, [queryType, t]);

  return (
    <>
      <h1 className="hero-title">{t.heroTitle}</h1>
      <p className="hero-sub">{t.heroTagline}</p>
      <form onSubmit={onSubmit} className="search-box squircle">
        <span className="search-sign" aria-hidden>
          $
        </span>
        <input
          id="domain-query"
          name="domain-query"
          type="text"
          value={domain}
          onChange={(event) => {
            onDomainChange(event.target.value);
          }}
          onFocus={onDomainFocus}
          placeholder={t.searchPlaceholder}
          className="search-input"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        {queryType !== "unknown" ? (
          <span className="query-tag squircle" aria-hidden>
            {queryTypeLabel}
          </span>
        ) : null}
        <button
          type="submit"
          className={`search-submit squircle${loading ? " is-loading" : ""}`}
          disabled={loading}
          aria-label={t.search}
          title={t.search}
        >
          {loading ? (
            <span className="loader" aria-hidden />
          ) : (
            <Search size={17} strokeWidth={2.4} aria-hidden />
          )}
        </button>
      </form>
      <div className="hero-chips">
        <span className="hero-chips-label">{t.heroQuickLabel}</span>
        {QUICK_QUERIES.map((query) => (
          <button
            key={query}
            type="button"
            className="hero-chip squircle"
            onClick={() => {
              onQuickQuery(query);
            }}
          >
            {query}
          </button>
        ))}
      </div>
      {!hasResult ? <p className="hero-supports">{t.heroSupports}</p> : null}
      {unsupportedSuffix ? (
        <section className="unsupported-suffix-panel squircle" aria-live="polite">
          <div className="unsupported-suffix-head">
            <span className="unsupported-suffix-badge squircle">{t.unsupportedSuffixBadge}</span>
            <h3 className="unsupported-suffix-title">{t.unsupportedSuffixTitle}</h3>
          </div>
          <p className="unsupported-suffix-copy">
            {t.unsupportedSuffixBody}
          </p>
          <div className="unsupported-suffix-meta">
            <code className="squircle">.{unsupportedSuffix.suffix}</code>
            <span>{unsupportedSuffix.query}</span>
          </div>
          <div className="unsupported-suffix-actions">
            <button
              type="button"
              className="unsupported-suffix-btn squircle"
              onClick={onRequestSupport}
              disabled={supportFeedback === "submitting" || supportFeedback === "created" || supportFeedback === "already"}
            >
              {supportFeedback === "submitting" ? t.requestSupportSubmitting : t.requestSupport}
            </button>
            <a href="/requests" className="unsupported-suffix-link plain-link">
              {t.viewPublicRequests}
            </a>
          </div>
          {supportFeedback === "created" ? (
            <p className="unsupported-suffix-feedback ok">{t.requestSupportDone}</p>
          ) : null}
          {supportFeedback === "already" ? (
            <p className="unsupported-suffix-feedback muted">{t.requestSupportAlready}</p>
          ) : null}
          {supportFeedback === "failed" ? (
            <p className="unsupported-suffix-feedback error">{t.requestSupportFailed}</p>
          ) : null}
        </section>
      ) : null}
      {error && !unsupportedSuffix ? <p className="error hero-error">{error}</p> : null}

      {loading && !hasResult ? (
        <section className="results-section results-inline">
          <div className="result-card squircle loading-card">
            <div className="loading-overlay">
              <div className="loading-spinner" aria-hidden />
              <div className="loading-text">{t.loadingRdapData}</div>
            </div>
            <div className="loading-skeleton">
              <div className="skeleton-line wide" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
