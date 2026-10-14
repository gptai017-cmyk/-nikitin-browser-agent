import fs from "node:fs/promises";

const token=process.env.TELEGRAM_BOT_TOKEN;
const chat="@yandzeen";
const historyPath="zen/metrics/history.json";
if(!token)throw new Error("Missing TELEGRAM_BOT_TOKEN");
async function api(method,body={}) {
  const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body)
  });
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(method+" failed: "+String(data.description||response.status).replaceAll(token,"[REDACTED]").slice(0,160));
  return data.result;
}
const date=new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const count=await api("getChatMemberCount",{chat_id:chat});
const history=JSON.parse(await fs.readFile(historyPath,"utf8"));
if(!Number.isInteger(count)||count<0)throw new Error("Invalid member count");
const existing=history.findIndex(row=>row.date===date);
const entry={date,members:count,collected_at:new Date().toISOString()};
if(existing>=0) history[existing]=entry;
else history.push(entry);
history.sort((a,b)=>a.date.localeCompare(b.date));
const prior=history.filter(row=>row.date<date).at(-1);
await fs.writeFile(historyPath,JSON.stringify(history,null,2)+"\n","utf8");
console.log("CHANNEL=@yandzeen");
console.log("DATE="+date);
console.log("MEMBERS="+count);
console.log("DAY_OVER_DAY="+(prior?count-prior.members:"baseline"));
console.log("DZEN_SUBSCRIBERS=NOT_AVAILABLE_WITH_TELEGRAM_BOT_API");
