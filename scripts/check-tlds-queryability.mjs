import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const TLDS_FILE = path.join(DATA_DIR, "tlds.json");
const OUTPUT_FILE = path.join(DATA_DIR, "tlds-queryability-report.json");

function normalizeSuffix(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
  return normalized || null;
}

function toNormalizedSet(values) {
  const result = new Set();
  for (const value of values ?? []) {
    const normalized = normalizeSuffix(value);
    if (normalized) {
      result.add(normalized);
    }
  }
  return result;
}

async function main() {
  const raw = await readFile(TLDS_FILE, "utf-8");
  const payload = JSON.parse(raw);
  const tlds = payload?.tlds ?? {};

  const sourceMap = new Map();
  for (const [sourceName, list] of Object.entries(tlds)) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const value of list) {
      const normalized = normalizeSuffix(value);
      if (!normalized) {
        continue;
      }
      if (!sourceMap.has(normalized)) {
        sourceMap.set(normalized, new Set());
      }
      sourceMap.get(normalized).add(sourceName);
    }
  }

  const allSuffixes = [...sourceMap.keys()].sort((a, b) => a.localeCompare(b));
  const queryableSet = toNormalizedSet(tlds.queryable ?? []);
  const cannotQueryRootSet = toNormalizedSet(tlds.cannotQueryRoot ?? []);

  const queryable = [];
  const unqueryable = [];
  for (const suffix of allSuffixes) {
    if (queryableSet.has(suffix)) {
      queryable.push(suffix);
    } else {
      unqueryable.push(suffix);
    }
  }

  const cannotQueryRootButQueryable = [...cannotQueryRootSet]
    .filter((suffix) => queryableSet.has(suffix))
    .sort((a, b) => a.localeCompare(b));

  const report = {
    checkedAt: new Date().toISOString(),
    sourceFile: "data/tlds.json",
    summary: {
      totalUniqueSuffixes: allSuffixes.length,
      queryable: queryable.length,
      unqueryable: unqueryable.length,
      queryableRate: allSuffixes.length
        ? Number(((queryable.length / allSuffixes.length) * 100).toFixed(2))
        : 0,
      cannotQueryRootButQueryable: cannotQueryRootButQueryable.length
    },
    queryable,
    unqueryable,
    cannotQueryRootButQueryable,
    sources: Object.fromEntries(
      [...sourceMap.entries()].map(([suffix, sources]) => [suffix, [...sources].sort()])
    )
  };

  await writeFile(OUTPUT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(`checkedAt=${report.checkedAt}`);
  console.log(`total=${report.summary.totalUniqueSuffixes}`);
  console.log(`queryable=${report.summary.queryable}`);
  console.log(`unqueryable=${report.summary.unqueryable}`);
  console.log(`queryableRate=${report.summary.queryableRate}%`);
  console.log(`output=${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
