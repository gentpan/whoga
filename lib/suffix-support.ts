import { extractRootTld } from "@/lib/whois-fallback";
import {
  resolveRdapBaseUrlFromExtraWithTrace,
  resolveRdapBaseUrlFromMergedWithTrace
} from "@/lib/rdap-registry";

export const UNSUPPORTED_SUFFIX_ERROR_CODE = "UNSUPPORTED_SUFFIX";

export function normalizeSuffixLabel(input: string): string {
  return input.trim().toLowerCase().replace(/^\.+/, "");
}

export function isNotFoundStyleError(error: string | null | undefined): boolean {
  if (!error?.trim()) {
    return false;
  }
  const lower = error.trim().toLowerCase();
  return (
    lower === "not found" ||
    lower.includes("not found") ||
    lower.includes("no rdap server found") ||
    lower.includes("no registration registry endpoint is published")
  );
}

export async function isSuffixSupportedForQuery(query: string): Promise<boolean> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const merged = await resolveRdapBaseUrlFromMergedWithTrace(normalized);
  if (merged.rdapBaseUrl) {
    return true;
  }

  const extra = await resolveRdapBaseUrlFromExtraWithTrace(normalized);
  return Boolean(extra.rdapBaseUrl);
}

export function resolveUnsupportedSuffixContext(params: {
  query: string;
  queryType: "domain" | "suffix" | "ip" | "asn" | "unknown";
  error?: string | null;
  status?: number;
}): { suffix: string; query: string } | null {
  const { query, queryType, error, status } = params;
  if (queryType !== "domain" && queryType !== "suffix") {
    return null;
  }

  const suffix = normalizeSuffixLabel(
    queryType === "suffix" ? query : extractRootTld(query)
  );
  if (!suffix) {
    return null;
  }

  if (queryType === "suffix" && (isNotFoundStyleError(error) || status === 404)) {
    return { suffix, query: query.trim() };
  }

  if (isNotFoundStyleError(error)) {
    return { suffix, query: query.trim() };
  }

  return null;
}

export async function shouldTreatAsUnsupportedSuffix(params: {
  query: string;
  queryType: "domain" | "suffix" | "ip" | "asn" | "unknown";
  error?: string | null;
  status?: number;
}): Promise<{ suffix: string; query: string } | null> {
  const context = resolveUnsupportedSuffixContext(params);
  if (!context) {
    return null;
  }

  const supported = await isSuffixSupportedForQuery(context.suffix);
  if (supported) {
    return null;
  }

  return context;
}
