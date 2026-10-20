import { useEffect, useMemo, useState } from "react";
import type { HomeCopy } from "@/web/lib/i18n";
import { errorToMessage } from "@/web/lib/rdap-format";

interface SuffixesResponse {
  count: number;
  suffixes: string[];
  decodedSuffixes?: Record<string, string>;
  tldCategories?: {
    ccTld: string[];
    gTld: string[];
    newGtld: string[];
    sTld: string[];
    brandTld: string[];
    geoTld: string[];
  };
  tldTypeCounts?: {
    ccTld: number;
    gTld: number;
    newGtld: number;
    sTld: number;
    brandTld: number;
    geoTld: number;
    total: number;
  };
  error?: string;
}

interface TldBrowserProps {
  t: HomeCopy;
  numberLocale: string;
  onSelectSuffix: (queryValue: string) => void;
}

export function TldBrowser({ t, numberLocale, onSelectSuffix }: TldBrowserProps) {
  const [suffixes, setSuffixes] = useState<string[]>([]);
  const [suffixCount, setSuffixCount] = useState(0);
  const [decodedSuffixes, setDecodedSuffixes] = useState<Record<string, string>>({});
  const [suffixCategories, setSuffixCategories] = useState({
    ccTld: [] as string[],
    gTld: [] as string[],
    newGtld: [] as string[],
    sTld: [] as string[],
    brandTld: [] as string[],
    geoTld: [] as string[]
  });
  const [tldTypeCounts, setTldTypeCounts] = useState({
    ccTld: 0,
    gTld: 0,
    newGtld: 0,
    sTld: 0,
    brandTld: 0,
    geoTld: 0,
    total: 0
  });
  const [suffixError, setSuffixError] = useState<string | null>(null);
  const [showAllTlds, setShowAllTlds] = useState(false);
  const [selectedTldCategory, setSelectedTldCategory] = useState<
    "all" | "ccTld" | "gTld" | "newGtld" | "sTld" | "brandTld" | "geoTld"
  >("all");

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
          setSuffixCategories(
            payload.tldCategories ?? {
              ccTld: [],
              gTld: [],
              newGtld: [],
              sTld: [],
              brandTld: [],
              geoTld: []
            }
          );
          setTldTypeCounts(
            payload.tldTypeCounts ?? {
              ccTld: 0,
              gTld: 0,
              newGtld: 0,
              sTld: 0,
              brandTld: 0,
              geoTld: 0,
              total: 0
            }
          );
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
    const sourceSuffixes =
      selectedTldCategory === "all" ? suffixes : (suffixCategories[selectedTldCategory] ?? []);
    if (showAllTlds) {
      return sourceSuffixes;
    }
    return sourceSuffixes.slice(0, 60);
  }, [selectedTldCategory, showAllTlds, suffixCategories, suffixes]);

  const activeSuffixCount = useMemo(() => {
    if (selectedTldCategory === "all") {
      return suffixCount;
    }
    return suffixCategories[selectedTldCategory]?.length ?? 0;
  }, [selectedTldCategory, suffixCategories, suffixCount]);

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
    <section className="supported-tlds-section">
      <h2>{t.supportedTlds}</h2>
      <div className="supported-tlds-card squircle">
        <p className="supported-count">
          {activeSuffixCount.toLocaleString(numberLocale)} / {suffixCount.toLocaleString(numberLocale)} {t.tldsSupported}
        </p>
        <div className="tld-breakdown" id="section-tlds">
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "ccTld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("ccTld");
              setShowAllTlds(false);
            }}
          >
            {t.ccTldLabel}: <strong>{tldTypeCounts.ccTld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "gTld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("gTld");
              setShowAllTlds(false);
            }}
          >
            {t.gTldLabel}: <strong>{tldTypeCounts.gTld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "newGtld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("newGtld");
              setShowAllTlds(false);
            }}
          >
            {t.newGtldLabel}: <strong>{tldTypeCounts.newGtld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "sTld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("sTld");
              setShowAllTlds(false);
            }}
          >
            {t.sTldLabel}: <strong>{tldTypeCounts.sTld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "brandTld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("brandTld");
              setShowAllTlds(false);
            }}
          >
            {t.brandTldLabel}: <strong>{tldTypeCounts.brandTld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "geoTld" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("geoTld");
              setShowAllTlds(false);
            }}
          >
            {t.geoTldLabel}: <strong>{tldTypeCounts.geoTld.toLocaleString(numberLocale)}</strong>
          </button>
          <button
            type="button"
            className={`tld-breakdown-item squircle ${selectedTldCategory === "all" ? "active" : ""}`}
            onClick={() => {
              setSelectedTldCategory("all");
              setShowAllTlds(false);
            }}
          >
            {t.all}: <strong>{suffixCount.toLocaleString(numberLocale)}</strong>
          </button>
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
        {activeSuffixCount > 60 ? (
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
      </div>
    </section>
  );
}
