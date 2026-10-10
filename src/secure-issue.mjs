import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  createHash, randomBytes, createCipheriv, createDecipheriv,
  publicEncrypt, privateDecrypt, generateKeyPairSync, constants
} from "node:crypto";

const worker = "https://nikitin-browser-bridge.cbd-legal-cloudflare-worker.workers.dev";
const secret = process.env.TELEGRAM_BOT_TOKEN || "";
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
const issue = event.issue;
const repo = process.env.GITHUB_REPOSITORY || "";
const issueNumber = issue.number;
const agentKey = createHash("sha256").update("browser-ai:" + secret).digest("hex");
if (!secret || !issue || !repo || issue.user.login !== repo.split("/")[0]) throw Error("Unauthorized setup");
const b64 = x => Buffer.from(x).toString("base64");
const from64 = x => Buffer.from(x, "base64");
const safe = x => String(x || "").slice(0, 600);

async function state(method, key, value) {
  const url = worker + "/state" + (method === "GET" ? "?key=" + encodeURIComponent(key) : "");
  const result = await fetch(url, {
    method,
    headers: {"X-Agent-Key":agentKey, "Content-Type":"application/json"},
    ...(method === "PUT" ? {body:JSON.stringify({key, value})} : {})
  });
  const data = await result.json();
  if (!result.ok || data.ok !== true) throw Error("Secure storage unavailable");
  return data;
}

async function comment(message) {
  const u = "https://api.github.com/repos/" + repo + "/issues/" + issueNumber + "/comments";
  const resp = await fetch(u, {
    method:"POST",
    headers:{
      "Authorization":"Bearer " + process.env.GITHUB_TOKEN,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json"
    },
    body:JSON.stringify({body:message})
  });
  if (!resp.ok) throw Error("Unable to post encrypted reply: " + resp.status);
}
async function closeIssue() {
  const resp = await fetch("https://api.github.com/repos/" + repo + "/issues/" + issueNumber,{
    method:"PATCH",
    headers:{
      "Authorization":"Bearer " + process.env.GITHUB_TOKEN,
      "Accept":"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28",
      "Content-Type":"application/json"
    },
    body: JSON.stringify({state:"closed",state_reason:"completed"})
  });
  if(!resp.ok) throw Error("Issue close failed " + resp.status);
}
function encryptReply(key, object) {
  const iv=randomBytes(12);
  const c=createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(object)))),c.final()]);
  return {version:1, encoding:"gzip", iv:b64(iv), ciphertext:b64(ciphertext),tag:b64(c.getAuthTag())};
}
function decryptRunner(packed, key) {
  const buf=from64(packed),iv=buf.subarray(0,12),tag=buf.subarray(buf.length-16),body=buf.subarray(12,buf.length-16);
  const d=createDecipheriv("aes-256-gcm",createHash("sha256").update(key).digest(),iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString("utf8"));
}

