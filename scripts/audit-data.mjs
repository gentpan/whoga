import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, "data");
const MANIFEST_FILE = path.join(DATA_DIR, "data-manifest.json");
const REPORT_FILE = path.join(DATA_DIR, "data-audit-report.json");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function stableNormalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }
  if (value && typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      normalized[key] = stableNormalize(value[key]);
    }
    return normalized;
  }
  return value;
}

function byteSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function loadJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function classifyShape(jsonValue) {
  if (Array.isArray(jsonValue)) {
    return `list:${jsonValue.length}`;
  }
  if (jsonValue && typeof jsonValue === "object") {
    return `dict:${Object.keys(jsonValue).length}`;
  }
  return typeof jsonValue;
}

function formatGroupLine(group) {
  return `- ${group.files.join(", ")} (${group.count} files)`;
}

async function main() {
  const wantReport = process.argv.includes("--report");
  const strictMode = process.argv.includes("--strict");
  const files = (await readdir(DATA_DIR))
    .filter((name) => name.endsWith(".json") && name !== "data-audit-report.json")
    .sort((a, b) => a.localeCompare(b));

  const manifest = await loadJson(MANIFEST_FILE);
  const manifestEntries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const allowedExactDuplicateGroups = Array.isArray(manifest?.allowedExactDuplicateGroups)
    ? manifest.allowedExactDuplicateGroups
    : [];
  const manifestByFile = new Map(
    manifestEntries
      .filter((entry) => entry && typeof entry.file === "string")
      .map((entry) => [entry.file, entry])
  );

  const rawHashGroups = new Map();
  const canonicalHashGroups = new Map();
  const analysis = [];

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const rawText = await readFile(filePath, "utf-8");
    const bytes = Buffer.byteLength(rawText, "utf-8");
    const rawHash = sha256(rawText);

    let parsed = null;
    let canonicalHash = null;
    let parseError = null;
    try {
      parsed = JSON.parse(rawText);
      canonicalHash = sha256(JSON.stringify(stableNormalize(parsed)));
    } catch (error) {
      parseError = error instanceof Error ? error.message : "unknown parse error";
    }

    if (!rawHashGroups.has(rawHash)) {
      rawHashGroups.set(rawHash, []);
    }
    rawHashGroups.get(rawHash).push(file);

    if (canonicalHash) {
      if (!canonicalHashGroups.has(canonicalHash)) {
        canonicalHashGroups.set(canonicalHash, []);
      }
      canonicalHashGroups.get(canonicalHash).push(file);
    }

    const meta = manifestByFile.get(file) ?? null;

    analysis.push({
      file,
      bytes,
      size: byteSize(bytes),
      shape: parsed !== null ? classifyShape(parsed) : "invalid-json",
      parseError,
      rawHash,
      canonicalHash,
      layer: meta?.layer ?? "unclassified",
      runtimeUsed: Boolean(meta?.runtimeUsed),
      owner: meta?.owner ?? null,
      notes: meta?.notes ?? null
    });
  }

  const exactDuplicates = [...rawHashGroups.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({ files: list, count: list.length }));
  const canonicalDuplicates = [...canonicalHashGroups.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({ files: list, count: list.length }));

  const layerStats = analysis.reduce((acc, item) => {
    const key = item.layer;
    if (!acc[key]) {
      acc[key] = { files: 0, bytes: 0 };
    }
    acc[key].files += 1;
    acc[key].bytes += item.bytes;
    return acc;
  }, {});

  const unclassified = analysis.filter((item) => item.layer === "unclassified").map((item) => item.file);
  const runtimeFiles = analysis.filter((item) => item.runtimeUsed).map((item) => item.file);
  const optionalFiles = analysis.filter((item) => !item.runtimeUsed).map((item) => item.file);
  const largest = [...analysis]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map((item) => ({ file: item.file, bytes: item.bytes, size: item.size }));

  const recommendations = [];
  if (exactDuplicates.length > 0) {
    recommendations.push({
      type: "duplicate",
      message: "Exact duplicate JSON files exist. Keep one canonical source and generate compatibility aliases.",
      groups: exactDuplicates
    });
  }
  if (unclassified.length > 0) {
    recommendations.push({
      type: "classification",
      message: "Some JSON files are not in data-manifest.json.",
      files: unclassified
    });
  }
  if (optionalFiles.length > 0) {
    recommendations.push({
      type: "slim",
      message: "Optional derived/meta files can be regenerated on refresh and excluded from runtime hot path.",
      files: optionalFiles
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      jsonFiles: analysis.length,
      totalBytes: analysis.reduce((sum, item) => sum + item.bytes, 0)
    },
    layerStats,
    exactDuplicates,
    canonicalDuplicates,
    runtimeFiles,
    optionalFiles,
    largest,
    unclassified,
    recommendations,
    files: analysis
  };

  const unexpectedExactDuplicates = exactDuplicates.filter((group) => {
    const sortedGroup = [...group.files].sort((a, b) => a.localeCompare(b));
    return !allowedExactDuplicateGroups.some((allow) => {
      if (!Array.isArray(allow)) {
        return false;
      }
      const sortedAllow = [...allow].sort((a, b) => String(a).localeCompare(String(b)));
      return JSON.stringify(sortedAllow) === JSON.stringify(sortedGroup);
    });
  });

  console.log("Data audit summary");
  console.log(`- JSON files: ${report.totals.jsonFiles}`);
  console.log(`- Total size: ${byteSize(report.totals.totalBytes)}`);
  console.log(`- Runtime files: ${runtimeFiles.length}`);
  console.log(`- Optional files: ${optionalFiles.length}`);
  console.log("");

  console.log("Layer breakdown");
  for (const [layer, info] of Object.entries(layerStats).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${layer}: ${info.files} files, ${byteSize(info.bytes)}`);
  }
  console.log("");

  console.log("Exact duplicate groups");
  if (exactDuplicates.length === 0) {
    console.log("- none");
  } else {
    for (const group of exactDuplicates) {
      console.log(formatGroupLine(group));
    }
  }
  console.log("");

  console.log("Top 5 largest JSON files");
  for (const item of largest) {
    console.log(`- ${item.file}: ${item.size}`);
  }

  if (wantReport) {
    await writeFile(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
    console.log("");
    console.log(`Report written: ${path.relative(ROOT_DIR, REPORT_FILE)}`);
  }

  if (strictMode) {
    const strictErrors = [];
    if (unclassified.length > 0) {
      strictErrors.push(`unclassified files: ${unclassified.join(", ")}`);
    }
    if (unexpectedExactDuplicates.length > 0) {
      strictErrors.push(
        `unexpected exact duplicate groups: ${unexpectedExactDuplicates
          .map((group) => group.files.join(", "))
          .join(" | ")}`
      );
    }
    if (strictErrors.length > 0) {
      console.error("\nStrict audit failed");
      for (const msg of strictErrors) {
        console.error(`- ${msg}`);
      }
      process.exit(2);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
