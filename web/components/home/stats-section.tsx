import { useEffect, useMemo, useState } from "react";
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
  const coveragePct = useMemo(() => {
    if (!rootTldCoverage.total) {
      return 0;
    }
    return Math.round((rootTldCoverage.withRdap / rootTldCoverage.total) * 1000) / 10;
  }, [rootTldCoverage]);

  if (statsLoading) {
    return <p className="muted">{t.statsLoading}</p>;
  }
  if (statsError || !stats) {
    return <p className="error muted">{statsError}</p>;
  }

  const coverageNote = [
    rootTldCoverage.withWhoisFallback > 0
      ? `+${rootTldCoverage.withWhoisFallback.toLocaleString(numberLocale)} ${t.rootTldWhoisFallback}`
      : "",
    rootTldCoverage.withWebRegistryOnly > 0
      ? `+${rootTldCoverage.withWebRegistryOnly.toLocaleString(numberLocale)} ${t.rootTldWebRegistryOnly}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");

  return (
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
          <span className="stats-bar squircle" aria-hidden>
            <i className="squircle" style={{ width: `${coveragePct}%` }} />
          </span>
          {coverageNote ? <p className="stats-cell-note">{coverageNote}</p> : null}
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
  );
}
