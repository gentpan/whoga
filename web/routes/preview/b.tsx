import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Calendar,
  ChevronDown,
  Database,
  Globe,
  History,
  Info,
  Layers,
  Network,
  Radar,
  Search,
  Server,
  ShieldOff,
  Terminal
} from "lucide-react";
import sample from "@/web/preview/sample-google-com.json";
import stats from "@/web/preview/sample-stats.json";
import "@/web/preview/design-b.css";

export const Route = createFileRoute("/preview/b")({
  component: PreviewB
});

/* ---------- 数据派生 ---------- */

const DAY_MS = 86_400_000;

type VcardRow = [string, unknown, string, unknown];

interface EntityLike {
  roles?: string[];
  publicIds?: Array<{ type: string; identifier: string }>;
  vcardArray?: [string, VcardRow[]];
  entities?: EntityLike[];
}

function vcardValue(rows: VcardRow[] | undefined, name: string): string | undefined {
  const hit = rows?.find((row) => row[0] === name)?.[3];
  return typeof hit === "string" && hit.length > 0 ? hit : undefined;
}

const registryEntities = sample.registryResult.entities as unknown as EntityLike[];
const registrarEntity = registryEntities.find((e) => e.roles?.includes("registrar"));
const registrarRows = registrarEntity?.vcardArray?.[1];
const registrarName = vcardValue(registrarRows, "fn") ?? "MarkMonitor Inc.";
const registrarIanaId =
  registrarEntity?.publicIds?.find((p) => p.type === "IANA Registrar ID")?.identifier ?? "292";
const abuseEntity = registrarEntity?.entities?.find((e) => e.roles?.includes("abuse"));
const abuseRows = abuseEntity?.vcardArray?.[1];
const abuseEmail = vcardValue(abuseRows, "email") ?? null;
const abuseTelRaw = vcardValue(abuseRows, "tel");
const abuseTel = abuseTelRaw ? abuseTelRaw.replace(/^tel:/, "") : null;

const EVENT_LABELS: Record<string, string> = {
  registration: "注册",
  expiration: "到期",
  "registrar expiration": "注册商到期",
  "last changed": "最近变更",
  "last update of rdap database": "RDAP 数据库更新"
};

interface TimelineEvent {
  action: string;
  label: string;
  date: string;
  ts: number;
}

const timelineEvents: TimelineEvent[] = sample.result.events
  .map((e) => ({
    action: e.eventAction,
    label: EVENT_LABELS[e.eventAction] ?? e.eventAction,
    date: e.eventDate.slice(0, 10),
    ts: Date.parse(e.eventDate)
  }))
  .sort((a, b) => a.ts - b.ts);

const SUFFIX_CHIPS = [
  "com", "net", "org", "io", "dev", "app", "ai", "co", "cn", "de",
  "uk", "jp", "xyz", "info", "biz", "me", "tv", "cc", "gg", "shop"
];

const FAQ_ITEMS: Array<{ q: string; a: ReactNode }> = [
  {
    q: "RDAP 和传统 WHOIS 协议有什么区别?",
    a: (
      <>
        RDAP 是 WHOIS 的现代化继任协议:基于 HTTPS 传输、返回结构化 JSON、状态码与字段语义
        由 ICANN 统一标准化,并原生支持国际化域名。当目标注册局尚未部署 RDAP 时,本站会自动回退
        到传统 <code>port43</code> WHOIS 查询,例如本例中的 <code>whois.markmonitor.com</code>。
      </>
    )
  },
  {
    q: "状态 clientTransferProhibited 是什么意思?",
    a: (
      <>
        这是一把“注册商锁”,表示该域名在注册商层面被禁止转移,是防止域名被恶意过户的常见保护手段。
        状态码前缀分两类:<code>client</code> 开头由注册商设置,<code>server</code>{" "}
        开头由注册局(如 Verisign)设置;出现 <code>hold</code> 类状态才通常意味着域名被暂停解析。
      </>
    )
  },
  {
    q: "支持查询哪些类型的目标?",
    a: (
      <>
        支持域名、IPv4 / IPv6 地址、ASN 自治系统号(如 <code>AS15169</code>)以及 TLD
        后缀本身。输入时无需指定类型,搜索框会自动识别并路由到 IANA 对应的 RDAP bootstrap
        引导文件(dns / ipv4 / ipv6 / asn)。
      </>
    )
  },
  {
    q: "数据来自哪里,多久更新一次?",
    a: (
      <>
        查询实时转发至各注册局与注册商的官方 RDAP 服务,不做中间篡改;IANA bootstrap
        引导数据每日同步,当前 dns.json 发布于 <code>2026-09-30</code>,覆盖{" "}
        <code>1,366 / 1,437</code> 个根 TLD 的 RDAP 服务发现。
      </>
    )
  }
];

