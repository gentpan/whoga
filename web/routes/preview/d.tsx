import { useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Code2,
  Database,
  FileJson,
  FlaskConical,
  Globe,
  Info,
  ListChecks,
  Network,
  Search,
  Server,
  ShieldOff,
  Users
} from "lucide-react";
import sampleGoogle from "@/web/preview/sample-google-com.json";
import sampleStats from "@/web/preview/sample-stats.json";
import sampleSuffixes from "@/web/preview/sample-suffixes.json";
import "@/web/preview/design-d.css";

export const Route = createFileRoute("/preview/d")({
  component: PreviewD
});

/* ---------- 数据准备(全部来自静态样例,无网络请求) ---------- */

const registry = sampleGoogle.registryResult;
const result = sampleGoogle.result;

function findEvent(events: Array<{ eventAction: string; eventDate: string }>, action: string) {
  return events.find((e) => e.eventAction === action)?.eventDate ?? "";
}

type VcardFields = Array<[string, unknown, string, string]>;

function vcardText(entity: unknown, field: string): string {
  const arr = (entity as { vcardArray?: [string, VcardFields] } | undefined)?.vcardArray?.[1];
  return arr?.find((f) => f[0] === field)?.[3] ?? "";
}

const registrarEntity = registry.entities.find((e) => e.roles.includes("registrar"));
const registrarName = vcardText(registrarEntity, "fn") || "MarkMonitor Inc.";
const registrarId = registrarEntity?.publicIds?.[0]?.identifier ?? "292";
const abuseEntity = registrarEntity?.entities?.[0];
const abuseTel = vcardText(abuseEntity, "tel").replace(/^tel:/, "") || "+1.2086851750";
const abuseEmail = vcardText(abuseEntity, "email") || "abusecomplaints@markmonitor.com";

const WHOIS = {
  domain: result.ldhName,
  handle: result.handle,
  registrar: registrarName,
  registrarId,
  port43: sampleGoogle.registrarResult?.port43 ?? "whois.markmonitor.com",
  registrarRdap: sampleGoogle.registrarRdapServer,
  registryRdap: sampleGoogle.rdapServer,
  registered: findEvent(result.events, "registration"),
  changed: findEvent(result.events, "last changed"),
  expires: findEvent(result.events, "expiration"),
  dbUpdated: findEvent(result.events, "last update of RDAP database"),
  status: result.status,
  nameservers: result.nameservers,
  dnssecSigned: result.secureDNS.delegationSigned
};

const STATUS_ZH: Record<string, string> = {
  "client delete prohibited": "客户端禁止删除 —— 注册商锁定,域名无法被删除",
  "client transfer prohibited": "客户端禁止转移 —— 防止未经授权的过户",
  "client update prohibited": "客户端禁止更新 —— 注册信息修改已锁定",
  "server delete prohibited": "服务端禁止删除 —— 注册局级删除锁定",
  "server transfer prohibited": "服务端禁止转移 —— 注册局级转移锁定",
  "server update prohibited": "服务端禁止更新 —— 注册局级修改锁定",
  active: "正常解析中",
  inactive: "未启用解析"
};

/* 相对时间:按当前日期动态计算,过去「N 前」/ 未来「还有 N」 */
function relTime(dateStr: string): { label: string; future: boolean } {
  const t = new Date(dateStr).getTime();
  const now = Date.now();
  const future = t > now;
  const days = Math.round(Math.abs(t - now) / 86400000);
  if (days === 0) return { label: "今天", future };
  if (days === 1) return { label: future ? "明天" : "昨天", future };
  let core: string;
  if (days < 31) {
    core = `${days} 天`;
  } else if (days < 700) {
    core = `${Math.round(days / 30.44)} 个月`;
  } else {
    core = `${Math.round(days / 365.25)} 年`;
  }
  return { label: future ? `还有 ${core}` : `${core}前`, future };
}

const DATES = [
  { name: "注册时间", date: WHOIS.registered },
  { name: "最近变更", date: WHOIS.changed },
  { name: "到期时间", date: WHOIS.expires },
  { name: "RDAP 数据更新", date: WHOIS.dbUpdated }
];

