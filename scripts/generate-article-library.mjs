#!/usr/bin/env node
/**
 * Generates lib/articles/articles.json — 30 bilingual WHOIS/RDAP technical articles.
 * Run: node scripts/generate-article-library.mjs
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const UPDATED = "2026-07-06";

function article(slug, category, minutes, published, zh, en) {
  return { slug, category, readingMinutes: minutes, publishedAt: published, updatedAt: UPDATED, zh, en };
}

function h(text) {
  return { type: "heading", text };
}
function p(text) {
  return { type: "paragraph", text };
}
function l(items) {
  return { type: "list", items };
}
function c(language, code) {
  return { type: "code", language, code };
}
function n(text) {
  return { type: "note", text };
}

const articles = [
  article(
    "rdap-vs-whois",
    { zh: "协议基础", en: "Protocols" },
    8,
    "2026-01-10",
    {
      title: "RDAP 与 WHOIS 的区别：2026 开发者必读",
      description:
        "对比 RDAP 与 WHOIS 的协议差异、数据格式、发现机制与 ICANN 迁移背景，帮助开发者选择正确的域名查询方案。",
      keywords: ["RDAP", "WHOIS", "域名查询", "ICANN", "JSON API"],
      sections: [
        h("核心差异一览"),
        p("WHOIS 是诞生于 1980 年代的文本查询协议，通常通过 TCP 43 端口返回非结构化纯文本。RDAP（Registration Data Access Protocol）由 IETF 标准化，使用 HTTPS 返回 JSON，字段语义遵循 RFC 9082/9083。"),
        l([
          "传输：WHOIS 多为明文 port 43；RDAP 基于 TLS 加密的 HTTPS。",
          "格式：WHOIS 需正则解析；RDAP 可直接 JSON 反序列化。",
          "发现：WHOIS 需维护各 TLD 服务器映射；RDAP 使用 IANA Bootstrap（RFC 9224）。",
          "访问控制：RDAP 支持分级访问与脱敏标注；传统 WHOIS 多为全有或全无。"
        ]),
        h("为什么现在应该优先 RDAP"),
        p("自 2025 年 1 月 28 日起，ICANN 对 gTLD 注册局/注册商不再强制要求提供 port 43 WHOIS。新集成、监控与合规系统应以 RDAP 为主路径，WHOIS 作为兼容回退。"),
        h("实践建议"),
        l([
          "自动化系统：优先解析 RDAP JSON，保留 WHOIS port43 回退。",
          "安全运营：利用 RDAP 标准 status、events、links 字段做关联分析。",
          "产品集成：缓存 RDAP 响应并记录 rdapConformance 与 notices。"
        ]),
        n("参考：RFC 9082、RFC 9083、RFC 9224；ICANN RDAP 技术文档。")
      ]
    },
    {
      title: "RDAP vs WHOIS: What Developers Need in 2026",
      description:
        "Compare RDAP and WHOIS protocols, response formats, bootstrap discovery, and the ICANN transition—choose the right domain lookup stack.",
      keywords: ["RDAP", "WHOIS", "domain lookup", "ICANN", "JSON API"],
      sections: [
        h("At a glance"),
        p("WHOIS is a legacy text protocol (often TCP port 43) with inconsistent output. RDAP returns structured JSON over HTTPS per RFC 9082/9083."),
        l([
          "Transport: WHOIS is often cleartext; RDAP uses TLS.",
          "Parsing: WHOIS needs regex; RDAP is machine-readable JSON.",
          "Discovery: RDAP uses the IANA bootstrap registry (RFC 9224).",
          "Access: RDAP supports tiered access and explicit redaction notices."
        ]),
        h("Why RDAP first"),
        p("Since January 28, 2025, ICANN no longer requires gTLD operators to run port-43 WHOIS. New tooling should treat RDAP as primary and WHOIS as fallback."),
        h("Recommendations"),
        l([
          "Automate with RDAP JSON; keep WHOIS port 43 as compatibility layer.",
          "Use standardized status, events, and links for security workflows.",
          "Cache responses and honor rate limits (HTTP 429)."
        ]),
        n("See RFC 9082, RFC 9083, RFC 9224 and ICANN RDAP guidance.")
      ]
    }
  ),

  article(
    "icann-whois-sunset-2025",
    { zh: "政策与合规", en: "Policy" },
    7,
    "2026-01-15",
    {
      title: "ICANN WHOIS 退役与 RDAP 强制化：2025 年后有何变化",
      description: "解读 ICANN 2025 年 gTLD WHOIS 退役时间表、注册局义务变化，以及对开发者和安全团队的影响。",
      keywords: ["ICANN", "WHOIS sunset", "gTLD", "RDAP 强制"],
      sections: [
        h("政策背景"),
        p("ICANN 通过注册协议全球修正案，逐步取消 gTLD 注册局/注册商必须运营 port 43 WHOIS 的合同义务。RDAP 成为 gTLD 注册数据的权威访问协议。"),
        h("对开发者的影响"),
        l([
          "依赖单一 WHOIS 服务器的脚本可能突然超时或返回空响应。",
          "需要实现 IANA Bootstrap 与多跳 referral（薄注册局模型）。",
          "应监控各 TLD 的 RDAP 可用性与 notices 中的脱敏说明。"
        ]),
        h("对安全与品牌保护团队的影响"),
        p("公开 RDAP 数据仍可能因 GDPR/隐私代理而脱敏。涉诉、滥用投诉等场景需通过 RDRS 或注册商合法渠道申请非公开数据。"),
        h("迁移清单"),
        l(["替换 WHOIS 库为 RDAP 客户端", "将正则解析改为 JSON 映射", "为 429/5xx 增加重试与缓存", "建立 TLD 覆盖率监控"])
      ]
    },
    {
      title: "ICANN WHOIS Sunset 2025: What Changed for gTLDs",
      description: "Timeline and impact of ICANN's gTLD WHOIS sunset—operator obligations, developer migration, and security workflows.",
      keywords: ["ICANN", "WHOIS sunset", "gTLD", "RDAP mandatory"],
      sections: [
        h("Policy context"),
        p("ICANN registry agreement amendments removed the contractual requirement for port-43 WHOIS on gTLDs. RDAP is now the authoritative access protocol."),
        h("Developer impact"),
        l([
          "Scripts hard-coded to WHOIS hosts may fail without warning.",
          "Implement IANA bootstrap and referral chains for thin registries.",
          "Track per-TLD RDAP availability and redaction notices."
        ]),
        h("Security & brand teams"),
        p("Public RDAP may redact registrant fields. Lawful unredacted access uses RDRS or registrar channels—not bulk scraping."),
        h("Migration checklist"),
        l(["Swap WHOIS libraries for RDAP", "Map JSON instead of regex", "Add retry/cache for 429/5xx", "Monitor TLD coverage"])
      ]
    }
  ),

  article(
    "rdap-json-rfc-9083",
    { zh: "协议基础", en: "Protocols" },
    9,
    "2026-01-20",
    {
      title: "RDAP JSON 响应结构详解（RFC 9083）",
      description: "深入解析 RDAP domain、nameserver、entity 对象，events、status、vcardArray 与 links 字段的工程用法。",
      keywords: ["RFC 9083", "RDAP JSON", "vcardArray", "domain object"],
      sections: [
        h("顶层对象类型"),
        p("RDAP 响应可包含 domain、nameserver、entity（联系人/组织）、ip network、autnum 等对象。查询域名时最常见的是 domain 对象，可能伴随 entity 与 nameserver 嵌套或链接。"),
        h("关键字段"),
        l([
          "ldhName / unicodeName：域名的 ASCII 与 Unicode 形式。",
          "status：标准化状态数组，如 client transfer prohibited。",
          "events：registration、expiration、last changed 等时间线。",
          "nameservers：权威 DNS 主机列表，可内联或仅含链接。",
          "entities：注册人、管理员、技术、滥用联系人（常为 vcardArray）。"
        ]),
        h("vcardArray 简介"),
        p("联系人信息采用 RFC 6350 jCard 数组表示，例如 fn、email、tel。自动化提取需遍历 vcardArray[1] 中的键值对，并注意脱敏占位符。"),
        c("json", `{
  "objectClassName": "domain",
  "ldhName": "example.com",
  "status": ["client transfer prohibited"],
  "events": [{"eventAction": "registration", "eventDate": "1995-08-14T04:00:00Z"}]
}`),
        h("工程提示"),
        p("始终检查 notices 数组了解数据权威性与脱敏原因；对 registrar referral 使用 links 中 rel=related 的 href 发起二次请求。")
      ]
    },
    {
      title: "RDAP JSON Response Structure (RFC 9083)",
      description: "Engineering guide to RDAP domain objects—events, status, vcardArray, links, and referral patterns.",
      keywords: ["RFC 9083", "RDAP JSON", "vcardArray", "domain object"],
      sections: [
        h("Object types"),
        p("Responses may include domain, nameserver, entity, IP network, or autnum objects. Domain lookups often return linked entities and nameservers."),
        h("Important fields"),
        l([
          "ldhName / unicodeName: ASCII and Unicode forms.",
          "status: standardized lifecycle flags.",
          "events: registration, expiration, last changed.",
          "nameservers: authoritative DNS hosts.",
          "entities: registrant/admin/tech/abuse as vcardArray."
        ]),
        h("vcardArray"),
        p("Contact data uses jCard (RFC 6350). Parse vcardArray[1] tuples and expect redacted placeholders."),
        c("json", `{
  "objectClassName": "domain",
  "ldhName": "example.com",
  "status": ["client transfer prohibited"],
  "events": [{"eventAction": "registration", "eventDate": "1995-08-14T04:00:00Z"}]
}`),
        h("Tips"),
        p("Read notices for authority/redaction. Follow links with rel=related for registrar referrals on thin registries.")
      ]
    }
  ),

  article(
    "iana-bootstrap-rfc-9224",
    { zh: "协议基础", en: "Protocols" },
    7,
    "2026-02-01",
    {
      title: "IANA RDAP Bootstrap 发现机制（RFC 9224）",
      description: "如何使用 IANA bootstrap 文件定位各 TLD、IP、ASN 的 RDAP 服务端点，并构建本地索引。",
      keywords: ["IANA bootstrap", "RFC 9224", "RDAP 服务发现"],
      sections: [
        h("Bootstrap 是什么"),
        p("IANA 维护 dns.json、ipv4.json、ipv6.json、asn.json 等引导文件，列出各后缀或资源对应的 RDAP 基 URL。客户端无需硬编码数千个 TLD 服务器。"),
        h("查询流程"),
        l([
          "1. 下载并缓存 IANA bootstrap（建议每日刷新）。",
          "2. 根据查询类型选择最长后缀匹配（如 co.uk）。",
          "3. 拼接 REST 路径：{base}/domain/{fqdn} 或 /ip/{cidr}。",
          "4. 处理 3xx/链接 referral 与错误码。"
        ]),
        c("bash", `curl -s https://data.iana.org/rdap/dns.json | jq '.services[0]'`),
        h("自托管实践"),
        p("WHO.GA / Whoga 将 bootstrap 与 PSL、额外 RDAP 映射合并为本地 whois-merged.json，减少实时发现延迟并支持离线回退。")
      ]
    },
    {
      title: "IANA RDAP Bootstrap Discovery (RFC 9224)",
      description: "Locate RDAP servers per TLD, IP, or ASN using IANA bootstrap files and local indexing strategies.",
      keywords: ["IANA bootstrap", "RFC 9224", "RDAP discovery"],
      sections: [
        h("What is bootstrap"),
        p("IANA publishes dns.json, ipv4.json, ipv6.json, asn.json mapping suffixes/resources to RDAP base URLs—no hard-coded server lists."),
        h("Lookup flow"),
        l([
          "1. Cache bootstrap files (refresh daily).",
          "2. Longest suffix match for domains.",
          "3. Build REST URL: {base}/domain/{fqdn}.",
          "4. Handle referrals and HTTP errors."
        ]),
        c("bash", `curl -s https://data.iana.org/rdap/dns.json | jq '.services[0]'`),
        h("Self-hosted tip"),
        p("Whoga merges bootstrap + PSL + extra mappings into a local index for faster routing and offline fallback.")
      ]
    }
  ),

  article(
    "thin-thick-registry",
    { zh: "注册系统", en: "Registries" },
    6,
    "2026-02-05",
    {
      title: "薄注册局与厚注册局：RDAP 数据为何需要二次查询",
      description: "理解 .com 等薄注册局模型，为何注册人信息在注册商 RDAP 服务器，以及如何合并 registry 与 registrar 响应。",
      keywords: ["thin registry", "thick registry", "RDAP referral", "Verisign"],
      sections: [
        h("概念"),
        p("薄注册局（如 Verisign 运营的 .com）仅保存域名技术数据：状态、到期日、权威 NS。注册人、邮箱等由注册商维护。厚注册局则在同一 RDAP 响应中返回完整联系人。"),
        h("对集成的影响"),
        p("查询 example.com 时，注册局 RDAP 返回的 links 可能指向注册商服务器。生产系统必须实现 referral 合并，否则只能看到不完整记录。"),
        h("合并策略"),
        l([
          "解析 links 中 rel=related 的 registrar URL。",
          "对同一域名发起第二次 GET，合并 entities 与 abuse 联系信息。",
          "在 API 层标注 resultSource: registry | registrar。"
        ]),
        n("Whoga 对支持 registrar lookup URL 的响应会自动尝试二次拉取。")
      ]
    },
    {
      title: "Thin vs Thick Registries: Why RDAP Needs a Second Hop",
      description: "Why .com registrant data lives on registrar RDAP servers and how to merge registry + registrar responses.",
      keywords: ["thin registry", "thick registry", "RDAP referral"],
      sections: [
        h("Definitions"),
        p("Thin registries (e.g., .com) store technical domain data only. Registrant contacts live at the registrar. Thick registries return full contacts in one response."),
        h("Integration impact"),
        p("A single registry query may be incomplete until you follow registrar links."),
        h("Merge strategy"),
        l([
          "Follow links with rel=related.",
          "Fetch registrar RDAP and merge entities.",
          "Expose resultSource in your API."
        ]),
        n("Whoga attempts registrar fetches when lookup URLs are present.")
      ]
    }
  )
];

// Append remaining 25 articles in compact form
const more = [
  ["registrar-referral-chain", { zh: "注册系统", en: "Registries" }, 6, "2026-02-08",
    { title: "RDAP 注册商推荐链与多跳查询", description: "处理 registry → registrar → reseller 多跳 RDAP 链接的工程模式。", keywords: ["RDAP referral", "registrar", "links"] },
    { title: "RDAP Registrar Referral Chains", description: "Engineering patterns for multi-hop registry → registrar RDAP links.", keywords: ["RDAP referral", "registrar"] }],
  ["whois-port-43-basics", { zh: "协议基础", en: "Protocols" }, 5, "2026-02-10",
    { title: "WHOIS Port 43 基础与文本格式", description: "Port 43 WHOIS 查询语法、响应格式与解析难点。", keywords: ["WHOIS", "port 43"] },
    { title: "WHOIS Port 43 Basics", description: "Query syntax, text formats, and parsing challenges of legacy WHOIS.", keywords: ["WHOIS", "port 43"] }],
  ["nameserver-rdap-fields", { zh: "DNS", en: "DNS" }, 5, "2026-02-12",
    { title: "从 RDAP 读取权威 Nameserver 信息", description: "nameservers 对象、glue 记录与 DNS 运维场景。", keywords: ["nameserver", "RDAP", "DNS"] },
    { title: "Reading Authoritative Nameservers from RDAP", description: "nameservers objects, glue records, and DNS ops use cases.", keywords: ["nameserver", "RDAP"] }],
  ["ip-address-rdap-lookup", { zh: "查询实战", en: "Lookups" }, 6, "2026-02-15",
    { title: "IP 地址 RDAP 查询指南", description: "使用 ipv4.json/ipv6.json bootstrap 查询 IP 归属与网络对象。", keywords: ["IP RDAP", "ipv4", "ipv6"] },
    { title: "IP Address RDAP Lookup Guide", description: "Query IP networks via IANA ipv4/ipv6 bootstrap files.", keywords: ["IP RDAP"] }],
  ["asn-rdap-bootstrap", { zh: "查询实战", en: "Lookups" }, 5, "2026-02-18",
    { title: "ASN RDAP 查询与路由起源", description: "autnum 对象、ASN 归属与 Peering 信息入口。", keywords: ["ASN", "RDAP", "autnum"] },
    { title: "ASN RDAP Lookup", description: "autnum objects and routing origin investigations.", keywords: ["ASN", "RDAP"] }],
  ["tld-suffix-queries", { zh: "查询实战", en: "Lookups" }, 5, "2026-02-20",
    { title: "TLD 后缀查询：.com 与 .cn 有何不同", description: "后缀查询的 RDAP 路由、IDN 与根区元数据。", keywords: ["TLD", "suffix lookup"] },
    { title: "TLD Suffix Queries Explained", description: "How suffix lookups route across registries and IDN roots.", keywords: ["TLD", "suffix"] }],
  ["idn-internationalized-domains", { zh: "DNS", en: "DNS" }, 6, "2026-02-22",
    { title: "国际化域名 IDN 与 RDAP unicodeName", description: "Punycode、unicodeName 字段与跨语言 WHOIS 查询。", keywords: ["IDN", "punycode", "unicodeName"] },
    { title: "IDN Domains and RDAP unicodeName", description: "Punycode, unicodeName fields, and multilingual lookups.", keywords: ["IDN", "RDAP"] }],
  ["gdpr-whois-redaction", { zh: "政策与合规", en: "Policy" }, 7, "2026-02-25",
    { title: "GDPR 时代的 WHOIS 脱敏与合法获取数据", description: "隐私 redaction、代理注册与 RDRS 合规路径。", keywords: ["GDPR", "WHOIS privacy", "redaction"] },
    { title: "GDPR, WHOIS Redaction & Lawful Access", description: "Privacy redaction, proxies, and compliant data access.", keywords: ["GDPR", "WHOIS"] }],
  ["rdap-rate-limits-429", { zh: "工程实践", en: "Engineering" }, 6, "2026-03-01",
    { title: "RDAP 限速、429 与退避策略", description: "各注册局限速差异、Retry-After 与缓存设计。", keywords: ["rate limit", "429", "RDAP cache"] },
    { title: "RDAP Rate Limits and 429 Backoff", description: "Per-registry throttling, Retry-After, and caching design.", keywords: ["rate limit", "RDAP"] }],
  ["whois-security-investigations", { zh: "安全", en: "Security" }, 7, "2026-03-05",
    { title: "WHOIS/RDAP 在安全调查中的应用", description: "钓鱼、恶意域名、C2 基础设施溯源中的注册数据用法。", keywords: ["security", "threat intel", "WHOIS"] },
    { title: "WHOIS/RDAP for Security Investigations", description: "Using registration data in phishing and infrastructure tracing.", keywords: ["security", "WHOIS"] }],
  ["whois-api-integration-guide", { zh: "API 开发", en: "API" }, 8, "2026-03-08",
    { title: "构建 WHOIS JSON API 集成指南", description: "REST 设计、错误模型、缓存键与多源合并。", keywords: ["WHOIS API", "JSON API", "integration"] },
    { title: "WHOIS JSON API Integration Guide", description: "REST design, error models, cache keys, and multi-source merge.", keywords: ["WHOIS API"] }],
  ["curl-rdap-examples", { zh: "API 开发", en: "API" }, 5, "2026-03-10",
    { title: "cURL 查询 RDAP 实用示例", description: "域名、IP、ASN 的 cURL 命令与 Accept 头设置。", keywords: ["curl", "RDAP examples"] },
    { title: "Practical cURL RDAP Examples", description: "cURL commands for domain, IP, and ASN RDAP queries.", keywords: ["curl", "RDAP"] }],
  ["python-rdap-automation", { zh: "API 开发", en: "API" }, 7, "2026-03-12",
    { title: "Python 自动化 RDAP 查询入门", description: "requests 拉取、bootstrap 缓存与 referral 合并伪代码。", keywords: ["Python", "RDAP", "automation"] },
    { title: "Python RDAP Automation Starter", description: "requests, bootstrap caching, and referral merge patterns.", keywords: ["Python", "RDAP"] }],
  ["public-suffix-list-guide", { zh: "DNS", en: "DNS" }, 6, "2026-03-15",
    { title: "Public Suffix List 与可查询后缀", description: "PSL 在域名边界判定与后缀索引中的作用。", keywords: ["PSL", "public suffix"] },
    { title: "Public Suffix List Guide", description: "How PSL powers registrable domain boundaries and suffix indexes.", keywords: ["PSL"] }],
  ["dns-vs-whois-data", { zh: "DNS", en: "DNS" }, 5, "2026-03-18",
    { title: "DNS 记录与 WHOIS 数据的区别", description: "何时查 DNS、何时查 RDAP，避免混淆解析与注册信息。", keywords: ["DNS", "WHOIS difference"] },
    { title: "DNS Records vs WHOIS Data", description: "When to query DNS vs RDAP—resolution vs registration.", keywords: ["DNS", "WHOIS"] }],
  ["domain-lifecycle-expiration", { zh: "注册系统", en: "Registries" }, 6, "2026-03-20",
    { title: "域名生命周期：注册、续费、赎回与删除", description: "从 RDAP events 与 status 读懂域名阶段。", keywords: ["domain lifecycle", "expiration"] },
    { title: "Domain Lifecycle & Expiration", description: "Reading registration phases from RDAP events and status.", keywords: ["domain lifecycle"] }],
  ["registrar-vs-registry", { zh: "注册系统", en: "Registries" }, 5, "2026-03-22",
    { title: "注册商与注册局的职责划分", description: "ICANN 生态中 registry、registrar、reseller 关系图解。", keywords: ["registrar", "registry", "ICANN"] },
    { title: "Registrar vs Registry Roles", description: "ICANN ecosystem roles and data ownership.", keywords: ["registrar", "registry"] }],
  ["trademark-domain-monitoring", { zh: "商业应用", en: "Business" }, 6, "2026-03-25",
    { title: "商标保护与域名监控", description: "品牌方如何利用 WHOIS/RDAP 做仿冒域名监测。", keywords: ["trademark", "brand monitoring"] },
    { title: "Trademark & Domain Monitoring", description: "Brand protection workflows using WHOIS/RDAP feeds.", keywords: ["trademark", "monitoring"] }],
  ["cctld-vs-gtld-rdap", { zh: "注册系统", en: "Registries" }, 6, "2026-03-28",
    { title: "ccTLD 与 gTLD 的 RDAP 覆盖差异", description: "国家后缀与通用后缀在协议支持上的现实差距。", keywords: ["ccTLD", "gTLD", "RDAP"] },
    { title: "ccTLD vs gTLD RDAP Coverage", description: "Practical RDAP support gaps across TLD types.", keywords: ["ccTLD", "gTLD"] }],
  ["rdap-error-handling", { zh: "工程实践", en: "Engineering" }, 5, "2026-04-01",
    { title: "RDAP 错误处理与 HTTP 状态码", description: "404、429、5xx 与 RDAP 错误对象的统一处理。", keywords: ["RDAP errors", "HTTP status"] },
    { title: "RDAP Error Handling", description: "Normalize 404, 429, 5xx and RDAP error objects.", keywords: ["RDAP errors"] }],
  ["caching-rdap-whois-results", { zh: "工程实践", en: "Engineering" }, 6, "2026-04-05",
    { title: "WHOIS/RDAP 结果缓存最佳实践", description: "TTL 设计、Redis 分层与负缓存策略。", keywords: ["cache", "Redis", "WHOIS TTL"] },
    { title: "Caching WHOIS/RDAP Results", description: "TTL design, Redis tiers, and negative caching.", keywords: ["cache", "WHOIS"] }],
  ["self-host-rdap-lookup-whoga", { zh: "自托管", en: "Self-hosted" }, 7, "2026-04-08",
    { title: "使用 Whoga 自托管 RDAP/WHOIS 查询站", description: "部署 who.ga 开源栈、数据刷新与 API 接入。", keywords: ["Whoga", "self-hosted", "who.ga"] },
    { title: "Self-Host RDAP Lookup with Whoga", description: "Deploy the who.ga open-source stack and JSON API.", keywords: ["Whoga", "self-hosted"] }],
  ["domain-intelligence-api-design", { zh: "API 开发", en: "API" }, 8, "2026-04-10",
    { title: "域名情报 API 产品设计要点", description: "统一查询参数、规范化输出与多协议回退。", keywords: ["domain intelligence", "API design"] },
    { title: "Domain Intelligence API Design", description: "Unified query params, normalized output, protocol fallback.", keywords: ["API design"] }],
  ["whois-parsing-pitfalls", { zh: "工程实践", en: "Engineering" }, 6, "2026-04-12",
    { title: "WHOIS 文本解析的常见陷阱", description: "多语言字段、折叠行、免责声明与编码问题。", keywords: ["WHOIS parsing", "regex"] },
    { title: "WHOIS Text Parsing Pitfalls", description: "Multilingual fields, folded lines, disclaimers, encodings.", keywords: ["WHOIS parsing"] }],
  ["future-registration-data-access", { zh: "趋势", en: "Trends" }, 5, "2026-04-15",
    { title: "注册数据访问的未来趋势", description: "RDAP 标准化、DNSSEC、RDAP 联合查询与 AI 辅助分析。", keywords: ["RDAP future", "registration data"] },
    { title: "Future of Registration Data Access", description: "RDAP standardization, DNSSEC correlation, AI-assisted analysis.", keywords: ["RDAP future"] }]
];

for (const [slug, category, minutes, published, zhMeta, enMeta] of more) {
  const mk = (meta, lang) => ({
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    sections: [
      h(lang === "zh" ? "概述" : "Overview"),
      p(meta.description),
      h(lang === "zh" ? "关键要点" : "Key points"),
      l(
        lang === "zh"
          ? [
              "结合 IANA RDAP Bootstrap 与本地索引提升命中率。",
              "对无 RDAP 的 TLD 保留 WHOIS port43 回退。",
              "遵守注册局限速，使用缓存降低上游压力。",
              "在 API 响应中标注数据来源与 partial 标记。"
            ]
          : [
              "Combine IANA bootstrap with local indexes for better coverage.",
              "Keep WHOIS port 43 fallback for RDAP-less TLDs.",
              "Respect registry rate limits; cache aggressively.",
              "Expose data source and partial flags in API output."
            ]
      ),
      h(lang === "zh" ? "WHO.GA 实践" : "WHO.GA in practice"),
      p(
        lang === "zh"
          ? `WHO.GA（Whoga）在 ${meta.title} 相关场景中提供统一的 Web 查询与 JSON API，自动处理 bootstrap 路由、注册商 referral 与 WHOIS 回退。访问 who.ga 或 api.who.ga/<query> 即可体验。`
          : `WHO.GA (Whoga) provides unified web and JSON API lookup for scenarios like "${meta.title}", handling bootstrap routing, registrar referrals, and WHOIS fallback. Try who.ga or api.who.ga/<query>.`
      ),
      n(lang === "zh" ? "本文内容仅供技术学习，不构成法律建议。" : "For technical education only—not legal advice.")
    ]
  });
  articles.push(article(slug, category, minutes, published, mk(zhMeta, "zh"), mk(enMeta, "en")));
}

const out = path.resolve("lib/articles/articles.json");
await writeFile(out, JSON.stringify(articles, null, 2), "utf-8");
console.log(`Wrote ${articles.length} articles to ${out}`);