/* ---------- 工具函数 ---------- */

function detectType(input: string): { kind: string; hint: string } {
  const v = input.trim();
  if (!v) return { kind: "AUTO", hint: "自动识别查询类型" };
  if (/^as\d+$/i.test(v)) return { kind: "ASN", hint: "自治系统 · bootstrap: asn" };
  if (/^\d{1,10}$/.test(v)) return { kind: "ASN", hint: "纯数字 · 按 ASN 处理" };
  if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(v))
    return { kind: "IPv4", hint: "IP 地址 · bootstrap: ipv4" };
  if (v.includes(":")) return { kind: "IPv6", hint: "IP 地址 · bootstrap: ipv6" };
  if (/^\.?[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(v) && !v.replace(/^\./, "").includes("."))
    return { kind: "TLD", hint: "顶级域 / 后缀查询" };
  return { kind: "DOMAIN", hint: "域名 · bootstrap: dns" };
}

function badgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("hold")) return "pb-badge pb-badge--hold";
  if (s === "active" || s === "ok" || s === "registered") return "pb-badge pb-badge--ok";
  if (s.startsWith("client")) return "pb-badge pb-badge--client";
  if (s.startsWith("server")) return "pb-badge pb-badge--server";
  return "pb-badge pb-badge--neutral";
}

const JSON_TOKEN_RE =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;

function highlightJson(src: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of src.matchAll(JSON_TOKEN_RE)) {
    const index = m.index ?? 0;
    if (index > last) out.push(src.slice(last, index));
    if (m[1] !== undefined) {
      out.push(
        <span key={key++} className={m[2] ? "pb-tk-key" : "pb-tk-str"}>
          {m[1]}
        </span>
      );
      if (m[2]) out.push(m[2]);
    } else if (m[3] !== undefined) {
      out.push(
        <span key={key++} className="pb-tk-num">
          {m[3]}
        </span>
      );
    } else if (m[4] !== undefined) {
      out.push(
        <span key={key++} className="pb-tk-bool">
          {m[4]}
        </span>
      );
    } else if (m[5] !== undefined) {
      out.push(
        <span key={key++} className="pb-tk-null">
          {m[5]}
        </span>
      );
    }
    last = index + m[0].length;
  }
  if (last < src.length) out.push(src.slice(last));
  return out;
}

/* ---------- 页面 ---------- */

