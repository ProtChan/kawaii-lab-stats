import { spawn } from "node:child_process";

const jobs = [
  { name: "YouTube", script: "scripts/collect-youtube.mjs", enabled: () => Boolean(process.env.YOUTUBE_API_KEY) },
  { name: "X", script: "scripts/collect-x.mjs", enabled: () => Boolean(process.env.X_BEARER_TOKEN) },
  {
    name: "Instagram",
    script: "scripts/collect-instagram.mjs",
    enabled: () => Boolean(process.env.META_ACCESS_TOKEN && process.env.META_IG_USER_ID),
  },
  {
    name: "Snapshot provider",
    script: "scripts/collect-provider.mjs",
    enabled: () => Boolean(process.env.SNAPSHOT_PROVIDER_URL),
  },
  {
    name: "Authorized web fallback",
    script: "scripts/collect-authorized-web.mjs",
    enabled: () => process.env.ENABLE_AUTHORIZED_WEB_SCRAPING === "true",
  },
];

function run(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", env: process.env });
    child.on("exit", (code, signal) => resolve({ code: code ?? 1, signal }));
  });
}

const results = [];
for (const job of jobs) {
  if (!job.enabled()) {
    console.log(`↷ ${job.name}: skipped (credentials/config not present)`);
    results.push({ name: job.name, status: "SKIPPED" });
    continue;
  }

  console.log(`\n▶ ${job.name}`);
  const result = await run(job.script);
  const status = result.code === 0 ? "SUCCESS" : result.code === 2 ? "PARTIAL" : "FAILED";
  results.push({ name: job.name, status, code: result.code });
}

console.log("\nCollection summary");
for (const result of results) console.log(`- ${result.name}: ${result.status}`);

if (results.some((result) => result.status === "FAILED")) process.exitCode = 1;
else if (results.some((result) => result.status === "PARTIAL")) process.exitCode = 2;
