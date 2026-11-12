#!/usr/bin/env node
// Safe, read-only CI gate. Does not read deployment secrets or invoke production APIs.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const tracked = execFileSync("git", ["ls-files", "-z"], {encoding:"utf8"})
  .split("\0").filter(Boolean);
const errors = [];
const statistics = {files:0, absoluteWorkersDevRefs:0};
const patterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["GitHub token", /\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{32,}\b/],
  ["GitHub fine-grained token", /\bgithub_pat_[A-Za-z0-9_]{25,}\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["Telegram bot token", /\b[0-9]{8,12}:[A-Za-z0-9_-]{35}\b/],
  ["hardcoded Bearer token", /\bBearer\s+[a-zA-Z0-9._-]{45,}/]
];
for (const filename of tracked) {
  if (/(^|\/)\.(?:env|secrets)(?:\.|$)/.test(filename) &&
      !/\.(?:example|sample|template)$/.test(filename)) {
    errors.push(`Sensitive config tracked in Git: ${filename}`);
  }
  if (!/\.(?:js|mjs|cjs|ts|tsx|json|jsonc|yaml|yml|py|sh|toml)$/.test(filename)) continue;
  if (/^(?:vendor|node_modules|dist)\//.test(filename)) continue;
  let content;
  try {content=readFileSync(filename,"utf8")}catch{continue}
  if (content.includes("\0")) continue;
  statistics.files++;
  const hosts=content.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+workers\.dev/gi);
  statistics.absoluteWorkersDevRefs+=(hosts||[]).length;
  for (const [name,pattern] of patterns) {
    if (pattern.test(content)) errors.push(`Possible ${name} in ${filename} (inspect privately, never print value)`);
  }
}
console.log(JSON.stringify({scan:"LEX",...statistics,cutoverReady:statistics.absoluteWorkersDevRefs===0},null,2));
if (process.env.LEX_DOMAIN_CUTOVER === "1" && statistics.absoluteWorkersDevRefs>0) {
  errors.push("Domain cutover gate failed: absolute workers.dev references remain");
}
if (errors.length) {
  for (const problem of errors) console.error("SECURITY:",problem);
  process.exitCode=1;
} else {
  console.log("LEX security preflight passed. This is NOT a substitute for secret scanning with history.");
}
