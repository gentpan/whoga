import { connect } from "node:net";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const LOOKUP_FILE = path.join(DATA_DIR, "missing-tld-lookup.json");
const EXTRA_FILE = path.join(DATA_DIR, "whois-extra-hosts.json");
const REPORT_FILE = path.join(DATA_DIR, "whois-host-scan.json");
const IANA_HOST = "whois.iana.org";

const NIC_PATTERNS = [
  "whois1.nic.{tld}",
  "whois.nic.{tld}",
  "whois2.nic.{tld}",
  "whois3.nic.{tld}",
  "whois1.registry.{tld}",
  "whois.registry.{tld}",
  "whois1.{tld}",
  "whois.{tld}",
  "whois.nic.net.{tld}",
  "whois.dns.{tld}"
];

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const timeoutMs = Number(process.env.WHOIS_SCAN_TIMEOUT_MS ?? "5000");

function queryWhois(host, query) {
  return new Promise((resolve, reject) => {
    let data = "";
    const socket = connect({ host, port: 43 }, () => {
      socket.write(`${query}\r\n`);
    });
    socket.setTimeout(timeoutMs);
    socket.on("data", (chunk) => {
      data += chunk.toString("utf8");
    });
    socket.on("end", () => resolve(data.trim()));
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("timeout"));
    });
  });
}

function isIanaRootDb(raw, tld) {
  const lower = raw.toLowerCase();
  if (!lower.includes("iana whois server") || lower.includes("domain name:")) {
    return false;
  }
  return new RegExp(`^domain:\\s*${tld}$`, "im").test(raw);
}

function isNoridBoilerplate(raw) {
  const lower = raw.toLowerCase();
  return lower.includes("norid as holds the copyright") && !lower.includes("domain name:");
}

function isUsefulWhois(raw, tld) {
  if (!raw.trim() || isIanaRootDb(raw, tld) || isNoridBoilerplate(raw)) {
    return false;
  }
  const lower = raw.toLowerCase();
  if (lower.includes("domain name:") || lower.includes("registry domain id:")) {
    return true;
  }
  if (
    lower.includes("no match") ||
    lower.includes("not found") ||
    lower.includes("no object found") ||
    lower.includes("no entries found") ||
    lower.includes("%error:101")
  ) {
    return true;
  }
  if (lower.includes("tld is not supported") || lower.includes("tld not supported")) {
    return false;
  }
  return false;
}

function hostsFromUrl(url) {
  const hosts = [];
  try {
    const parsed = new URL(url);
    let host = parsed.hostname.toLowerCase();
    if (!host) {
      return hosts;
    }
    if (host.startsWith("www.")) {
      hosts.push(host.slice(4));
    }
    hosts.push(host, `whois.${host}`, `whois1.${host}`);
    const match = url.match(/whois[\w.-]+/i);
    if (match?.[0]?.includes(".")) {
      hosts.push(match[0].toLowerCase());
    }
  } catch {
    return hosts;
  }
  return [...new Set(hosts.filter(Boolean))];
}

async function ianaRemarks(tld) {
  try {
    const raw = await queryWhois(IANA_HOST, tld);
    const urls = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line.toLowerCase().startsWith("remarks:")) {
        const part = line.split(":", 2)[1] ?? "";
        for (const url of part.match(/https?:\/\/[^\s)]+/g) ?? []) {
          urls.push(url.replace(/[.,;]+$/, ""));
        }
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function buildCandidates(tld, remarkUrls, knownHosts = []) {
  const candidates = [...knownHosts];
  for (const pattern of NIC_PATTERNS) {
    candidates.push(pattern.replace("{tld}", tld));
  }
  for (const url of remarkUrls) {
    candidates.push(...hostsFromUrl(url));
  }
  return [...new Set(candidates.filter(Boolean))];
}

async function scanTld(tld, knownHost) {
  const query = `example.${tld}`;
  const remarkUrls = await ianaRemarks(tld);
  const candidates = buildCandidates(tld, remarkUrls, knownHost ? [knownHost] : []);

  for (const host of candidates) {
    try {
      const raw = await queryWhois(host, query);
      if (isUsefulWhois(raw, tld)) {
        return { tld, host, remarkUrls, status: "port43" };
      }
    } catch {
      // try next host
    }
  }

  if (remarkUrls.length > 0) {
    return { tld, host: null, remarkUrls, status: "web-only" };
  }
  return { tld, host: null, remarkUrls: [], status: "none" };
}

async function main() {
  const lookup = JSON.parse(await readFile(LOOKUP_FILE, "utf-8"));
  const extra = JSON.parse(await readFile(EXTRA_FILE, "utf-8"));

  const targets = lookup.results.filter((entry) => !entry.whois?.trim()).map((entry) => entry.tld);
  console.log(`Scanning ${targets.length} TLDs without WHOIS in missing-tld-lookup.json ...`);

  const discovered = [];
  const webOnly = [];
  const none = [];

  for (let i = 0; i < targets.length; i += 1) {
    const tld = targets[i];
    const known = extra.port43?.[tld] ?? null;
    const result = await scanTld(tld, known);
    if (result.status === "port43") {
      discovered.push(result);
      console.log(`  [port43] .${tld} -> ${result.host}`);
    } else if (result.status === "web-only") {
      webOnly.push(result);
    } else {
      none.push(result);
    }
    if ((i + 1) % 10 === 0) {
      console.log(`  progress ${i + 1}/${targets.length}`);
    }
  }

  const report = {
    scannedAt: new Date().toISOString(),
    summary: {
      scanned: targets.length,
      discoveredPort43: discovered.length,
      webOnly: webOnly.length,
      none: none.length
    },
    discovered,
    webOnly,
    none: none.map((item) => item.tld)
  };

  await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.log(`Report written to ${REPORT_FILE}`);

  if (!shouldWrite) {
    console.log("Dry run. Pass --write to update missing-tld-lookup.json and whois-extra-hosts.json");
    return;
  }

  if (discovered.length > 0) {
    for (const item of discovered) {
      const entry = lookup.results.find((row) => row.tld === item.tld);
      if (entry) {
        entry.whois = item.host;
      }
    }
    lookup.withWhois = lookup.results.filter((row) => row.whois?.trim()).length;
    lookup.none = lookup.results.filter((row) => !row.whois?.trim()).length;
    lookup.checkedAt = new Date().toISOString();
    await writeFile(LOOKUP_FILE, `${JSON.stringify(lookup, null, 2)}\n`, "utf-8");
    console.log(`Updated ${discovered.length} entries in missing-tld-lookup.json`);
  }

  extra.generatedAt = new Date().toISOString();
  extra.port43 = extra.port43 ?? {};
  extra.webRegistry = extra.webRegistry ?? {};
  for (const item of discovered) {
    extra.port43[item.tld] = item.host;
  }
  for (const item of webOnly) {
    if (!extra.webRegistry[item.tld] && item.remarkUrls[0]) {
      extra.webRegistry[item.tld] = item.remarkUrls[0];
    }
  }
  await writeFile(EXTRA_FILE, `${JSON.stringify(extra, null, 2)}\n`, "utf-8");
  console.log("Updated whois-extra-hosts.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
