import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  Database,
  EyeOff,
  FileJson2,
  Fingerprint,
  Globe,
  Layers,
  Lock,
  Mail,
  Search,
  Server,
  ShieldCheck,
  TriangleAlert,
  Waypoints
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import sampleGoogle from "@/web/preview/sample-google-com.json";
import sampleStats from "@/web/preview/sample-stats.json";
import sampleSuffixes from "@/web/preview/sample-suffixes.json";
import "@/web/preview/design-e.css";

export const Route = createFileRoute("/preview/e")({
  component: PreviewE
});

/* ---------- 数据准备 ---------- */

type VField = [string, unknown, string, string];

function vget(fields: VField[] | undefined, key: string): string | undefined {
  return fields?.find((f) => f[0] === key)?.[3];
}

const registry = sampleGoogle.registryResult;
const result = sampleGoogle.result;

function findEvent(action: string) {
  return result.events.find((e) => e.eventAction === action)?.eventDate ?? "";
}

const registrarEntity = registry.entities.find((e) => e.roles.includes("registrar"));
const registrarFields = registrarEntity?.vcardArray?.[1] as VField[] | undefined;
const registrarName = vget(registrarFields, "fn") ?? "MarkMonitor Inc.";
const registrarId = registrarEntity?.publicIds?.[0]?.identifier ?? "292";
const abuseFields = registrarEntity?.entities?.find((e) => e.roles.includes("abuse"))?.vcardArray?.[1] as
  | VField[]
  | undefined;
const abuseEmail = vget(abuseFields, "email") ?? "abusecomplaints@markmonitor.com";
const abuseTel = (vget(abuseFields, "tel") ?? "tel:+1.2086851750").replace(/^tel:/, "");
const registrantFields = result.entities.find((e) => e.roles.includes("registrant"))?.vcardArray?.[1] as
  | VField[]
  | undefined;
const contactUri = vget(registrantFields, "contact-uri") ?? "https://domains.markmonitor.com/whois/contact/google.com";

const WHOIS = {
  domain: result.ldhName,
  handle: result.handle,
  registrar: registrarName,
  registrarId,
  port43: result.port43,
  rdap: sampleGoogle.registrarRdapServer,
  status: result.status,
  nameservers: result.nameservers.map((n) => n.ldhName),
  dnssec: result.secureDNS.delegationSigned
};

const STATUS_ZH: Record<string, string> = {
  "client delete prohibited": "注册商锁定 · 禁止删除",
  "client transfer prohibited": "注册商锁定 · 禁止转移",
  "client update prohibited": "注册商锁定 · 禁止更新",
  "server delete prohibited": "注册局锁定 · 禁止删除",
  "server transfer prohibited": "注册局锁定 · 禁止转移",
  "server update prohibited": "注册局锁定 · 禁止更新"
};

const DATES = [
  { label: "注册时间", iso: findEvent("registration"), note: "域名首次登记", tone: "" },
  { label: "最近变更", iso: findEvent("last changed"), note: "注册信息最近一次修改", tone: "" },
  { label: "到期时间", iso: findEvent("expiration"), note: "需在此日期前续费", tone: "warn" },
  { label: "RDAP 数据更新", iso: findEvent("last update of RDAP database"), note: "注册局数据库刷新", tone: "" }
];

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = t - Date.now();
  const days = Math.abs(diff) / 86400000;
  let core: string;
  if (days >= 365) core = `${Math.floor(days / 365)} 年`;
  else if (days >= 30) core = `${Math.floor(days / 30)} 个月`;
  else if (days >= 1) core = `${Math.floor(days)} 天`;
  else core = "不到 1 天";
  return diff > 0 ? `${core}后` : `${core}前`;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const coverage = sampleStats.rootTldCoverage;
const coveragePct = ((coverage.withRdap / coverage.total) * 100).toFixed(1);
const bootstrapTotal = sampleStats.items.reduce((sum, item) => sum + item.supportedCount, 0);

