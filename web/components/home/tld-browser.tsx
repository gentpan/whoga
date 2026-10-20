import { useEffect, useMemo, useState } from "react";
import { Tags } from "lucide-react";
import type { HomeCopy } from "@/web/lib/i18n";
import { errorToMessage } from "@/web/lib/rdap-format";

interface SuffixesResponse {
  count: number;
  suffixes: string[];
  decodedSuffixes?: Record<string, string>;
  error?: string;
}

const HOT_SUFFIXES = [
  "com", "net", "org", "io", "ai", "dev", "app", "cn", "uk", "de",
  "jp", "co", "me", "cc", "tv", "info", "xyz", "shop", "blog", "cloud"
];

interface TldBrowserProps {
  t: HomeCopy;
  numberLocale: string;
  onSelectSuffix: (queryValue: string) => void;
}

export function TldBrowser({ t, numberLocale, onSelectSuffix }: TldBrowserProps) {
  const [suffixes, setSuffixes] = useState<string[]>([]);
  const [suffixCount, setSuffixCount] = useState(0);
  const [decodedSuffixes, setDecodedSuffixes] = useState<Record<string, string>>({});
  const [suffixError, setSuffixError] = useState<string | null>(null);
  const [showAllTlds, setShowAllTlds] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSuffixes(): Promise<void> {
      try {
        const response = await fetch("/api/suffixes", { cache: "no-store" });
        const payload = (await response.json()) as SuffixesResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? `Suffix API error: ${response.status}`);
        }
        if (mounted) {
          setSuffixes(payload.suffixes ?? []);
          setSuffixCount(payload.count ?? 0);
          setDecodedSuffixes(payload.decodedSuffixes ?? {});
        }
      } catch (loadError) {
        if (mounted) {
          const message = errorToMessage(loadError, "Failed to load suffixes");
          setSuffixError(message);
        }
      }
    }

    void loadSuffixes();

    return () => {
      mounted = false;
    };
  }, []);

  const visibleSuffixes = useMemo(() => {
    if (showAllTlds) {
      return suffixes;
    }
    const hot = HOT_SUFFIXES.filter((suffix) => suffixes.includes(suffix));
    return hot.length ? hot : suffixes.slice(0, 20);
  }, [showAllTlds, suffixes]);

  const suffixDisplayList = useMemo(
    () =>
      visibleSuffixes.map((suffix) => {
        const decoded = decodedSuffixes[suffix] ?? suffix;
        return {
          suffix,
          decoded,
          hasDecodedLabel: decoded !== suffix
        };
      }),
    [decodedSuffixes, visibleSuffixes]
  );

  return (
    <section className="supported-tlds-section" id="section-tlds">
      <article className="result-card squircle">
        <div className="result-card-head">
          <span className="result-card-icon" aria-hidden>
            <Tags size={14} strokeWidth={2} />
          </span>
          <h3 className="result-card-title">
            <span className="term-hash" aria-hidden># </span>
            {t.supportedTlds}
          </h3>
          <span className="result-card-meta">
            {t.tldsTotal.replace("{count}", suffixCount.toLocaleString(numberLocale))}
          </span>
        </div>
        {suffixError ? <p className="error muted">{suffixError}</p> : null}
        <div className="supported-tags-wrap">
          {suffixDisplayList.map(({ suffix, decoded, hasDecodedLabel }) => (
            <button
              key={suffix}
              type="button"
              className="tld-chip squircle"
              onClick={() => {
                const queryValue = hasDecodedLabel ? decoded : suffix;
                onSelectSuffix(queryValue);
              }}
            >
              <span className="tld-chip-primary">.{hasDecodedLabel ? decoded : suffix}</span>
            </button>
          ))}
        </div>
        {suffixCount > visibleSuffixes.length || showAllTlds ? (
          <div className="supported-action">
            <button
              type="button"
              className="show-all-btn"
              onClick={() => setShowAllTlds((prev) => !prev)}
            >
              {showAllTlds ? t.showFewerTlds : t.showAllTlds}
            </button>
          </div>
        ) : null}
      </article>
    </section>
  );
}
