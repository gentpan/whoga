import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { I18N } from "@/web/lib/i18n";
import { useSiteLocale } from "@/web/lib/use-site-locale";
import {
  errorToMessage,
  resolveUnsupportedSuffixFromPayload,
  type ApiResponse
} from "@/web/lib/rdap-format";

export type SupportFeedback = "idle" | "submitting" | "created" | "already" | "failed";

export function useLookup() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const [domain, setDomain] = useState("example.com");
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [visitorIp, setVisitorIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupportedSuffix, setUnsupportedSuffix] = useState<{ suffix: string; query: string } | null>(
    null
  );
  const [supportFeedback, setSupportFeedback] = useState<SupportFeedback>("idle");
  const [data, setData] = useState<ApiResponse | null>(null);
  const autoRouteQueryRef = useRef<string | null>(null);
  const [locale] = useSiteLocale();
  const t = I18N[locale];

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

  const runQuery = useCallback(async (value: string): Promise<void> => {
    const input = value.trim();
    if (!input) {
      return;
    }

    setLoading(true);
    setError(null);
    setUnsupportedSuffix(null);
    setSupportFeedback("idle");

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

          let parsedPayload: ApiResponse | null = null;
          if (!looksLikeHtml && expectsJson) {
            try {
              parsedPayload = JSON.parse(raw) as ApiResponse;
            } catch {
              parsedPayload = null;
            }
          }

          if (parsedPayload) {
            const retryableServerError = response.status >= 500;
            if (!retryableServerError || attempt >= 2) {
              return { response, payload: parsedPayload };
            }
          }

          if (attempt < 2) {
            await new Promise((resolve) => {
              setTimeout(resolve, response.status >= 500 ? 320 : 180);
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
        const unsupported = resolveUnsupportedSuffixFromPayload(payload, input);
        if (unsupported) {
          setUnsupportedSuffix(unsupported);
          setError(null);
          setData(null);
          setDomain(input);
          return;
        }

        const serverError = typeof payload.error === "string" ? payload.error : null;
        if (response.status === 404) {
          throw new Error(t.domainNotFound);
        }
        if (response.status >= 500) {
          throw new Error(serverError ?? t.apiUnavailable);
        }
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
      setUnsupportedSuffix(null);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleRequestSupport = useCallback(async (): Promise<void> => {
    if (!unsupportedSuffix) {
      return;
    }

    setSupportFeedback("submitting");
    try {
      const response = await fetch("/api/suffix-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ query: unsupportedSuffix.query })
      });
      const payload = (await response.json()) as {
        created?: boolean;
        reason?: string;
        error?: string;
        errorCode?: string;
      };

      if (response.status === 409 && payload.errorCode === "ALREADY_SUPPORTED") {
        setUnsupportedSuffix(null);
        setSupportFeedback("idle");
        setError(t.requestSupportAlreadySupported);
        return;
      }

      if (!response.ok && response.status !== 200) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }

      if (payload.created === false && payload.reason === "already_requested") {
        setSupportFeedback("already");
        return;
      }

      setSupportFeedback("created");
    } catch {
      setSupportFeedback("failed");
    }
  }, [unsupportedSuffix, t]);

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

  function handleDomainChange(value: string): void {
    setHasUserEdited(true);
    setDomain(value);
  }

  function handleDomainFocus(): void {
    if (domain === "example.com" || (visitorIp && domain === visitorIp)) {
      setDomain("");
    }
  }

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
    setUnsupportedSuffix(null);
    setSupportFeedback("idle");
    setLoading(true);
    void navigate({ to: targetPath });
  }

  function navigateToQuery(queryValue: string): void {
    const targetPath = `/whois/${encodeURIComponent(queryValue)}`;
    if (pathname === targetPath) {
      void runQuery(queryValue);
      return;
    }
    autoRouteQueryRef.current = null;
    setLoading(true);
    setError(null);
    setDomain(queryValue);
    void navigate({ to: targetPath });
  }

  return {
    pathname,
    domain,
    loading,
    error,
    unsupportedSuffix,
    supportFeedback,
    data,
    handleDomainChange,
    handleDomainFocus,
    handleSubmit,
    handleRequestSupport,
    navigateToQuery
  };
}
