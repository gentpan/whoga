import { useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Braces, ChevronDown, Lock, Search, ShieldAlert } from "lucide-react";
import sample from "@/web/preview/sample-google-com.json";
import statsData from "@/web/preview/sample-stats.json";
import suffixData from "@/web/preview/sample-suffixes.json";
import "@/web/preview/design-a.css";

export const Route = createFileRoute("/preview/a")({
  component: DesignAPage
});

interface PreviewEntity {
  handle?: string;
  roles?: string[];
  publicIds?: Array<{ type: string; identifier: string }>;
  vcardArray?: unknown;
}

const NAV_LINKS = [
  { label: "统计", target: "stats" },
  { label: "API", target: "faq-api" },
  { label: "后缀", target: "suffixes" },
  { label: "FAQ", target: "faq" }
];

const QUICK_EXAMPLES = ["google.com", "8.8.8.8", "AS15169"];

const POPULAR_SUFFIXES = [
  "com",
  "net",
  "org",
  "io",
  "ai",
  "cn",
  "co",
  "dev",
  "app",
  "xyz",
  "info",
  "me",
  "cc",
  "tv",
  "uk",
  "de",
  "jp",
  "shop",
  "top",
  "cloud"
];

const FAQ_ITEMS = [
  {
    id: "faq-rdap",
    question: "什么是 RDAP?",
    answer:
      "RDAP(Registration Data Access Protocol)是 WHOIS 的现代化继任者,由 IETF 标准化(RFC 7480-7485)。它通过 HTTPS 返回结构化 JSON 数据,原生支持国际化域名、访问控制与机器可读解析。WHO.GA 的所有查询默认优先走 RDAP,仅在目标后缀没有 RDAP 服务时回退到传统 WHOIS。"
  },
  {
    id: "faq-types",
    question: "支持哪些查询类型?",
    answer:
      "支持域名(覆盖 1,391 个可查询后缀)、IPv4 / IPv6 地址、ASN 自治系统号,以及后缀本身的注册局信息。输入内容后系统会自动识别类型,并路由到对应的 RDAP 或 WHOIS 服务器,无需手动选择。"
  },
  {
    id: "faq-api",
    question: "是否提供 JSON API?",
    answer:
      "提供。页面上的每一次查询都有对应的结构化 API,例如 GET /api/whois/google.com 即可返回与本页完全相同的数据,无需密钥、可以直接在脚本或自动化流程中集成。响应中附带数据来源与缓存状态等元信息。"
  },
  {
    id: "faq-freshness",
    question: "数据多久更新一次?",
    answer:
      "IANA 的 RDAP 引导数据(bootstrap)每日同步;域名记录则实时查询自各注册局与注册商的服务器,并带有短时缓存以提升响应速度——缓存命中情况会在响应的 cache 字段中明确标出。"
  }
];

const numberFormat = new Intl.NumberFormat("en-US");

function formatNumber(value: number): string {
  return numberFormat.format(value);
}

function vcardText(entity: PreviewEntity | undefined, key: string): string | undefined {
  const vcard = entity?.vcardArray;
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) {
    return undefined;
  }
  for (const entry of vcard[1] as unknown[]) {
    if (Array.isArray(entry) && entry[0] === key && typeof entry[3] === "string" && entry[3]) {
      return entry[3];
    }
  }
  return undefined;
}

function highlightJson(source: string): ReactNode[] {
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(source.slice(lastIndex, index));
    }
    const [token, quoted, colon] = match;
    if (quoted !== undefined) {
      nodes.push(
        <span key={key++} className={colon ? "tok-key" : "tok-string"}>
          {quoted}
        </span>
      );
      if (colon) {
        nodes.push(colon);
      }
    } else if (token === "true" || token === "false" || token === "null") {
      nodes.push(
        <span key={key++} className="tok-literal">
          {token}
        </span>
      );
    } else {
      nodes.push(
        <span key={key++} className="tok-number">
          {token}
        </span>
      );
    }
    lastIndex = index + token.length;
  }
  nodes.push(source.slice(lastIndex));
  return nodes;
}

