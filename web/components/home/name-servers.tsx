import { Check, Copy, Server } from "lucide-react";
import type { HomeCopy } from "@/web/lib/i18n";
import type { DnsLookupView, NameServerItem } from "@/web/lib/rdap-format";

export interface DnsLookupState {
  loading: boolean;
  error?: string;
  view?: DnsLookupView;
}

interface NameServersSectionProps {
  t: HomeCopy;
  nameServerList: NameServerItem[];
  openNameServers: Record<string, boolean>;
  dnsLookupMap: Record<string, DnsLookupState>;
  copiedNameServer: string | null;
  onToggle: (host: string) => void;
  onCopy: (text: string, key?: string) => void;
  onRunDnsLookup: (host: string) => void;
}

export function NameServersSection({
  t,
  nameServerList,
  openNameServers,
  dnsLookupMap,
  copiedNameServer,
  onToggle,
  onCopy,
  onRunDnsLookup
}: NameServersSectionProps) {
  return (
    <article className="result-card squircle">
      <div className="result-card-head">
        <span className="result-card-icon" aria-hidden>
          <Server size={14} strokeWidth={2} />
        </span>
        <h3 className="result-card-title">
          <span className="term-hash" aria-hidden># </span>
          {t.nameServers}
        </h3>
        <span className="result-card-meta">{nameServerList.length}</span>
      </div>
      <div className="ns-card-grid">
        {nameServerList.map((ns, index) => (
          <div className="ns-card" key={`${ns.host}-${index}`}>
            <div className="ns-card-head">
              <span className="ns-index">#{index + 1}</span>
              <span className="ns-value">{ns.host}</span>
              <div className="ns-actions">
                <span className="ns-active-badge squircle">active</span>
                <button
                  type="button"
                  className={`ns-copy squircle ${copiedNameServer === ns.host ? "is-copied" : ""}`}
                  aria-label={`Copy ${ns.host}`}
                  data-tooltip={copiedNameServer === ns.host ? t.copied : t.copy}
                  onClick={() => {
                    onCopy(ns.host, ns.host);
                  }}
                >
                  {copiedNameServer === ns.host ? (
                    <Check aria-hidden size={15} strokeWidth={2.4} />
                  ) : (
                    <Copy aria-hidden size={15} strokeWidth={2.2} />
                  )}
                </button>
                <button
                  type="button"
                  className="ns-toggle squircle"
                  onClick={() => {
                    onToggle(ns.host);
                  }}
                >
                  {openNameServers[ns.host] ? t.hide : t.details}
                </button>
              </div>
            </div>
            {openNameServers[ns.host] ? (
              <div className="ns-details">
                {ns.ipv4.length ? (
                  <div className="ns-row">
                    <span className="ns-label">A</span>
                    <span className="ns-data">{ns.ipv4.join(", ")}</span>
                  </div>
                ) : null}
                {ns.ipv6.length ? (
                  <div className="ns-row">
                    <span className="ns-label">AAAA</span>
                    <span className="ns-data">{ns.ipv6.join(", ")}</span>
                  </div>
                ) : null}
                <div className="ns-row ns-row-block">
                  <span className="ns-label">{t.dnsLookup}</span>
                  <div className="dns-lookup-box squircle">
                    {dnsLookupMap[ns.host]?.loading ? (
                      <span className="dns-loading">{t.loading}</span>
                    ) : dnsLookupMap[ns.host]?.error ? (
                      <span className="dns-error">{dnsLookupMap[ns.host]?.error}</span>
                    ) : dnsLookupMap[ns.host]?.view ? (
                      <div className="dns-grid">
                        {(["A", "AAAA"] as const).map((recordType) => {
                          const values =
                            dnsLookupMap[ns.host]?.view?.groups?.[recordType] ?? [];
                          if (!values.length) {
                            return null;
                          }
                          return (
                            <div className="dns-row" key={`${ns.host}-${recordType}`}>
                              <span className="dns-type">{recordType}</span>
                              <span className="dns-values">{values.join(", ")}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="dns-run squircle"
                        onClick={() => {
                          onRunDnsLookup(ns.host);
                        }}
                      >
                        {t.runDnsLookup}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </article>
  );
}
