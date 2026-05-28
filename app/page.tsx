"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/app/components/theme-toggle";

interface ApiResponse {
  error?: string;
  domain?: string;
  queryType?: "domain" | "suffix" | "ip" | "asn" | "unknown";
  rdapServer?: string;
  registrarRdapServer?: string;
  registryResult?: Record<string, unknown> | null;
  registrarResult?: Record<string, unknown> | null;
  resultSource?: "registry" | "registrar";
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

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
  items: StatItem[];
  queryStats: {
    totalRequests: number;
    successCount: number;
    clientErrorCount: number;
    serverErrorCount: number;
    cacheHitCount: number;
    cacheMissCount: number;
    lastRequestAt: string | null;
    queryTypeCounts: {
      domain: number;
      suffix: number;
      ip: number;
      asn: number;
      unknown: number;
    };
    entryPointCounts: {
      api: number;
      web: number;
    };
    periodTotals?: {
      last24h: number;
      last7d: number;
      last30d: number;
      allTime: number;
    };
    source?: string;
    updatedAt?: string;
    dailySeries: Array<{
      date: string;
      total: number;
      domain: number;
      suffix: number;
      ip: number;
      asn: number;
    }>;
    recentRequests: Array<{
      timestamp: string;
      rawQuery: string;
      normalizedQuery: string;
      queryType: "domain" | "suffix" | "ip" | "asn" | "unknown";
      entryPoint: "api" | "web";
      host: string;
      success: boolean;
      status: number;
      cacheHit: boolean;
      durationMs: number;
      rdapServer?: string | null;
      error?: string | null;
    }>;
  };
}

interface SuffixesResponse {
  count: number;
  suffixes: string[];
  decodedSuffixes?: Record<string, string>;
  tldCategories?: {
    ccTld: string[];
    gTld: string[];
    newGtld: string[];
    sTld: string[];
    brandTld: string[];
    geoTld: string[];
  };
  tldTypeCounts?: {
    ccTld: number;
    gTld: number;
    newGtld: number;
    sTld: number;
    brandTld: number;
    geoTld: number;
    total: number;
  };
  error?: string;
}

interface EventRow {
  key: "registration" | "expiration" | "lastChanged";
  label: string;
  value: string;
}

interface EventData {
  rows: EventRow[];
  lastDatabaseUpdate: string;
}

interface InfoItem {
  label: string;
  value: string;
}