const JSON_EVENTS = ["registration", "last changed", "expiration"]
  .map((action) => result.events.find((e) => e.eventAction === action))
  .filter((e): e is (typeof result.events)[number] => Boolean(e));

const STATS = [
  { value: fmt(sampleStats.queryableDomainSuffixes), label: "可查询后缀", sub: "域名 / IP / ASN 全覆盖" },
  { value: `${coveragePct}%`, label: "根 TLD RDAP 覆盖", sub: `${fmt(coverage.withRdap)} / ${fmt(coverage.total)}` },
  { value: fmt(coverage.withWhoisFallback), label: "WHOIS 回退后缀", sub: "无 RDAP 时自动降级 port43" },
  { value: fmt(bootstrapTotal), label: "Bootstrap 引导记录", sub: "dns · ipv4 · ipv6 · asn · tags" }
];

const SUFFIXES = [
  "com", "net", "org", "io", "ai", "dev", "app", "cn", "uk", "de",
  "jp", "co", "me", "cc", "tv", "info", "xyz", "top", "shop", "cloud"
].filter((s) => sampleSuffixes.suffixes.includes(s));

const FAQ = [
  {
    q: "支持哪些查询类型？",
    a: "域名（google.com）、IPv4 / IPv6 地址（8.8.8.8）、ASN（AS15169）以及后缀（.dev）。直接输入，回车即查。"
  },
  {
    q: "RDAP 和传统 WHOIS 有什么区别？",
    a: "RDAP 以结构化 JSON 返回注册数据，字段清晰、便于程序解析；遇到尚未支持 RDAP 的后缀时，自动回退 port43 WHOIS 查询。"
  },
  {
    q: "数据来自哪里，多久更新一次？",
    a: "Bootstrap 引导数据每日同步 IANA，查询结果实时请求各注册局的 RDAP 服务，并做短期缓存以加速重复查询。"
  },
  {
    q: "是否提供 API？",
    a: "提供。GET https://who.ga/api/whois?domain=<query> 返回与页面一致的结构化 JSON，可直接接入脚本与数据管线。"
  }
];

const CHAIN: Array<{ icon: LucideIcon; name: string; url: string; note: string }> = [
  { icon: Globe, name: "IANA Bootstrap", url: "data.iana.org/rdap/dns.json", note: "匹配后缀 .com · resolver: dns-json" },
  { icon: Database, name: "注册局 RDAP", url: "rdap.verisign.com/com/v1", note: "Verisign 返回注册局记录" },
  { icon: Building2, name: "注册商 RDAP", url: "rdap.markmonitor.com", note: "最终结果来源 · resultSource: registrar" }
];

/* ---------- 通用小组件 ---------- */

