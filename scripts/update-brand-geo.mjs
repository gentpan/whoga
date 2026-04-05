import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const BRAND_TLDS_FILE = path.join(DATA_DIR, "brand-tlds.json");
const GEO_TLDS_FILE = path.join(DATA_DIR, "geo-tlds.json");

const GTLDS_SOURCE_URL = "https://www.icann.org/resources/registries/gtlds/v2/gtlds.json";
const GEO_TLDS_SOURCE_URL = process.env.GEO_TLDS_SOURCE_URL;

function normalizeTldLabel(label) {
  const cleaned = String(label ?? "").trim().replace(/^\./, "").toLowerCase();
  return cleaned || null;
}

function extractActiveGtlds(payload) {
  const set = new Set();
  for (const entry of payload.gTLDs ?? []) {
    const label = normalizeTldLabel(entry.gTLD ?? entry.uLabel ?? "");
    if (!label) {
      continue;
    }
    if (entry.contractTerminated || entry.removalDate) {
      continue;
    }
    set.add(label);
  }
  return set;
}

function extractBrandTlds(payload) {
  const list = [];
  for (const entry of payload.gTLDs ?? []) {
    if (!entry.specification13) {
      continue;
    }
    if (entry.contractTerminated || entry.removalDate) {
      continue;
    }
    const label = normalizeTldLabel(entry.gTLD ?? entry.uLabel ?? "");
    if (label) {
      list.push(label);
    }
  }
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

function stripHtml(input) {
  return String(input ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGeoTlds(html, activeGtlds) {
  const list = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cell = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!cell) {
      continue;
    }
    const text = stripHtml(cell[1] ?? "");
    const token = (text.split(/\s+/)[0] ?? "").trim();
    const normalized = normalizeTldLabel(token);
    if (!normalized || normalized === "tld") {
      continue;
    }
    if (activeGtlds.size > 0 && !activeGtlds.has(normalized)) {
      continue;
    }
    list.push(normalized);
  }
  return [...new Set(list)].sort((a, b) => a.localeCompare(b));
}

async function main() {
  const gtlds = await fetch(GTLDS_SOURCE_URL, { cache: "no-store" }).then((r) => r.json());
  const activeGtlds = extractActiveGtlds(gtlds);
  const brandTlds = extractBrandTlds(gtlds);
  let geoTlds = [];
  if (GEO_TLDS_SOURCE_URL) {
    try {
      const geoHtml = await fetch(GEO_TLDS_SOURCE_URL, { cache: "no-store" }).then((r) => r.text());
      geoTlds = extractGeoTlds(geoHtml, activeGtlds);
    } catch {
      geoTlds = [];
    }
  }

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    BRAND_TLDS_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: GTLDS_SOURCE_URL,
        counts: { brandTlds: brandTlds.length },
        tlds: brandTlds
      },
      null,
      2
    ),
    "utf-8"
  );

  if (GEO_TLDS_SOURCE_URL) {
    await writeFile(
      GEO_TLDS_FILE,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: GEO_TLDS_SOURCE_URL,
          filteredByGtldsJson: true,
          counts: { geoTlds: geoTlds.length },
          tlds: geoTlds
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  console.log(`brand: ${brandTlds.length}, geo: ${geoTlds.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