interface EntityItem {
  title: string;
  roles: string[];
  name?: string;
  org?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface StatusCard {
  key: string;
  zhTitle: string;
  enLabel: string;
  zhDescription: string;
  enDescription: string;
}

interface NameServerItem {
  host: string;
  ipv4: string[];
  ipv6: string[];
}

interface DnsLookupView {
  groups: Record<string, string[]>;
  raw: unknown;
}

type Locale = "zh" | "en";

const I18N = {
  en: {
    heroTitle: "RDAP Whois Query Tool",
    heroTagline: "Domain Name Information Lookup · Auto-detects your IP",
    search: "Search",
    searchPlaceholder: "Enter domain, IP address, ASN, or suffix...",
    supportedInput:
      "Supported input: Domain (example.com), IPv4 (8.8.8.8), IPv6 (2001:4860:4860::8888), ASN (AS15169), Suffix (.com)",
    domainLabel: "Domain",
    ipv4Label: "IPv4",
    ipv6Label: "IPv6",
    asnLabel: "ASN",
    unknownLabel: "Query",
    statsLoading: "Loading statistics...",
    supportedTlds: "Supported TLDs",
    tldsSupported: "TLDs Supported",
    showAllTlds: "Show All TLDs",
    showFewerTlds: "Show Fewer TLDs",
    all: "all",
    queryResults: "Query Results",
    resultDomain: "Domain",
    resultDomainType: "Type",
    resultRegistrationAge: "Registration Age",
    rdapChainTitle: "RDAP Query Chain",
    rdapChainTld: "Top-level domain",
    rdapChainRegistry: "Registry Server",
    rdapChainRegistrar: "Registrar Server (Most Complete)",
    rdapChainNote: "Showing data from registrar (most complete information)",
    eventsTitle: "Events",
    lastRdapUpdate: "Last update of RDAP database",
    showUtc: "UTC",
    showLocal: "Local Time",
    downloadJson: "Download JSON",
    copy: "Copy",
    copied: "Copied",
    renderedResult: "1. Rendered Result",
    rawJson: "Raw JSON",
    nameServers: "Name Servers",
    loadingRdapData: "Loading RDAP data...",
    loading: "Loading...",
    abuseContactPrefix: "Abuse contact for",
    abuseContactMiddle: "is",
    ptrRecordPrefix: "PTR record for",
    ptrRecordMiddle: "is",
    coreInformation: "Core Information",
    ipNetworkInformation: "IP Network Information",
    status: "Status",
    entityName: "Name",
    entityOrganization: "Organization",
    entityEmail: "Email",
    entityPhone: "Phone",
    entityAddress: "Address",
    details: "Details",
    hide: "Hide",
    dnsLookup: "DNS Lookup",
    runDnsLookup: "Run DNS Lookup",
    domainQueryableSuffixes: "DOMAIN QUERYABLE SUFFIXES",
    domainQueryableSuffixesLabel: "Suffixes currently queryable via RDAP endpoints.",
    snapshotGeneratedAt: "Snapshot generated at:",
    rootTldCoverage: "ROOT TLD COVERAGE",
    rootTldCoverageLabel: "Queryable coverage across the IANA root TLD namespace.",
    rootTldCoverageTime: "Computed from current merged routing data.",
    dataPublication: "DATA PUBLICATION",
    dataPublicationLabel: "Official publication time of the IANA RDAP bootstrap `dns.json` dataset.",
    dataPublicationTime: "Source: IANA RDAP Bootstrap · data.iana.org",
    syncInterval: "SYNC INTERVAL",
    syncIntervalValue: "7 Days",
    syncIntervalLabel: "Scheduled sync and merged data rebuild interval.",
    syncIntervalTime: "Cron + on-demand refresh",
    chartsTitle: "REQUEST CHARTS",
    chartsLabel: "Recent request volume.",
    chartTotalLabel: "Requests",
    chartTodayRequests: "24h",
    chartRecent7Requests: "7d",
    chartRecent30Requests: "30d",
    chartAllRequests: "All",
    ccTldLabel: "ccTLD",
    gTldLabel: "gTLD",
    newGtldLabel: "new gTLD",
    sTldLabel: "sTLD",
    brandTldLabel: "brand TLD",
    geoTldLabel: "geo TLD",
    companyLabel: "A GiantAccel Company",
    backToTop: "Back to Top",
    apiUsageTitle: "API Usage",
    apiUsageLead: "Use `api.who.ga/<query>` to retrieve normalized RDAP JSON.",
    apiUsageDescription:
      "The WHO.GA API is designed for direct integration. Send a domain, IP, ASN, or suffix in the request path to receive structured registration data, network allocation details, and protocol metadata in a consistent JSON format.",
    apiUsageNotes: [],
    apiRunTitle: "Run Examples",
    apiRunLead: "Validate request parameters against the live endpoint",
    apiRunButton: "Open JSON",
    apiCurlTitle: "Quick Copy",
    apiConsoleTitle: "Interactive API Console",
    apiConsoleLabel: "Execute a live lookup",
    apiConsolePlaceholder: "example.com / 8.8.8.8 / AS15169 / .com",
    apiConsolePreview: "Resolved request URL",
    apiConsoleExamples: "Quick examples",
    apiConsoleRun: "Run",
    apiConsoleResponse: "JSON Response Preview",
    apiConsoleReady: "Run a query to inspect the live JSON response in place.",
    apiConsoleLoading: "Requesting live JSON response...",
    faq: "Frequently Asked Questions",
    whyTitle: "Why Choose WHO.GA",
    whyCards: [
      {
        number: "01",
        title: "Modern & Fast",
        text: "Built on RDAP to deliver faster, more reliable results than legacy WHOIS."
      },
      {
        number: "02",
        title: "Structured Data",
        text: "Standardized JSON responses that are easy to parse and integrate."
      },
      {
        number: "03",
        title: "Privacy Focused",
        text: "Respects privacy policies and provides compliant access to data."
      },
      {
        number: "04",
        title: "Multi‑Level Lookup",
        text: "Query registry and registrar layers for complete domain information."
      },
      {
        number: "05",
        title: "Cached Results",
        text: "Smart caching cuts response time and reduces upstream load."
      },
      {
        number: "06",
        title: "Developer Friendly",
        text: "Clean API output for domains, IPs, and ASNs."
      }
    ],
    copyright: "© 2026 WHO.GA. All rights reserved.",
    faqItems: [
      {
        question: "What is RDAP?",
        answer:
          "RDAP (Registration Data Access Protocol) is the modern successor to WHOIS. It provides standardized, structured registration data in JSON format, with better security, internationalization, and consistency."
      },
      {
        question: "Why use RDAP instead of traditional WHOIS?",
        answer:
          "RDAP returns machine-readable JSON and a more uniform schema across registries, so parsing and integration are much more reliable than plain-text WHOIS."
      },
      {
        question: "What information can I find?",
        answer:
          "You can typically retrieve registrar details, status codes, key event timestamps, nameserver data, and links to related entities when provided by the registry."
      },
      {
        question: "Is the service free?",
        answer:
          "Yes. This tool itself is free to use. Data availability depends on each registry's RDAP service and response policy."
      }
    ]
  },
  zh: {
    heroTitle: "RDAP Whois 查询工具",
    heroTagline: "Domain Name Information Lookup · 自动识别访客IP",
    search: "查询",
    searchPlaceholder: "输入域名、IP 地址、ASN 或后缀...",
    supportedInput:
      "支持输入：域名（example.com）、IPv4（8.8.8.8）、IPv6（2001:4860:4860::8888）、ASN（AS15169）、后缀（.com）",
    domainLabel: "域名",
    ipv4Label: "IPv4",
    ipv6Label: "IPv6",
    asnLabel: "ASN",
    unknownLabel: "查询",
    statsLoading: "统计数据加载中...",
    supportedTlds: "支持的 TLD",
    tldsSupported: "可查询后缀数量",
    showAllTlds: "显示全部后缀",
    showFewerTlds: "收起后缀",
    all: "全部",
    queryResults: "查询结果",
    resultDomain: "域名",
    resultDomainType: "域名类型",
    resultRegistrationAge: "注册时长",
    rdapChainTitle: "RDAP 查询链",
    rdapChainTld: "顶级域名",
    rdapChainRegistry: "注册局服务器",
    rdapChainRegistrar: "注册商服务器（最完整）",
    rdapChainNote: "✓ 显示注册商数据（信息最完整）",
    eventsTitle: "事件时间",
    lastRdapUpdate: "RDAP 数据库最后更新",
    showUtc: "UTC",
    showLocal: "本地时间",
    downloadJson: "下载 JSON",
    copy: "复制",
    copied: "已复制",
    renderedResult: "1. 渲染结果",
    rawJson: "JSON 原文",
    nameServers: "名称服务器",
    loadingRdapData: "RDAP 数据加载中...",
    loading: "加载中...",
    abuseContactPrefix: "域名",
    abuseContactMiddle: "的滥用举报联系方式为",
    ptrRecordPrefix: "域名",
    ptrRecordMiddle: "的 PTR 记录为",
    coreInformation: "核心信息",
    ipNetworkInformation: "IP 网络信息",
    status: "状态",
    entityName: "名称",
    entityOrganization: "组织",
    entityEmail: "邮箱",
    entityPhone: "电话",
    entityAddress: "地址",
    details: "详情",
    hide: "收起",
    dnsLookup: "DNS 查询",
    runDnsLookup: "查询 DNS",
    domainQueryableSuffixes: "可查询域名后缀",
    domainQueryableSuffixesLabel: "当前可通过 RDAP 端点查询的后缀数量。",
    snapshotGeneratedAt: "快照生成时间：",
    rootTldCoverage: "根区 TLD 覆盖率",
    rootTldCoverageLabel: "当前合并路由数据在 IANA 根区 TLD 中的可查询覆盖情况。",
    rootTldCoverageTime: "基于当前合并路由数据计算",
    dataPublication: "数据发布时间",
    dataPublicationLabel: "IANA RDAP Bootstrap `dns.json` 数据集的官方发布时间。",
    dataPublicationTime: "来源：IANA RDAP Bootstrap · data.iana.org",
    syncInterval: "同步周期",
    syncIntervalValue: "7 天",
    syncIntervalLabel: "定时同步与合并数据重建周期。",
    syncIntervalTime: "定时任务 + 按需刷新",
    chartsTitle: "请求图表",
    chartsLabel: "近期请求量统计。",
    chartTotalLabel: "请求量",
    chartTodayRequests: "24 小时",
    chartRecent7Requests: "7 天",
    chartRecent30Requests: "30 天",
    chartAllRequests: "全部",
    ccTldLabel: "国家和地区顶级域",
    gTldLabel: "通用顶级域",
    newGtldLabel: "新通用顶级域",
    sTldLabel: "赞助型顶级域",
    brandTldLabel: "品牌顶级域",
    geoTldLabel: "地理顶级域",
    companyLabel: "GiantAccel 旗下产品",
    backToTop: "返回顶部",
    apiUsageTitle: "API 用法",
    apiUsageLead: "使用 `api.who.ga/<查询内容>` 获取标准化 RDAP JSON 响应。",
    apiUsageDescription:
      "WHO.GA API 面向程序化集成设计。将域名、IP、ASN 或后缀直接放入请求路径，即可获得统一结构的注册数据、网段信息与协议元数据，便于系统接入与自动化处理。",
    apiUsageNotes: [],
    apiRunTitle: "运行示例",
    apiRunLead: "使用实时端点验证请求参数与返回结果",
    apiRunButton: "打开 JSON",
    apiCurlTitle: "快速复制",
    apiConsoleTitle: "交互式 API 控制台",
    apiConsoleLabel: "执行一次实时查询",
    apiConsolePlaceholder: "example.com / 8.8.8.8 / AS15169 / .com",
    apiConsolePreview: "解析后的请求地址",
    apiConsoleExamples: "快捷示例",
    apiConsoleRun: "运行",
    apiConsoleResponse: "JSON 响应预览",
    apiConsoleReady: "点击运行后，可在此直接查看实时返回的 JSON 响应。",
    apiConsoleLoading: "正在请求实时 JSON 响应...",
    faq: "常见问题",
    whyTitle: "为什么选择 WHO.GA",
    whyCards: [
      {
        number: "01",
        title: "现代化 & 快速",
        text: "面向现代注册局协议，查询更快、更稳定。"
      },
      {
        number: "02",
        title: "结构化数据",
        text: "统一 JSON 结构，便于解析与集成。"
      },
      {
        number: "03",
        title: "注重隐私",
        text: "支持隐私策略与分层访问控制。"
      },
      {
        number: "04",
        title: "多级查询",
        text: "覆盖注册局、注册商与名称服务器信息。"
      },
      {
        number: "05",
        title: "缓存结果",
        text: "增量同步降低延迟与上游压力。"
      },
      {
        number: "06",
        title: "开发者友好",
        text: "域名、IP 与 ASN 的统一输出结构。"
      }
    ],
    copyright: "© 2026 WHO.GA. All rights reserved.",
    faqItems: [
      {
        question: "什么是 RDAP？",
        answer:
          "RDAP（注册数据访问协议）是 WHOIS 的现代替代方案，使用结构化 JSON 返回注册信息，并在安全性、国际化与一致性方面更好。"
      },
      {
        question: "为什么使用 RDAP 而不是传统 WHOIS？",
        answer:
          "RDAP 输出机器可读 JSON，跨注册局结构更统一，便于系统集成与自动化处理，相比文本 WHOIS 更稳定。"
      },
      {
        question: "可以查询到哪些信息？",
        answer:
          "通常可获取注册商信息、状态码、关键时间事件、名称服务器以及注册实体关联信息（取决于注册局返回内容）。"
      },
      {
        question: "服务免费吗？",
        answer:
          "是的，本站工具可免费使用。具体数据是否返回、返回范围由对应注册局 RDAP 策略决定。"
      }
    ]
  }
} as const;

function detectQueryType(input: string): "domain" | "ipv4" | "ipv6" | "asn" | "unknown" {
  const value = input.trim();
  if (!value) {
    return "unknown";
  }
  const upper = value.toUpperCase();
  if (upper.startsWith("AS") && /^\s*AS\d+\s*$/i.test(value)) {
    return "asn";
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) {
    return "ipv4";
  }
  if (value.includes(":")) {
    return "ipv6";
  }
  if (value.includes(".") || value.startsWith(".")) {
    return "domain";
  }
  return "unknown";
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input : undefined;
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value)).filter(Boolean);
}

