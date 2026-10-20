import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileJson,
  Globe,
  LayoutTemplate,
  Link2,
  CircleHelp,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Users
} from "lucide-react";
import sampleGoogle from "@/web/preview/sample-google-com.json";
import sampleStats from "@/web/preview/sample-stats.json";
import sampleSuffixes from "@/web/preview/sample-suffixes.json";
import "@/web/preview/design-f.css";

export const Route = createFileRoute("/preview/f")({
  component: PreviewF
});

/* ---------- 数据准备 ---------- */

const registry = sampleGoogle.registryResult;
const result = sampleGoogle.result;

type RdapEvent = { eventAction: string; eventDate: string };
type Entity = {
  roles: string[];
  handle?: string;
  vcardArray?: unknown;
  publicIds?: Array<{ type: string; identifier: string }>;
  entities?: Entity[];
  remarks?: Array<{ title?: string }>;
};

function findEvent(events: RdapEvent[], action: string) {
  return events.find((e) => e.eventAction === action)?.eventDate;
}

type VcardField = [string, unknown, string, unknown];

function vcardField(entity: Entity | undefined, name: string): string | undefined {
  const arr = entity?.vcardArray as [string, VcardField[]] | undefined;
  const field = arr?.[1]?.find((f) => f[0] === name);
  const value = field?.[3];
  return typeof value === "string" && value ? value : undefined;
}

const entities = result.entities as Entity[];
const registryEntities = registry.entities as Entity[];

const registrarEntity = entities.find((e) => e.roles.includes("registrar"));
const registrantEntity = entities.find((e) => e.roles.includes("registrant"));
const technicalEntity = entities.find((e) => e.roles.includes("technical"));
const abuseEntity = registryEntities
  .find((e) => e.roles.includes("registrar"))
  ?.entities?.find((e) => e.roles.includes("abuse"));

const WHOIS = {
  domain: result.ldhName,
  handle: result.handle,
  registrar: vcardField(registrarEntity, "fn") ?? "Markmonitor Inc.",
  ianaId: registrarEntity?.publicIds?.[0]?.identifier ?? "292",
  port43: sampleGoogle.registrarResult?.port43 ?? "whois.markmonitor.com",
  registryRdap: new URL(sampleGoogle.rdapServer).host,
  registrarRdap: new URL(sampleGoogle.registrarRdapServer).host,
  status: result.status,
  nameservers: result.nameservers.map((n) => ({
    name: n.ldhName,
    status: n.status?.[0] ?? "active",
    changed: n.events?.find((e) => e.eventAction === "last changed")?.eventDate.slice(0, 10)
  })),
  dnssecSigned: result.secureDNS.delegationSigned,
  registrantContact: vcardField(registrantEntity, "contact-uri"),
  technicalContact: vcardField(technicalEntity, "contact-uri"),
  abuseEmail: vcardField(abuseEntity, "email"),
  abuseTel: vcardField(abuseEntity, "tel")?.replace(/^tel:/, "")
};

const EVENTS = [
  { label: "注册时间", action: "registration", tone: "plain" },
  { label: "最近更新", action: "last changed", tone: "plain" },
  { label: "到期时间", action: "expiration", tone: "accent" },
  { label: "RDAP 数据库更新", action: "last update of RDAP database", tone: "plain" }
].map((row) => ({ ...row, date: findEvent(result.events, row.action) }));

const STATUS_EXPLAIN: Record<string, string> = {
  "client update prohibited": "注册商客户端禁止修改域名信息（防篡改锁定）",
  "client transfer prohibited": "注册商客户端禁止转移域名（防转出锁定）",
  "client delete prohibited": "注册商客户端禁止删除域名",
  "server update prohibited": "注册局服务端禁止修改域名信息",
  "server transfer prohibited": "注册局服务端禁止转移域名",
  "server delete prohibited": "注册局服务端禁止删除域名"
};

const coverage = sampleStats.rootTldCoverage;
const coveragePct = (coverage.withRdap / coverage.total) * 100;
const fmt = (n: number) => n.toLocaleString("en-US");

const STATS = [
  { value: fmt(sampleStats.queryableDomainSuffixes), label: "可查询后缀", note: "域名 / IP / ASN 全类型" },
  {
    value: `${coveragePct.toFixed(1)}%`,
    label: "根 TLD RDAP 覆盖",
    note: `${fmt(coverage.withRdap)} / ${fmt(coverage.total)} 个后缀`,
    bar: coveragePct
  },
  { value: fmt(coverage.withWhoisFallback), label: "WHOIS 回退后缀", note: "无 RDAP 时自动走 port43" },
  { value: fmt(coverage.withWebRegistryOnly), label: "仅网页注册局", note: "提供注册局官网入口" }
];

