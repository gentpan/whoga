import { execSync, spawn } from "node:child_process";

const PORT = 3000;

function listPortPids(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, {
      stdio: ["ignore", "pipe", "ignore"]
    })
      .toString()
      .trim();
    if (!output) {
      return [];
    }
    return output
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

function freePort(port) {
  const pids = listPortPids(port);
  if (!pids.length) {
    return;
  }

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore and continue
    }
  }

  const remains = listPortPids(port);
  for (const pid of remains) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore and continue
    }
  }
}

freePort(PORT);

const child = spawn("pnpm", ["vite", "dev", "--host", "0.0.0.0", "--port", String(PORT)], {
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