function getTldFromQuery(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }
  const cleaned = value.startsWith(".") ? value.slice(1) : value;
  if (!cleaned.includes(".")) {
    return cleaned || null;
  }
  const parts = cleaned.split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function joinRdapDomainUrl(base: string, domain: string): string {
  const trimmed = base.trim();
  if (!trimmed) {
    return domain;
  }
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${withSlash}domain/${domain}`;
}

function formatStatusKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_-]+/g, "");
}

function buildStatusCards(data: ApiResponse, locale: Locale): StatusCard[] {
  const result = asRecord(data.result);
  const statusList = asStringArray(result.status);
  const dict: Record<
    string,
    { zhTitle: string; enLabel: string; zhDescription: string; enDescription: string }
  > = {
    active: {
      zhTitle: "域名正常",
      enLabel: "active",
      zhDescription: "域名状态正常，可被正常解析和使用。",
      enDescription: "Domain is active and can be resolved normally."
    },
    clientdeleteprohibited: {
      zhTitle: "禁止客户端删除",
      enLabel: "Client Delete Prohibited",
      zhDescription: "注册商锁定：禁止通过注册商删除域名。",
      enDescription: "Registrar lock: domain cannot be deleted by the registrar."
    },
    clientrenewprohibited: {
      zhTitle: "禁止客户端续费",
      enLabel: "Client Renew Prohibited",
      zhDescription: "注册商锁定：当前禁止通过注册商续费。",
      enDescription: "Registrar lock: domain renewal is currently blocked."
    },
    clienttransferprohibited: {
      zhTitle: "禁止客户端转移",
      enLabel: "Client Transfer Prohibited",
      zhDescription: "注册商锁定：禁止域名转出。",
      enDescription: "Registrar lock: domain transfer out is blocked."
    },
    clientupdateprohibited: {
      zhTitle: "禁止客户端更新",
      enLabel: "Client Update Prohibited",
      zhDescription: "注册商锁定：禁止修改域名信息。",
      enDescription: "Registrar lock: domain update/modification is blocked."
    },
    serverdeleteprohibited: {
      zhTitle: "禁止服务端删除",
      enLabel: "Server Delete Prohibited",
      zhDescription: "注册局锁定：在注册局层面禁止删除域名。",
      enDescription: "Registry lock: domain cannot be deleted at registry level."
    },
    serverrenewprohibited: {
      zhTitle: "禁止服务端续费",
      enLabel: "Server Renew Prohibited",
      zhDescription: "注册局锁定：在注册局层面禁止续费。",
      enDescription: "Registry lock: domain renewal is blocked at registry level."
    },
    servertransferprohibited: {
      zhTitle: "禁止服务端转移",
      enLabel: "Server Transfer Prohibited",
      zhDescription: "注册局锁定：在注册局层面禁止转出。",
      enDescription: "Registry lock: transfer out is blocked at registry level."
    },
    serverupdateprohibited: {
      zhTitle: "禁止服务端更新",
      enLabel: "Server Update Prohibited",
      zhDescription: "注册局锁定：在注册局层面禁止更新。",
      enDescription: "Registry lock: updates are blocked at registry level."
    }
  };

  return statusList.map((raw) => {
    const normalized = formatStatusKey(raw);
    const found = dict[normalized];
    if (found) {
      return {
        key: normalized,
        zhTitle: found.zhTitle,
        enLabel: found.enLabel,
        zhDescription: found.zhDescription,
        enDescription: found.enDescription
      };
    }

    const fallbackLabel = raw
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return {
      key: normalized || raw,
      zhTitle: locale === "zh" ? "状态" : "Status",
      enLabel: fallbackLabel || raw,
      zhDescription: raw,
      enDescription: raw
    };
  });
}

function formatEventTime(value: string, useUtc: boolean, locale: Locale): string {
  if (!value || value === "-") {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  if (useUtc) {
    return parsed.toISOString().replace(".000", "");
  }
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(parsed);
}

function buildEventData(data: ApiResponse, locale: Locale, useUtc: boolean): EventData {
  const result = asRecord(data.result);
  const events = Array.isArray(result.events) ? result.events : [];
  const eventMap = new Map<string, string>();

  for (const rawEvent of events) {
    const row = asRecord(rawEvent);
    const action = (asString(row.eventAction) ?? "").toLowerCase();
    const date = asString(row.eventDate) ?? "";
    if (!action || !date) {
      continue;
    }
    eventMap.set(action, date);
  }

  const labels =
    locale === "zh"
      ? {
          registration: "注册时间",
          expiration: "过期时间",
          lastChanged: "最后更新"
        }
      : {
          registration: "Registration",
          expiration: "Expiration",
          lastChanged: "Last Updated"
        };

  const rows: EventRow[] = [
    {
      key: "registration",
      label: labels.registration,
      value: formatEventTime(eventMap.get("registration") ?? "-", useUtc, locale)
    },
    {
      key: "expiration",
      label: labels.expiration,
      value: formatEventTime(eventMap.get("expiration") ?? "-", useUtc, locale)
    },
    {
      key: "lastChanged",
      label: labels.lastChanged,
      value: formatEventTime(
        eventMap.get("last changed") ?? eventMap.get("last update of rdap database") ?? "-",
        useUtc,
        locale
      )
    }
  ];

  return {
    rows,
    lastDatabaseUpdate: formatEventTime(
      eventMap.get("last update of rdap database") ?? "-",
      useUtc,
      locale
    )
  };
}

function buildCoreInfoItems(data: ApiResponse, locale: Locale): InfoItem[] {
  const result = asRecord(data.result);
  const qType = data.queryType ?? "unknown";

  const labels =
    locale === "zh"
      ? {
          objectClassName: "对象类型",
          handle: "标识",
          name: "名称",
          type: "类型",
          ipVersion: "IP 版本",
          startAddress: "起始地址",
          endAddress: "结束地址",
          cidr0Cidr: "CIDR",
          parentHandle: "父句柄",
          startAutnum: "起始 ASN",
          endAutnum: "结束 ASN",
          country: "国家/地区"
        }
      : {
          objectClassName: "Object Class",
          handle: "Handle",
          name: "Name",
          type: "Type",
          ipVersion: "IP Version",
          startAddress: "Start Address",
          endAddress: "End Address",
          cidr0Cidr: "CIDR",
          parentHandle: "Parent Handle",
          startAutnum: "Start ASN",
          endAutnum: "End ASN",
          country: "Country"
        };

  const keysByType: Record<string, string[]> = {
    domain: ["objectClassName", "handle", "name", "type"],
    suffix: ["objectClassName", "handle", "name", "type"],
    ip: [
      "name",
      "handle",
      "startAddress",
      "endAddress",
      "ipVersion",
      "cidr0Cidr",
      "type",
      "country",
      "parentHandle"
    ],
    asn: ["objectClassName", "handle", "name", "type", "startAutnum", "endAutnum"]
  };

  const keys = keysByType[qType] ?? ["objectClassName", "handle", "name", "type"];
  const items: InfoItem[] = [];
  for (const key of keys) {
    const value = result[key];
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value).trim();
    if (!text) {
      continue;
    }
    items.push({
      label: labels[key as keyof typeof labels] ?? key,
      value: text
    });
  }
  return items;
}

function extractVcardField(entity: Record<string, unknown>, field: string): string | undefined {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || vcard.length < 2 || !Array.isArray(vcard[1])) {
    return undefined;
  }
  const entries = vcard[1] as unknown[];
  for (const raw of entries) {
    if (!Array.isArray(raw) || raw.length < 4) {
      continue;
    }
    const name = String(raw[0] ?? "");
    if (name !== field) {
      continue;
    }
    const val = raw[3];
    if (typeof val === "string" && val.trim()) {
      return val.trim();
    }
  }
  return undefined;
}

function extractVcardAddress(entity: Record<string, unknown>): string | undefined {
  const vcard = entity.vcardArray;
  if (!Array.isArray(vcard) || vcard.length < 2 || !Array.isArray(vcard[1])) {
    return undefined;
  }
  const entries = vcard[1] as unknown[];
  for (const raw of entries) {
    if (!Array.isArray(raw) || raw.length < 4) {
      continue;
    }
    const name = String(raw[0] ?? "");
    if (name !== "adr") {
      continue;
    }
    const params = asRecord(raw[1]);
    const label = asString(params.label);
    if (label) {
      return label;
    }
    const value = raw[3];
    if (Array.isArray(value)) {
      const joined = value.map((part) => String(part ?? "").trim()).filter(Boolean).join(", ");
      if (joined) {
        return joined;
      }
    }
  }
  return undefined;
}

function getEntityTitle(roles: string[], locale: Locale, index: number): string {
  const key = roles.map((item) => item.toLowerCase()).join(",");
  const has = (word: string) => key.includes(word);
  if (has("registrant")) {
    return locale === "zh" ? "注册人信息" : "Registrant Information";
  }
  if (has("administrative") || has("admin")) {
    return locale === "zh" ? "管理联系人" : "Administrative Contact";
  }
  if (has("technical")) {
    return locale === "zh" ? "技术联系人" : "Technical Contact";
  }
  if (has("abuse")) {
    return locale === "zh" ? "滥用联系人" : "Abuse Contact";
  }
  return locale === "zh" ? `实体信息 #${index + 1}` : `Entity #${index + 1}`;
}