const SUFFIXES = [
  "com", "net", "org", "io", "ai", "dev", "app", "cn", "uk", "de",
  "jp", "co", "me", "cc", "tv", "info", "xyz", "shop", "blog", "cloud"
].filter((s) => sampleSuffixes.suffixes.includes(s));

const FAQ = [
  {
    q: "支持哪些查询类型？",
    a: "域名（google.com）、IPv4 / IPv6 地址（8.8.8.8）、ASN（AS15169）以及后缀（.dev）。在上方输入框直接输入，回车即查。"
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

/* ---------- 相对时间（动态计算） ---------- */

function relTime(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const days = Math.floor(Math.abs(diff) / 86_400_000);
  const years = Math.floor(days / 365.25);
  const months = Math.floor(days / 30.44);
  let text: string;
  if (years >= 1) {
    const restMonths = Math.round((days - years * 365.25) / 30.44);
    text = restMonths >= 1 && restMonths < 12 ? `${years} 年 ${restMonths} 个月` : `${years} 年`;
  } else if (months >= 1) {
    text = `${months} 个月`;
  } else if (days >= 1) {
    text = `${days} 天`;
  } else {
    return diff >= 0 ? "24 小时内" : "还有不到 1 天";
  }
  return diff >= 0 ? `${text}前` : `还有 ${text}`;
}

/* ---------- 小组件 ---------- */

function Card({
  id,
  icon,
  title,
  meta,
  children
}: {
  id?: string;
  icon?: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pf-card squircle" id={id}>
      <header className="pf-card-head">
        {icon}
        <h2 className="pf-card-title">{title}</h2>
        {meta ? <span className="pf-card-meta">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function KV({ k, v, mono = true }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="pf-kv">
      <span className="pf-k">{k}</span>
      <span className={`pf-v${mono ? " pf-mono" : ""}`}>{v}</span>
    </div>
  );
}

/* ---------- 页面 ---------- */

function PreviewF() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [jsonOpen, setJsonOpen] = useState(true);
  const now = Date.now();

  const regIso = findEvent(result.events, "registration");
  const expIso = findEvent(result.events, "expiration");
  const lifePct =
    regIso && expIso
      ? Math.min(100, Math.max(0, ((now - Date.parse(regIso)) / (Date.parse(expIso) - Date.parse(regIso))) * 100))
      : 0;

  const go = (q: string) => {
    const query = q.trim();
    if (!query) return;
    void navigate({ to: "/whois/$query", params: { query } });
  };

  return (
    <div className="preview-f">
      {/* 悬浮 pill 导航 */}
      <nav className="pf-nav squircle" aria-label="预览导航">
        <span className="pf-nav-logo">
          <Globe size={15} aria-hidden />
          who.ga
        </span>
        <span className="pf-nav-links">
          <a href="#stats">统计</a>
          <a href="#api">API</a>
          <a href="#suffixes">后缀</a>
          <a href="#faq">FAQ</a>
        </span>
      </nav>

      <div className="pf-badge squircle">
        <LayoutTemplate size={11} aria-hidden />
        方案 F · 浅色卡片
      </div>

      {/* Hero */}
      <header className="pf-hero">
        <h1 className="pf-title">查询任何域名的注册信息</h1>
        <p className="pf-subtitle">基于 RDAP 协议，支持域名 / IP / ASN，覆盖 {fmt(sampleStats.queryableDomainSuffixes)} 个后缀</p>
        <form
          className="pf-search squircle"
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
        >
          <Search size={18} className="pf-search-icon" aria-hidden />
          <input
            className="pf-search-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="输入域名、IP 或 ASN，例如 google.com"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            aria-label="输入域名、IP 或 ASN 查询"
          />
          <button type="submit" className="pf-search-btn squircle">
            查询
          </button>
        </form>
        <div className="pf-quick">
          <span className="pf-quick-label">试试</span>
          {["google.com", "8.8.8.8", "AS15169"].map((q) => (
            <button key={q} type="button" className="pf-chip squircle" onClick={() => go(q)}>
              {q}
            </button>
          ))}
        </div>
      </header>

      <main className="pf-main">
        {/* 查询结果分组 */}
        <div className="pf-group-head">
          <span className="pf-group-title">查询结果</span>
          <span className="pf-group-meta">
            <CheckCircle2 size={13} aria-hidden />
            来自注册商 RDAP 实时响应（静态示例）
          </span>
        </div>

        {/* 概要 */}
        <Card icon={<Globe size={15} aria-hidden />} title="域名概要" meta="rdap.markmonitor.com">
          <div className="pf-domain-row">
            <span className="pf-domain">{WHOIS.domain}</span>
            <span className="pf-pill pf-pill-ok squircle">
              <CheckCircle2 size={12} aria-hidden />
              已注册
            </span>
          </div>
          <div className="pf-kv-grid">
            <KV k="注册商" v={`${WHOIS.registrar}`} mono={false} />
            <KV k="IANA 注册商 ID" v={`#${WHOIS.ianaId}`} />
            <KV k="注册局 RDAP" v={WHOIS.registryRdap} />
            <KV k="注册商 RDAP" v={WHOIS.registrarRdap} />
            <KV k="port43 WHOIS" v={WHOIS.port43} />
            <KV k="Registry Domain ID" v={WHOIS.handle} />
          </div>
        </Card>

        {/* 状态 */}
        <Card
          icon={<ShieldCheck size={15} aria-hidden />}
          title="域名状态"
          meta={`${WHOIS.status.length} 个 EPP 状态码 · icann.org/epp`}
        >
          {WHOIS.status.map((s) => (
            <div className="pf-status-row" key={s}>
              <ShieldCheck size={14} className="pf-status-icon" aria-hidden />
              <span className="pf-status-name pf-mono">{s}</span>
              <span className="pf-status-desc">{STATUS_EXPLAIN[s] ?? "注册数据锁定保护"}</span>
            </div>
          ))}
        </Card>

        {/* 日期 */}
        <Card icon={<CalendarDays size={15} aria-hidden />} title="日期与事件" meta="相对时间按当前时刻计算">
          <div className="pf-date-head pf-mono" aria-hidden>
            <span>事件</span>
            <span>日期 (UTC)</span>
            <span className="pf-date-rel-h">相对时间</span>
          </div>
          {EVENTS.map((row) => (
            <div className="pf-date-row" key={row.action}>
              <span className="pf-date-label">{row.label}</span>
              <span className="pf-date-value pf-mono">{row.date?.slice(0, 10) ?? "—"}</span>
              <span className={`pf-pill squircle ${row.tone === "accent" ? "pf-pill-ok" : "pf-pill-plain"}`}>
                {row.date ? relTime(row.date, now) : "—"}
              </span>
            </div>
          ))}
          <div className="pf-life">
            <div className="pf-life-bar squircle">
              <span className="pf-life-fill" style={{ width: `${lifePct.toFixed(1)}%` }} />
            </div>
            <span className="pf-life-note">
              注册至今 {regIso ? relTime(regIso, now).replace("前", "") : "—"}，生命周期已过 {lifePct.toFixed(0)}%
            </span>
          </div>
        </Card>

        {/* 名称服务器 */}
        <Card icon={<Server size={15} aria-hidden />} title="名称服务器" meta={`${WHOIS.nameservers.length} 台`}>
          {WHOIS.nameservers.map((ns, i) => (
            <div className="pf-ns-row" key={ns.name}>
              <span className="pf-ns-idx pf-mono">{String(i + 1).padStart(2, "0")}</span>
              <span className="pf-ns-name pf-mono">{ns.name}</span>
              <span className="pf-pill pf-pill-ok squircle">{ns.status}</span>
              <span className="pf-ns-changed">{ns.changed ? `${ns.changed} 变更` : ""}</span>
            </div>
          ))}
        </Card>

        {/* DNSSEC */}
        <Card icon={<ShieldAlert size={15} aria-hidden />} title="DNSSEC" meta="secureDNS">
          <div className="pf-dnssec-row">
            <span className="pf-pill pf-pill-warn squircle">
              <ShieldAlert size={12} aria-hidden />
              未签名
            </span>
            <span className="pf-mono pf-dnssec-kv">delegationSigned: {String(WHOIS.dnssecSigned)}</span>
          </div>
          <p className="pf-note">该域名未启用 DNSSEC 签名，DNS 解析结果不具备端到端完整性校验。</p>
        </Card>

        {/* 实体联系人 */}
        <Card icon={<Users size={15} aria-hidden />} title="实体联系人" meta="注册人信息已按隐私政策脱敏">
          <div className="pf-entity-block">
            <div className="pf-entity-role">
              注册人 (Registrant)
              <span className="pf-pill pf-pill-plain squircle">已脱敏</span>
            </div>
            <KV k="名称" v="REDACTED FOR PRIVACY" />
            <KV k="联系表单" v={WHOIS.registrantContact ?? "—"} />
          </div>
          <div className="pf-entity-block">
            <div className="pf-entity-role">
              技术联系人 (Technical)
              <span className="pf-pill pf-pill-plain squircle">已脱敏</span>
            </div>
            <KV k="联系表单" v={WHOIS.technicalContact ?? "—"} />
          </div>
          <div className="pf-entity-block">
            <div className="pf-entity-role">滥用举报 (Abuse)</div>
            <KV k="邮箱" v={WHOIS.abuseEmail ?? "—"} />
            <KV k="电话" v={WHOIS.abuseTel ?? "—"} />
          </div>
        </Card>

        {/* RDAP 查询链 */}
        <Card icon={<Link2 size={15} aria-hidden />} title="RDAP 查询链" meta="bootstrap → 注册局 → 注册商">
          <div className="pf-chain">
            <span className="pf-chain-node squircle">
              <span className="pf-chain-role">IANA 引导</span>
              <span className="pf-chain-host pf-mono">data.iana.org</span>
            </span>
            <ArrowRight size={14} className="pf-chain-arrow" aria-hidden />
            <span className="pf-chain-node squircle">
              <span className="pf-chain-role">注册局 (.com)</span>
              <span className="pf-chain-host pf-mono">{WHOIS.registryRdap}</span>
            </span>
            <ArrowRight size={14} className="pf-chain-arrow" aria-hidden />
            <span className="pf-chain-node pf-chain-final squircle">
              <span className="pf-chain-role">注册商 · 最终结果</span>
              <span className="pf-chain-host pf-mono">{WHOIS.registrarRdap}</span>
            </span>
          </div>
          <div className="pf-kv-grid">
            <KV k="匹配后缀" v=".com" />
            <KV k="回退链" v="google.com → com" />
            <KV k="解析器" v="dns-json" />
            <KV k="port43" v={WHOIS.port43} />
          </div>
        </Card>

        {/* 原始 JSON */}
        <section className="pf-card squircle">
          <header className="pf-card-head">
            <FileJson size={15} aria-hidden />
            <h2 className="pf-card-title">原始 RDAP 响应</h2>
            <span className="pf-card-meta">JSON · 字段有省略</span>
            <button
              type="button"
              className="pf-json-toggle"
              onClick={() => setJsonOpen((v) => !v)}
              aria-expanded={jsonOpen}
            >
              {jsonOpen ? "收起" : "展开"}
              <ChevronDown size={14} className={jsonOpen ? "pf-chev pf-chev-open" : "pf-chev"} aria-hidden />
            </button>
          </header>
          {jsonOpen ? (
            <pre className="pf-json squircle">
              <code>
                <span className="pf-j-p">{"{"}</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;objectClassName&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;domain&quot;</span>
                <span className="pf-j-p">,</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;handle&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;{WHOIS.handle}&quot;</span>
                <span className="pf-j-p">,</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;ldhName&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;{WHOIS.domain}&quot;</span>
                <span className="pf-j-p">,</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;status&quot;</span>
                <span className="pf-j-p">: [</span>{"\n"}
                {WHOIS.status.map((s, i) => (
                  <span key={s}>
                    {"    "}
                    <span className="pf-j-s">&quot;{s}&quot;</span>
                    <span className="pf-j-p">{i < WHOIS.status.length - 1 ? "," : ""}</span>
                    {"\n"}
                  </span>
                ))}
                {"  "}<span className="pf-j-p">],</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;events&quot;</span>
                <span className="pf-j-p">: [</span>{"\n"}
                {"    "}<span className="pf-j-p">{"{ "}</span>
                <span className="pf-j-k">&quot;eventAction&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;registration&quot;</span>
                <span className="pf-j-p">, </span>
                <span className="pf-j-k">&quot;eventDate&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;1997-09-15T07:00:00.000+00:00&quot;</span>
                <span className="pf-j-p">{" },"}</span>{"\n"}
                {"    "}<span className="pf-j-p">{"{ "}</span>
                <span className="pf-j-k">&quot;eventAction&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;expiration&quot;</span>
                <span className="pf-j-p">, </span>
                <span className="pf-j-k">&quot;eventDate&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-s">&quot;2028-09-13T07:00:00.000+00:00&quot;</span>
                <span className="pf-j-p">{" }"}</span>{"\n"}
                {"  "}<span className="pf-j-p">],</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;secureDNS&quot;</span>
                <span className="pf-j-p">: {"{ "}</span>
                <span className="pf-j-k">&quot;delegationSigned&quot;</span>
                <span className="pf-j-p">: </span>
                <span className="pf-j-b">{String(WHOIS.dnssecSigned)}</span>
                <span className="pf-j-p">{" },"}</span>{"\n"}
                {"  "}<span className="pf-j-k">&quot;nameservers&quot;</span>
                <span className="pf-j-p">: [</span>{"\n"}
                {WHOIS.nameservers.map((ns, i) => (
                  <span key={ns.name}>
                    {"    "}
                    <span className="pf-j-p">{"{ "}</span>
                    <span className="pf-j-k">&quot;ldhName&quot;</span>
                    <span className="pf-j-p">: </span>
                    <span className="pf-j-s">&quot;{ns.name}&quot;</span>
                    <span className="pf-j-p">{" }"}</span>
                    <span className="pf-j-p">{i < WHOIS.nameservers.length - 1 ? "," : ""}</span>
                    {"\n"}
                  </span>
                ))}
                {"  "}<span className="pf-j-p">]</span>{"\n"}
                <span className="pf-j-p">{"}"}</span>{"\n"}
                <span className="pf-j-note">// … 字段已省略，完整响应：GET /api/whois?domain=google.com</span>
              </code>
            </pre>
          ) : null}
        </section>

        {/* 站点统计 */}
        <div className="pf-card squircle pf-stats" id="stats">
          <header className="pf-card-head">
            <BarChart3 size={15} aria-hidden />
            <h2 className="pf-card-title">站点统计</h2>
            <span className="pf-card-meta">数据每日同步 IANA</span>
          </header>
          <div className="pf-stats-grid">
            {STATS.map((s) => (
              <div className="pf-stat" key={s.label}>
                <span className="pf-stat-value">{s.value}</span>
                <span className="pf-stat-label">{s.label}</span>
                {s.bar !== undefined ? (
                  <span className="pf-stat-bar squircle" aria-hidden>
                    <span className="pf-stat-bar-fill" style={{ width: `${s.bar.toFixed(1)}%` }} />
                  </span>
                ) : null}
                <span className="pf-stat-note">{s.note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* API */}
        <section className="pf-card squircle" id="api">
          <header className="pf-card-head">
            <Code2 size={15} aria-hidden />
            <h2 className="pf-card-title">开放 API</h2>
            <span className="pf-card-meta">免费 · 无需密钥</span>
          </header>
          <p className="pf-note">返回与页面一致的结构化 JSON，可直接接入脚本与数据管线。</p>
          <pre className="pf-json pf-api-line squircle">
            <code>
              <span className="pf-j-s">GET</span>{" "}
              <span className="pf-j-p">https://who.ga/api/whois?domain=</span>
              <span className="pf-j-b">&lt;query&gt;</span>
            </code>
          </pre>
        </section>

        {/* 后缀 */}
        <section className="pf-card squircle" id="suffixes">
          <header className="pf-card-head">
            <Tags size={15} aria-hidden />
            <h2 className="pf-card-title">支持的后缀</h2>
            <span className="pf-card-meta">共 {fmt(sampleSuffixes.count)} 个</span>
          </header>
          <div className="pf-sfx">
            {SUFFIXES.map((s) => (
              <button key={s} type="button" className="pf-sfx-chip squircle" onClick={() => go(`.${s}`)}>
                .{s}
              </button>
            ))}
            <span className="pf-sfx-more">… 以及另外 {fmt(sampleSuffixes.count - SUFFIXES.length)} 个</span>
          </div>
        </section>

        {/* FAQ */}
        <section className="pf-card squircle" id="faq">
          <header className="pf-card-head">
            <CircleHelp size={15} aria-hidden />
            <h2 className="pf-card-title">常见问题</h2>
          </header>
          {FAQ.map((item) => (
            <div className="pf-faq-item" key={item.q}>
              <p className="pf-faq-q">{item.q}</p>
              <p className="pf-faq-a">{item.a}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="pf-footer">
        <p>© 2026 who.ga · 基于 RDAP 的域名 / IP / ASN 查询</p>
        <p className="pf-footer-dim">设计方案 F 预览 · 页面数据为静态示例</p>
      </footer>
    </div>
  );
}
