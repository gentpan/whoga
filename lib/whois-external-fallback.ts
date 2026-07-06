export type ExternalWhoisResult = {
  provider: string;
  data: Record<string, unknown>;
  partial: boolean;
};

type ExternalProvider = {
  id: string;
  buildUrl: (domain: string) => string;
  parse: (payload: unknown) => ExternalWhoisResult | null;
};

const DEFAULT_TIMEOUT_MS = 15000;

function readExternalProviderUrls(): string[] {
  const raw = process.env.WHOIS_EXTERNAL_API_URLS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildTemplateProviders(): ExternalProvider[] {
  return readExternalProviderUrls().map((template, index) => ({
    id: `custom-${index + 1}`,
    buildUrl: (domain: string) => template.replaceAll("{domain}", encodeURIComponent(domain)),
    parse: (payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const record = payload as Record<string, unknown>;
      const data =
        record.data && typeof record.data === "object"
          ? (record.data as Record<string, unknown>)
          : record;
      if (Object.keys(data).length === 0) {
        return null;
      }
      return {
        provider: `custom-${index + 1}`,
        data,
        partial: record.partial === true
      };
    }
  }));
}

const BUILTIN_PROVIDERS: ExternalProvider[] = [
  {
    id: "whatismyip",
    buildUrl: (domain) =>
      `https://whatismyip.technology/api/whois?q=${encodeURIComponent(domain)}`,
    parse: (payload) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const record = payload as { data?: Record<string, unknown>; partial?: boolean };
      const data = record.data ?? {};
      if (Object.keys(data).length === 0) {
        return null;
      }
      return {
        provider: "whatismyip",
        data,
        partial: record.partial === true
      };
    }
  },
  {
    id: "who-dat",
    buildUrl: (domain) => `https://who-dat.as93.net/v1/whois/${encodeURIComponent(domain)}`,
    parse: (payload) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const record = payload as Record<string, unknown>;
      if (record.error) {
        return null;
      }
      return {
        provider: "who-dat",
        data: record,
        partial: record.isRegistered === false
      };
    }
  },
  {
    id: "airat-whois",
    buildUrl: (domain) =>
      `https://whois.api.airat.top/json?domain=${encodeURIComponent(domain)}`,
    parse: (payload) => {
      if (!payload || typeof payload !== "object") {
        return null;
      }
      const record = payload as Record<string, unknown>;
      if (record.error) {
        return null;
      }
      const rdap = record.rdap;
      if (rdap && typeof rdap === "object") {
        return {
          provider: "airat-whois",
          data: record,
          partial: false
        };
      }
      return null;
    }
  }
];

function allProviders(): ExternalProvider[] {
  const custom = buildTemplateProviders();
  return custom.length > 0 ? [...custom, ...BUILTIN_PROVIDERS] : BUILTIN_PROVIDERS;
}

async function fetchExternalProvider(
  provider: ExternalProvider,
  domain: string
): Promise<ExternalWhoisResult | null> {
  const timeoutMs = Number(process.env.WHOIS_EXTERNAL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(provider.buildUrl(domain), {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as unknown;
    return provider.parse(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function tryExternalWhoisApis(domain: string): Promise<ExternalWhoisResult | null> {
  for (const provider of allProviders()) {
    const result = await fetchExternalProvider(provider, domain);
    if (result) {
      return result;
    }
  }
  return null;
}

export async function tryIpinfoLookup(
  query: string,
  queryType: "ip" | "asn"
): Promise<Record<string, unknown> | null> {
  const token = process.env.IPINFO_TOKEN?.trim();
  if (!token) {
    return null;
  }

  const timeoutMs = Number(process.env.WHOIS_EXTERNAL_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url =
      queryType === "ip"
        ? `https://ipinfo.io/${encodeURIComponent(query)}?token=${encodeURIComponent(token)}`
        : `https://ipinfo.io/AS${encodeURIComponent(query.replace(/^as/i, ""))}?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
