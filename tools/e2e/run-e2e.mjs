import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { request } from "undici";
import { createServer } from "node:net";

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

async function findAvailablePort() {
  return await new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 50; i++) {
    try {
      const h = await request(`${baseUrl}/health`);
      if (h.statusCode === 200) return true;
    } catch {}
    await wait(200);
  }
  return false;
}

async function main() {
  const host = process.env.CPMS_API_HOST ?? "127.0.0.1";
  const port = process.env.CPMS_API_PORT ?? await findAvailablePort();
  const baseUrl = `http://${host}:${port}`;

  // Start server with node directly to avoid pnpm lifecycle exit issues
  const serverPath = resolve(repoRoot, "packages/server-node/src/server.js");
  const proc = spawn(process.execPath, [serverPath], {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: "test", CPMS_API_HOST: host, CPMS_API_PORT: String(port) }
  });

  const stop = async () => {
    if (proc.killed) return;
    proc.kill("SIGTERM");
    await new Promise((r) => proc.once("exit", r));
  };

  try {
    const ok = await waitForHealth(baseUrl);
    if (!ok) throw new Error("API did not become healthy");

    const payloadPath = resolve(repoRoot, "examples/requests/login.pattern.request.concrete.json");
    const payload = JSON.parse(readFileSync(payloadPath, "utf-8"));

    const res = await request(`${baseUrl}/cpms/match_pattern`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.statusCode !== 200) throw new Error(`match_pattern failed: ${res.statusCode}`);
    const body = await res.body.json();

    const assigned = body?.result?.assigned ?? {};
    if (assigned["concept:email@1.0.0"] !== "cand_email") throw new Error("email assignment incorrect");
    if (assigned["concept:password@1.0.0"] !== "cand_pass") throw new Error("password assignment incorrect");

    console.log("E2E OK:", assigned);
  } finally {
    await stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