const coverage = sampleStats.rootTldCoverage;
const coveragePct = (coverage.withRdap / coverage.total) * 100;
const bootstrap: Record<string, number> = {};
for (const item of sampleStats.items) bootstrap[item.key] = item.supportedCount;
const fmt = (n: number) => n.toLocaleString("en-US");

const HOT_SUFFIXES = [
  "com", "net", "org", "io", "ai", "dev", "app", "cn", "uk", "de",
  "jp", "co", "me", "cc", "tv", "info", "biz", "xyz", "top", "pro"
].filter((s) => sampleSuffixes.suffixes.includes(s));

const FAQ = [
  {
    q: "支持哪些查询类型?",
    a: "域名(google.com)、IPv4 / IPv6 地址(8.8.8.8)、ASN(AS15169)以及后缀(.dev)。在输入框直接输入,回车即查。"
  },
  {
    q: "RDAP 和传统 WHOIS 有什么区别?",
    a: "RDAP 以结构化 JSON 返回注册数据,字段清晰、便于程序解析;遇到尚未支持 RDAP 的后缀时,自动回退 port43 WHOIS 查询。"
  },
  {
    q: "数据来自哪里,多久更新一次?",
    a: "Bootstrap 引导数据每日同步 IANA,查询结果实时请求各注册局的 RDAP 服务,并做短期缓存以加速重复查询。"
  },
  {
    q: "是否提供 API?",
    a: "提供。GET https://who.ga/api/whois?domain=<query> 返回与页面一致的结构化 JSON,可直接接入脚本与数据管线。"
  }
];

/* ---------- JSON 语法高亮(自写正则,逐行分词) ---------- */

const RAW_LINES = JSON.stringify(result, null, 2).split("\n");
const JSON_TOKEN =
  /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)/g;

function highlightJsonLine(line: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  JSON_TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = JSON_TOKEN.exec(line)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={key++} className="pd-j-p">
          {line.slice(last, m.index)}
        </span>
      );
    }
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        nodes.push(
          <span key={key++} className="pd-j-k">
            {m[1]}
          </span>,
          <span key={key++} className="pd-j-p">
            {m[2]}
          </span>
        );
      } else {
        nodes.push(
          <span key={key++} className="pd-j-s">
            {m[1]}
          </span>
        );
      }
    } else if (m[3] !== undefined) {
      nodes.push(
        <span key={key++} className="pd-j-n">
          {m[3]}
        </span>
      );
    } else {
      nodes.push(
        <span key={key++} className="pd-j-b">
          {m[4]}
        </span>
      );
    }
    last = JSON_TOKEN.lastIndex;
  }
  if (last < line.length) {
    nodes.push(
      <span key={key++} className="pd-j-p">
        {line.slice(last)}
      </span>
    );
  }
  return nodes;
}

/* ---------- 小组件 ---------- */

function KV({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="pd-kv">
      <span className="pd-k">{k}</span>
      <span className={`pd-v${mono ? " mono" : ""}`}>{v}</span>
    </div>
  );
}

function CardHead({
  icon,
  title,
  meta
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
}) {
  return (
    <div className="pd-card-head">
      <span className="pd-card-icon squircle">{icon}</span>
      <span className="pd-card-title">{title}</span>
      {meta ? <span className="pd-card-meta">{meta}</span> : null}
    </div>
  );
}

/* ---------- 页面 ---------- */

