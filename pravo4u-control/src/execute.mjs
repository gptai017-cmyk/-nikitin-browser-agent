import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

const REPO = "gptai017-cmyk/-nikitin-browser-agent";
const BRANCH = "pravo4u-control-integration-20261010";
const ROOT = "pravo4u-control";
const CHANNELS = Object.freeze({
  pravo4u: { id: "-1004365134051", username: "pravo4urus" },
  zemlibank: { id: "-1003995995788", username: "zemlibank" }
});
const commandPrefix = ROOT + "/commands/";
const ledgerDir = ROOT + "/state";
const token = process.env.PRAVO4U_BOT_TOKEN || "";
const run = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");

async function telegram(method, body = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await r.json();
    if (!r.ok || data.ok !== true) throw new Error("Telegram " + method + " failed: " + (data.error_code || r.status));
    return data.result;
  } finally {
    clearTimeout(timer);
  }
}

function saveLedger(id, document) {
  fs.mkdirSync(ledgerDir, { recursive: true });
  const filename = path.join(ledgerDir, id + ".json");
  if (fs.existsSync(filename) && document.status === "reserved") {
    throw new Error("Refusing to repeat already recorded command " + id);
  }
  fs.writeFileSync(filename, JSON.stringify(document, null, 2) + "\n");
  run(["add", filename]);
  run(["-c", "user.name=Pravo4u Control", "-c", "user.email=actions@users.noreply.github.com",
    "commit", "-m", "control: " + document.status + " " + id]);
  run(["push", "origin", "HEAD:" + BRANCH]);
}

function assertOwnPost(channel, messageId) {
  if (!fs.existsSync(ledgerDir)) throw new Error("No previously published posts");
  const entries = fs.readdirSync(ledgerDir).filter(f => /^[0-9a-f-]{36}\.json$/.test(f));
  let published = false, deleted = false;
  for (const file of entries) {
    const row = JSON.parse(fs.readFileSync(path.join(ledgerDir, file), "utf8"));
    if (row.channel === channel && row.message_id === messageId && row.status === "sent") {
      if (row.operation === "publish") published = true;
      if (row.operation === "delete") deleted = true;
    }
  }
  if (!published || deleted) throw new Error("Post not owned by Control or already deleted");
}

function validate(command, filename) {
  if (!command || typeof command !== "object" || Array.isArray(command))
    throw new Error("Invalid command object");
  const id = String(command.command_id || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))
    throw new Error("Invalid command UUID");
  if (filename !== commandPrefix + id + ".json")
    throw new Error("Command filename does not match id");
  if (!Object.prototype.hasOwnProperty.call(CHANNELS, command.channel))
    throw new Error("Channel not allowed");
  if (!["publish", "edit", "delete", "verify", "inspect"].includes(command.operation))
    throw new Error("Operation not allowed");
  if (typeof command.dry_run !== "boolean")
    throw new Error("Explicit dry_run boolean required");
  if (command.operation !== "delete" && command.operation !== "verify" && command.operation !== "inspect" &&
      (typeof command.text !== "string" || !command.text.trim() ||
       [...command.text].length > 3500)) throw new Error("Invalid message text");
  if (command.operation !== "publish" && command.operation !== "verify" && command.operation !== "inspect" &&
      (!Number.isSafeInteger(command.message_id) || command.message_id < 1))
    throw new Error("Invalid message_id");
  if ((command.operation === "delete" || command.operation === "verify" || command.operation === "inspect") && command.text !== undefined)
    throw new Error("Delete must not include text");
  if (fs.existsSync(path.join(ledgerDir, id + ".json")))
    throw new Error("Command already processed or reserved");
  return id;
}