function SectionHead({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <div className="pe-sec-head">
      <div className="pe-eyebrow">{eyebrow}</div>
      <div className="pe-sec-row">
        <h2 className="pe-sec-title">{title}</h2>
        {meta ? <span className="pe-sec-meta">{meta}</span> : null}
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  meta,
  children
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pe-card pe-sq">
      <header className="pe-card-head">
        <Icon size={15} className="pe-card-icon" aria-hidden />
        <h3 className="pe-card-title">{title}</h3>
        {meta ? <span className="pe-card-meta">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="pe-kv">
      <span className="pe-kv-k">{k}</span>
      <span className={`pe-kv-v${mono ? " pe-mono" : ""}`}>{v}</span>
    </div>
  );
}

/* ---------- JSON 语法高亮（克制的灰度版） ---------- */

function Jk({ v }: { v: string }) {
  return <span className="pe-j-k">&quot;{v}&quot;</span>;
}
function Js({ v }: { v: string }) {
  return <span className="pe-j-s">&quot;{v}&quot;</span>;
}
function Jp({ v }: { v: string }) {
  return <span className="pe-j-p">{v}</span>;
}
function Jb({ v }: { v: boolean }) {
  return <span className="pe-j-b">{String(v)}</span>;
}

/* ---------- 页面 ---------- */

function PreviewE() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [jsonOpen, setJsonOpen] = useState(false);

  const go = (q: string) => {
    const query = q.trim();
    if (!query) return;
    void navigate({ to: "/whois/$query", params: { query } });
  };

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="preview-e">
      {/* 悬浮 pill 导航 */}
      <nav className="pe-nav pe-sq" aria-label="页面导航">
        <a className="pe-nav-logo" href="#top" onClick={scrollTo("top")}>
          who<span className="pe-nav-logo-dot">.ga</span>
        </a>
        <div className="pe-nav-links">
          <a className="pe-nav-link pe-sq" href="#stats" onClick={scrollTo("stats")}>统计</a>
          <a className="pe-nav-link pe-sq" href="/api/whois?domain=google.com">API</a>
          <a className="pe-nav-link pe-sq" href="#suffixes" onClick={scrollTo("suffixes")}>后缀</a>
          <a className="pe-nav-link pe-sq" href="#faq" onClick={scrollTo("faq")}>FAQ</a>
        </div>
      </nav>

      <div className="pe-badge pe-sq" aria-hidden>
        <Layers size={11} />
        方案 E
      </div>

      <main className="pe-main" id="top">
        {/* Hero：一行标题 + 大输入框 */}
        <section className="pe-hero">
          <h1 className="pe-title">一次查询，看清域名底细</h1>
          <p className="pe-sub">基于 RDAP 的域名 / IP / ASN 注册信息查询，数据直连各注册局。</p>

          <form
            className="pe-search pe-sq"
            onSubmit={(e) => {
              e.preventDefault();
              go(value);
            }}
          >
            <Search size={18} className="pe-search-icon" aria-hidden />
            <input
              className="pe-search-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="输入域名、IPv4 / IPv6 地址或 ASN…"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="输入域名、IP 或 ASN 查询"
            />
            <button type="submit" className="pe-search-btn pe-sq">
              查询
              <ArrowRight size={15} aria-hidden />
            </button>
          </form>

          <div className="pe-quick">
            {["google.com", "8.8.8.8", "AS15169"].map((q) => (
              <button key={q} type="button" className="pe-chip pe-sq pe-mono" onClick={() => go(q)}>
                {q}
              </button>
            ))}
          </div>
        </section>

        {/* 查询结果：每条信息一张独立卡片 */}
        <section className="pe-section" id="result">
          <SectionHead eyebrow="查询结果" title="google.com" meta="via rdap.markmonitor.com" />

          <div className="pe-cards">
            {/* 概要 */}
            <Card icon={Fingerprint} title="概要" meta="Domain">
              <div className="pe-ov-top">
                <span className="pe-ov-domain pe-mono">{WHOIS.domain}</span>
                <span className="pe-ov-badge pe-sq">
                  <CircleCheck size={12} aria-hidden />
                  已注册
                </span>
              </div>
              <div className="pe-kv-list">
                <KV k="注册商" v={`${WHOIS.registrar} (IANA #${WHOIS.registrarId})`} mono={false} />
                <KV k="Registry Domain ID" v={WHOIS.handle} />
                <KV k="WHOIS 服务器" v={WHOIS.port43} />
                <KV k="RDAP 服务器" v={WHOIS.rdap} />
              </div>
            </Card>

            {/* 状态 */}
            <Card icon={ShieldCheck} title="状态" meta={`${WHOIS.status.length} 个 EPP 状态`}>
              <div className="pe-status-list">
                {WHOIS.status.map((s) => (
                  <div className="pe-status-row" key={s}>
                    <Lock size={13} className="pe-status-lock" aria-hidden />
                    <code className="pe-status-code pe-sq">{s}</code>
                    <span className="pe-status-zh">{STATUS_ZH[s] ?? s}</span>
                  </div>
                ))}
              </div>
              <p className="pe-hint">client = 注册商侧锁定，server = 注册局侧锁定，防护更强。详见 icann.org/epp。</p>
            </Card>

            {/* 日期 */}
            <Card icon={CalendarDays} title="日期" meta="Events">
              <div className="pe-kv-list">
                {DATES.map((d) => (
                  <div className="pe-date-row" key={d.label}>
                    <span className="pe-date-label">
                      {d.label}
                      <span className="pe-date-note">{d.note}</span>
                    </span>
                    <span className="pe-date-value pe-mono">{d.iso.slice(0, 10)}</span>
                    <span className={`pe-date-rel${d.tone === "warn" ? " pe-warn" : ""}`}>{relTime(d.iso)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 名称服务器 */}
            <Card icon={Server} title="名称服务器" meta={`${WHOIS.nameservers.length} 台`}>
              <div className="pe-kv-list">
                {WHOIS.nameservers.map((ns, i) => (
                  <div className="pe-ns-row" key={ns}>
                    <span className="pe-ns-idx pe-mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="pe-ns-name pe-mono">{ns}</span>
                    <span className="pe-ns-tag pe-sq">active</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* DNSSEC */}
            <Card icon={ShieldCheck} title="DNSSEC" meta="Secure DNS">
              <div className="pe-dnssec">
                <TriangleAlert size={15} className="pe-warn" aria-hidden />
                <div>
                  <div className="pe-dnssec-state">
                    未签名 <code className="pe-mono pe-dnssec-code">delegationSigned: false</code>
                  </div>
                  <p className="pe-hint">该域名未启用 DNSSEC 签名，DNS 应答不具备来源完整性验证。</p>
                </div>
              </div>
            </Card>

            {/* 实体联系人 */}
            <Card icon={EyeOff} title="实体联系人" meta="Entities">
              <div className="pe-kv-list">
                <KV k="注册人" v="REDACTED FOR PRIVACY（已隐藏）" />
                <KV k="技术联系人" v="REDACTED FOR PRIVACY（已隐藏）" />
                <div className="pe-kv">
                  <span className="pe-kv-k">滥用举报</span>
                  <span className="pe-kv-v pe-contact">
                    <Mail size={12} aria-hidden />
                    <span className="pe-mono">{abuseEmail}</span>
                    <span className="pe-contact-sep">·</span>
                    <span className="pe-mono">{abuseTel}</span>
                  </span>
                </div>
              </div>
              <p className="pe-hint">
                注册人数据依隐私政策隐藏，可通过注册商联系表单转达：
                <a className="pe-link" href={contactUri}>domains.markmonitor.com</a>
              </p>
            </Card>

            {/* RDAP 查询链 */}
            <Card icon={Waypoints} title="RDAP 查询链" meta="Resolution path">
              <div className="pe-chain">
                {CHAIN.map((step) => (
                  <div className="pe-chain-step" key={step.url}>
                    <span className="pe-chain-tile pe-sq">
                      <step.icon size={14} aria-hidden />
                    </span>
                    <span className="pe-chain-info">
                      <span className="pe-chain-name">{step.name}</span>
                      <span className="pe-chain-url pe-mono">{step.url}</span>
                    </span>
                    <span className="pe-chain-note">{step.note}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 原始 JSON */}
            <Card icon={FileJson2} title="原始 JSON" meta="excerpt · registrar RDAP">
              <div className="pe-json-head">
                <span className="pe-hint">registrar 返回的结构化响应节选</span>
                <button
                  type="button"
                  className="pe-json-toggle pe-sq"
                  onClick={() => setJsonOpen((v) => !v)}
                  aria-expanded={jsonOpen}
                >
                  {jsonOpen ? "收起" : "展开"}
                  {jsonOpen ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
                </button>
              </div>
              {jsonOpen ? (
                <div className="pe-json pe-sq pe-mono">
                  <div className="pe-j-line"><Jp v="{" /></div>
                  <div className="pe-j-line">{"  "}<Jk v="objectClassName" /><Jp v=": " /><Js v="domain" /><Jp v="," /></div>
                  <div className="pe-j-line">{"  "}<Jk v="handle" /><Jp v=": " /><Js v={WHOIS.handle} /><Jp v="," /></div>
                  <div className="pe-j-line">{"  "}<Jk v="ldhName" /><Jp v=": " /><Js v={WHOIS.domain} /><Jp v="," /></div>
                  <div className="pe-j-line">{"  "}<Jk v="port43" /><Jp v=": " /><Js v={WHOIS.port43} /><Jp v="," /></div>
                  <div className="pe-j-line">{"  "}<Jk v="status" /><Jp v=": [" /></div>
                  {WHOIS.status.map((s, i) => (
                    <div className="pe-j-line" key={s}>
                      {"    "}<Js v={s} /><Jp v={i < WHOIS.status.length - 1 ? "," : ""} />
                    </div>
                  ))}
                  <div className="pe-j-line">{"  "}<Jp v="]," /></div>
                  <div className="pe-j-line">{"  "}<Jk v="events" /><Jp v=": [" /></div>
                  {JSON_EVENTS.map((ev, i) => (
                    <div className="pe-j-line" key={ev.eventAction}>
                      {"    "}<Jp v="{ " /><Jk v="eventAction" /><Jp v=": " /><Js v={ev.eventAction} /><Jp v=", " />
                      <Jk v="eventDate" /><Jp v=": " /><Js v={ev.eventDate} /><Jp v={i < JSON_EVENTS.length - 1 ? " }," : " }"} />
                    </div>
                  ))}
                  <div className="pe-j-line">{"  "}<Jp v="]," /></div>
                  <div className="pe-j-line">
                    {"  "}<Jk v="secureDNS" /><Jp v=": { " /><Jk v="delegationSigned" /><Jp v=": " /><Jb v={WHOIS.dnssec} /><Jp v=" }," />
                  </div>
                  <div className="pe-j-line">
                    {"  "}<Jk v="nameservers" /><Jp v=": [" />
                    {WHOIS.nameservers.map((ns, i) => (
                      <span key={ns}>
                        {" "}<Js v={ns} />{i < WHOIS.nameservers.length - 1 ? <Jp v="," /> : null}
                      </span>
                    ))}
                    {" "}<Jp v="]" />
                  </div>
                  <div className="pe-j-line"><Jp v="}" /></div>
                  <div className="pe-j-note">… 字段已省略 · 完整响应：GET /api/whois?domain=google.com</div>
                </div>
              ) : null}
            </Card>
          </div>
        </section>

        {/* 统计 */}
        <section className="pe-section" id="stats">
          <SectionHead eyebrow="站点统计" title="覆盖与规模" meta={`更新于 ${sampleStats.updatedAt.slice(0, 10)}`} />
          <div className="pe-stats">
            {STATS.map((s) => (
              <div className="pe-stat pe-sq" key={s.label}>
                <div className="pe-stat-value">{s.value}</div>
                <div className="pe-stat-label">{s.label}</div>
                <div className="pe-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 后缀 */}
        <section className="pe-section" id="suffixes">
          <SectionHead eyebrow="可查询后缀" title="热门后缀" meta={`共 ${fmt(sampleSuffixes.count)} 个`} />
          <div className="pe-suffixes">
            {SUFFIXES.map((s) => (
              <button
                key={s}
                type="button"
                className="pe-suffix pe-sq pe-mono"
                onClick={() => go(`.${s}`)}
                title={`查询 .${s} 后缀`}
              >
                .{s}
              </button>
            ))}
          </div>
          <p className="pe-hint pe-suffix-hint">输入 .后缀 即可查看该后缀的注册局与支持详情。</p>
        </section>

        {/* FAQ */}
        <section className="pe-section" id="faq">
          <SectionHead eyebrow="常见问题" title="FAQ" />
          <div className="pe-faq">
            {FAQ.map((item) => (
              <section className="pe-card pe-sq pe-faq-item" key={item.q}>
                <h3 className="pe-faq-q">{item.q}</h3>
                <p className="pe-faq-a">{item.a}</p>
              </section>
            ))}
          </div>
        </section>
      </main>

      <footer className="pe-footer">
        <span>© 2026 who.ga — 克制，且详尽。</span>
        <span className="pe-mono pe-footer-right">RDAP · WHOIS · API</span>
      </footer>
    </div>
  );
}
