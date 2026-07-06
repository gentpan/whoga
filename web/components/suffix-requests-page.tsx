import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteShell } from "@/web/components/site-shell";
import { useSiteLocale } from "@/web/lib/use-site-locale";

type Locale = "zh" | "en";

type PublicSuffixSupportItem = {
  suffix: string;
  count: number;
  lastRequestedAt: string;
  queries: string[];
};

type PublicSuffixSupportResponse = {
  items: PublicSuffixSupportItem[];
  totalRequests: number;
  uniqueSuffixes: number;
};

const COPY = {
  en: {
    title: "Suffix Support Requests",
    subtitle:
      "Public list of suffixes users have requested. Entries are removed automatically once the suffix becomes queryable.",
    totalRequests: "Total requests",
    uniqueSuffixes: "Unique suffixes",
    suffix: "Suffix",
    count: "Requests",
    lastRequested: "Last requested",
    samples: "Sample queries",
    empty: "No pending suffix requests right now.",
    loading: "Loading...",
    error: "Failed to load requests.",
    refresh: "Refresh"
  },
  zh: {
    title: "后缀支持请求",
    subtitle: "用户公开提交的后缀支持需求。当该后缀可正常查询后，条目会自动移除。",
    totalRequests: "总请求数",
    uniqueSuffixes: "后缀种类",
    suffix: "后缀",
    count: "请求次数",
    lastRequested: "最近请求",
    samples: "示例查询",
    empty: "当前没有待处理的后缀请求。",
    loading: "加载中...",
    error: "加载失败。",
    refresh: "刷新"
  }
} as const;

function formatTime(value: string, locale: Locale): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

export function SuffixRequestsPage() {
  const [locale] = useSiteLocale();
  const [data, setData] = useState<PublicSuffixSupportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = COPY[locale];

  async function loadRequests(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/suffix-requests", { cache: "no-store" });
      const payload = (await response.json()) as PublicSuffixSupportResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRequests();
  }, []);

  return (
    <SiteShell pageClassName="requests-page">
      <div className="page-content requests-main">
        <header className="requests-hero">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </header>

        <div className="requests-toolbar">
          <button type="button" className="requests-refresh" onClick={() => void loadRequests()} disabled={loading}>
            {loading ? t.loading : t.refresh}
          </button>
        </div>

        {error ? <p className="requests-error">{error}</p> : null}

        {data ? (
          <section className="requests-summary">
            <div className="requests-stat">
              <span>{t.totalRequests}</span>
              <strong>{data.totalRequests}</strong>
            </div>
            <div className="requests-stat">
              <span>{t.uniqueSuffixes}</span>
              <strong>{data.uniqueSuffixes}</strong>
            </div>
          </section>
        ) : null}

        {loading && !data ? <p className="requests-muted">{t.loading}</p> : null}

        {!loading && data && data.items.length === 0 ? <p className="requests-muted">{t.empty}</p> : null}

        {data && data.items.length > 0 ? (
          <div className="requests-table-wrap">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>{t.suffix}</th>
                  <th>{t.count}</th>
                  <th>{t.lastRequested}</th>
                  <th>{t.samples}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.suffix}>
                    <td>
                      <code>.{item.suffix}</code>
                    </td>
                    <td>{item.count}</td>
                    <td>{formatTime(item.lastRequestedAt, locale)}</td>
                    <td>
                      <div className="requests-samples">
                        {item.queries.map((query) => (
                          <Link
                            key={query}
                            to="/whois/$query"
                            params={{ query }}
                            className="requests-sample-link"
                            style={{ textDecoration: "none" }}
                          >
                            {query}
                          </Link>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}
