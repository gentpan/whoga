import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const TLDS_FILE = path.join(DATA_DIR, "tlds.json");
const MERGED_FILE = path.join(DATA_DIR, "whois-merged.json");
const OUTPUT_FILE = path.join(DATA_DIR, "rdap-domain-test-report.json");
const CONCURRENCY = Number(process.env.RDAP_TEST_CONCURRENCY ?? "20");
const TIMEOUT_MS = Number(process.env.RDAP_TEST_TIMEOUT_MS ?? "10000");

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function buildTestDomain(suffix) {
  return `example.${suffix}`;
}

function normalizeSuffix(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
  return cleaned || null;
}

function isLikelyRdapJson(body, contentType) {
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
    const parsed = JSON.parse(text);
    return Boolean(parsed && typeof parsed === "object");
  } catch {
    return false;
  }
}

async function probeSuffix(suffix, rdapBaseUrl) {
  const testDomain = buildTestDomain(suffix);
  const targetUrl = `${normalizeBaseUrl(rdapBaseUrl)}domain/${encodeURIComponent(testDomain)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/rdap+json, application/json" },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });

    const body = await response.text().catch(() => "");
    const contentType = response.headers.get("content-type") ?? "";
    const rdapJson = isLikelyRdapJson(body, contentType);

    const ok = rdapJson;
    return {
      suffix,
      rdapBaseUrl,
      testDomain,
      targetUrl,
      status: response.status,
      contentType,
      rdapJson,
      ok,
      reason: ok ? "ok" : "non-rdap-response"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      suffix,
      rdapBaseUrl,
      testDomain,
      targetUrl,
      status: 0,
      contentType: "",
      rdapJson: false,
      ok: false,
      reason: message.includes("aborted") ? "timeout" : message
    };
  } finally {
    clearTimeout(timer);
  }
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

async function main() {
  const [tldsRaw, mergedRaw] = await Promise.all([
    readFile(TLDS_FILE, "utf-8"),
    readFile(MERGED_FILE, "utf-8")
  ]);

  const tldsPayload = JSON.parse(tldsRaw);
  const mergedPayload = JSON.parse(mergedRaw);

  const queryableSuffixes = [...new Set((tldsPayload?.tlds?.queryable ?? []).map(normalizeSuffix).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const rdapMap = new Map();
  for (const item of mergedPayload?.items ?? []) {
    const suffix = normalizeSuffix(item?.suffix);
    const rdapUrl = typeof item?.rdapUrl === "string" ? item.rdapUrl.trim() : "";
    if (!suffix || !rdapUrl) {
      continue;
    }
    rdapMap.set(suffix, rdapUrl);
  }

  const tasks = queryableSuffixes
    .map((suffix) => ({ suffix, rdapBaseUrl: rdapMap.get(suffix) ?? "" }))
    .filter((item) => item.rdapBaseUrl);

  const results = await withConcurrency(tasks, CONCURRENCY, async (task) =>
    probeSuffix(task.suffix, task.rdapBaseUrl)
  );

  const failed = results.filter((item) => !item.ok);
  const passed = results.filter((item) => item.ok);

  const failedByRdap = {};
  for (const item of failed) {
    if (!failedByRdap[item.rdapBaseUrl]) {
      failedByRdap[item.rdapBaseUrl] = [];
    }
    failedByRdap[item.rdapBaseUrl].push(item.suffix);
  }

  for (const key of Object.keys(failedByRdap)) {
    failedByRdap[key].sort((a, b) => a.localeCompare(b));
  }

  const report = {
    checkedAt: new Date().toISOString(),
    source: {
      tlds: "data/tlds.json",
      merged: "data/whois-merged.json"
    },
    config: {
      concurrency: CONCURRENCY,
      timeoutMs: TIMEOUT_MS
    },
    summary: {
      totalTested: results.length,
      passed: passed.length,
      failed: failed.length,
      passRate: results.length ? Number(((passed.length / results.length) * 100).toFixed(2)) : 0
    },
    failedSuffixes: failed.map((item) => ({
      suffix: item.suffix,
      rdapBaseUrl: item.rdapBaseUrl,
      status: item.status,
      reason: item.reason
    })),
    failedByRdap,
    results
  };

  await writeFile(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(`checkedAt=${report.checkedAt}`);
  console.log(`tested=${report.summary.totalTested}`);
  console.log(`passed=${report.summary.passed}`);
  console.log(`failed=${report.summary.failed}`);
  console.log(`passRate=${report.summary.passRate}%`);
  console.log(`output=${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