function DesignAPage() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const result = sample.result;
  const entities = result.entities as unknown as PreviewEntity[];

  const pickDate = (action: string) =>
    result.events.find((event) => event.eventAction === action)?.eventDate.slice(0, 10);

  const registrationDate = pickDate("registration");
  const changedDate = pickDate("last changed");
  const expirationDate = pickDate("expiration");

  const ageYears = registrationDate
    ? Math.floor((Date.now() - new Date(registrationDate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const registrarEntity = entities.find((entity) => entity.roles?.includes("registrar"));
  const registrarName = vcardText(registrarEntity, "fn") ?? "MarkMonitor Inc.";
  const registrarIanaId = registrarEntity?.publicIds?.find((id) => id.type === "IANA Registrar ID")?.identifier;

  const registryServer = sample.rdapServer;
  const registrarServer = sample.registrarRdapServer;

  const rawJson = useMemo(() => JSON.stringify(result, null, 2), [result]);
  const rawLines = useMemo(() => rawJson.split("\n").length, [rawJson]);
  const highlighted = useMemo(() => highlightJson(rawJson), [rawJson]);

  const suffixes = useMemo(
    () => POPULAR_SUFFIXES.filter((suffix) => suffixData.suffixes.includes(suffix)),
    []
  );

  const coverage = statsData.rootTldCoverage;
  const asnSupport = statsData.items.find((item) => item.key === "asn")?.supportedCount ?? 0;

  const goLookup = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }
    void navigate({ to: "/whois/$query", params: { query: trimmed } });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goLookup(value);
  };

  const scrollTo = (target: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="preview-a">
      <header className="pa-nav">
        <div className="pa-nav-inner">
          <a className="pa-logo" href="/preview/a">
            <span className="pa-logo-mark" aria-hidden />
            WHO<span className="pa-logo-tld">.GA</span>
          </a>
          <nav className="pa-nav-right">
            {NAV_LINKS.map((link) => (
              <a key={link.target} className="pa-nav-link" href={`#${link.target}`} onClick={scrollTo(link.target)}>
                {link.label}
              </a>
            ))}
            <span className="pa-badge">方案 A · 极简</span>
          </nav>
        </div>
      </header>

      <section className="pa-hero">
        <div className="pa-container">
          <span className="pa-eyebrow">RDAP · WHOIS · JSON API</span>
          <h1>看清每一个域名的来龙去脉</h1>
          <p className="pa-hero-sub">
            基于 RDAP 协议的现代化查询服务:输入域名、IP 或 ASN,一次返回注册局与注册商的结构化数据。
          </p>
          <form className="pa-search" onSubmit={handleSubmit} role="search">
            <span className="pa-search-icon" aria-hidden>
              <Search size={20} strokeWidth={2} />
            </span>
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="输入域名、IP 或 ASN"
              aria-label="输入域名、IP 或 ASN"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="pa-search-btn">
              查询
            </button>
          </form>
          <div className="pa-hints">
            <span>试试</span>
            {QUICK_EXAMPLES.map((example) => (
              <button key={example} type="button" className="pa-hint-btn" onClick={() => goLookup(example)}>
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pa-section" id="result">
        <div className="pa-container">
          <div className="pa-section-head">
            <div className="pa-overline">示例查询</div>
            <h2 className="pa-title">google.com 的查询结果</h2>
            <p className="pa-sub">真实 RDAP 响应的渲染示例:状态、关键日期、注册商与名称服务器,以及可展开的原始 JSON。</p>
          </div>

          <div className="pa-card">
            <div className="pa-card-head">
              <span className="pa-card-domain">google.com</span>
              <span className="pa-card-source">示例数据 · 来源 MarkMonitor RDAP</span>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">域名状态</div>
              <div className="pa-status-list">
                {result.status.map((status) => (
                  <span key={status} className="pa-chip">
                    <Lock size={11} strokeWidth={2.2} aria-hidden />
                    {status}
                  </span>
                ))}
              </div>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">关键日期</div>
              <div className="pa-dates">
                <div className="pa-date">
                  <span className="pa-date-label">注册日期</span>
                  <span className="pa-date-value">{registrationDate}</span>
                  {ageYears !== null && <span className="pa-date-note">已满 {ageYears} 年</span>}
                </div>
                <div className="pa-date">
                  <span className="pa-date-label">最近更新</span>
                  <span className="pa-date-value">{changedDate}</span>
                </div>
                <div className="pa-date">
                  <span className="pa-date-label">过期日期</span>
                  <span className="pa-date-value">{expirationDate}</span>
                </div>
              </div>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">注册商</div>
              <div className="pa-kv">
                {registrarName}
                {registrarIanaId && <span className="pa-kv-sub">IANA ID {registrarIanaId}</span>}
              </div>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">DNSSEC</div>
              <div className="pa-dnssec">
                <span className="pa-dnssec-chip">
                  <ShieldAlert size={13} strokeWidth={2.2} aria-hidden />
                  未签名
                </span>
                <span className="pa-dnssec-raw">delegationSigned: false</span>
              </div>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">名称服务器</div>
              <div className="pa-ns-grid">
                {result.nameservers.map((ns) => (
                  <span key={ns.ldhName} className="pa-ns">
                    <span className="pa-ns-dot" aria-hidden />
                    {ns.ldhName}
                  </span>
                ))}
              </div>
            </div>

            <div className="pa-row">
              <div className="pa-row-label">RDAP 服务器</div>
              <div>
                <div className="pa-server-line">
                  <span className="pa-server-role">注册局</span>
                  <span className="pa-server-host">{registryServer}</span>
                </div>
                <div className="pa-server-line">
                  <span className="pa-server-role">注册商</span>
                  <span className="pa-server-host">{registrarServer}</span>
                </div>
              </div>
            </div>

            <details className="pa-json">
              <summary>
                <Braces size={15} strokeWidth={2} aria-hidden />
                原始 RDAP 响应(JSON)
                <span className="pa-json-lines">{formatNumber(rawLines)} 行</span>
                <ChevronDown className="pa-json-chevron" size={16} strokeWidth={2} aria-hidden />
              </summary>
              <pre>
                <code>{highlighted}</code>
              </pre>
            </details>
          </div>
        </div>
      </section>

      <section className="pa-section pa-stats" id="stats">
        <div className="pa-container">
          <div className="pa-section-head">
            <div className="pa-overline">数据统计</div>
            <h2 className="pa-title">覆盖整个根区的查询能力</h2>
          </div>
          <div className="pa-stats-grid">
            <div className="pa-stat">
              <div className="pa-stat-value">{formatNumber(statsData.queryableDomainSuffixes)}</div>
              <div className="pa-stat-label">可查询后缀</div>
            </div>
            <div className="pa-stat">
              <div className="pa-stat-value">
                {formatNumber(coverage.withRdap)}
                <small> / {formatNumber(coverage.total)}</small>
              </div>
              <div className="pa-stat-label">根区 TLD RDAP 覆盖</div>
            </div>
            <div className="pa-stat">
              <div className="pa-stat-value">{formatNumber(coverage.withWhoisFallback)}</div>
              <div className="pa-stat-label">WHOIS 回退后缀</div>
            </div>
            <div className="pa-stat">
              <div className="pa-stat-value">{formatNumber(asnSupport)}</div>
              <div className="pa-stat-label">ASN 分配机构</div>
            </div>
          </div>
        </div>
      </section>

      <section className="pa-section" id="suffixes">
        <div className="pa-container">
          <div className="pa-section-head">
            <div className="pa-overline">热门后缀</div>
            <h2 className="pa-title">从 {formatNumber(suffixData.count)} 个后缀开始</h2>
            <p className="pa-sub">点击任意后缀,查看其注册局信息与 RDAP 支持情况。</p>
          </div>
          <div className="pa-chips">
            {suffixes.map((suffix) => (
              <button key={suffix} type="button" className="pa-suffix" onClick={() => goLookup(suffix)}>
                .{suffix}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pa-section" id="faq">
        <div className="pa-container">
          <div className="pa-section-head">
            <div className="pa-overline">常见问题</div>
            <h2 className="pa-title">关于 WHO.GA</h2>
          </div>
          <div className="pa-faq">
            {FAQ_ITEMS.map((item) => (
              <details key={item.id} className="pa-faq-item" id={item.id}>
                <summary>
                  {item.question}
                  <ChevronDown className="pa-faq-chevron" size={17} strokeWidth={2} aria-hidden />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="pa-footer">
        <div className="pa-container pa-footer-inner">
          <div className="pa-footer-brand">
            <a className="pa-footer-logo" href="/preview/a">
              WHO.GA
            </a>
            <span className="pa-footer-note">© 2026 · 现代化的 RDAP / WHOIS 查询服务</span>
          </div>
          <div className="pa-footer-links">
            {NAV_LINKS.map((link) => (
              <a key={link.target} href={`#${link.target}`} onClick={scrollTo(link.target)}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
