import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const DATA_DIR = path.join(process.cwd(), "data");
const TLDS_FILE = path.join(DATA_DIR, "tlds.json");
const MERGED_FILE = path.join(DATA_DIR, "whois-merged.json");
const OUTPUT_FILE = path.join(DATA_DIR, "data-availability-report.json");

const CONCURRENCY = Number(process.env.DATA_TEST_CONCURRENCY ?? "8");
const TIMEOUT_MS = Number(process.env.DATA_TEST_TIMEOUT_MS ?? "12000");
const APP_PORT = Number(process.env.DATA_TEST_APP_PORT ?? "4016");
const APP_HOST = "127.0.0.1";

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function normalizeSuffix(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
  return cleaned || null;
}

function buildExampleDomain(suffix) {
  return `example.${suffix}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLikelyJson(body, contentType) {
  if (!body || typeof body !== "string") {
    return false;
  }
  if ((contentType ?? "").toLowerCase().includes("json")) {
    return true;
  }
  const text = body.trim();
  if (!text.startsWith("{")) {
    return false;
  }
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function countUsefulSignals(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return 0;
  }
  let score = 0;
  const record = result;
  if (typeof record.objectClassName === "string" && record.objectClassName) score += 1;
  if (typeof record.ldhName === "string" && record.ldhName) score += 1;
  if (typeof record.handle === "string" && record.handle) score += 1;
  if (typeof record.name === "string" && record.name) score += 1;
  if (Array.isArray(record.status) && record.status.length) score += 1;
  if (Array.isArray(record.events) && record.events.length) score += 1;
  if (Array.isArray(record.entities) && record.entities.length) score += 1;
  if (Array.isArray(record.nameservers) && record.nameservers.length) score += 1;
  if (Array.isArray(record.notices) && record.notices.length) score += 1;
  if (Array.isArray(record.links) && record.links.length) score += 1;
  return score;
}

function classifyApiPayload(payload) {
  const result = payload?.result && typeof payload.result === "object" ? payload.result : null;
  const statusList = Array.isArray(result?.status) ? result.status.map((item) => String(item).toLowerCase()) : [];
  const usefulSignalCount = countUsefulSignals(result);
  const available = statusList.includes("available");
  const hasStructured404 =
    payload?.status === 404 ||
    result?.errorCode === 404 ||
    String(payload?.error ?? "").toLowerCase() === "not found";

  return {
    useful: available || usefulSignalCount >= 3,
    available,
    usefulSignalCount,
    hasStructured404,
    hasResult: Boolean(result),
    resultSource: payload?.resultSource ?? null,
    resolver: payload?.match?.resolver ?? null,
    error: typeof payload?.error === "string" ? payload.error : null
  };
}

async function fetchText(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
    const body = await response.text().catch(() => "");
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      contentType: "",
      body: "",
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timer);
  }
}

async function probeRawRdap(suffix, rdapBaseUrl) {
  if (!rdapBaseUrl) {
    return {
      method: "raw-rdap",
      ok: false,
      status: 0,
      reason: "missing-rdap-url",
      useful: false
    };
  }
  const targetUrl = `${normalizeBaseUrl(rdapBaseUrl)}domain/${encodeURIComponent(buildExampleDomain(suffix))}`;
  const response = await fetchText(targetUrl, {
    method: "GET",
    headers: { Accept: "application/rdap+json, application/json" },
    redirect: "follow"
  });
  const rdapJson = isLikelyJson(response.body, response.contentType);
  return {
    method: "raw-rdap",
    targetUrl,
    ok: rdapJson,
    status: response.status,
    reason: response.error ?? (rdapJson ? "ok" : "non-rdap-response"),
    useful: rdapJson
  };
}

async function probeApi(baseUrl, query) {
  const url = `${baseUrl}/api/whois?domain=${encodeURIComponent(query)}`;
  const response = await fetchText(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    redirect: "follow"
  });
  let payload = null;
  try {
    payload = response.body ? JSON.parse(response.body) : null;
  } catch {
    payload = null;
  }
  const classified = classifyApiPayload(payload);
  return {
    query,
    url,
    ok: response.ok,
    status: response.status,
    reason: response.error ?? classified.error ?? (classified.useful ? "useful-data" : "no-useful-data"),
    ...classified
  };
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function waitForApp(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60000) {
    const response = await fetchText(`${baseUrl}/api/meta`);
    if (response.status > 0) {
      return;
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for local app server");
}

async function startLocalApp() {
  const child = spawn("pnpm", ["nitro", "preview", "--host", APP_HOST, "--port", String(APP_PORT)], {
    cwd: process.cwd(),
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOSTNAME: APP_HOST
    }
  });

  const stop = async () => {
    if (child.killed) {
      return;
    }
    child.kill("SIGINT");
    await sleep(500);
    if (!child.killed) {
      child.kill("SIGKILL");
    }
  };

  return { child, stop };
}

async function main() {
  const [tldsRaw, mergedRaw] = await Promise.all([
    readFile(TLDS_FILE, "utf-8"),
    readFile(MERGED_FILE, "utf-8")
  ]);

  const tldsPayload = JSON.parse(tldsRaw);
  const mergedPayload = JSON.parse(mergedRaw);

  const rdapMap = new Map();
  for (const item of mergedPayload?.items ?? []) {
    const suffix = normalizeSuffix(item?.suffix);
    const rdapUrl = typeof item?.rdapUrl === "string" ? item.rdapUrl.trim() : "";
    if (!suffix || !rdapUrl) {
      continue;
    }
    rdapMap.set(suffix, rdapUrl);
  }

  const allSuffixes = [...new Set((tldsPayload?.tlds?.queryable ?? []).map(normalizeSuffix).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

  const baseUrl = `http://${APP_HOST}:${APP_PORT}`;
  const app = await startLocalApp();
  try {
    await waitForApp(baseUrl);

    const results = await withConcurrency(allSuffixes, CONCURRENCY, async (suffix) => {
      const rdapBaseUrl = rdapMap.get(suffix) ?? "";
      const [rawRdap, apiDomain, apiSuffix] = await Promise.all([
        probeRawRdap(suffix, rdapBaseUrl),
        probeApi(baseUrl, buildExampleDomain(suffix)),
        probeApi(baseUrl, `.${suffix}`)
      ]);

      return {
        suffix,
        rdapBaseUrl,
        rawRdap,
        apiDomain,
        apiSuffix,
        final: {
          obtainableViaDomain: apiDomain.useful,
          obtainableViaSuffix: apiSuffix.useful,
          obtainableEither: apiDomain.useful || apiSuffix.useful,
          directRdapHealthy: rawRdap.ok,
          fallbackUsed:
            apiDomain.resolver === "ttnic-html" ||
            apiDomain.resolver === "extra-json" ||
            apiSuffix.resolver === "extra-json" ||
            apiSuffix.resolver === "ttnic-html"
        }
      };
    });

    const obtainableEither = results.filter((item) => item.final.obtainableEither).length;
    const obtainableViaDomain = results.filter((item) => item.final.obtainableViaDomain).length;
    const obtainableViaSuffix = results.filter((item) => item.final.obtainableViaSuffix).length;
    const directRdapHealthy = results.filter((item) => item.final.directRdapHealthy).length;
    const unobtainable = results.filter((item) => !item.final.obtainableEither);

    const byApiReason = {};
    const byRawReason = {};
    for (const item of unobtainable) {
      const domainReason = item.apiDomain.reason ?? "unknown";
      byApiReason[domainReason] = (byApiReason[domainReason] ?? 0) + 1;
      const rawReason = item.rawRdap.reason ?? "unknown";
      byRawReason[rawReason] = (byRawReason[rawReason] ?? 0) + 1;
    }

    const report = {
      checkedAt: new Date().toISOString(),
      source: {
        tlds: "data/tlds.json",
        merged: "data/whois-merged.json"
      },
      config: {
        concurrency: CONCURRENCY,
        timeoutMs: TIMEOUT_MS,
        appPort: APP_PORT
      },
      summary: {
        totalTested: results.length,
        directRdapHealthy,
        obtainableViaDomain,
        obtainableViaSuffix,
        obtainableEither,
        unobtainable: unobtainable.length,
        obtainableRate: results.length ? Number(((obtainableEither / results.length) * 100).toFixed(2)) : 0
      },
      unobtainableByApiReason: Object.entries(byApiReason).sort((a, b) => b[1] - a[1]),
      unobtainableByRawReason: Object.entries(byRawReason).sort((a, b) => b[1] - a[1]),
      unobtainableSuffixes: unobtainable.map((item) => ({
        suffix: item.suffix,
        rdapBaseUrl: item.rdapBaseUrl,
        rawReason: item.rawRdap.reason,
        rawStatus: item.rawRdap.status,
        apiDomainReason: item.apiDomain.reason,
        apiDomainStatus: item.apiDomain.status,
        apiSuffixReason: item.apiSuffix.reason,
        apiSuffixStatus: item.apiSuffix.status
      })),
      results
    };

    await writeFile(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
    console.log(`checkedAt=${report.checkedAt}`);
    console.log(`tested=${report.summary.totalTested}`);
    console.log(`directRdapHealthy=${report.summary.directRdapHealthy}`);
    console.log(`obtainableViaDomain=${report.summary.obtainableViaDomain}`);
    console.log(`obtainableViaSuffix=${report.summary.obtainableViaSuffix}`);
    console.log(`obtainableEither=${report.summary.obtainableEither}`);
    console.log(`unobtainable=${report.summary.unobtainable}`);
    console.log(`obtainableRate=${report.summary.obtainableRate}%`);
    console.log(`output=${path.relative(process.cwd(), OUTPUT_FILE)}`);
  } finally {
    await app.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
