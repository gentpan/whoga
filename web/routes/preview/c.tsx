import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Terminal } from "lucide-react";
import sampleGoogle from "@/web/preview/sample-google-com.json";
import sampleStats from "@/web/preview/sample-stats.json";
import sampleSuffixes from "@/web/preview/sample-suffixes.json";
import "@/web/preview/design-c.css";

export const Route = createFileRoute("/preview/c")({
  component: PreviewC
});

/* ---------- 数据准备 ---------- */

const registry = sampleGoogle.registryResult;
const result = sampleGoogle.result;

function findEvent(events: Array<{ eventAction: string; eventDate: string }>, action: string) {
  return events.find((e) => e.eventAction === action)?.eventDate.slice(0, 10) ?? "—";
}

const registrarEntity = registry.entities.find((e) => e.roles.includes("registrar"));
const registrarName =
  (registrarEntity?.vcardArray?.[1] as Array<[string, unknown, string, string]> | undefined)?.find(
    (f) => f[0] === "fn"
  )?.[3] ?? "MarkMonitor Inc.";
const registrarId = registrarEntity?.publicIds?.[0]?.identifier ?? "292";
const port43 = sampleGoogle.registrarResult?.port43 ?? "whois.markmonitor.com";

const WHOIS = {
  domain: result.ldhName,
  handle: result.handle,
  registrar: `${registrarName} (IANA #${registrarId})`,
  port43,
  rdap: sampleGoogle.registrarRdapServer,
  registered: findEvent(result.events, "registration"),
  changed: findEvent(result.events, "last changed"),
  expires: findEvent(result.events, "expiration"),
  status: result.status,
  nameservers: result.nameservers.map((n) => n.ldhName),
  dnssec: result.secureDNS.delegationSigned,
  lastUpdate: findEvent(result.events, "last update of RDAP database")
};

const coverage = sampleStats.rootTldCoverage;
const coveragePct = coverage.withRdap / coverage.total;
const barCells = 18;
const barFilled = Math.round(coveragePct * barCells);
const coverageBar = "█".repeat(barFilled) + "░".repeat(barCells - barFilled);
const bootstrap: Record<string, number> = {};
for (const item of sampleStats.items) bootstrap[item.key] = item.supportedCount;
const fmt = (n: number) => n.toLocaleString("en-US");

const LS_SUFFIXES = [
  "com", "net", "org", "io", "ai", "dev", "app",
  "cn", "uk", "de", "jp", "co", "me", "cc",
  "tv", "info", "biz", "xyz", "top", "vip", "pro",
  "name", "wiki", "blog", "shop", "site", "tech", "cloud"
].filter((s) => sampleSuffixes.suffixes.includes(s));

const FAQ = [
  {
    q: "支持哪些查询类型？",
    a: "域名（google.com）、IPv4 / IPv6 地址（8.8.8.8）、ASN（AS15169）以及后缀（.dev）。在提示符后直接输入，回车即查。"
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

/* ---------- JSON 语法高亮小组件 ---------- */

function Jk({ v }: { v: string }) {
  return <span className="pc-j-k">&quot;{v}&quot;</span>;
}
function Js({ v }: { v: string }) {
  return <span className="pc-j-s">&quot;{v}&quot;</span>;
}
function Jp({ v }: { v: string }) {
  return <span className="pc-j-p">{v}</span>;
}
function Jb({ v }: { v: boolean }) {
  return <span className="pc-j-b">{String(v)}</span>;
}

/* ---------- 终端窗口骨架 ---------- */

function TermWindow({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`pc-term ${className}`}>
      <div className="pc-term-bar">
        <span className="pc-dots" aria-hidden>
          <i className="pc-dot pc-dot-r" />
          <i className="pc-dot pc-dot-y" />
          <i className="pc-dot pc-dot-g" />
        </span>
        <span className="pc-term-title">{title}</span>
        <span className="pc-term-bar-right" aria-hidden />
      </div>
      <div className="pc-term-body">{children}</div>
    </section>
  );
}

function Prompt({ cmd, typed }: { cmd: string; typed?: boolean }) {
  return (
    <div className="pc-line">
      <span className="pc-p-br">[</span>
      <span className="pc-p-user">visitor</span>
      <span className="pc-p-br">@</span>
      <span className="pc-p-host">who.ga</span>
      <span className="pc-p-path"> ~</span>
      <span className="pc-p-br">]</span>
      <span className="pc-p-sign">$ </span>
      {typed ? <span className="pc-cmd pc-typed">{cmd}</span> : <span className="pc-cmd">{cmd}</span>}
    </div>
  );
}

function Sec({ name, meta }: { name: string; meta?: string }) {
  return (
    <div className="pc-sec">
      <span className="pc-sec-hash">#</span>
      <span className="pc-sec-name">{name}</span>
      {meta ? <span className="pc-sec-meta">{meta}</span> : null}
      <span className="pc-sec-rule" aria-hidden />
    </div>
  );
}

function KV({ k, v, vClass = "" }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="pc-kv">
      <span className="pc-k">{k}</span>
      <span className={`pc-v ${vClass}`}>{v}</span>
    </div>
  );
}