function PreviewB() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const detected = detectType(value);

  const derived = useMemo(() => {
    const now = Date.now();
    const regTs = Date.parse("1997-09-15T04:00:00Z");
    const expEvent = sample.result.events.find((e) => e.eventAction === "expiration");
    const expTs = expEvent ? Date.parse(expEvent.eventDate) : Date.parse("2028-09-13T07:00:00Z");
    const ageDays = Math.max(0, Math.floor((now - regTs) / DAY_MS));
    const expInDays = Math.max(0, Math.ceil((expTs - now) / DAY_MS));
    const lifePct = Math.min(100, Math.max(0, ((now - regTs) / (expTs - regTs)) * 100));

    const rawView = {
      domain: sample.domain,
      queryType: sample.queryType,
      handle: sample.result.handle,
      ldhName: sample.result.ldhName,
      status: sample.result.status,
      events: sample.result.events.map((e) => ({
        action: e.eventAction,
        date: e.eventDate
      })),
      nameservers: sample.result.nameservers.map((n) => ({
        name: n.ldhName,
        status: n.status
      })),
      secureDNS: sample.result.secureDNS,
      registrar: {
        name: registrarName,
        ianaId: registrarIanaId,
        abuseEmail,
        abuseTel,
        port43: sample.result.port43
      },
      rdapConformance: sample.result.rdapConformance,
      source: {
        bootstrap: sample.source.dnsJsonUrl,
        matchedSuffix: sample.match.matchedSuffix,
        registry: sample.rdapServer,
        registrar: sample.registrarRdapServer,
        resultSource: sample.resultSource,
        publication: sample.source.publication
      }
    };
    const rawJson = JSON.stringify(rawView, null, 2);
    return { now, expTs, ageDays, expInDays, lifePct, rawJson };
  }, []);

  const jsonNodes = useMemo(() => highlightJson(derived.rawJson), [derived.rawJson]);

  const coverage = stats.rootTldCoverage;
  const coveragePct = ((coverage.withRdap / coverage.total) * 100).toFixed(1);
  const dnsItem = stats.items.find((item) => item.key === "dns");
  const barMax = Math.max(...stats.items.map((item) => item.supportedCount));
  const bootstrapTotal = stats.items.reduce((sum, item) => sum + item.supportedCount, 0);

  const go = (q: string) => {
    const query = q.trim();
    if (query) navigate({ to: "/whois/$query", params: { query } });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    go(value);
  };

  return (
    <div className="preview-b">
      {/* 顶部导航 */}
      <header className="pb-topbar">
        <div className="pb-wrap pb-topbar-inner">
          <div className="pb-brand">
            <span className="pb-brand-mark">
              <Terminal size={14} />
            </span>
            <span className="pb-brand-name">who.ga</span>
            <span className="pb-brand-divider" />
            <span className="pb-brand-sub">RDAP / WHOIS 查询台</span>
          </div>
          <nav className="pb-topnav">
            <a className="pb-topnav-link is-active" href="#">
              查询
            </a>
            <a className="pb-topnav-link" href="#">
              覆盖统计
            </a>
            <a className="pb-topnav-link" href="#">
              后缀目录
            </a>
            <a className="pb-topnav-link" href="#">
              常见问题
            </a>
            <span className="pb-version-pill">RDAP · BOOTSTRAP 2026-09-30</span>
          </nav>
        </div>
      </header>

      {/* 搜索区 */}
      <section className="pb-search-section">
        <div className="pb-wrap">
          <div className="pb-search-label">
            <Search size={12} />
            Lookup / 注册数据查询
          </div>
          <form className="pb-searchbox" onSubmit={onSubmit}>
            <div className="pb-typebadge">
              <span className="pb-typebadge-kind">{detected.kind}</span>
              <span className="pb-typebadge-hint">{detected.hint}</span>
            </div>
            <input
              className="pb-search-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="输入域名、IP 地址、ASN 或后缀,例如 google.com"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="pb-search-btn" type="submit">
              <span>查询</span>
              <ArrowRight size={14} />
            </button>
          </form>
          <div className="pb-quick">
            <span className="pb-quick-label">快速示例</span>
            {["google.com", "8.8.8.8", "AS15169", ".dev"].map((q) => (
              <button key={q} type="button" className="pb-quick-chip" onClick={() => go(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      <main className="pb-wrap">
        {/* 查询结果元信息条 */}
        <div className="pb-metabar">
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">目标</span>
            <span className="pb-metabar-val is-accent">GOOGLE.COM</span>
          </span>
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">类型</span>
            <span className="pb-metabar-val">DOMAIN</span>
          </span>
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">链路</span>
            <span className="pb-metabar-val">REGISTRY → REGISTRAR</span>
          </span>
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">来源</span>
            <span className="pb-metabar-val">rdap.markmonitor.com</span>
          </span>
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">缓存</span>
            <span className="pb-metabar-val">{sample.cache.hit ? "HIT" : "MISS"} · {sample.cache.backend}</span>
          </span>
          <span className="pb-metabar-item">
            <span className="pb-metabar-key">数据更新</span>
            <span className="pb-metabar-val">2026-10-19 18:45Z</span>
          </span>
        </div>

        {/* 仪表盘网格 */}
        <div className="pb-grid">
          {/* 左列 */}
          <div className="pb-col">
            {/* 域名概要卡 */}
            <section className="pb-card">
              <div className="pb-card-head">
                <span className="pb-card-title">
                  <Globe size={13} />
                  域名概要 · Domain Overview
                </span>
                <span className="pb-card-extra">{sample.result.handle}</span>
              </div>
              <div className="pb-card-body">
                <div className="pb-domain-row">
                  <span className="pb-dot-live" />
                  <span className="pb-domain">GOOGLE.COM</span>
                  <span className="pb-badge pb-badge--ok">已注册</span>
                </div>

                <div className="pb-badges">
                  {sample.result.status.map((s) => (
                    <span key={s} className={badgeClass(s)}>
                      {s.replace(/\s+/g, "")}
                    </span>
                  ))}
                </div>

                <div className="pb-kv">
                  <span className="pb-kv-key">注册商</span>
                  <span className="pb-kv-val">
                    <strong>{registrarName}</strong> · IANA #{registrarIanaId}
                  </span>
                  <span className="pb-kv-key">滥用联系</span>
                  <span className="pb-kv-val">
                    {abuseEmail ?? "—"}
                    {abuseTel ? ` · ${abuseTel}` : ""}
                  </span>
                  <span className="pb-kv-key">RDAP 服务</span>
                  <span className="pb-kv-val">{sample.registrarRdapServer}</span>
                  <span className="pb-kv-key">WHOIS 回退</span>
                  <span className="pb-kv-val">{sample.result.port43}</span>
                </div>

                <div className="pb-ministats">
                  <div className="pb-ministat">
                    <div className="pb-ministat-value">
                      {(derived.ageDays / 365.25).toFixed(1)}
                      <small>年</small>
                    </div>
                    <div className="pb-ministat-caption">
                      域名年龄 · {derived.ageDays.toLocaleString("en-US")} 天
                    </div>
                  </div>
                  <div className="pb-ministat">
                    <div className="pb-ministat-value">
                      {derived.expInDays.toLocaleString("en-US")}
                      <small>天</small>
                    </div>
                    <div className="pb-ministat-caption">距到期 · 2028-09-13</div>
                  </div>
                  <div className="pb-ministat">
                    <div className="pb-ministat-value">
                      {sample.result.nameservers.length}
                      <small>台</small>
                    </div>
                    <div className="pb-ministat-caption">名称服务器 · 全部 active</div>
                  </div>
                </div>

                <div className="pb-progress">
                  <div className="pb-progress-track">
                    <div className="pb-progress-fill" style={{ width: `${derived.lifePct}%` }} />
                  </div>
                  <div className="pb-progress-caption">
                    <span>1997-09-15 注册</span>
                    <span>注册周期已流逝 {derived.lifePct.toFixed(1)}%</span>
                    <span>2028-09-13 到期</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 原始 JSON 终端面板 */}
            <section className="pb-term">
              <div className="pb-term-head">
                <span className="pb-term-dot pb-term-dot--r" />
                <span className="pb-term-dot pb-term-dot--y" />
                <span className="pb-term-dot pb-term-dot--g" />
                <span className="pb-term-title">rdap-response.json — {sample.registrarRdapServer}</span>
                <span className="pb-term-tag">
                  {derived.rawJson.split("\n").length} 行 · application/rdap+json
                </span>
              </div>
              <pre className="pb-term-body">{jsonNodes}</pre>
            </section>
          </div>

          {/* 右列 */}
          <div className="pb-col">
            {/* 事件时间线 */}
            <section className="pb-card">
              <div className="pb-card-head">
                <span className="pb-card-title">
                  <Calendar size={13} />
                  事件时间线 · Events
                </span>
                <span className="pb-card-extra">{timelineEvents.length} 条记录</span>
              </div>
              <div className="pb-card-body">
                <div className="pb-tl">
                  {timelineEvents.map((e) => {
                    const future = e.ts > derived.now;
                    return (
                      <div
                        key={`${e.action}-${e.date}`}
                        className={`pb-tl-item ${future ? "pb-tl-item--future" : "pb-tl-item--past"}`}
                      >
                        <span className="pb-tl-dot" />
                        <div className="pb-tl-main">
                          <div>
                            <div className="pb-tl-action">{e.label}</div>
                            {e.action === "expiration" && (
                              <div className="pb-tl-note">
                                距今 {derived.expInDays.toLocaleString("en-US")} 天
                              </div>
                            )}
                          </div>
                          <span className="pb-tl-date">{e.date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 名称服务器 */}
            <section className="pb-card">
              <div className="pb-card-head">
                <span className="pb-card-title">
                  <Server size={13} />
                  名称服务器 · NS
                </span>
                <span className="pb-card-extra">{sample.result.nameservers.length} 台在线</span>
              </div>
              <div className="pb-card-body">
                <div className="pb-ns-list">
                  {sample.result.nameservers.map((ns) => (
                    <div key={ns.ldhName} className="pb-ns-row">
                      <span className="pb-ns-name">
                        <span className="pb-ns-dot" />
                        {ns.ldhName}
                      </span>
                      <span className="pb-ns-meta">
                        {ns.status.join(", ")} · 变更 {ns.events[0]?.eventDate.slice(0, 10) ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* DNSSEC */}
            <section className="pb-card">
              <div className="pb-card-head">
                <span className="pb-card-title">
                  <ShieldOff size={13} />
                  DNSSEC
                </span>
                <span className="pb-card-extra">secureDNS</span>
              </div>
              <div className="pb-card-body">
                <div className="pb-dnssec">
                  <span className="pb-dnssec-icon">
                    <ShieldOff size={16} />
                  </span>
                  <div>
                    <div className="pb-dnssec-title">未启用 DNSSEC 签名</div>
                    <div className="pb-dnssec-desc">
                      <code>delegationSigned: false</code> — 该域未发布 DS
                      记录,解析链不进行加密签名验证。
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* RDAP 查询链 */}
            <section className="pb-card">
              <div className="pb-card-head">
                <span className="pb-card-title">
                  <Network size={13} />
                  RDAP 查询链 · Chain
                </span>
                <span className="pb-card-extra">4 步解析</span>
              </div>
              <div className="pb-card-body">
                <div className="pb-chain">
                  <div className="pb-chain-step">
                    <span className="pb-chain-num">1</span>
                    <div>
                      <div className="pb-chain-title">输入识别</div>
                      <div className="pb-chain-desc">
                        <em>google.com</em> · 识别为 DOMAIN 查询
                      </div>
                    </div>
                  </div>
                  <div className="pb-chain-step">
                    <span className="pb-chain-num">2</span>
                    <div>
                      <div className="pb-chain-title">Bootstrap 匹配</div>
                      <div className="pb-chain-desc">
                        dns.json 最长后缀匹配 <em>com</em> · dns-json
                      </div>
                    </div>
                  </div>
                  <div className="pb-chain-step">
                    <span className="pb-chain-num">3</span>
                    <div>
                      <div className="pb-chain-title">注册局 RDAP</div>
                      <div className="pb-chain-desc">
                        <em>rdap.verisign.com</em> · Verisign .com 注册局
                      </div>
                    </div>
                  </div>
                  <div className="pb-chain-step pb-chain-step--result">
                    <span className="pb-chain-num">4</span>
                    <div>
                      <div className="pb-chain-title">注册商 RDAP · 结果来源</div>
                      <div className="pb-chain-desc">
                        <em>rdap.markmonitor.com</em> · {registrarName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* 统计数字带 */}
        <section className="pb-section">
          <div className="pb-section-head">
            <span className="pb-section-title">
              <Radar size={15} />
              全球后缀覆盖
            </span>
            <span className="pb-section-note">数据源 IANA RDAP BOOTSTRAP · 更新于 2026-10-19</span>
          </div>
          <div className="pb-stats">
            <div className="pb-stat">
              <div className="pb-stat-label">
                <Globe size={12} />
                可查询后缀
              </div>
              <div className="pb-stat-value">
                {stats.queryableDomainSuffixes.toLocaleString("en-US")}
              </div>
              <div className="pb-stat-sub">含公共后缀与子级公共后缀</div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat-label">
                <Radar size={12} />
                TLD RDAP 覆盖
              </div>
              <div className="pb-stat-value">
                {coverage.withRdap.toLocaleString("en-US")}
                <small>/ {coverage.total.toLocaleString("en-US")}</small>
              </div>
              <div className="pb-coverbar">
                <span
                  className="pb-coverbar-seg--rdap"
                  style={{ width: `${(coverage.withRdap / coverage.total) * 100}%` }}
                />
                <span
                  className="pb-coverbar-seg--whois"
                  style={{ width: `${(coverage.withWhoisFallback / coverage.total) * 100}%` }}
                />
                <span
                  className="pb-coverbar-seg--web"
                  style={{ width: `${(coverage.withWebRegistryOnly / coverage.total) * 100}%` }}
                />
              </div>
              <div className="pb-coverbar-legend">
                <span>
                  <i style={{ background: "var(--pb-green)" }} />
                  RDAP {coverage.withRdap}
                </span>
                <span>
                  <i style={{ background: "var(--pb-amber)" }} />
                  WHOIS {coverage.withWhoisFallback}
                </span>
                <span>
                  <i style={{ background: "var(--pb-violet)" }} />
                  网页 {coverage.withWebRegistryOnly}
                </span>
              </div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat-label">
                <History size={12} />
                WHOIS 回退
              </div>
              <div className="pb-stat-value">
                {coverage.withWhoisFallback}
                <small>个 TLD</small>
              </div>
              <div className="pb-stat-sub">
                注册局无 RDAP 时自动回退 · 覆盖率 <em>{coveragePct}%</em>
              </div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat-label">
                <Database size={12} />
                DNS 支持项
              </div>
              <div className="pb-stat-value">
                {dnsItem ? dnsItem.supportedCount.toLocaleString("en-US") : "—"}
              </div>
              <div className="pb-stat-sub">
                dns.json 发布于 {dnsItem ? dnsItem.publication.slice(0, 10) : "—"}
              </div>
            </div>
            <div className="pb-stat">
              <div className="pb-stat-label">
                <Activity size={12} />
                Bootstrap 分布
              </div>
              <div className="pb-bars">
                {stats.items.map((item) => (
                  <div key={item.key} className="pb-bar-row">
                    <span className="pb-bar-label">{item.key === "object-tags" ? "tags" : item.key}</span>
                    <span className="pb-bar-track">
                      <span
                        className="pb-bar-fill"
                        style={{ width: `${Math.max(3, (item.supportedCount / barMax) * 100)}%` }}
                      />
                    </span>
                    <span className="pb-bar-value">{item.supportedCount.toLocaleString("en-US")}</span>
                  </div>
                ))}
              </div>
              <div className="pb-stat-sub">合计 {bootstrapTotal.toLocaleString("en-US")} 个支持项</div>
            </div>
          </div>
        </section>

        {/* 后缀 chips */}
        <section className="pb-section">
          <div className="pb-section-head">
            <span className="pb-section-title">
              <Layers size={15} />
              热门可查询后缀
            </span>
            <span className="pb-section-note">
              共 {stats.queryableDomainSuffixes.toLocaleString("en-US")} 个 · 点击任意后缀可查询
            </span>
          </div>
          <div className="pb-chips">
            {SUFFIX_CHIPS.map((s) => (
              <button key={s} type="button" className="pb-chip" onClick={() => go(`.${s}`)}>
                .{s}
              </button>
            ))}
            <span className="pb-chip pb-chip--more">+ {stats.queryableDomainSuffixes - SUFFIX_CHIPS.length} 更多</span>
          </div>
        </section>

        {/* FAQ 手风琴 */}
        <section className="pb-section">
          <div className="pb-section-head">
            <span className="pb-section-title">
              <Info size={15} />
              常见问题
            </span>
            <span className="pb-section-note">FAQ · {FAQ_ITEMS.length} 条</span>
          </div>
          <div className="pb-faq">
            {FAQ_ITEMS.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>
                  {item.q}
                  <ChevronDown size={15} className="pb-faq-chevron" />
                </summary>
                <div className="pb-faq-answer">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="pb-footer">
        <div className="pb-wrap pb-footer-inner">
          <span>who.ga · RDAP / WHOIS 查询服务 · 数据来源:IANA 与各注册局 / 注册商官方服务</span>
          <span className="pb-footer-mono">BOOTSTRAP 2026-09-30 · STATIC PREVIEW</span>
        </div>
      </footer>

      {/* 角落标记 */}
      <div className="pb-marker">
        <i />
        方案 B · 仪表盘
      </div>
    </div>
  );
}
