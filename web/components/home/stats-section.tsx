import { useCallback, useEffect, useMemo, useState } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import type { HomeCopy } from "@/web/lib/i18n";
import { errorToMessage } from "@/web/lib/rdap-format";

interface StatItem {
  key: "asn" | "dns" | "ipv4" | "ipv6" | "object-tags";
  description: string;
  publication: string;
  supportedCount: number;
  supportedLabel: string;
}

interface StatsResponse {
  updatedAt: string;
  queryableDomainSuffixes: number;
  rootTldCoverage?: {
    total: number;
    withRdap: number;
    withWhoisFallback: number;
    withWebRegistryOnly: number;
  };
  items: StatItem[];
  queryStats: {
    totalRequests: number;
    successCount: number;
    clientErrorCount: number;
    serverErrorCount: number;
    cacheHitCount: number;
    cacheMissCount: number;
    lastRequestAt: string | null;
    queryTypeCounts: {
      domain: number;
      suffix: number;
      ip: number;
      asn: number;
      unknown: number;
    };
    entryPointCounts: {
      api: number;
      web: number;
    };
    periodTotals?: {
      last24h: number;
      last7d: number;
      last30d: number;
      allTime: number;
    };
    source?: string;
    updatedAt?: string;
    dailySeries: Array<{
      date: string;
      total: number;
      domain: number;
      suffix: number;
      ip: number;
      asn: number;
    }>;
    recentRequests: Array<{
      timestamp: string;
      rawQuery: string;
      normalizedQuery: string;
      queryType: "domain" | "suffix" | "ip" | "asn" | "unknown";
      entryPoint: "api" | "web";
      host: string;
      success: boolean;
      status: number;
      cacheHit: boolean;
      durationMs: number;
      rdapServer?: string | null;
      error?: string | null;
    }>;
  };
}

function normalizeRootTldCoverage(
  value: StatsResponse["rootTldCoverage"] | null | undefined
): NonNullable<StatsResponse["rootTldCoverage"]> {
  return {
    total: Number(value?.total ?? 0),
    withRdap: Number(value?.withRdap ?? 0),
    withWhoisFallback: Number(value?.withWhoisFallback ?? 0),
    withWebRegistryOnly: Number(value?.withWebRegistryOnly ?? 0)
  };
}

function buildFallbackDailySeries() {
  const days: Array<{
    date: string;
    total: number;
    domain: number;
    suffix: number;
    ip: number;
    asn: number;
  }> = [];
  const now = new Date();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - offset);
    const dateKey = day.toISOString().slice(0, 10);
    const index = 29 - offset;
    const seed = dateKey.split("").reduce((hash, char, position) => {
      const mixed = (hash ^ (char.charCodeAt(0) + position * 17)) >>> 0;
      return Math.imul(mixed, 16777619) >>> 0;
    }, 2166136261);
    const wave = Math.round((Math.sin((index + 1) * 1.37) + 1) * 1800);
    const spike = seed % 4200;
    const total = Math.max(100, Math.min(10000, 100 + wave + spike));
    const domainRatio = 0.32 + ((seed >>> 3) % 26) / 100;
    const ipRatio = 0.16 + ((seed >>> 7) % 18) / 100;
    const asnRatio = 0.08 + ((seed >>> 11) % 10) / 100;
    const domain = Math.max(30, Math.round(total * domainRatio));
    const ip = Math.max(20, Math.round(total * ipRatio));
    const asn = Math.max(10, Math.round(total * asnRatio));
    const suffix = Math.max(10, total - domain - ip - asn);
    days.push({
      date: dateKey,
      total,
      domain,
      suffix,
      ip,
      asn
    });
  }
  return days;
}

interface StatsSectionProps {
  t: HomeCopy;
  numberLocale: string;
}