/* ---------- 页面 ---------- */

function PreviewC() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    void navigate({ to: "/whois/$query", params: { query: q } });
  };

  return (
    <div className="preview-c">
      <div className="pc-shell">
        {/* 会话头部 */}
        <header className="pc-head">
          <div className="pc-head-left">
            <Terminal size={14} className="pc-head-icon" aria-hidden />
            <span className="pc-head-title">who.ga</span>
            <span className="pc-head-sub">— RDAP / WHOIS lookup terminal</span>
          </div>
          <div className="pc-head-right">ttys000 · 80×24 · UTF-8</div>
        </header>

        {/* 窗口一：whois 查询会话 */}
        <TermWindow title="who.ga — zsh" className="pc-hero">
          <div className="pc-line pc-muted">Last login: Tue Oct 20 09:41:07 on ttys000</div>
          <Prompt cmd="whois google.com" typed />

          <div className="pc-output">
            <Sec name="Domain" />
            <KV k="Domain Name:" v={WHOIS.domain} vClass="pc-v-bright" />
            <KV k="Registry Domain ID:" v={WHOIS.handle} />
            <KV k="Registrar:" v={WHOIS.registrar} />
            <KV k="WHOIS Server:" v={WHOIS.port43} />
            <KV k="RDAP Server:" v={WHOIS.rdap} vClass="pc-v-link" />

            <Sec name="Dates" />
            <KV k="Registered:" v={WHOIS.registered} vClass="pc-v-bright" />
            <KV k="Last Changed:" v={WHOIS.changed} />
            <KV k="Expires:" v={WHOIS.expires} vClass="pc-v-warn" />
            <KV k="RDAP DB Updated:" v={WHOIS.lastUpdate} />

            <Sec name="Status" meta={`${WHOIS.status.length}`} />
            {WHOIS.status.map((s) => (
              <div className="pc-list-item" key={s}>
                <span className="pc-gt">&gt;</span> {s}
              </div>
            ))}

            <Sec name="Nameservers" meta={`${WHOIS.nameservers.length}`} />
            {WHOIS.nameservers.map((ns) => (
              <div className="pc-list-item" key={ns}>
                <span className="pc-gt">&gt;</span> <span className="pc-v-cyan">{ns}</span>
              </div>
            ))}

            <Sec name="DNSSEC" />
            <KV k="Delegation Signed:" v={WHOIS.dnssec ? "true (signed)" : "false (unsigned)"} vClass="pc-v-dim" />

            <Sec name="Raw JSON" meta="excerpt · rdap.markmonitor.com" />
            <div className="pc-json">
              <div className="pc-j-line">
                <Jp v="{" />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="objectClassName" />
                <Jp v=": " />
                <Js v="domain" />
                <Jp v="," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="handle" />
                <Jp v=": " />
                <Js v={WHOIS.handle} />
                <Jp v="," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="ldhName" />
                <Jp v=": " />
                <Js v={WHOIS.domain} />
                <Jp v="," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="status" />
                <Jp v=": [" />
              </div>
              {WHOIS.status.map((s, i) => (
                <div className="pc-j-line" key={s}>
                  {"    "}
                  <Js v={s} />
                  <Jp v={i < WHOIS.status.length - 1 ? "," : ""} />
                </div>
              ))}
              <div className="pc-j-line">
                {"  "}
                <Jp v="]," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="events" />
                <Jp v=": [" />
              </div>
              <div className="pc-j-line">
                {"    "}
                <Jp v="{ " />
                <Jk v="eventAction" />
                <Jp v=": " />
                <Js v="registration" />
                <Jp v=", " />
                <Jk v="eventDate" />
                <Jp v=": " />
                <Js v="1997-09-15T07:00:00.000+00:00" />
                <Jp v=" }," />
              </div>
              <div className="pc-j-line">
                {"    "}
                <Jp v="{ " />
                <Jk v="eventAction" />
                <Jp v=": " />
                <Js v="expiration" />
                <Jp v=", " />
                <Jk v="eventDate" />
                <Jp v=": " />
                <Js v="2028-09-13T07:00:00.000+00:00" />
                <Jp v=" }" />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jp v="]," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="secureDNS" />
                <Jp v=": { " />
                <Jk v="delegationSigned" />
                <Jp v=": " />
                <Jb v={false} />
                <Jp v=" }," />
              </div>
              <div className="pc-j-line">
                {"  "}
                <Jk v="nameservers" />
                <Jp v=": [" /> {WHOIS.nameservers.map((ns, i) => (
                  <span key={ns}>
                    <Js v={ns} />
                    {i < WHOIS.nameservers.length - 1 ? <Jp v=", " /> : null}
                  </span>
                ))}
                <Jp v=" ]" />
              </div>
              <div className="pc-j-line">
                <Jp v="}" />
              </div>
              <div className="pc-j-note"># … 字段已省略，完整响应：GET /api/whois?domain=google.com</div>
            </div>
          </div>

          {/* 交互提示符 */}
          <div className="pc-input-line" onClick={() => inputRef.current?.focus()}>
            <span className="pc-p-br">[</span>
            <span className="pc-p-user">visitor</span>
            <span className="pc-p-br">@</span>
            <span className="pc-p-host">who.ga</span>
            <span className="pc-p-path"> ~</span>
            <span className="pc-p-br">]</span>
            <span className="pc-p-sign">$ </span>
            <span className="pc-input-wrap">
              <input
                ref={inputRef}
                className="pc-input"
                value={value}
                size={Math.max(1, value.length)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label="输入域名、IP 或 ASN，回车查询"
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
              />
              <span className="pc-cursor" aria-hidden />
            </span>
          </div>
          <div className="pc-hint"># 输入 域名 / IP / ASN 后回车查询 — 试试 8.8.8.8 · AS15169 · .dev</div>
        </TermWindow>

        {/* 窗口二：neofetch 统计面板 */}
        <TermWindow title="who.ga — neofetch">
          <Prompt cmd="neofetch" />
          <div className="pc-neofetch">
            <pre className="pc-logo" aria-hidden>
              {"██╗    ██╗██╗  ██╗ ██████╗ \n██║    ██║██║  ██║██╔═══██╗\n██║ █╗ ██║███████║██║   ██║\n██║███╗██║██╔══██║██║   ██║\n╚███╔███╔╝██║  ██║╚██████╔╝\n ╚══╝╚══╝ ╚═╝  ╚═╝ ╚═════╝ "}
            </pre>
            <div className="pc-neo-info">
              <div className="pc-neo-head">
                <span className="pc-p-user">visitor</span>
                <span className="pc-p-br">@</span>
                <span className="pc-p-host">who.ga</span>
              </div>
              <div className="pc-neo-sep">──────────────────────────────</div>
              <KV k="站点:" v="who.ga — 域名 / IP / ASN 查询终端" />
              <KV k="引擎:" v="RDAP (rdap_level_0) + port43 回退" />
              <KV k="可查询后缀:" v={fmt(sampleStats.queryableDomainSuffixes)} vClass="pc-v-bright" />
              <div className="pc-kv">
                <span className="pc-k">TLD 覆盖:</span>
                <span className="pc-v">
                  {fmt(coverage.withRdap)} / {fmt(coverage.total)}{" "}
                  <span className="pc-bar">[{coverageBar}]</span>{" "}
                  <span className="pc-v-dim">{(coveragePct * 100).toFixed(1)}%</span>
                </span>
              </div>
              <KV k="WHOIS 回退:" v={`${fmt(coverage.withWhoisFallback)} 个后缀`} />
              <KV k="仅网页注册局:" v={`${fmt(coverage.withWebRegistryOnly)} 个后缀`} />
              <KV
                k="Bootstrap:"
                v={`dns ${fmt(bootstrap.dns ?? 0)} · ipv4 ${fmt(bootstrap.ipv4 ?? 0)} · ipv6 ${fmt(bootstrap.ipv6 ?? 0)} · asn ${fmt(bootstrap.asn ?? 0)}`}
              />
              <KV k="数据更新:" v={`${sampleStats.updatedAt.slice(0, 16).replace("T", " ")} UTC`} vClass="pc-v-dim" />
            </div>
          </div>
        </TermWindow>

        {/* 窗口三：ls 后缀列表 */}
        <TermWindow title="who.ga — ls /srv/suffixes">
          <Prompt cmd={`ls /srv/suffixes | head -n ${LS_SUFFIXES.length}`} />
          <div className="pc-ls-meta pc-muted">total {fmt(sampleSuffixes.count)}</div>
          <div className="pc-ls">
            {LS_SUFFIXES.map((s) => (
              <span className="pc-ls-item" key={s}>
                <span className="pc-ls-dot">.</span>
                {s}
              </span>
            ))}
          </div>
          <div className="pc-hint"># … 共 {fmt(sampleSuffixes.count)} 个可查询后缀，输入任意后缀即可查看详情</div>
        </TermWindow>

        {/* 窗口四：man FAQ */}
        <TermWindow title="who.ga — man who.ga">
          <Prompt cmd="man who.ga" />
          <div className="pc-man-banner">
            <span>WHO.GA(1)</span>
            <span>用户手册</span>
            <span>WHO.GA(1)</span>
          </div>
          <div className="pc-man-sec">名称</div>
          <p className="pc-man-p">who.ga — 基于 RDAP 的域名 / IP / ASN 查询终端</p>
          <div className="pc-man-sec">问答</div>
          {FAQ.map((item) => (
            <div className="pc-man-qa" key={item.q}>
              <p className="pc-man-q">{item.q}</p>
              <p className="pc-man-a">{item.a}</p>
            </div>
          ))}
          <div className="pc-man-sec">参见</div>
          <p className="pc-man-p">
            <span className="pc-v-cyan">whois(1)</span>, <span className="pc-v-cyan">dig(1)</span>,{" "}
            <span className="pc-v-cyan">curl(1)</span>
          </p>
        </TermWindow>

        {/* 会话结束 */}
        <footer className="pc-foot">
          <div className="pc-line">
            <span className="pc-p-br">[</span>
            <span className="pc-p-user">visitor</span>
            <span className="pc-p-br">@</span>
            <span className="pc-p-host">who.ga</span>
            <span className="pc-p-path"> ~</span>
            <span className="pc-p-br">]</span>
            <span className="pc-p-sign">$ </span>
            <span className="pc-cmd">exit</span>
          </div>
          <div className="pc-line pc-muted">logout</div>
          <div className="pc-line pc-faint">[Process completed] · © 2026 who.ga — 感谢访问本终端</div>
        </footer>
      </div>

      <div className="pc-badge">
        <Terminal size={12} aria-hidden />
        方案 C · 终端
      </div>
    </div>
  );
}
