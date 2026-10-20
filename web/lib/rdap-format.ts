import type { Locale } from "@/web/lib/i18n";

export interface ApiResponse {
  error?: string;
  errorCode?: string;
  suffix?: string;
  query?: string;
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

export interface EventRow {
  key: "registration" | "expiration" | "lastChanged";
  label: string;
  value: string;
  rawDate: string;
}

export interface EventData {
  rows: EventRow[];
  lastDatabaseUpdate: string;
}

export interface InfoItem {
  label: string;
  value: string;
}

export interface EntityItem {
  title: string;
  roles: string[];
  name?: string;
  org?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface StatusCard {
  key: string;
  zhTitle: string;
  enLabel: string;
  zhDescription: string;
  enDescription: string;
}

export interface NameServerItem {
  host: string;
  ipv4: string[];
  ipv6: string[];
}

export interface DnsLookupView {
  groups: Record<string, string[]>;
  raw: unknown;
}

export function detectQueryType(input: string): "domain" | "ipv4" | "ipv6" | "asn" | "unknown" {
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

export function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

export function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim() ? input : undefined;
}

export function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((value) => String(value)).filter(Boolean);
}

export function getTldFromQuery(input: string): string | null {
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

export function resolveUnsupportedSuffixFromPayload(
  payload: ApiResponse,
  input: string
): { suffix: string; query: string } | null {
  if (payload.errorCode === "UNSUPPORTED_SUFFIX" && typeof payload.suffix === "string") {
    return {
      suffix: payload.suffix,
      query: typeof payload.query === "string" ? payload.query : input
    };
  }

  return null;
}

export function joinRdapDomainUrl(base: string, domain: string): string {
  const trimmed = base.trim();
  if (!trimmed) {
    return domain;
  }
  const withSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return `${withSlash}domain/${domain}`;
}

export function formatStatusKey(raw: string): string {
  return raw.toLowerCase().replace(/[\s_-]+/g, "");
}

export function buildStatusCards(data: ApiResponse, locale: Locale): StatusCard[] {
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

export function formatEventTime(value: string, useUtc: boolean, locale: Locale): string {
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

export function buildEventData(data: ApiResponse, locale: Locale, useUtc: boolean): EventData {
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
      value: formatEventTime(eventMap.get("registration") ?? "-", useUtc, locale),
      rawDate: eventMap.get("registration") ?? ""
    },
    {
      key: "expiration",
      label: labels.expiration,
      value: formatEventTime(eventMap.get("expiration") ?? "-", useUtc, locale),
      rawDate: eventMap.get("expiration") ?? ""
    },
    {
      key: "lastChanged",
      label: labels.lastChanged,
      value: formatEventTime(
        eventMap.get("last changed") ?? eventMap.get("last update of rdap database") ?? "-",
        useUtc,
        locale
      ),
      rawDate: eventMap.get("last changed") ?? eventMap.get("last update of rdap database") ?? ""
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

export interface RelativeTimeLabel {
  label: string;
  future: boolean;
}

export function formatRelativeTime(dateStr: string, locale: Locale): RelativeTimeLabel | null {
  if (!dateStr) {
    return null;
  }
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const now = Date.now();
  const time = parsed.getTime();
  const future = time > now;
  const days = Math.round(Math.abs(time - now) / 86400000);
  const zh = locale === "zh";
  if (days === 0) {
    return { label: zh ? "今天" : "today", future };
  }
  if (days === 1) {
    return { label: future ? (zh ? "明天" : "tomorrow") : zh ? "昨天" : "yesterday", future };
  }
  let core: string;
  if (days < 31) {
    core = zh ? `${days} 天` : `${days} days`;
  } else if (days < 700) {
    const months = Math.round(days / 30.44);
    core = zh ? `${months} 个月` : months === 1 ? "1 month" : `${months} months`;
  } else {
    const years = Math.round(days / 365.25);
    core = zh ? `${years} 年` : years === 1 ? "1 year" : `${years} years`;
  }
  return {
    label: future ? (zh ? `还有 ${core}` : `in ${core}`) : zh ? `${core}前` : `${core} ago`,
    future
  };
}

export function buildCoreInfoItems(data: ApiResponse, locale: Locale): InfoItem[] {
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

export function extractVcardField(entity: Record<string, unknown>, field: string): string | undefined {
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

export function extractVcardAddress(entity: Record<string, unknown>): string | undefined {
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

export function getEntityTitle(roles: string[], locale: Locale, index: number): string {
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

export function buildEntities(data: ApiResponse, locale: Locale): EntityItem[] {
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

export function getAbuseContactText(data: ApiResponse | null): string | null {
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

export function getRegistrationAgeLabel(data: ApiResponse | null, locale: Locale): string {
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

export function eventsToRecords(input: unknown[]): Record<string, unknown>[] {
  return input
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function highlightJson(input: string): string {
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

export function errorToMessage(error: unknown, fallback = "Unknown error"): string {
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

export function normalizeDnsLookupResult(raw: unknown): DnsLookupView {
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
