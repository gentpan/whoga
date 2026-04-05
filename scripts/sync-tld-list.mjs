#!/usr/bin/env node
/**
 * TLD List Sync Script
 * Fetches IANA's official TLD list and converts to JSON
 * Source: https://data.iana.org/TLD/tlds-alpha-by-domain.txt
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const TLD_LIST_FILE = path.join(DATA_DIR, "tlds-iana-list.json");

const IANA_TLD_LIST_URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

/**
 * Fetch and parse IANA TLD list
 */
async function fetchAndParseTldList() {
  console.log(`[TLD Sync] Fetching TLD list from ${IANA_TLD_LIST_URL}...`);

  const response = await fetch(IANA_TLD_LIST_URL, {
    headers: {
      "User-Agent": "whoga-rdap-whois/0.1.0 (+https://github.com/whoga/whoga)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch TLD list: ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();
  const lines = text.split("\n").map((line) => line.trim());

  // Parse: skip comments and empty lines, extract TLDs
  // File format:
  // # Version: YYYY-MM-DD
  // # ... header comments ...
  // (blank line)
  // ABARTH
  // ABBOTT
  // ...

  let versionLine = null;
  const tlds = [];

  for (const line of lines) {
    if (line.startsWith("#")) {
      // Extract version if present
      if (line.startsWith("# Version:")) {
        versionLine = line.substring("# Version:".length).trim();
      }
    } else if (line.length > 0) {
      // TLD entries are uppercase single words
      const tld = line.toLowerCase();
      if (tld && /^[a-z0-9\-]+$/.test(tld)) {
        tlds.push(tld);
      }
    }
  }

  console.log(`[TLD Sync] Parsed ${tlds.length} TLDs`);

  return { tlds, version: versionLine };
}

/**
 * Save TLD list to JSON
 */
async function saveTldListToJson(tlds, version) {
  const now = new Date().toISOString();
  const basePayload = {
    tlds,
    count: tlds.length,
    generatedAt: now,
    source: "https://data.iana.org/TLD/tlds-alpha-by-domain.txt",
    version: version || "unknown",
  };

  const payload = {
    ...basePayload,
    meta: {
      lastSyncedAt: now,
      tldCount: tlds.length,
      fileSize: Buffer.byteLength(JSON.stringify(basePayload), "utf8"),
      source: IANA_TLD_LIST_URL,
    },
  };

  // Ensure data directory exists
  await mkdir(DATA_DIR, { recursive: true });

  // Write main TLD list
  await writeFile(TLD_LIST_FILE, JSON.stringify(payload, null, 2));
  console.log(`[TLD Sync] Written ${TLD_LIST_FILE}`);

  return payload;
}

/**
 * Main entry point
 */
async function main() {
  try {
    console.log("[TLD Sync] Starting TLD list sync...");
    console.log(`[TLD Sync] Output: ${TLD_LIST_FILE}`);

    const { tlds, version } = await fetchAndParseTldList();
    const payload = await saveTldListToJson(tlds, version);

    console.log("[TLD Sync] Done!");
    console.log(
      JSON.stringify(
        {
          status: "success",
          tldCount: payload.count,
          generatedAt: payload.generatedAt,
          version: payload.version,
        },
        null,
        2
      )
    );

    process.exit(0);
  } catch (error) {
    console.error("[TLD Sync] Error:", error.message);
    process.exit(1);
  }
}

main();
