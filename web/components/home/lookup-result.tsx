import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  Globe,
  Info,
  ListChecks,
  Network,
  Search,
  ShieldCheck,
  ShieldOff,
  TriangleAlert,
  Users
} from "lucide-react";
import { I18N, type Locale } from "@/web/lib/i18n";
import { NameServersSection, type DnsLookupState } from "@/web/components/home/name-servers";
import {
  asRecord,
  asString,
  asStringArray,
  buildCoreInfoItems,
  buildEntities,
  buildEventData,
  buildStatusCards,
  detectQueryType,
  errorToMessage,
  formatRelativeTime,
  getAbuseContactText,
  getRegistrationAgeLabel,
  getTldFromQuery,
  highlightJson,
  joinRdapDomainUrl,
  normalizeDnsLookupResult,
  type ApiResponse,
  type NameServerItem
} from "@/web/lib/rdap-format";

interface LookupResultProps {
  data: ApiResponse | null;
  domain: string;
  locale: Locale;
}

export function LookupResult({ data, domain, locale }: LookupResultProps) {
  const t = I18N[locale];
  const [eventsUseUtc, setEventsUseUtc] = useState(true);
  const [openNameServers, setOpenNameServers] = useState<Record<string, boolean>>({});
  const [dnsLookupMap, setDnsLookupMap] = useState<Record<string, DnsLookupState>>({});
  const [ptrRecords, setPtrRecords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedNameServer, setCopiedNameServer] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedNameServerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatted = useMemo(() => {
    if (!data) {
      return "";
    }
    return JSON.stringify(data.result ?? data, null, 2);
  }, [data]);

  const highlightedJson = useMemo(() => {
    if (!formatted) {
      return "";
    }
    return highlightJson(formatted);
  }, [formatted]);

  const eventData = useMemo(
    () =>
      data
        ? buildEventData(data, locale, eventsUseUtc)
        : {
            rows: [],
            lastDatabaseUpdate: "-"
          },
    [data, locale, eventsUseUtc]
  );
  const coreInfoItems = useMemo(() => (data ? buildCoreInfoItems(data, locale) : []), [data, locale]);
  const entityItems = useMemo(() => (data ? buildEntities(data, locale) : []), [data, locale]);
  const abuseContactText = useMemo(() => getAbuseContactText(data), [data]);
  const registrationAgeLabel = useMemo(() => getRegistrationAgeLabel(data, locale), [data, locale]);
  const statusCards = useMemo(() => (data ? buildStatusCards(data, locale) : []), [data, locale]);
  const isIpQuery = (data?.queryType ?? detectQueryType(domain)) === "ip";
  const isDomainLikeQuery =
    (data?.queryType ?? detectQueryType(domain)) === "domain" ||
    (data?.queryType ?? detectQueryType(domain)) === "suffix";
  const showInfoNotices = isIpQuery || isDomainLikeQuery;
  const nameServerList = useMemo<NameServerItem[]>(() => {
    const result = asRecord(data?.result);
    const nameservers = Array.isArray(result.nameservers) ? result.nameservers : [];
    return nameservers
      .map((entry) => {
        const row = asRecord(entry);
        const host = asString(row.ldhName) ?? asString(row.unicodeName);
        if (!host) {
          return null;
        }
        const ip = asRecord(row.ipAddresses);
        return {
          host,
          ipv4: asStringArray(ip.v4),
          ipv6: asStringArray(ip.v6)
        };
      })
      .filter((value): value is NameServerItem => Boolean(value));
  }, [data]);

  const dnssecInfo = useMemo(() => {
    const result = asRecord(data?.result);
    const secureDNS = asRecord(result.secureDNS);
    if (!Object.keys(secureDNS).length) {
      return null;
    }
    const delegationSigned = secureDNS.delegationSigned === true;
    const zoneSigned = secureDNS.zoneSigned === true;
    return { delegationSigned, zoneSigned, signed: delegationSigned || zoneSigned };
  }, [data]);

  const lookupDns = useCallback(async (host: string): Promise<void> => {
    if (!host) {
      return;
    }
    setDnsLookupMap((prev) => ({
      ...prev,
      [host]: { loading: true }
    }));

    try {
      const response = await fetch(`/api/dns-lookup?domain=${encodeURIComponent(host)}`, {
        cache: "no-store"
      });
      const payload = (await response.json()) as { error?: string; result?: unknown };
      if (!response.ok) {
        throw new Error(payload.error ?? `DNS lookup failed: ${response.status}`);
      }
      setDnsLookupMap((prev) => ({
        ...prev,
        [host]: { loading: false, view: normalizeDnsLookupResult(payload.result) }
      }));
    } catch (error) {
      setDnsLookupMap((prev) => ({
        ...prev,
        [host]: { loading: false, error: errorToMessage(error, "DNS lookup failed") }
      }));
    }
  }, []);

  const resultSourceType = useMemo(
    () => data?.queryType ?? detectQueryType(data?.domain ?? domain),
    [data?.domain, data?.queryType, domain]
  );

  const resultTypeLabel = useMemo(() => {
    if (resultSourceType === "asn") {
      return t.asnLabel;
    }
    if (resultSourceType === "ip") {
      const value = (data?.domain ?? domain).trim();
      return value.includes(":") ? t.ipv6Label : t.ipv4Label;
    }
    if (resultSourceType === "domain" || resultSourceType === "suffix") {
      return t.domainLabel;
    }
    return t.domainLabel;
  }, [data?.domain, domain, resultSourceType, t]);

  const isAsnResult = resultSourceType === "asn";

  const rdapChain = useMemo(() => {
    if (!data?.domain || !data?.rdapServer) {
      return null;
    }
    const qType = data.queryType ?? detectQueryType(data.domain);
    if (qType !== "domain" && qType !== "suffix") {
      return null;
    }
    const rdapBase = String(data.rdapServer);
    const tld = getTldFromQuery(data.domain);
    if (!tld) {
      return null;
    }
    const lookupName = qType === "suffix" ? tld : data.domain;
    const registryUrl = joinRdapDomainUrl(rdapBase, lookupName);

    let registrarUrl: string | null = null;
    if (data.registrarRdapServer) {
      registrarUrl = joinRdapDomainUrl(String(data.registrarRdapServer), lookupName);
    }

    if (!registrarUrl) {
      const registrarRecord = asRecord(data.registrarResult);
      const links = Array.isArray(registrarRecord.links) ? registrarRecord.links : [];
      for (const link of links) {
        const row = asRecord(link);
        const href = asString(row.href);
        const rel = (asString(row.rel) ?? "").toLowerCase();
        const type = (asString(row.type) ?? "").toLowerCase();
        if (!href) {
          continue;
        }
        const isRdap = href.includes("rdap") || type.includes("rdap+json");
        const isSelfLike = rel === "self" || rel === "related" || rel === "alternate";
        const isDifferent = rdapBase && !href.startsWith(rdapBase);
        if (isRdap && isSelfLike && isDifferent) {
          registrarUrl = href;
          break;
        }
      }
    }

    const items = [
      {
        label: `${t.rdapChainTld}: .${tld ?? "-"}`,
        url: rdapBase
      },
      {
        label: t.rdapChainRegistry,
        url: registryUrl
      }
    ];

    if (registrarUrl) {
      items.push({
        label: t.rdapChainRegistrar,
        url: registrarUrl
      });
    }

    return { items, registrarUrl };
  }, [data, t]);

  useEffect(() => {
    let cancelled = false;
    async function loadPtr(): Promise<void> {
      if (!showInfoNotices || !data?.domain) {
        setPtrRecords([]);
        return;
      }
      if (isIpQuery) {
        try {
          const response = await fetch(`/api/dns-reverse?ip=${encodeURIComponent(data.domain)}`, {
            cache: "no-store"
          });
          if (!response.ok) {
            setPtrRecords([]);
            return;
          }
          const payload = (await response.json()) as { ptr?: string[] };
          if (cancelled) {
            return;
          }
          setPtrRecords(Array.isArray(payload.ptr) ? payload.ptr : []);
        } catch {
          if (!cancelled) {
            setPtrRecords([]);
          }
        }
        return;
      }

      if (isDomainLikeQuery) {
        try {
          const dnsResponse = await fetch(`/api/dns-lookup?domain=${encodeURIComponent(data.domain)}`, {
            cache: "no-store"
          });
          if (!dnsResponse.ok) {
            setPtrRecords([]);
            return;
          }
          const dnsPayload = (await dnsResponse.json()) as { result?: unknown };
          const dnsView = normalizeDnsLookupResult(dnsPayload.result);
          const v4List = (dnsView.groups.A ?? []).filter(Boolean).slice(0, 3);
          if (!v4List.length) {
            setPtrRecords([]);
            return;
          }

          const ptrResponses = await Promise.all(
            v4List.map(async (ip) => {
              try {
                const reverseResponse = await fetch(`/api/dns-reverse?ip=${encodeURIComponent(ip)}`, {
                  cache: "no-store"
                });
                if (!reverseResponse.ok) {
                  return [] as string[];
                }
                const reversePayload = (await reverseResponse.json()) as { ptr?: string[] };
                return Array.isArray(reversePayload.ptr) ? reversePayload.ptr : [];
              } catch {
                return [] as string[];
              }
            })
          );

          if (cancelled) {
            return;
          }

          const merged = Array.from(new Set(ptrResponses.flat().filter(Boolean)));
          setPtrRecords(merged);
        } catch {
          if (!cancelled) {
            setPtrRecords([]);
          }
        }
      }
    }
    void loadPtr();
    return () => {
      cancelled = true;
    };
  }, [data?.domain, isIpQuery, isDomainLikeQuery, showInfoNotices]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      if (copiedNameServerTimerRef.current) {
        clearTimeout(copiedNameServerTimerRef.current);
      }
    };
  }, []);

  async function handleCopyJson(): Promise<void> {
    if (!formatted) {
      return;
    }
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, 1700);
  }

  async function handleCopyText(text: string, key?: string): Promise<void> {
    if (!text) {
      return;
    }
    await navigator.clipboard.writeText(text);
    if (!key) {
      return;
    }
    setCopiedNameServer(key);
    if (copiedNameServerTimerRef.current) {
      clearTimeout(copiedNameServerTimerRef.current);
    }
    copiedNameServerTimerRef.current = setTimeout(() => {
      setCopiedNameServer(null);
    }, 1700);
  }

  function handleDownloadJson(): void {
    if (!formatted) {
      return;
    }
    const blob = new Blob([formatted], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const fileBase = domain.trim().replace(/[^a-z0-9.-]/gi, "_") || "rdap-result";

    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBase}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!formatted) {
    return null;
  }

  const queryLabel = data?.domain ?? domain;

  return (
    <section className="results-section results-inline">
      <div className="term-bar" aria-hidden>
        <span className="term-dots">
          <i className="term-dot term-dot-r" />
          <i className="term-dot term-dot-y" />
          <i className="term-dot term-dot-g" />
        </span>
        <span className="term-bar-title">{`whois ${queryLabel} — who.ga`}</span>
      </div>
      <p className="result-echo" aria-hidden>
        <span className="result-echo-sign">$</span>
        <span className="result-echo-cmd">whois {queryLabel}</span>
        <span className="result-echo-meta">{resultTypeLabel}</span>
      </p>

      {showInfoNotices && (abuseContactText || ptrRecords.length > 0) ? (
        <div className="result-notices">
          {abuseContactText ? (
            <div className="notice-banner notice-banner-green">
              <span className="notice-icon" aria-hidden>
                <TriangleAlert size={16} strokeWidth={2.2} />
              </span>
              <span>
                {t.abuseContactPrefix} <strong>{`'${queryLabel}'`}</strong> {t.abuseContactMiddle}{" "}
                <strong>{`'${abuseContactText}'`}</strong>
              </span>
            </div>
          ) : null}
          {ptrRecords.length ? (
            <div className="notice-banner notice-banner-blue">
              <span className="notice-icon" aria-hidden>
                <Search size={16} strokeWidth={2.2} />
              </span>
              <span>
                {t.ptrRecordPrefix} <strong>{`'${queryLabel}'`}</strong> {t.ptrRecordMiddle}{" "}
                <strong>{`'${ptrRecords.join(", ")}'`}</strong>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 概要卡 */}
      <article className="result-card squircle">
        <div className="result-card-head">
          <span className="result-card-icon" aria-hidden>
            <Globe size={14} strokeWidth={2} />
          </span>
          <h3 className="result-card-title">
            <span className="term-hash" aria-hidden># </span>
            {isIpQuery ? t.ipNetworkInformation : t.coreInformation}
          </h3>
          <span className="result-card-meta">{resultTypeLabel}</span>
        </div>
        <div className="result-domain-row">
          <span className="result-domain">{queryLabel}</span>
          {isAsnResult ? (
            <span className="result-badge squircle">{t.asnLabel}</span>
          ) : (
            <>
              <span className="result-badge squircle">{resultTypeLabel}</span>
              {registrationAgeLabel !== "-" ? (
                <span className="result-badge squircle">
                  {t.resultRegistrationAge}: {registrationAgeLabel}
                </span>
              ) : null}
            </>
          )}
        </div>
        {coreInfoItems.length ? (
          <div className="kv-panel">
            {coreInfoItems.map((item) => (
              <div key={item.label} className="kv-row">
                <span className="kv-key">{item.label}:</span>
                <span className="kv-value">{item.value}</span>
              </div>
            ))}
            {statusCards.length && isIpQuery ? (
              <div className="kv-row">
                <span className="kv-key">{t.status}:</span>
                <span className="kv-value">
                  <span className="inline-active-badge squircle">active</span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>

      {/* 状态卡 */}
      {statusCards.length && !isIpQuery ? (
        <article className="result-card squircle">
          <div className="result-card-head">
            <span className="result-card-icon" aria-hidden>
              <ListChecks size={14} strokeWidth={2} />
            </span>
            <h3 className="result-card-title">
              <span className="term-hash" aria-hidden># </span>
              {t.status}
            </h3>
            <span className="result-card-meta">{statusCards.length}</span>
          </div>
          <div
            className={`status-grid ${
              statusCards.length === 4
                ? "is-four"
                : statusCards.length >= 6
                  ? "is-six"
                  : "is-default"
            }`}
          >
            {statusCards.map((card) => (
              <div className="status-card squircle" key={card.key}>
                <span className="status-text">
                  {locale === "zh" ? card.zhTitle : card.enLabel}
                </span>
                <span className="status-info" aria-hidden>
                  <Info size={14} strokeWidth={2.2} />
                  <span className="status-tooltip squircle">
                    <span className="status-tooltip-zh">{card.zhDescription}</span>
                    <span className="status-tooltip-en">{card.enDescription}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* 日期卡(带相对时间) */}
      {eventData.rows.length ? (
        <article className="result-card squircle">
          <div className="result-card-head">
            <span className="result-card-icon" aria-hidden>
              <CalendarClock size={14} strokeWidth={2} />
            </span>
            <h3 className="result-card-title">
              <span className="term-hash" aria-hidden># </span>
              {t.eventsTitle}
            </h3>
            <div className="events-head-meta">
              <span className="events-last-update">
                {t.lastRdapUpdate}: {eventData.lastDatabaseUpdate}
              </span>
              <button
                type="button"
                className="events-time-toggle squircle"
                onClick={() => setEventsUseUtc((prev) => !prev)}
              >
                {eventsUseUtc ? t.showLocal : t.showUtc}
              </button>
            </div>
          </div>
          <div className="date-list">
            {eventData.rows.map((row) => {
              const rel = formatRelativeTime(row.rawDate, locale);
              return (
                <div className="date-row" key={row.key}>
                  <span className="date-name">{row.label}</span>
                  <span className="date-val">{row.value}</span>
                  {rel ? (
                    <span className={`date-rel${rel.future ? " future" : ""}`}>{rel.label}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </article>
      ) : null}

      {/* 实体卡(每个实体一张) */}
      {entityItems.map((entity, index) => (
        <article key={`${entity.title}-${index}`} className="result-card squircle">
          <div className="result-card-head">
            <span className="result-card-icon" aria-hidden>
              <Users size={14} strokeWidth={2} />
            </span>
            <h3 className="result-card-title">
              <span className="term-hash" aria-hidden># </span>
              {entity.title}
            </h3>
          </div>
          <div className="kv-panel">
            {entity.name ? (
              <div className="kv-row">
                <span className="kv-key">{t.entityName}:</span>
                <span className="kv-value">{entity.name}</span>
              </div>
            ) : null}
            {entity.org ? (
              <div className="kv-row">
                <span className="kv-key">{t.entityOrganization}:</span>
                <span className="kv-value">{entity.org}</span>
              </div>
            ) : null}
            {entity.email ? (
              <div className="kv-row">
                <span className="kv-key">{t.entityEmail}:</span>
                <span className="kv-value">{entity.email}</span>
              </div>
            ) : null}
            {entity.phone ? (
              <div className="kv-row">
                <span className="kv-key">{t.entityPhone}:</span>
                <span className="kv-value">{entity.phone}</span>
              </div>
            ) : null}
            {entity.address ? (
              <div className="kv-row">
                <span className="kv-key">{t.entityAddress}:</span>
                <span className="kv-value">{entity.address}</span>
              </div>
            ) : null}
          </div>
        </article>
      ))}

      {/* 名称服务器卡 */}
      {nameServerList.length ? (
        <NameServersSection
          t={t}
          nameServerList={nameServerList}
          openNameServers={openNameServers}
          dnsLookupMap={dnsLookupMap}
          copiedNameServer={copiedNameServer}
          onToggle={(host) => {
            setOpenNameServers((prev) => {
              const nextOpen = !prev[host];
              if (nextOpen && !dnsLookupMap[host]) {
                void lookupDns(host);
              }
              return { ...prev, [host]: nextOpen };
            });
          }}
          onCopy={(text, key) => {
            void handleCopyText(text, key);
          }}
          onRunDnsLookup={(host) => {
            void lookupDns(host);
          }}
        />
      ) : null}

      {/* DNSSEC 卡 */}
      {dnssecInfo ? (
        <article className="result-card squircle">
          <div className="result-card-head">
            <span className="result-card-icon" aria-hidden>
              {dnssecInfo.signed ? (
                <ShieldCheck size={14} strokeWidth={2} />
              ) : (
                <ShieldOff size={14} strokeWidth={2} />
              )}
            </span>
            <h3 className="result-card-title">
              <span className="term-hash" aria-hidden># </span>
              {t.dnssecTitle}
            </h3>
            <span className="result-card-meta">secureDNS</span>
          </div>
          <div className="dnssec-row">
            <span className={`result-badge squircle${dnssecInfo.signed ? "" : " is-muted"}`}>
              {dnssecInfo.signed ? t.dnssecSigned : t.dnssecUnsigned}
            </span>
            <code className="dnssec-code">delegationSigned: {String(dnssecInfo.delegationSigned)}</code>
          </div>
          <p className="dnssec-hint">
            {dnssecInfo.signed ? t.dnssecSignedHint : t.dnssecUnsignedHint}
          </p>
        </article>
      ) : null}

      {/* RDAP 查询链卡 */}
      {rdapChain ? (
        <article className="result-card squircle">
          <div className="result-card-head">
            <span className="result-card-icon" aria-hidden>
              <Network size={14} strokeWidth={2} />
            </span>
            <h3 className="result-card-title">
              <span className="term-hash" aria-hidden># </span>
              {t.rdapChainTitle}
            </h3>
            <span className="result-card-meta">{rdapChain.items.length}</span>
          </div>
          <div className="rdap-chain-list">
            {rdapChain.items.map((item, index) => (
              <div className="rdap-chain-row" key={`${item.label}-${index}`}>
                <span className={`rdap-chain-step step-${index + 1}`}>{index + 1}</span>
                <div className="rdap-chain-content">
                  <div className="rdap-chain-label">{item.label}</div>
                  <div className="rdap-chain-url">{item.url}</div>
                </div>
              </div>
            ))}
            {rdapChain.registrarUrl ? (
              <div className="rdap-chain-note">{t.rdapChainNote}</div>
            ) : null}
          </div>
        </article>
      ) : null}

      {/* 原始 JSON 卡(可折叠) */}
      <details className="result-card squircle json-details">
        <summary className="json-summary">
          <span className="result-card-icon" aria-hidden>
            <FileJson size={14} strokeWidth={2} />
          </span>
          <span className="result-card-title">
            <span className="term-hash" aria-hidden># </span>
            {t.rawJson}
          </span>
          <ChevronRight size={15} className="json-chev" aria-hidden />
        </summary>
        <div className="result-box raw-box">
          <div className="json-toolbar">
            <button type="button" className="download-btn squircle" onClick={handleDownloadJson}>
              <Download aria-hidden size={16} strokeWidth={2.2} />
              <span>{t.downloadJson}</span>
            </button>
            <div className="copy-btn-wrap">
              <button
                type="button"
                className={`copy-btn squircle ${copied ? "is-copied" : ""}`}
                onClick={() => {
                  void handleCopyJson();
                }}
                data-tooltip={copied ? t.copied : t.copy}
              >
                {copied ? (
                  <Check aria-hidden size={16} strokeWidth={2.4} />
                ) : (
                  <Copy aria-hidden size={16} strokeWidth={2.2} />
                )}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
            </div>
          </div>
          <pre
            className="raw-json squircle code-highlight"
            dangerouslySetInnerHTML={{ __html: highlightedJson }}
          />
        </div>
      </details>
    </section>
  );
}