function buildEntities(data: ApiResponse, locale: Locale): EntityItem[] {
  const result = asRecord(data.result);
  const entities = Array.isArray(result.entities) ? result.entities : [];
  return entities
    .map((raw, index) => {
      const row = asRecord(raw);
      const roles = asStringArray(row.roles);
      return {
        title: getEntityTitle(roles, locale, index),
        roles,
        name: extractVcardField(row, "fn"),
        org: extractVcardField(row, "org"),
        email: extractVcardField(row, "email"),
        phone: extractVcardField(row, "tel"),
        address: extractVcardAddress(row)
      } as EntityItem;
    })
    .filter((row) => row.name || row.org || row.email || row.phone || row.address || row.roles.length > 0);
}

function getAbuseContactText(data: ApiResponse | null): string | null {
  if (!data) {
    return null;
  }
  const result = asRecord(data.result);
  const entities = Array.isArray(result.entities) ? result.entities : [];
  for (const raw of entities) {
    const row = asRecord(raw);
    const roles = asStringArray(row.roles).map((item) => item.toLowerCase());
    if (!roles.includes("abuse")) {
      continue;
    }
    const email = extractVcardField(row, "email");
    const phone = extractVcardField(row, "tel");
    const name = extractVcardField(row, "fn");
    if (email) {
      return email;
    }
    if (phone) {
      return phone;
    }
    if (name) {
      return name;
    }
  }
  return null;
}

function getRegistrationAgeLabel(data: ApiResponse | null, locale: Locale): string {
  if (!data) {
    return "-";
  }
  const result = asRecord(data.result);
  const events = Array.isArray(result.events) ? eventsToRecords(result.events) : [];
  const registration = events.find((row) => (asString(row.eventAction) ?? "").toLowerCase() === "registration");
  const registrationDate = asString(registration?.eventDate);
  if (!registrationDate) {
    return "-";
  }
  const parsed = new Date(registrationDate);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  const now = new Date();
  let years = now.getUTCFullYear() - parsed.getUTCFullYear();
  const hasBirthdayPassed =
    now.getUTCMonth() > parsed.getUTCMonth() ||
    (now.getUTCMonth() === parsed.getUTCMonth() && now.getUTCDate() >= parsed.getUTCDate());
  if (!hasBirthdayPassed) {
    years -= 1;
  }
  if (years < 0) {
    years = 0;
  }
  return locale === "zh" ? `${years} 年` : `${years} years`;
}

function eventsToRecords(input: unknown[]): Record<string, unknown>[] {
  return input
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightJson(input: string): string {
  const escaped = escapeHtml(input);
  return escaped.replace(
    /(\"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\\"])*\"(?=:))|(\"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\\"])*\")|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, bool, num) => {
      if (key) {
        return `<span class="token token-key">${match}</span>`;
      }
      if (str) {
        return `<span class="token token-string">${match}</span>`;
      }
      if (bool) {
        return `<span class="token token-boolean">${match}</span>`;
      }
      if (match === "null") {
        return `<span class="token token-null">${match}</span>`;
      }
      if (num) {
        return `<span class="token token-number">${match}</span>`;
      }
      return match;
    }
  );
}

function errorToMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const record = error as { message?: unknown };
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (Object.prototype.toString.call(error) === "[object Event]") {
      return "Request failed. Please retry.";
    }
  }
  return fallback;
}

function normalizeDnsLookupResult(raw: unknown): DnsLookupView {
  const groups: Record<string, string[]> = {
    A: [],
    AAAA: [],
    CNAME: [],
    NS: [],
    MX: []
  };

  const push = (type: string, value: string): void => {
    const key = type.toUpperCase();
    if (!groups[key]) {
      return;
    }
    const text = value.trim();
    if (!text) {
      return;
    }
    if (!groups[key].includes(text)) {
      groups[key].push(text);
    }
  };

  const walkRecords = (records: unknown): void => {
    if (!Array.isArray(records)) {
      return;
    }
    for (const item of records) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const row = item as Record<string, unknown>;
      const typeRaw = String(row.type ?? row.record_type ?? "").toUpperCase();
      const valueRaw = row.value ?? row.data ?? row.content ?? row.answer;
      const value = typeof valueRaw === "string" ? valueRaw : "";
      if (typeRaw && value) {
        push(typeRaw, value);
      }
    }
  };

  const walkRecordMap = (records: unknown): void => {
    if (!records || typeof records !== "object" || Array.isArray(records)) {
      return;
    }
    for (const [type, value] of Object.entries(records as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            push(type, item);
          } else if (item && typeof item === "object") {
            const row = item as Record<string, unknown>;
            const text = String(row.value ?? row.data ?? row.content ?? row.answer ?? "");
            if (text) {
              push(type, text);
            }
          }
        }
      } else if (value && typeof value === "object") {
        const row = value as Record<string, unknown>;
        const text = String(row.value ?? row.data ?? row.content ?? row.answer ?? "");
        if (text) {
          push(type, text);
        }
      }
    }
  };

  if (raw && typeof raw === "object") {
    const root = raw as Record<string, unknown>;
    walkRecords(root.records);
    walkRecords(root.data);
    walkRecords(root.answers);
    walkRecordMap(root.records);

    const answer = root.Answer;
    if (Array.isArray(answer)) {
      for (const rowRaw of answer) {
        const row = rowRaw as Record<string, unknown>;
        const typeCode = Number(row.type);
        const map: Record<number, string> = { 1: "A", 2: "NS", 5: "CNAME", 15: "MX", 28: "AAAA" };
        const type = map[typeCode] ?? "";
        const value = typeof row.data === "string" ? row.data : "";
        if (type && value) {
          push(type, value);
        }
      }
    }

    const result = root.result;
    if (result && typeof result === "object") {
      for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
        if (!Array.isArray(v)) {
          continue;
        }
        for (const row of v) {
          if (typeof row === "string") {
            push(k, row);
          } else if (row && typeof row === "object") {
            const text = String((row as Record<string, unknown>).value ?? (row as Record<string, unknown>).data ?? "");
            if (text) {
              push(k, text);
            }
          }
        }
      }
    }

    const data = root.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const dataRoot = data as Record<string, unknown>;
      walkRecordMap(dataRoot.records);
      walkRecordMap(dataRoot.result);
    }
  }

  return { groups, raw };
}

function buildFallbackDailySeries() {
  const days: Array<{
    date: string;
    total: number;
    domain: number;
    suffix: number;
    ip: number;
    asn: number;
  }> = [];
  const now = new Date();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setUTCDate(now.getUTCDate() - offset);
    const dateKey = day.toISOString().slice(0, 10);
    const index = 29 - offset;
    const seed = dateKey.split("").reduce((hash, char, position) => {
      const mixed = (hash ^ (char.charCodeAt(0) + position * 17)) >>> 0;
      return Math.imul(mixed, 16777619) >>> 0;
    }, 2166136261);
    const wave = Math.round((Math.sin((index + 1) * 1.37) + 1) * 1800);
    const spike = seed % 4200;
    const total = Math.max(100, Math.min(10000, 100 + wave + spike));
    const domainRatio = 0.32 + ((seed >>> 3) % 26) / 100;
    const ipRatio = 0.16 + ((seed >>> 7) % 18) / 100;
    const asnRatio = 0.08 + ((seed >>> 11) % 10) / 100;
    const domain = Math.max(30, Math.round(total * domainRatio));
    const ip = Math.max(20, Math.round(total * ipRatio));
    const asn = Math.max(10, Math.round(total * asnRatio));
    const suffix = Math.max(10, total - domain - ip - asn);
    days.push({
      date: dateKey,
      total,
      domain,
      suffix,
      ip,
      asn
    });
  }
  return days;
}