function PreviewD() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (q?: string) => {
    const query = (q ?? value).trim();
    if (!query) return;
    void navigate({ to: "/whois/$query", params: { query } });
  };

  const rawJson = useMemo(
    () =>
      RAW_LINES.map((line, i) => (
        <span key={i}>
          {highlightJsonLine(line)}
          {"\n"}
        </span>
      )),
    []
  );

  return (
    <div className="preview-d">
      {/* 悬浮 pill 导航 */}
      <nav className="pd-nav" aria-label="Primary">
        <div className="pd-nav-pill squircle">
          <a
            className="pd-nav-logo"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img src="/logo.svg" alt="" width={30} height={30} decoding="async" />
            <b>
              who<i>.</i>ga
            </b>
          </a>
          <div className="pd-nav-links">
            <a className="pd-nav-link squircle" href="#pd-stats">
              <BarChart3 size={15} aria-hidden />
              <span>统计</span>
            </a>
            <a className="pd-nav-link squircle pd-hide-sm" href="#pd-api">
              <Code2 size={15} aria-hidden />
              <span>API</span>
            </a>
            <a className="pd-nav-link squircle" href="#pd-suffixes">
              <Database size={15} aria-hidden />
              <span>后缀</span>
            </a>
            <a className="pd-nav-link squircle pd-hide-sm" href="#pd-faq">
              <Info size={15} aria-hidden />
              <span>FAQ</span>
            </a>
          </div>
        </div>
      </nav>

      {/* 方案标记 */}
      <div className="pd-design-badge squircle">
        <FlaskConical size={12} aria-hidden />
        方案 D
      </div>

      <main className="pd-main">
        {/* hero:一行标题 + 一行副标题 + 大输入框 */}
        <header className="pd-hero">
          <p className="pd-hero-eyebrow">RDAP / WHOIS 查询服务</p>
          <h1 className="pd-hero-title">域名注册信息,一查即得</h1>
          <p className="pd-hero-sub">
            覆盖 {fmt(sampleStats.queryableDomainSuffixes)} 个后缀,支持域名、IPv4 / IPv6 与
            ASN,数据每日与 IANA 同步。
          </p>
          <form
            className="pd-search squircle"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <span className="pd-search-sign" aria-hidden>
              $
            </span>
            <input
              ref={inputRef}
              value={value}
              placeholder="输入域名 / IP / ASN,回车查询"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="查询域名、IP 或 ASN"
              onChange={(e) => setValue(e.target.value)}
            />
            <button type="submit" className="pd-search-btn squircle">
              <Search size={15} strokeWidth={2.4} aria-hidden />
              <span>查询</span>
            </button>
          </form>
          <div className="pd-chips">
            <span className="pd-chips-label">试试</span>
            {["google.com", "8.8.8.8", "AS15169"].map((q) => (
              <button key={q} type="button" className="pd-chip squircle" onClick={() => submit(q)}>
                {q}
              </button>
            ))}
          </div>
        </header>

        {/* 查询结果:google.com,每条信息一张独立卡片 */}
        <section className="pd-section" id="pd-result">
          <div className="pd-echo">
            <span className="pd-echo-sign">$</span>
            <span>whois google.com</span>
            <span className="pd-echo-meta">结果来源:注册商 RDAP · 静态示例数据</span>
          </div>

          {/* 概要卡 */}
          <div className="pd-card squircle">
            <CardHead icon={<Globe size={14} aria-hidden />} title="域名概要" meta={`handle: ${WHOIS.handle}`} />
            <div className="pd-overview">
              <span className="pd-overview-name">{WHOIS.domain}</span>
              <span className="pd-badge squircle">
                <BadgeCheck size={12} aria-hidden />
                已注册
              </span>
            </div>
            <KV k="注册商" v={WHOIS.registrar} />
            <KV k="IANA ID" v={`#${WHOIS.registrarId}`} mono />
            <KV k="WHOIS 服务器" v={WHOIS.port43} mono />
            <KV k="RDAP 服务器" v={WHOIS.registrarRdap} mono />
          </div>

          {/* 状态卡 */}
          <div className="pd-card squircle">
            <CardHead
              icon={<ListChecks size={14} aria-hidden />}
              title="域名状态"
              meta={`${WHOIS.status.length} 项 EPP 状态`}
            />
            {WHOIS.status.map((s) => (
              <div className="pd-status" key={s}>
                <span className="pd-status-code">{s}</span>
                <span className="pd-status-desc">{STATUS_ZH[s] ?? "注册状态锁定"}</span>
              </div>
            ))}
          </div>

          {/* 日期卡 */}
          <div className="pd-card squircle">
            <CardHead icon={<CalendarClock size={14} aria-hidden />} title="日期事件" meta="UTC" />
            {DATES.map((d) => {
              const rel = relTime(d.date);
              return (
                <div className="pd-date-row" key={d.name}>
                  <span className="pd-date-name">{d.name}</span>
                  <span className="pd-date-val">{d.date.slice(0, 10)}</span>
                  <span className={`pd-date-rel${rel.future ? " future" : ""}`}>{rel.label}</span>
                </div>
              );
            })}
          </div>

          {/* 实体联系人卡 */}
          <div className="pd-card squircle">
            <CardHead icon={<Users size={14} aria-hidden />} title="实体联系人" meta="隐私保护已启用" />
            <KV k="注册人 (registrant)" v="已隐藏(REDACTED FOR PRIVACY)" />
            <KV k="技术联系人" v="已隐藏,经注册商表单转达" />
            <KV k="滥用举报 (abuse)" v={`${abuseEmail} · ${abuseTel}`} mono />
            <KV k="联系表单" v="domains.markmonitor.com/whois/contact/google.com" mono />
          </div>

          {/* 名称服务器卡 */}
          <div className="pd-card squircle">
            <CardHead
              icon={<Server size={14} aria-hidden />}
              title="名称服务器"
              meta={`${WHOIS.nameservers.length} 台 · 均 active`}
            />
            {WHOIS.nameservers.map((ns, i) => (
              <div className="pd-ns" key={ns.ldhName}>
                <span className="pd-ns-idx">{String(i + 1).padStart(2, "0")}</span>
                <span className="pd-ns-name">{ns.ldhName}</span>
                <span className="pd-badge gray squircle">active</span>
              </div>
            ))}
          </div>

          {/* DNSSEC 卡 */}
          <div className="pd-card squircle">
            <CardHead icon={<ShieldOff size={14} aria-hidden />} title="DNSSEC" meta="secureDNS" />
            <div className="pd-dnssec">
              <span className="pd-badge gray squircle">未签名</span>
              <p>
                <code>delegationSigned: false</code> —— 该域名未启用 DNSSEC
                签名,DNS 应答不具备完整性校验。
              </p>
            </div>
          </div>

          {/* RDAP 查询链卡 */}
          <div className="pd-card squircle">
            <CardHead icon={<Network size={14} aria-hidden />} title="RDAP 查询链" meta="google.com → com" />
            <div className="pd-chain">
              <div className="pd-chain-step">
                <div className="pd-chain-title">IANA Bootstrap</div>
                <div className="pd-chain-url">data.iana.org/rdap/dns.json</div>
                <div className="pd-chain-note">匹配后缀 .com,定位注册局 RDAP 服务 · 发布于 2026-09-30</div>
              </div>
              <div className="pd-chain-step">
                <div className="pd-chain-title">注册局 RDAP · Verisign</div>
                <div className="pd-chain-url">{WHOIS.registryRdap.replace(/^https:\/\//, "")}</div>
                <div className="pd-chain-note">返回域名登记信息,并引用注册商 RDAP 服务</div>
              </div>
              <div className="pd-chain-step">
                <div className="pd-chain-title">
                  注册商 RDAP · MarkMonitor
                  <span className="pd-badge squircle">结果来源</span>
                </div>
                <div className="pd-chain-url">{WHOIS.registrarRdap.replace(/^https:\/\//, "")}</div>
                <div className="pd-chain-note">提供联系人、滥用举报等完整字段</div>
              </div>
              <div className="pd-chain-step skip">
                <div className="pd-chain-title">port43 回退 · 未触发</div>
                <div className="pd-chain-url">{WHOIS.port43}</div>
                <div className="pd-chain-note">RDAP 可用时仅作备用通道</div>
              </div>
            </div>
          </div>

          {/* 原始 JSON 卡(可折叠) */}
          <details className="pd-card squircle">
            <summary className="pd-json-head">
              <span className="pd-card-icon squircle">
                <FileJson size={14} aria-hidden />
              </span>
              <span className="pd-card-title">原始 JSON</span>
              <span className="pd-card-meta">
                rdap.markmonitor.com · {RAW_LINES.length} 行
              </span>
              <ChevronRight size={15} className="pd-json-chev" aria-hidden />
            </summary>
            <div className="pd-json-body">
              <pre className="pd-json">
                <code>{rawJson}</code>
              </pre>
            </div>
          </details>
        </section>

        {/* 统计条 */}
        <section className="pd-section" id="pd-stats">
          <div className="pd-section-head">
            <span className="pd-section-label">Stats</span>
            <h2 className="pd-section-title">站点数据</h2>
            <span className="pd-section-meta">更新于 {sampleStats.updatedAt.slice(0, 10)}</span>
          </div>
          <div className="pd-stats">
            <div className="pd-stat squircle">
              <div className="pd-stat-num">{fmt(sampleStats.queryableDomainSuffixes)}</div>
              <div className="pd-stat-label">可查询后缀</div>
            </div>
            <div className="pd-stat squircle">
              <div className="pd-stat-num">
                {fmt(coverage.withRdap)}
                <small> / {fmt(coverage.total)}</small>
              </div>
              <div className="pd-stat-label">TLD 覆盖 · RDAP {coveragePct.toFixed(1)}%</div>
              <div className="pd-stat-bar squircle">
                <i className="squircle" style={{ width: `${coveragePct}%` }} />
              </div>
            </div>
            <div className="pd-stat squircle">
              <div className="pd-stat-num">{fmt(coverage.withWhoisFallback)}</div>
              <div className="pd-stat-label">WHOIS 回退后缀</div>
            </div>
            <div className="pd-stat squircle">
              <div className="pd-stat-num">{fmt(coverage.withWebRegistryOnly)}</div>
              <div className="pd-stat-label">仅网页注册局</div>
            </div>
          </div>
          <p className="pd-stats-note">
            Bootstrap 数据源:dns {fmt(bootstrap.dns ?? 0)} · ipv4 {fmt(bootstrap.ipv4 ?? 0)} · ipv6{" "}
            {fmt(bootstrap.ipv6 ?? 0)} · asn {fmt(bootstrap.asn ?? 0)} · object-tags{" "}
            {fmt(bootstrap["object-tags"] ?? 0)}
          </p>
        </section>

        {/* API */}
        <section className="pd-section" id="pd-api">
          <div className="pd-section-head">
            <span className="pd-section-label">API</span>
            <h2 className="pd-section-title">编程接口</h2>
          </div>
          <div className="pd-card squircle">
            <div className="pd-api-line">
              <span className="pd-api-method squircle">GET</span>
              <code>{"https://who.ga/api/whois?domain=<query>"}</code>
            </div>
            <p className="pd-api-note">
              返回与页面一致的结构化 JSON,支持域名、IP、ASN 与后缀查询,可直接接入脚本与数据管线。
            </p>
          </div>
        </section>

        {/* 后缀 */}
        <section className="pd-section" id="pd-suffixes">
          <div className="pd-section-head">
            <span className="pd-section-label">Suffixes</span>
            <h2 className="pd-section-title">热门后缀</h2>
            <span className="pd-section-meta">共 {fmt(sampleSuffixes.count)} 个</span>
          </div>
          <div className="pd-suffixes">
            {HOT_SUFFIXES.map((s) => (
              <button
                key={s}
                type="button"
                className="pd-chip squircle"
                onClick={() => submit(`.${s}`)}
              >
                <span className="pd-chip-dot">.</span>
                {s}
              </button>
            ))}
          </div>
          <p className="pd-suffix-note">输入任意后缀(如 .dev)即可查看该后缀的详细信息。</p>
        </section>

        {/* FAQ */}
        <section className="pd-section" id="pd-faq">
          <div className="pd-section-head">
            <span className="pd-section-label">FAQ</span>
            <h2 className="pd-section-title">常见问题</h2>
          </div>
          {FAQ.map((item, i) => (
            <details key={item.q} className="pd-faq squircle" open={i === 0}>
              <summary className="pd-faq-q">
                <ChevronRight size={14} className="pd-faq-chev" aria-hidden />
                {item.q}
              </summary>
              <p className="pd-faq-a">{item.a}</p>
            </details>
          ))}
        </section>

        {/* footer */}
        <footer className="pd-footer">
          <span>© 2026 who.ga</span>
          <span>RDAP + port43 回退 · 每日同步 IANA</span>
          <span className="pd-footer-right">方案 D 设计预览 · 页面数据为静态示例</span>
        </footer>
      </main>
    </div>
  );
}
