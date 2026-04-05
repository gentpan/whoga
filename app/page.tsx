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
}

interface SuffixesResponse {
  count: number;
  suffixes: string[];
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
    nameServers: "Name Servers",
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

  const [suffixes, setSuffixes] = useState<string[]>([]);
  const [suffixCount, setSuffixCount] = useState(0);
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
            <span className="brand-logo-text" aria-hidden>
              WHO.GA
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
                  <div className="loading-text">Loading RDAP data...</div>
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
                                {locale === "zh" ? "滥用举报联系方式" : "Abuse contact for"}{" "}
                                <strong>{`'${data?.domain ?? domain}'`}</strong>{" "}
                                {locale === "zh" ? "为" : "is"} <strong>{`'${abuseContactText}'`}</strong>
                              </span>
                            </div>
                          ) : null}
                          {ptrRecords.length ? (
                            <div className="notice-banner notice-banner-blue">
                              <span className="notice-icon" aria-hidden>
                                <i className="fa-solid fa-magnifying-glass" />
                              </span>
                              <span>
                                PTR {locale === "zh" ? "记录" : "record"}{" "}
                                <strong>{`'${data?.domain ?? domain}'`}</strong>{" "}
                                {locale === "zh" ? "为" : "is"}{" "}
                                <strong>{`'${ptrRecords.join(", ")}'`}</strong>
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
                            {isIpQuery ? (locale === "zh" ? "IP 网络信息" : "IP Network Information") : locale === "zh" ? "核心信息" : "Core Information"}
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
                                <span className="kv-key">{locale === "zh" ? "状态" : "Status"}:</span>
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
                                    <span className="kv-key">{locale === "zh" ? "名称" : "Name"}:</span>
                                    <span className="kv-value">{entity.name}</span>
                                  </div>
                                ) : null}
                                {entity.org ? (
                                  <div className="kv-row">
                                    <span className="kv-key">{locale === "zh" ? "组织" : "Organization"}:</span>
                                    <span className="kv-value">{entity.org}</span>
                                  </div>
                                ) : null}
                                {entity.email ? (
                                  <div className="kv-row">
                                    <span className="kv-key">Email:</span>
                                    <span className="kv-value">{entity.email}</span>
                                  </div>
                                ) : null}
                                {entity.phone ? (
                                  <div className="kv-row">
                                    <span className="kv-key">{locale === "zh" ? "电话" : "Phone"}:</span>
                                    <span className="kv-value">{entity.phone}</span>
                                  </div>
                                ) : null}
                                {entity.address ? (
                                  <div className="kv-row">
                                    <span className="kv-key">{locale === "zh" ? "地址" : "Address"}:</span>
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
                          <h3 className="result-item-title">Status</h3>
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
                                      {openNameServers[ns.host] ? "Hide" : "Details"}
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
                                      <span className="ns-label">DNS Lookup</span>
                                      <div className="dns-lookup-box">
                                        {dnsLookupMap[ns.host]?.loading ? (
                                          <span className="dns-loading">Loading...</span>
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
                                            Run DNS Lookup
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

        {stats && !statsError ? (
          <section className="stats-block">
            <div className="stat-overview-grid">
              <article className="stat-card">
                <p className="stat-key">DOMAIN QUERYABLE SUFFIXES</p>
                <p className="stat-count">{stats.queryableDomainSuffixes.toLocaleString("zh-CN")}</p>
                <p className="stat-label">Suffixes currently queryable via RDAP endpoints.</p>
                <p className="stat-time">Snapshot generated at: {stats.updatedAt}</p>
              </article>
              <article className="stat-card">
                <p className="stat-key">ROOT TLD COVERAGE</p>
                <p className="stat-count">1436 / 1436</p>
                <p className="stat-label">Queryable coverage across the IANA root TLD namespace.</p>
                <p className="stat-time">Computed from current merged routing data.</p>
              </article>
              <article className="stat-card">
                <p className="stat-key">DATA PUBLICATION</p>
                <p className="stat-count">{statsMap.get("dns")?.publication ?? "-"}</p>
                <p className="stat-label">Publication timestamp of upstream `dns.json`.</p>
                <p className="stat-time">Source: data.iana.org</p>
              </article>
              <article className="stat-card">
                <p className="stat-key">SYNC INTERVAL</p>
                <p className="stat-count">7 Days</p>
                <p className="stat-label">Scheduled sync and merged data rebuild interval.</p>
                <p className="stat-time">Cron + on-demand refresh</p>
              </article>
            </div>
          </section>
        ) : null}
        {statsLoading ? <p className="muted">{t.statsLoading}</p> : null}
        {statsError ? <p className="error muted">{statsError}</p> : null}

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
              {activeSuffixCount.toLocaleString("zh-CN")} / {suffixCount.toLocaleString("zh-CN")} {t.tldsSupported}
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
                ccTLD: <strong>{tldTypeCounts.ccTld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "gTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("gTld");
                  setShowAllTlds(false);
                }}
              >
                gTLD: <strong>{tldTypeCounts.gTld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "newGtld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("newGtld");
                  setShowAllTlds(false);
                }}
              >
                new gTLD: <strong>{tldTypeCounts.newGtld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "sTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("sTld");
                  setShowAllTlds(false);
                }}
              >
                sTLD: <strong>{tldTypeCounts.sTld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "brandTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("brandTld");
                  setShowAllTlds(false);
                }}
              >
                brand TLD: <strong>{tldTypeCounts.brandTld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "geoTld" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("geoTld");
                  setShowAllTlds(false);
                }}
              >
                geo TLD: <strong>{tldTypeCounts.geoTld.toLocaleString("zh-CN")}</strong>
              </button>
              <button
                type="button"
                className={`tld-breakdown-item ${selectedTldCategory === "all" ? "active" : ""}`}
                onClick={() => {
                  setSelectedTldCategory("all");
                  setShowAllTlds(false);
                }}
              >
                {t.all}: <strong>{suffixCount.toLocaleString("zh-CN")}</strong>
              </button>
            </div>
            {suffixError ? <p className="error muted">{suffixError}</p> : null}
            <div className="supported-tags-wrap">
              {visibleSuffixes.map((suffix) => (
                <button
                  key={suffix}
                  type="button"
                  className="tld-chip"
                  onClick={() => {
                    const targetPath = `/whois/${encodeURIComponent(suffix)}`;
                    if (pathname === targetPath) {
                      void runQuery(suffix);
                      return;
                    }
                    autoRouteQueryRef.current = null;
                    setLoading(true);
                    setError(null);
                    setDomain(suffix);
                    router.replace(targetPath);
                  }}
                >
                  .{suffix}
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

        <footer className="footer">
          <div className="footer-bottom">
            <div className="footer-copyright">
              <p>
                <span className="footer-company">A GiantAccel Company</span>
                <span>{t.copyright}</span>
              </p>
            </div>
            <div className="footer-social">
              <a href="#" aria-label="X" title="X">
                <i className="fa-brands fa-x-twitter" aria-hidden />
              </a>
              <a href="#" aria-label="GitHub" title="GitHub">
                <i className="fa-brands fa-github" aria-hidden />
              </a>
              <a href="#" aria-label="Telegram" title="Telegram">
                <i className="fa-brands fa-telegram" aria-hidden />
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
        aria-label="Back to top"
      >
        <i className="fa-solid fa-up" aria-hidden />
        <span>Back to Top</span>
      </button>
    </main>
  );
}