if (process.argv[2] === "keygen") {
  const pair=generateKeyPairSync("rsa",{modulusLength:3072,
    publicKeyEncoding:{format:"pem",type:"spki"},
    privateKeyEncoding:{format:"pem",type:"pkcs8"}});
  await state("PUT","chatgpt_secure_private",pair.privateKey);
  const pub={version:1,algorithm:"RSA-OAEP-SHA256+AES-256-GCM",public_key:pair.publicKey,created_at:new Date().toISOString()};
  writeFileSync("bridge/public-key.json",JSON.stringify(pub,null,2)+"\n",{mode:0o644});
  execFileSync("git",["config","user.email","41898282+github-actions[bot]@users.noreply.github.com"]);
  execFileSync("git",["config","user.name","github-actions[bot]"]);
  execFileSync("git",["add","bridge/public-key.json"]);
  execFileSync("git",["commit","-m","chore: establish public encryption key for secure browser tasks"]);
  execFileSync("git",["push","origin","HEAD:main"]);
  await comment("✅ Защищённый ключ создан. Публичная часть опубликована в bridge/public-key.json, закрытая находится только в Cloudflare KV.");
  await closeIssue();
} else if (process.argv[2] === "compact") {
  // Summarize an existing sealed reply with the original session key, without disclosing it.
  try {
    const id = Number(String(issue.title).match(/^\[CHATGPT-COMPACT\] (\d+)$/)?.[1]||0);
    if(!Number.isInteger(id)||id<1||id>100000000) throw Error("Invalid source issue");
    const headers={"Authorization":"Bearer "+process.env.GITHUB_TOKEN,"Accept":"application/vnd.github+json"};
    const sourceUrl="https://api.github.com/repos/"+repo+"/issues/"+id;
    const [source,entries]=await Promise.all([
      fetch(sourceUrl,{headers}).then(x=>x.json()),
      fetch(sourceUrl+"/comments?per_page=100",{headers}).then(x=>x.json())
    ]);
    if(!Array.isArray(entries)||!source?.body||source.user?.login!==repo.split("/")[0])throw Error("Invalid source");
    const previous=JSON.parse(source.body);
    const pem=(await state("GET","chatgpt_secure_private")).value;
    const key=privateDecrypt({key:pem,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},from64(previous.key));
    const rec=entries.find(x=>typeof x.body==="string"&&x.body.startsWith("SECURE_BROWSER_RESULT_V1\n"));
    if(!rec)throw Error("Source reply missing");
    const env=JSON.parse(rec.body.split("\n").slice(1).join("\n"));
    const cipher=createDecipheriv("aes-256-gcm",key,from64(env.iv));
    cipher.setAuthTag(from64(env.tag));
    let plain=Buffer.concat([cipher.update(from64(env.ciphertext)),cipher.final()]);
    if(env.encoding==="gzip")plain=gunzipSync(plain);
    const data=JSON.parse(plain.toString("utf8"));
    const brief={request_id:String(data.request_id||""),status:data.status,
      output:String(data.output||"").slice(0,1200),
      evidence:data.evidence?{
        url:String(data.evidence.url||"").slice(0,300),
        title:String(data.evidence.title||"").slice(0,120),
        text:String(data.evidence.text||"").slice(0,500)
      }:null};
    if(String(data.output||"").includes("inspect_budget_summary")) {
      const m=String(data.output).match(/"addButtons"\s*:\s*(\[[\s\S]*?\])\s*,\s*"text"/);
      if(m){try{
        const cats=JSON.parse(m[1]).map(x=>String(x.index)+": "+String(x.section||"").slice(0,180));
        brief.output="Budget category buttons:\n"+cats.join("\n");
      }catch{}}
    }
    await comment("SECURE_BROWSER_RESULT_V1\n"+JSON.stringify(encryptReply(key,brief)));
    await closeIssue();
  }catch(e){
    await comment("❌ Не удалось сократить зашифрованный ответ.").catch(()=>{});
    await closeIssue().catch(()=>{});
    process.exitCode=1;
  }
} else if (process.argv[2] === "run") {
  let key=null;
  let requestId="unknown";
  try {
    const envelope=JSON.parse(issue.body||"");
    if(envelope.version!==1 || Object.values(envelope).some(v=>typeof v==="string" && v.length>16000))throw Error("Invalid envelope");
    const priv=(await state("GET","chatgpt_secure_private")).value;
    if(!priv) throw Error("Secure private key not initialized");
    key=privateDecrypt({key:priv,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:"sha256"},from64(envelope.key));
    if(key.length!==32)throw Error("Invalid session key");
    const decipher=createDecipheriv("aes-256-gcm",key,from64(envelope.iv));
    decipher.setAuthTag(from64(envelope.tag));
    const request=JSON.parse(Buffer.concat([decipher.update(from64(envelope.ciphertext)),decipher.final()]).toString("utf8"));
    requestId=String(request.request_id||"");
    if(!/^[a-z0-9_-]{12,64}$/i.test(requestId) || issue.title !== "[CHATGPT-SECURE] " + requestId ||
        Math.abs(Date.now()-Number(request.ts))>900000 ||typeof request.task!=="string" || request.task.length>7500){
      throw Error("Invalid or expired task");
    }
    const resultKey=randomBytes(32).toString("hex");
    const task="[[CHATGPT_RESULT_KEY:"+resultKey+"]] "+request.task;
    const result=spawnSync(process.execPath,["src/execute-dispatch.js"],{
      encoding:"utf8",timeout:12*60*1000,maxBuffer:1024*1024,
      env:{...process.env,BROWSER_TASK_PLAINTEXT:task,BROWSER_BRIDGE_URL:worker}
    });
    const output=String(result.stdout||"");
    const m=output.match(/CHATGPT_RESULT_ENCRYPTED_V1\s+([A-Za-z0-9+/=]+)/);
    let info;
    if(m){
      info=decryptRunner(m[1],resultKey);
      if(result.status!==0) info.status="failed";
    }else{
      info={status:"failed",output:"Browser did not return an encrypted result",exit_code:result.status,signal:result.signal||null};
    }
    const reply=encryptReply(key,{request_id:requestId,...info});
    await comment("SECURE_BROWSER_RESULT_V1\n"+JSON.stringify(reply));
    await closeIssue();
  }catch(e) {
    // Never put decrypted task, browser output, secrets or untrusted exception details into public issue.
    if(key){
      await comment("SECURE_BROWSER_RESULT_V1\n"+JSON.stringify(encryptReply(key,{
        request_id:requestId,status:"failed",output:"Secure browser task failed before completion"
      }))).catch(()=>{});
    }else{
      await comment("❌ Шифрованное задание отклонено. Проверьте актуальность ключа и формат запроса.").catch(()=>{});
    }
    await closeIssue().catch(()=>{});
    process.exitCode=1;
  }
} else throw Error("Unknown secure-browser action");