async function processCommand(filename) {
  if (!filename.startsWith(commandPrefix) || !filename.endsWith(".json")) return;
  if (fs.statSync(filename).size > 16000) throw new Error("Command too large");
  const command = JSON.parse(fs.readFileSync(filename, "utf8"));
  const id = validate(command, filename);
  const channel = CHANNELS[command.channel];
  console.log("Validated", id, command.operation, command.channel,
    command.dry_run ? "DRY_RUN" : "LIVE");
  if (command.dry_run) {
    console.log("DRY_RUN_OK", JSON.stringify({
      id, operation: command.operation, channel: command.channel,
      text_length: typeof command.text === "string" ? [...command.text].length : 0,
      bot_token_present: Boolean(token)
    }));
    return;
  }
  if (!token) throw new Error("PRAVO4U_BOT_TOKEN is missing; no message sent");
  const me = await telegram("getMe");
  if (me.username?.toLowerCase() !== "advokat4ubot")
    throw new Error("Wrong Telegram bot; no message sent");
  const membership = await telegram("getChatMember",
    { chat_id: channel.id, user_id: me.id });
  if (!["administrator", "creator"].includes(membership.status))
    throw new Error("Bot is not channel admin");
  const canPost = membership.status === "creator" || membership.can_post_messages === true;
  if (command.operation === "inspect") {
    const details = await telegram("getChat", { chat_id: channel.id });
    const members = await telegram("getChatMemberCount", { chat_id: channel.id });
    console.log("INSPECT_OK", JSON.stringify({ bot: me.username, channel: command.channel,
      can_post: canPost, members, title: details.title || null,
      description: String(details.description || "").slice(0, 1000),
      pinned_message_id: details.pinned_message?.message_id || null,
      pinned_preview: String(details.pinned_message?.text || "").slice(0, 300) }));
    return;
  }
  if (command.operation === "verify") {
    const members = await telegram("getChatMemberCount", { chat_id: channel.id });
    console.log("VERIFY_OK", JSON.stringify({ bot: me.username, channel: command.channel,
      can_post: canPost, administrator: membership.status, members }));
    if (!canPost) throw new Error("Posting not permitted");
    return;
  }
  if (command.operation === "publish" && !canPost)
    throw new Error("Posting not permitted");
  if (command.operation === "edit" &&
      membership.status !== "creator" && membership.can_edit_messages !== true)
    throw new Error("Editing not permitted");
  if (command.operation === "delete" &&
      membership.status !== "creator" && membership.can_delete_messages !== true)
    throw new Error("Deletion not permitted");
  if (command.operation !== "publish") assertOwnPost(command.channel, command.message_id);

  const base = {
    command_id: id, operation: command.operation, channel: command.channel,
    command_hash: hash(fs.readFileSync(filename)), text_hash: command.text ? hash(command.text) : null,
    source: "chatgpt-github", started_at: new Date().toISOString()
  };
  // Persist a reservation BEFORE the Telegram API call. Retries never resend
  // reserved commands, even after a crash or an ambiguous network failure.
  saveLedger(id, { ...base, status: "reserved" });
  let resultId = command.operation === "publish" ? null : command.message_id;
  try {
    let result;
    if (command.operation === "publish") {
      result = await telegram("sendMessage", {
        chat_id: channel.id, text: command.text,
        link_preview_options: { is_disabled: true }
      });
      resultId = result.message_id;
      if (!Number.isSafeInteger(resultId)) throw new Error("No Telegram message_id");
    } else if (command.operation === "edit") {
      await telegram("editMessageText", {
        chat_id: channel.id, message_id: resultId, text: command.text,
        link_preview_options: { is_disabled: true }
      });
    } else {
      await telegram("deleteMessage", { chat_id: channel.id, message_id: resultId });
    }
    saveLedger(id, {
      ...base, status: "sent", message_id: resultId,
      completed_at: new Date().toISOString(),
      url: "https://t.me/" + channel.username + "/" + resultId
    });
    console.log("SUCCESS", id, "message_id", resultId,
      "https://t.me/" + channel.username + "/" + resultId);
  } catch (err) {
    try {
      saveLedger(id, { ...base, status: "uncertain", message_id: resultId,
        error: String(err.message).slice(0, 150), completed_at: new Date().toISOString() });
    } catch (persistError) {
      console.error("Cannot persist uncertain result:", persistError.message);
    }
    throw err;
  }
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPO) throw new Error("Wrong repository");
  if (process.env.GITHUB_REF !== "refs/heads/" + BRANCH) throw new Error("Wrong branch");
  const filenames = run(["diff-tree", "--no-commit-id", "--name-only", "-r",
    process.env.GITHUB_SHA, "--", commandPrefix]).split("\n").filter(Boolean);
  if (!filenames.length) {
    console.log("No new command files in this push. No Telegram action.");
    return;
  }
  if (filenames.length > 3) throw new Error("Maximum three commands per push");
  for (const filename of filenames) await processCommand(filename);
}
main().catch(err => { console.error("CONTROL_FAIL", err.message); process.exitCode = 1; });
