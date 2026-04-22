import { access, copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const REPO_DATA_DIR = path.join(process.cwd(), "data");
const RUNTIME_ROOT_DIR =
  process.env.WHOGA_RUNTIME_DIR ?? path.resolve(process.cwd(), "..", "whoga-runtime");
const RUNTIME_DATA_DIR = path.join(RUNTIME_ROOT_DIR, "data");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function getRepoDataPath(fileName: string): string {
  return path.join(REPO_DATA_DIR, fileName);
}

export function getRuntimeDataPath(fileName: string): string {
  return path.join(RUNTIME_DATA_DIR, fileName);
}

export async function resolveReadableDataPath(fileName: string): Promise<string> {
  const runtimePath = getRuntimeDataPath(fileName);
  if (await pathExists(runtimePath)) {
    return runtimePath;
  }
  return getRepoDataPath(fileName);
}

export async function ensureWritableDataPath(fileName: string): Promise<string> {
  const runtimePath = getRuntimeDataPath(fileName);
  if (await pathExists(runtimePath)) {
    return runtimePath;
  }

  await mkdir(RUNTIME_DATA_DIR, { recursive: true });
  const repoPath = getRepoDataPath(fileName);
  if (await pathExists(repoPath)) {
    await copyFile(repoPath, runtimePath);
  }
  return runtimePath;
}

export async function readableDataPaths(fileNames: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    fileNames.map(async (fileName) => [fileName, await resolveReadableDataPath(fileName)] as const)
  );
  return Object.fromEntries(entries);
}