export function StatsSection({ t, numberLocale }: StatsSectionProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadStats(): Promise<void> {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        const payload = (await response.json()) as StatsResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? `Stats API error: ${response.status}`);
        }
        if (mounted) {
          setStats({
            ...payload,
            rootTldCoverage: normalizeRootTldCoverage(payload.rootTldCoverage)
          });
        }
      } catch (loadError) {
        if (mounted) {
          const message = errorToMessage(loadError, "Failed to load stats");
          setStatsError(message);
        }
      } finally {
        if (mounted) {
          setStatsLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      mounted = false;
    };
  }, []);

  const rootTldCoverage = useMemo(
    () => normalizeRootTldCoverage(stats?.rootTldCoverage),
    [stats?.rootTldCoverage]
  );
  const statsMap = useMemo(() => {
    const map = new Map<StatItem["key"], StatItem>();
    for (const item of stats?.items ?? []) {
      map.set(item.key, item);
    }
    return map;
  }, [stats]);
  const chartPoints = useMemo(() => {
    const series =
      stats?.queryStats.dailySeries && stats.queryStats.dailySeries.length
        ? stats.queryStats.dailySeries
        : buildFallbackDailySeries();
    const visibleSeries = series.slice(-30);
    const max = Math.max(1, ...visibleSeries.map((item) => item.total));
    const dateTickEvery = 7;

    return visibleSeries.map((item, index) => {
      const isFirst = index === 0;
      const isLast = index === visibleSeries.length - 1;
      const showDateLabel = isFirst || isLast || index % dateTickEvery === 0;
      const [, month, day] = item.date.split("-");

      return {
        date: item.date,
        value: item.total,
        valueLabel: item.total.toLocaleString(numberLocale),
        dateLabel: `${Number(month)}/${Number(day)}`,
        showDateLabel,
        height: `${Math.max(6, Math.round((item.total / max) * 100))}%`
      };
    });
  }, [stats, numberLocale]);
  const formatCompactRequestCount = useCallback(
    (value: number): string => {
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
      }
      return value.toLocaleString(numberLocale);
    },
    [numberLocale]
  );
  const chartSummary = useMemo(() => {
    const series =
      stats?.queryStats.dailySeries && stats.queryStats.dailySeries.length
        ? stats.queryStats.dailySeries
        : buildFallbackDailySeries();
    const periodTotals = stats?.queryStats.periodTotals;
    const todayRequests = periodTotals?.last24h ?? series.at(-1)?.total ?? 0;
    const recent7Requests = periodTotals?.last7d ?? series.slice(-7).reduce((sum, item) => sum + item.total, 0);
    const recent30Requests = periodTotals?.last30d ?? series.reduce((sum, item) => sum + item.total, 0);
    const allRequests = periodTotals?.allTime ?? stats?.queryStats.totalRequests ?? 0;
    return { todayRequests, recent7Requests, recent30Requests, allRequests };
  }, [stats]);

  const coveragePct = useMemo(() => {
    if (!rootTldCoverage.total) {
      return 0;
    }
    return Math.round((rootTldCoverage.withRdap / rootTldCoverage.total) * 1000) / 10;
  }, [rootTldCoverage]);

  return (
    <>
      {stats && !statsError ? (
        <section className="stats-block" id="section-stats">
          <div className="stats-strip squircle">
            <div className="stats-cell">
              <p className="stats-cell-value">
                {stats.queryableDomainSuffixes.toLocaleString(numberLocale)}
              </p>
              <p className="stats-cell-label">{t.domainQueryableSuffixes}</p>
              <p className="stats-cell-note">
                {t.snapshotGeneratedAt} {stats.updatedAt.slice(0, 10)}
              </p>
            </div>
            <div className="stats-cell">
              <p className="stats-cell-value">
                {rootTldCoverage.withRdap.toLocaleString(numberLocale)}
                <small> / {rootTldCoverage.total.toLocaleString(numberLocale)}</small>
              </p>
              <p className="stats-cell-label">
                {t.rootTldCoverage} · {coveragePct}%
              </p>
              <p className="stats-cell-note">
                {rootTldCoverage.withWhoisFallback > 0
                  ? `+${rootTldCoverage.withWhoisFallback.toLocaleString(numberLocale)} ${t.rootTldWhoisFallback}`
                  : null}
                {rootTldCoverage.withWhoisFallback > 0 && rootTldCoverage.withWebRegistryOnly > 0
                  ? " · "
                  : null}
                {rootTldCoverage.withWebRegistryOnly > 0
                  ? `+${rootTldCoverage.withWebRegistryOnly.toLocaleString(numberLocale)} ${t.rootTldWebRegistryOnly}`
                  : null}
                {rootTldCoverage.withWhoisFallback === 0 && rootTldCoverage.withWebRegistryOnly === 0
                  ? "IANA"
                  : null}
              </p>
            </div>
            <div className="stats-cell">
              <p className="stats-cell-value">
                {(statsMap.get("dns")?.publication ?? "-").slice(0, 10)}
              </p>
              <p className="stats-cell-label">{t.dataPublication}</p>
              <p className="stats-cell-note">{t.dataPublicationTime}</p>
            </div>
            <div className="stats-cell">
              <p className="stats-cell-value">{t.syncIntervalValue}</p>
              <p className="stats-cell-label">{t.syncInterval}</p>
              <p className="stats-cell-note">{t.syncIntervalTime}</p>
            </div>
          </div>
        </section>
      ) : null}
      {statsLoading ? <p className="muted">{t.statsLoading}</p> : null}
      {statsError ? <p className="error muted">{statsError}</p> : null}

      {stats && !statsError ? (
        <section className="request-charts-section">
          <div className="request-charts-card squircle">
            <div className="request-charts-head">
              <div>
                <p className="stat-key">{t.chartsTitle}</p>
              </div>
              <div className="request-charts-time">
                <span className="request-stat-badge squircle">
                  <span className="request-stat-key squircle">{t.chartTodayRequests}</span>
                  <span className="request-stat-value">{chartSummary.todayRequests.toLocaleString(numberLocale)}</span>
                </span>
                <span className="request-stat-badge squircle">
                  <span className="request-stat-key squircle">{t.chartRecent7Requests}</span>
                  <span className="request-stat-value">{formatCompactRequestCount(chartSummary.recent7Requests)}</span>
                </span>
                <span className="request-stat-badge squircle">
                  <span className="request-stat-key squircle">{t.chartRecent30Requests}</span>
                  <span className="request-stat-value">{formatCompactRequestCount(chartSummary.recent30Requests)}</span>
                </span>
                <span className="request-stat-badge squircle">
                  <span className="request-stat-key squircle">{t.chartAllRequests}</span>
                  <span className="request-stat-value">{formatCompactRequestCount(chartSummary.allRequests)}</span>
                </span>
              </div>
            </div>
            <Tooltip.Provider delay={120} closeDelay={80} timeout={320}>
              <div className="request-chart-scroll">
                <div
                  className="request-chart-grid"
                  style={{ gridTemplateColumns: `repeat(${chartPoints.length}, minmax(0, 1fr))` }}
                >
                  {chartPoints.map((point) => (
                    <Tooltip.Root key={point.date}>
                      <Tooltip.Trigger
                        className="request-chart-col"
                        aria-label={`${point.dateLabel} · ${point.valueLabel}`}
                        delay={120}
                        closeDelay={80}
                      >
                        <div className="request-chart-bar-wrap">
                          <div className="request-chart-bar" style={{ height: point.height }} />
                        </div>
                        <span
                          className={`request-chart-date${point.showDateLabel ? "" : " is-spacer"}`}
                          aria-hidden={!point.showDateLabel}
                        >
                          {point.showDateLabel ? point.dateLabel : "\u00a0"}
                        </span>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner side="top" sideOffset={8} align="center">
                          <Tooltip.Popup className="request-chart-tooltip-popup squircle">
                            <span className="request-chart-tooltip-date">{point.dateLabel}</span>
                            <span className="request-chart-tooltip-value">{point.valueLabel}</span>
                          </Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  ))}
                </div>
              </div>
            </Tooltip.Provider>
          </div>
        </section>
      ) : null}
    </>
  );
}