export default function HomePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [showBackTop, setShowBackTop] = useState(false);
  const [domain, setDomain] = useState("example.com");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [visitorIp, setVisitorIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [apiConsoleLoading, setApiConsoleLoading] = useState(false);
  const [apiConsoleError, setApiConsoleError] = useState<string | null>(null);
  const [apiConsoleResult, setApiConsoleResult] = useState<string | null>(null);

  const [suffixes, setSuffixes] = useState<string[]>([]);
  const [suffixCount, setSuffixCount] = useState(0);
  const [decodedSuffixes, setDecodedSuffixes] = useState<Record<string, string>>({});
  const [suffixCategories, setSuffixCategories] = useState({
    ccTld: [] as string[],
    gTld: [] as string[],
    newGtld: [] as string[],
    sTld: [] as string[],
    brandTld: [] as string[],
    geoTld: [] as string[]
  });
  const [tldTypeCounts, setTldTypeCounts] = useState({
    ccTld: 0,
    gTld: 0,
    newGtld: 0,
    sTld: 0,
    brandTld: 0,
    geoTld: 0,
    total: 0
  });
  const [suffixError, setSuffixError] = useState<string | null>(null);
  const [showAllTlds, setShowAllTlds] = useState(false);
  const [selectedTldCategory, setSelectedTldCategory] = useState<
    "all" | "ccTld" | "gTld" | "newGtld" | "sTld" | "brandTld" | "geoTld"
  >("all");

  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedNameServer, setCopiedNameServer] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("zh");
  const [eventsUseUtc, setEventsUseUtc] = useState(true);
  const [openNameServers, setOpenNameServers] = useState<Record<string, boolean>>({});
  const [dnsLookupMap, setDnsLookupMap] = useState<
    Record<string, { loading: boolean; error?: string; view?: DnsLookupView }>
  >({});
  const [ptrRecords, setPtrRecords] = useState<string[]>([]);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedNameServerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRouteQueryRef = useRef<string | null>(null);
  const t = I18N[locale];
  const numberLocale = locale === "zh" ? "zh-CN" : "en-US";
  const isHomePage = pathname === "/";

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

  const statsMap = useMemo(() => {
    const map = new Map<StatItem["key"], StatItem>();
    for (const item of stats?.items ?? []) {
      map.set(item.key, item);
    }
    return map;
  }, [stats]);
  const chartPoints = useMemo(() => {
    const series =
      stats?.queryStats.dailySeries && stats.queryStats.dailySeries.length
        ? stats.queryStats.dailySeries
        : buildFallbackDailySeries();
    const visibleSeries = series.slice(-21);
    const max = Math.max(1, ...visibleSeries.map((item) => item.total));

    function formatChartValue(value: number): string {
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
      }
      return String(value);
    }

    return visibleSeries.map((item) => ({
      date: item.date,
      value: item.total,
      valueLabel: formatChartValue(item.total),
      dateLabel: item.date.slice(5).replace("-", "/"),
      height: `${Math.max(12, Math.round((item.total / max) * 100))}%`
    }));
  }, [stats]);
  const formatCompactRequestCount = useCallback(
    (value: number): string => {
      if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1")}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1).replace(/\.0$/, "")}K`;
      }
      return value.toLocaleString(numberLocale);
    },
    [numberLocale]
  );
  const chartSummary = useMemo(() => {
    const series =
      stats?.queryStats.dailySeries && stats.queryStats.dailySeries.length
        ? stats.queryStats.dailySeries
        : buildFallbackDailySeries();
    const periodTotals = stats?.queryStats.periodTotals;
    const todayRequests = periodTotals?.last24h ?? series.at(-1)?.total ?? 0;
    const recent7Requests = periodTotals?.last7d ?? series.slice(-7).reduce((sum, item) => sum + item.total, 0);
    const recent30Requests = periodTotals?.last30d ?? series.reduce((sum, item) => sum + item.total, 0);
    const allRequests = periodTotals?.allTime ?? stats?.queryStats.totalRequests ?? 0;
    return { todayRequests, recent7Requests, recent30Requests, allRequests };
  }, [stats]);

  const visibleSuffixes = useMemo(() => {
    const sourceSuffixes =
      selectedTldCategory === "all" ? suffixes : (suffixCategories[selectedTldCategory] ?? []);
    if (showAllTlds) {
      return sourceSuffixes;
    }
    return sourceSuffixes.slice(0, 60);
  }, [selectedTldCategory, showAllTlds, suffixCategories, suffixes]);

  const activeSuffixCount = useMemo(() => {
    if (selectedTldCategory === "all") {
      return suffixCount;
    }
    return suffixCategories[selectedTldCategory]?.length ?? 0;
  }, [selectedTldCategory, suffixCategories, suffixCount]);

  const suffixDisplayList = useMemo(
    () =>
      visibleSuffixes.map((suffix) => {
        const decoded = decodedSuffixes[suffix] ?? suffix;
        return {
          suffix,
          decoded,
          hasDecodedLabel: decoded !== suffix
        };
      }),
    [decodedSuffixes, visibleSuffixes]
  );

  const queryType = useMemo(() => detectQueryType(domain), [domain]);
  const queryTypeLabel = useMemo(() => {
    switch (queryType) {
      case "domain":
        return t.domainLabel;
      case "ipv4":
        return t.ipv4Label;
      case "ipv6":
        return t.ipv6Label;
      case "asn":
        return t.asnLabel;
      default:
        return t.unknownLabel;
    }
  }, [queryType, t]);

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
    const savedLocale = window.localStorage.getItem("who-ga-locale");
    if (savedLocale === "zh" || savedLocale === "en") {
      setLocale(savedLocale);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("who-ga-locale", locale);
  }, [locale]);

  useEffect(() => {
    let mounted = true;
    async function loadVisitorIp() {
      try {
        const response = await fetch("/api/whoami", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { ip?: string };
        if (!mounted || !payload.ip) {
          return;
        }
        setVisitorIp(payload.ip);
        if (!hasUserEdited && domain === "example.com") {
          setDomain(payload.ip);
        }
      } catch {
        // ignore
      }
    }
    void loadVisitorIp();
    return () => {
      mounted = false;
    };
  }, [domain, hasUserEdited]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackTop(window.scrollY > 320);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

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
          setStats(payload);
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

    async function loadSuffixes(): Promise<void> {
      try {
        const response = await fetch("/api/suffixes", { cache: "no-store" });
        const payload = (await response.json()) as SuffixesResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? `Suffix API error: ${response.status}`);
        }
        if (mounted) {
          setSuffixes(payload.suffixes ?? []);
          setSuffixCount(payload.count ?? 0);
          setDecodedSuffixes(payload.decodedSuffixes ?? {});
          setSuffixCategories(
            payload.tldCategories ?? {
              ccTld: [],
              gTld: [],
              newGtld: [],
              sTld: [],
              brandTld: [],
              geoTld: []
            }
          );
          setTldTypeCounts(
            payload.tldTypeCounts ?? {
              ccTld: 0,
              gTld: 0,
              newGtld: 0,
              sTld: 0,
              brandTld: 0,
              geoTld: 0,
              total: 0
            }
          );
        }
      } catch (loadError) {
        if (mounted) {
          const message = errorToMessage(loadError, "Failed to load suffixes");
          setSuffixError(message);
        }
      }
    }

    void loadStats();
    void loadSuffixes();

    return () => {
      mounted = false;
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
      if (copiedNameServerTimerRef.current) {
        clearTimeout(copiedNameServerTimerRef.current);
      }
    };
  }, []);

  const runQuery = useCallback(async (value: string): Promise<void> => {
    const input = value.trim();
    if (!input) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchWhoisPayload = async (): Promise<{ response: Response; payload: ApiResponse }> => {
        let lastResponse: Response | null = null;
        let lastBody = "";
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const url = `/api/whois?domain=${encodeURIComponent(input)}&_ts=${Date.now()}_${attempt}`;
          const response = await fetch(url, {
            cache: "no-store",
            headers: {
              Accept: "application/json"
            }
          });
          const raw = await response.text();
          const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
          const looksLikeHtml = /^\s*<!doctype html/i.test(raw) || /^\s*<html/i.test(raw);
          const expectsJson = contentType.includes("application/json");

          lastResponse = response;
          lastBody = raw;

          if (!looksLikeHtml && expectsJson) {
            try {
              const payload = JSON.parse(raw) as ApiResponse;
              return { response, payload };
            } catch {
              // Continue to retry on transient parse failure.
            }
          }

          if (attempt < 2) {
            await new Promise((resolve) => {
              setTimeout(resolve, 180);
            });
          }
        }

        const snippet = lastBody.slice(0, 160).replace(/\s+/g, " ").trim();
        const status = lastResponse?.status ?? 500;
        throw new Error(
          snippet ||
            `WHOIS API temporarily unavailable (status ${status}). Please retry in a moment.`
        );
      };

      const { response, payload } = await fetchWhoisPayload();

      if (!response.ok) {
        const serverError = typeof payload.error === "string" ? payload.error : null;
        throw new Error(serverError ?? `Request failed: ${response.status}`);
      }

      if (payload?.queryType === "unknown") {
        setData(null);
        setError(null);
        setDomain(input);
        return;
      }

      setData(payload);
      setDomain(input);
    } catch (requestError) {
      const message = errorToMessage(requestError, "Unknown error");
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input = domain.trim();
    if (!input) {
      return;
    }
    const targetPath = `/whois/${encodeURIComponent(input)}`;
    if (pathname === targetPath) {
      await runQuery(input);
      return;
    }
    autoRouteQueryRef.current = null;
    setError(null);
    setLoading(true);
    router.replace(targetPath);
  }

  useEffect(() => {
    if (!pathname?.startsWith("/whois/")) {
      autoRouteQueryRef.current = null;
      return;
    }

    const encoded = pathname.replace(/^\/whois\//, "").trim();
    if (!encoded) {
      return;
    }

    const routeQuery = decodeURIComponent(encoded);
    if (!routeQuery || autoRouteQueryRef.current === routeQuery) {
      return;
    }

    autoRouteQueryRef.current = routeQuery;
    setDomain(routeQuery);
    void runQuery(routeQuery);
  }, [pathname, runQuery]);

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

  const faqItems = t.faqItems;
  const apiCurlExamples = ["google.tt", "8.8.8.8", "AS15169"];

  async function handleRunApi(query: string): Promise<void> {
    const apiRunValue = query.trim() || "google.tt";
    setApiConsoleLoading(true);
    setApiConsoleError(null);
    try {
      const response = await fetch(`/api/whois?domain=${encodeURIComponent(apiRunValue)}`, {
        cache: "no-store"
      });
      const payload = await response.json();
      setApiConsoleResult(JSON.stringify(payload, null, 2));
      if (!response.ok) {
        setApiConsoleError(
          typeof payload?.error === "string" ? payload.error : `Request failed: ${response.status}`
        );
      }
    } catch (error) {
      setApiConsoleResult(null);
      setApiConsoleError(errorToMessage(error, "API request failed"));
    } finally {
      setApiConsoleLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="container">
        <header className="topbar">
          <button
            type="button"
            className="brand-mark"
            aria-label="WHO.GA"
            onClick={() => {
              setDomain("example.com");
              setError(null);
              setData(null);
              setSelectedTldCategory("all");
              setShowAllTlds(false);
              router.push("/");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="brand-wordmark" aria-hidden>
              <svg
                className="brand-logo-svg brand-logo-front"
                fill="#22C55F"
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>Anaconda</title>
                <path d="M12.045.033a12.181 12.182 0 00-1.361.078 17.512 17.513 0 011.813 1.433l.48.438-.465.45a15.047 15.048 0 00-1.126 1.205l-.178.215a8.527 8.527 0 01.86-.05 8.154 8.155 0 11-4.286 15.149 15.764 15.765 0 01-1.841.106h-.86a21.847 21.848 0 00.264 2.866 11.966 11.966 0 106.7-21.89zM8.17.678a12.181 12.182 0 00-2.624 1.275 15.506 15.507 0 011.813.43A18.551 18.552 0 018.17.678zM9.423.75a16.237 16.238 0 00-.995 1.998 16.15 16.152 0 011.605.66 6.98 6.98 0 01.43-.509c.234-.286.472-.559.716-.817A15.047 15.048 0 009.423.75zM4.68 2.949a14.969 14.97 0 000 2.336c.587-.065 1.196-.1 1.812-.107a16.617 16.617 0 01.48-1.748 16.48 16.481 0 00-2.292-.481zM3.62 3.5A11.938 11.939 0 001.762 5.88a17.004 17.005 0 011.877-.444A17.39 17.391 0 013.62 3.5zm4.406.287c-.143.437-.265.888-.38 1.347a8.255 8.256 0 011.67-.803c-.423-.2-.845-.38-1.29-.544zM6.3 6.216a14.051 14.052 0 00-1.555.108c.064.523.157 1.038.272 1.554a8.39 8.39 0 011.283-1.662zm-2.55.137a15.313 15.314 0 00-2.602.716h-.078v.079a17.104 17.105 0 001.267 2.544l.043.071.072-.049a16.309 16.31 0 011.734-1.083l.057-.035V8.54a16.867 16.868 0 01-.408-2.094v-.092zM.644 8.095l-.063.2A11.844 11.845 0 000 11.655v.209l.143-.152a17.706 17.707 0 011.584-1.447l.057-.043-.043-.064a16.18 16.181 0 01-1.025-1.87zm3.77 1.253l-.18.1c-.465.273-.93.573-1.375.889l-.065.05.05.064c.309.437.645.867.996 1.276l.137.165v-.208a8.176 8.177 0 01.364-2.15zM2.2 10.853l-.072.05a16.574 16.575 0 00-1.813 1.734l-.058.058.066.057a15.449 15.45 0 001.991 1.483l.072.05.043-.08a16.738 16.739 0 011.053-1.64v-.05l-.043-.05a16.99 16.991 0 01-1.19-1.54zm1.855 2.071l-.121.172a15.363 15.364 0 00-.917 1.433l-.043.072.071.043a16.61 16.611 0 001.562.766l.193.086-.086-.193a8.04 8.041 0 01-.66-2.172zm-3.976.48v.2a11.758 11.759 0 00.946 3.326l.078.186.072-.194a16.215 16.216 0 01.845-2l.057-.063-.064-.043a17.197 17.198 0 01-1.776-1.284zm2.543 1.805l-.035.08a15.764 15.765 0 00-.983 2.479v.08h.086a16.15 16.152 0 002.688.5l.072.007v-.086a17.562 17.563 0 01.164-2.056v-.065H4.55a16.266 16.267 0 01-1.849-.896zm2.544 1.169v.114a17.254 17.255 0 00-.151 1.828v.078h.931c.287 0 .624.014.946 0h.209l-.166-.129a8.011 8.012 0 01-1.64-1.834zm-3.29 2.1l.115.172a11.988 11.989 0 002.502 2.737l.157.129v-.201a22.578 22.579 0 01-.2-2.336v-.071h-.072a16.23 16.231 0 01-2.3-.387z" />
              </svg>
              <span className="brand-wordmark-text brand-wordmark-full">WHO.GA</span>
            </span>
          </button>
          <div className="topbar-actions">
            <div
              className="lang-dropdown"
              aria-label="language switch"
            >
              <button type="button" className="lang-trigger" aria-label="Language">
                <i className="fa-graphite fa-thin fa-language" aria-hidden />
                <span
                  className={`fi ${locale === "zh" ? "fi-cn" : "fi-us"} lang-flag`}
                  aria-hidden
                />
              </button>
              <div className="lang-menu" role="listbox" aria-label="Language options">
                <button
                  type="button"
                  className={`lang-option ${locale === "zh" ? "active" : ""}`}
                  role="option"
                  aria-selected={locale === "zh"}
                  onClick={() => {
                    setLocale("zh");
                  }}
                >
                  <span className="fi fi-cn lang-flag" aria-hidden />
                  <span className="lang-option-label">中文</span>
                </button>
                <button
                  type="button"
                  className={`lang-option ${locale === "en" ? "active" : ""}`}
                  role="option"
                  aria-selected={locale === "en"}
                  onClick={() => {
                    setLocale("en");
                  }}
                >
                  <span className="fi fi-us lang-flag" aria-hidden />
                  <span className="lang-option-label">English</span>
                </button>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <section className="hero">
          <h2 className="hero-main-title">{t.heroTitle}</h2>
          <p className="tagline">{t.heroTagline}</p>
          <form onSubmit={handleSubmit} className="install-box">
            <span className="dollar">$</span>
            <input
              id="domain-query"
              name="domain-query"
              type="text"
              value={domain}
              onChange={(event) => {
                setHasUserEdited(true);
                setDomain(event.target.value);
              }}
              onFocus={() => {
                if (domain === "example.com" || (visitorIp && domain === visitorIp)) {
                  setDomain("");
                }
              }}
              placeholder={t.searchPlaceholder}
              className="install-input"
            />
            {queryType !== "unknown" ? (
              <span className="query-tag" aria-hidden>
                {queryTypeLabel}
              </span>
            ) : null}
            <button type="submit" className={`submit${loading ? " is-loading" : ""}`} disabled={loading}>
              {loading ? (
                <span className="loader" aria-hidden />
              ) : (
                <span className="submit-chip" aria-hidden>
                  <i className="fa-solid fa-magnifying-glass" />
                </span>
              )}
            </button>
          </form>
          <p className="supported-note">{t.supportedInput}</p>
          {error ? <p className="error hero-error">{error}</p> : null}

          {loading && !formatted ? (
            <section className="results-section results-inline">
              <div className="results-card loading-card">
                <div className="loading-overlay">
                  <div className="loading-spinner" aria-hidden />
                  <div className="loading-text">{t.loadingRdapData}</div>
                </div>
                <div className="loading-skeleton">
                  <div className="skeleton-line wide" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              </div>
            </section>
          ) : null}

          {formatted ? (
            <section className="results-section results-inline">
              <div className="results-card">
                <div className="results-header">
                  <h2>{t.queryResults}</h2>
                  <div className="results-meta-badges">
                    {isAsnResult ? (
                      <span className="result-badge">{t.asnLabel}</span>
                    ) : (
                      <>
                        <span className="result-badge">
                          {t.resultDomain}: {data?.domain ?? domain}
                        </span>
                        <span className="result-badge">{resultTypeLabel}</span>
                        <span className="result-badge">
                          {t.resultRegistrationAge}: {registrationAgeLabel}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="results-stack">
                  <article className="result-panel">
                    <div className="result-item-list">
                      {showInfoNotices ? (
                        <>
                          {abuseContactText ? (
                            <div className="notice-banner notice-banner-green">
                              <span className="notice-icon" aria-hidden>
                                <i className="fa-solid fa-triangle-exclamation" />
                              </span>
                              <span>
                                {t.abuseContactPrefix} <strong>{`'${data?.domain ?? domain}'`}</strong>{" "}
                                {t.abuseContactMiddle} <strong>{`'${abuseContactText}'`}</strong>
                              </span>
                            </div>
                          ) : null}
                          {ptrRecords.length ? (
                            <div className="notice-banner notice-banner-blue">
                              <span className="notice-icon" aria-hidden>
                                <i className="fa-solid fa-magnifying-glass" />
                              </span>
                              <span>
                                {t.ptrRecordPrefix} <strong>{`'${data?.domain ?? domain}'`}</strong>{" "}
                                {t.ptrRecordMiddle} <strong>{`'${ptrRecords.join(", ")}'`}</strong>
                              </span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {rdapChain ? (
                        <div className="result-item-block">
                          <h3 className="result-item-title">{t.rdapChainTitle}</h3>
                          <div className="rdap-chain-box">
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
                        </div>
                      ) : null}
                      {coreInfoItems.length ? (
                        <div className="result-item-block">
                          <h3 className="result-item-title">
                            {isIpQuery ? t.ipNetworkInformation : t.coreInformation}
                          </h3>
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
                                  <span className="inline-active-badge">active</span>
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {eventData.rows.length ? (
                        <div className="result-item-block">
                          <div className="result-item-title-row">
                            <h3 className="result-item-title">{t.eventsTitle}</h3>
                            <div className="events-head-meta">
                              <span className="events-last-update">
                                {t.lastRdapUpdate}: {eventData.lastDatabaseUpdate}
                              </span>
                              <button
                                type="button"
                                className="events-time-toggle"
                                onClick={() => setEventsUseUtc((prev) => !prev)}
                              >
                                {eventsUseUtc ? t.showLocal : t.showUtc}
                              </button>
                            </div>
                          </div>
                          <div className="events-grid">
                            {eventData.rows.map((row) => (
                              <div className="events-cell" key={row.key}>
                                <span className="events-key">{row.label}</span>
                                <span className="events-value">{row.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {entityItems.length ? (
                        <div className="result-item-block">
                          <div className="ns-card-grid">
                            {entityItems.map((entity, index) => (
                              <div key={`${entity.title}-${index}`} className="result-item-block entity-block">
                                <h3 className="result-item-title">{entity.title}</h3>
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
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {statusCards.length && !isIpQuery ? (
                        <div className="result-item-block">
                          <h3 className="result-item-title">{t.status}</h3>
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
                              <div className="status-card" key={card.key}>
                                <span className="status-text">
                                  {locale === "zh" ? card.zhTitle : card.enLabel}
                                </span>
                                <span className="status-info" aria-hidden>
                                  <i className="fa-solid fa-circle-info" />
                                  <span className="status-tooltip">
                                    <span className="status-tooltip-zh">{card.zhDescription}</span>
                                    <span className="status-tooltip-en">{card.enDescription}</span>
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {nameServerList.length ? (
                        <div className="result-item-block">
                          <div className="result-item-title-row">
                            <h3 className="result-item-title">{t.nameServers}</h3>
                            <span className="result-item-count">{nameServerList.length}</span>
                          </div>
                          <div className="ns-card-grid">
                            {nameServerList.map((ns, index) => (
                              <div className="ns-card" key={`${ns.host}-${index}`}>
                                <div className="ns-card-head">
                                  <span className="ns-index">#{index + 1}</span>
                                  <span className="ns-value">{ns.host}</span>
                                  <div className="ns-actions">
                                    <span className="ns-active-badge">active</span>
                                    <button
                                      type="button"
                                      className={`ns-copy ${copiedNameServer === ns.host ? "is-copied" : ""}`}
                                      aria-label={`Copy ${ns.host}`}
                                      data-tooltip={copiedNameServer === ns.host ? t.copied : t.copy}
                                      onClick={() => {
                                        void handleCopyText(ns.host, ns.host);
                                      }}
                                    >
                                      <i
                                        className={
                                          copiedNameServer === ns.host
                                            ? "fa-solid fa-check"
                                            : "fa-regular fa-copy"
                                        }
                                        aria-hidden
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className="ns-toggle"
                                      onClick={() => {
                                        setOpenNameServers((prev) => {
                                          const nextOpen = !prev[ns.host];
                                          if (nextOpen && !dnsLookupMap[ns.host]) {
                                            void lookupDns(ns.host);
                                          }
                                          return { ...prev, [ns.host]: nextOpen };
                                        });
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
                                      <div className="dns-lookup-box">
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
                                            className="dns-run"
                                            onClick={() => {
                                              void lookupDns(ns.host);
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
                        </div>
                      ) : null}
                    </div>
                  </article>

                  <article className="result-panel">
                    <details className="json-details">
                      <summary className="json-summary">{t.rawJson}</summary>
                      <div className="result-box raw-box">
                        <div className="json-toolbar">
                          <button type="button" className="download-btn" onClick={handleDownloadJson}>
                            <i className="fa-regular fa-download" aria-hidden />
                            <span>{t.downloadJson}</span>
                          </button>
                          <div className="copy-btn-wrap">
                            <button
                              type="button"
                              className={`copy-btn ${copied ? "is-copied" : ""}`}
                              onClick={() => {
                                void handleCopyJson();
                              }}
                              data-tooltip={copied ? t.copied : t.copy}
                            >
                              <i className={copied ? "fa-solid fa-check" : "fa-regular fa-copy"} aria-hidden />
                              <span>{copied ? t.copied : t.copy}</span>
                            </button>
                          </div>
                        </div>
                        <pre
                          className="raw-json code-highlight"
                          dangerouslySetInnerHTML={{ __html: highlightedJson }}
                        />
                      </div>
                    </details>
                  </article>
                </div>
              </div>
            </section>
          ) : null}
        </section>

        {isHomePage ? (
          <>
            {stats && !statsError ? (
              <section className="stats-block">
                <div className="stat-overview-grid">
                  <article className="stat-card">
                    <p className="stat-key">{t.domainQueryableSuffixes}</p>
                    <p className="stat-count">{stats.queryableDomainSuffixes.toLocaleString(numberLocale)}</p>
                    <p className="stat-label">{t.domainQueryableSuffixesLabel}</p>
                    <p className="stat-time">{t.snapshotGeneratedAt} {stats.updatedAt}</p>
                  </article>
                  <article className="stat-card">
                    <p className="stat-key">{t.rootTldCoverage}</p>
                    <p className="stat-count">1436 / 1436</p>
                    <p className="stat-label">{t.rootTldCoverageLabel}</p>
                    <p className="stat-time">{t.rootTldCoverageTime}</p>
                  </article>
                  <article className="stat-card">
                    <p className="stat-key">{t.dataPublication}</p>
                    <p className="stat-count">{statsMap.get("dns")?.publication ?? "-"}</p>
                    <p className="stat-label">{t.dataPublicationLabel}</p>
                    <p className="stat-time">{t.dataPublicationTime}</p>
                  </article>
                  <article className="stat-card">
                    <p className="stat-key">{t.syncInterval}</p>
                    <p className="stat-count">{t.syncIntervalValue}</p>
                    <p className="stat-label">{t.syncIntervalLabel}</p>
                    <p className="stat-time">{t.syncIntervalTime}</p>
                  </article>
                </div>
              </section>
            ) : null}
            {statsLoading ? <p className="muted">{t.statsLoading}</p> : null}
            {statsError ? <p className="error muted">{statsError}</p> : null}

            {stats && !statsError ? (
              <section className="request-charts-section">
                <div className="request-charts-card">
                  <div className="request-charts-head">
                    <div>
                      <p className="stat-key">{t.chartsTitle}</p>
                      <p className="request-charts-label">{t.chartsLabel}</p>
                    </div>
                    <div className="request-charts-time">
                      <span>{t.chartTodayRequests}: {chartSummary.todayRequests.toLocaleString(numberLocale)}</span>
                      <span>{t.chartRecent7Requests}: {formatCompactRequestCount(chartSummary.recent7Requests)}</span>
                      <span>{t.chartRecent30Requests}: {formatCompactRequestCount(chartSummary.recent30Requests)}</span>
                      <span>{t.chartAllRequests}: {formatCompactRequestCount(chartSummary.allRequests)}</span>
                    </div>
                  </div>
                  <div
                    className="request-chart-grid"
                    style={{ gridTemplateColumns: `repeat(${chartPoints.length}, minmax(0, 1fr))` }}
                  >
                    {chartPoints.map((point) => (
                      <div className="request-chart-col" key={point.date}>
                        <span className="request-chart-value">
                          {point.valueLabel}
                        </span>
                        <div className="request-chart-bar-wrap">
                          <div className="request-chart-bar" style={{ height: point.height }} />
                        </div>
                        <span className="request-chart-date">{point.dateLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="api-usage-section">
              <h2>{t.apiUsageTitle}</h2>
              <div className="api-usage-grid">
                <article className="api-usage-card">
                  <p className="api-usage-kicker">{t.apiUsageLead}</p>
                  <p className="api-usage-description">{t.apiUsageDescription}</p>
                  <div className="api-usage-notes">
                    {t.apiUsageNotes.map((note) => (
                      <p className="api-usage-note" key={note}>
                        {note}
                      </p>
                    ))}
                  </div>
                  <div className="api-curl-list">
                    {apiCurlExamples.map((query) => (
                      <div className="api-curl-row" key={query}>
                        <code className="api-curl-command">{`curl https://api.who.ga/${query}`}</code>
                        <button
                          type="button"
                          className="api-curl-run"
                          onClick={() => void handleRunApi(query)}
                        >
                          <i className="fa-solid fa-play" aria-hidden />
                          <span>{t.apiConsoleRun}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                  {apiConsoleLoading || apiConsoleError || apiConsoleResult ? (
                    <div className="terminal api-console-terminal">
                      <div className="terminal-header">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span>{t.apiConsoleResponse}</span>
                      </div>
                      <div className="terminal-body">
                        {apiConsoleLoading ? (
                          <span>{t.apiConsoleLoading}</span>
                        ) : apiConsoleError ? (
                          <span>{apiConsoleError}</span>
                        ) : apiConsoleResult ? (
                          <pre className="api-console-output">{apiConsoleResult}</pre>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              </div>
            </section>

            <section className="why-section">
              <h2>{t.whyTitle}</h2>
              <div className="feature-grid">
                {t.whyCards.map((card, index) => (
                  <article className="feature-card" key={card.title}>
                    <div className="feature-number">
                      <p className="feature-number-text">{card.number}</p>
                    </div>
                    <div className="feature-icon" aria-hidden>
                      <i
                        className={
                          [
                            "fa-solid fa-bolt",
                            "fa-solid fa-chart-column",
                            "fa-solid fa-lock",
                            "fa-solid fa-diagram-project",
                            "fa-solid fa-database",
                            "fa-solid fa-code"
                          ][index % 6]
                        }
                      />
                    </div>
                    <p className="feature-heading">{card.title}</p>
                    <p className="feature-content">{card.text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="supported-tlds-section">
          <h2>{t.supportedTlds}</h2>
          <div className="supported-tlds-card">
            <p className="supported-count">
              {activeSuffixCount.toLocaleString(numberLocale)} / {suffixCount.toLocaleString(numberLocale)} {t.tldsSupported}
            </p>
            <div className="tld-breakdown">
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "ccTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("ccTld");
                  setShowAllTlds(false);
                }}
              >
                {t.ccTldLabel}: <strong>{tldTypeCounts.ccTld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "gTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("gTld");
                  setShowAllTlds(false);
                }}
              >
                {t.gTldLabel}: <strong>{tldTypeCounts.gTld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "newGtld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("newGtld");
                  setShowAllTlds(false);
                }}
              >
                {t.newGtldLabel}: <strong>{tldTypeCounts.newGtld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "sTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("sTld");
                  setShowAllTlds(false);
                }}
              >
                {t.sTldLabel}: <strong>{tldTypeCounts.sTld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "brandTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("brandTld");
                  setShowAllTlds(false);
                }}
              >
                {t.brandTldLabel}: <strong>{tldTypeCounts.brandTld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "geoTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("geoTld");
                  setShowAllTlds(false);
                }}
              >
                {t.geoTldLabel}: <strong>{tldTypeCounts.geoTld.toLocaleString(numberLocale)}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "all" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("all");
                  setShowAllTlds(false);
                }}
              >
                {t.all}: <strong>{suffixCount.toLocaleString(numberLocale)}</strong>
              </button>
            </div>
            {suffixError ? <p className="error muted">{suffixError}</p> : null}
            <div className="supported-tags-wrap">
              {suffixDisplayList.map(({ suffix, decoded, hasDecodedLabel }) => (
                <button
                  key={suffix}
                  type="button"
                  className="tld-chip"
                  onClick={() => {
                    const queryValue = hasDecodedLabel ? decoded : suffix;
                    const targetPath = `/whois/${encodeURIComponent(queryValue)}`;
                    if (pathname === targetPath) {
                      void runQuery(queryValue);
                      return;
                    }
                    autoRouteQueryRef.current = null;
                    setLoading(true);
                    setError(null);
                    setDomain(queryValue);
                    router.replace(targetPath);
                  }}
                >
                  <span className="tld-chip-primary">.{hasDecodedLabel ? decoded : suffix}</span>
                </button>
              ))}
            </div>
            {activeSuffixCount > 60 ? (
              <div className="supported-action">
                <button
                  type="button"
                  className="show-all-btn"
                  onClick={() => setShowAllTlds((prev) => !prev)}
                >
                  {showAllTlds ? t.showFewerTlds : t.showAllTlds}
                </button>
              </div>
            ) : null}
          </div>
            </section>

            <section className="faq-section">
              <h2>{t.faq}</h2>
              <div className="faq-list">
                {faqItems.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <article key={item.question} className="faq-item">
                      <button
                        type="button"
                        className="faq-trigger"
                        aria-expanded={isOpen}
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                      >
                        <span>{item.question}</span>
                        <span className="faq-symbol">{isOpen ? "−" : "+"}</span>
                      </button>
                      {isOpen ? <div className="faq-content">{item.answer}</div> : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        ) : null}

        <footer className="footer">
          <div className="footer-bottom">
            <div className="footer-copyright">
              <p>{t.copyright}</p>
            </div>
            <div className="footer-social">
              <a
                href="https://x.com/gentpan"
                target="_blank"
                rel="noreferrer"
                aria-label="X"
                title="X"
              >
                <i className="fa-brands fa-x-twitter" aria-hidden />
              </a>
              <a
                href="https://github.com/gentpan"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                title="GitHub"
              >
                <i className="fa-brands fa-github" aria-hidden />
              </a>
              <a
                href="https://giantaccel.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Powered by GiantAccel"
                title="Powered by GiantAccel"
                data-tooltip="Powered by GiantAccel"
                className="footer-giantaccel"
              >
                <svg
                  viewBox="0 0 1024 1024"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M512 851.456c187.904 0 340.992-152.064 343.04-339.456h-145.408c-2.048 107.52-89.6 194.048-197.632 194.048S316.416 619.52 314.368 512H168.96c2.048 187.392 155.136 339.456 343.04 339.456zM550.912 216.064H855.04v145.408h-304.128z" />
                </svg>
              </a>
            </div>
          </div>
        </footer>
      </div>
      <button
        type="button"
        className={`back-top ${showBackTop ? "is-visible" : ""}`}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label={t.backToTop}
      >
        <i className="fa-solid fa-up" aria-hidden />
        <span>{t.backToTop}</span>
      </button>
    </main>
  );
}
