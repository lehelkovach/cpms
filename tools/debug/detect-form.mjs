#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const usage = `Usage:
  node tools/debug/detect-form.mjs --html-file ./fixture.html [--base-url http://localhost:8787]
  node tools/debug/detect-form.mjs --html '<form>...</form>'
  node tools/debug/detect-form.mjs --dom-snapshot ./snapshot.json --html ''

Options:
  --base-url       CPMS API URL (default: CPMS_API_URL or http://localhost:8787)
  --html-file      Read HTML from a file
  --html           Inline HTML string
  --dom-snapshot   Optional JSON file with app/accessibility snapshot
  --url            Optional page/app URL metadata
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    args[name] = value;
    i += 1;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args["base-url"] ?? process.env.CPMS_API_URL ?? "http://localhost:8787").replace(/\/$/, "");
  const html = args["html-file"] ? await readFile(args["html-file"], "utf-8") : (args.html ?? "");
  const domSnapshot = args["dom-snapshot"]
    ? JSON.parse(await readFile(args["dom-snapshot"], "utf-8"))
    : undefined;

  if (!html && !domSnapshot) {
    throw new Error("Provide --html, --html-file, or --dom-snapshot.\n\n" + usage);
  }

  const response = await fetch(`${baseUrl}/cpms/detect_form`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      html,
      url: args.url,
      dom_snapshot: domSnapshot
    })
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`detect_form failed (${response.status}): ${body}`);
  }

  console.log(JSON.stringify(JSON.parse(body), null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
