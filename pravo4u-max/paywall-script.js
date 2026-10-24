// Browser entrypoint for approved paid checkout. Public script contains no private document generator.
export const PAID_ENTRY_SCRIPT=String.raw`
"use strict";
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const kind=new URLSearchParams(location.search).get("type");
const EL=id=>document.getElementById(id);
const eligible=new Set(["order","rent","loan","service","fssp_minimum","course_refund","fssp_files","fssp_copy","fssp_complaint","court_files","loan_demand","service_end","service_claim","online_return","defect_return","prepayment_delay","work_contract","goods_sale","vehicle_sale","rent_return","service_advance"]);
if(!eligible.has(kind)){EL("error").textContent="Неизвестный документ. Откройте каталог.";throw Error("invalid product");}
EL("make").hidden=true;
EL("form").hidden=true;
EL("payzone").hidden=false;
EL("type").textContent="Персонализированный документ — 50 ₽";
const message=EL("message"),error=EL("error");
const key="p4u_claim_"+kind;
const getClaim=()=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
function fail(text){error.textContent=text;message.textContent="";}
function note(text){message.textContent=text;error.textContent="";}
const button=document.createElement("button");button.textContent="Проверить оплату и открыть конструктор";button.id="checkPayment";EL("payzone").appendChild(button);
let loading=false,unlocked=false;
async function unlock(){
 if(loading||unlocked)return;
 const claim=getClaim();
 if(!claim){note("Сначала оплатите выбранный документ.");return}
 loading=true;button.disabled=true;
 try{
  const r=await fetch("/api/pay/source",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...claim,product:kind}),cache:"no-store"});
  if(r.status===403){note("Оплата ещё не подтверждена либо заказ относится к другому документу. Деньги повторно не переводите.");return}
  if(!r.ok)throw Error("Не удалось проверить оплату. Сохранённый заказ не удалён.");
  const source=await r.text();
  if(source.length<10000)throw Error("Ошибка выдачи генератора. Обратитесь в поддержку.");
  const blob=URL.createObjectURL(new Blob([source],{type:"application/javascript"}));
  const script=document.createElement("script");script.src=blob;
  script.onload=()=>{URL.revokeObjectURL(blob);unlocked=true;EL("payzone").hidden=true;EL("form").hidden=false;EL("make").hidden=false;note("Оплата подтверждена. Заполните анкету на вашем устройстве.")};
  script.onerror=()=>{URL.revokeObjectURL(blob);fail("Ошибка загрузки конструктора. Напишите в поддержку.")};
  document.body.appendChild(script);
 }catch(e){fail(e.message||"Проверка временно недоступна")}finally{loading=false;button.disabled=false}
}
EL("pay").onclick=async()=>{
 if(!EL("acceptOffer").checked){fail("Для оплаты подтвердите ознакомление с офертой.");return}
 if(getClaim()){note("Уже существует заказ на этот документ. Используйте «Проверить оплату»; чтобы избежать двойного списания, второй счёт не создаём.");return}
 try{
  const r=await fetch("/api/pay/create",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({product:kind,acceptedOffer:true}),cache:"no-store"});
  const data=await r.json();
  if(!r.ok||!data.paymentUrl||!data.claim)throw Error("Создание счёта недоступно. Деньги не списаны.");
  localStorage.setItem(key,JSON.stringify({invoice:data.invoice,claim:data.claim}));
  localStorage.setItem("p4u_last_product",kind);
  location.assign(data.paymentUrl);
 }catch(e){fail(e.message||"Не удалось создать счёт")}
};
button.onclick=unlock;
if(getClaim()){note("Найден сохранённый номер заказа. Если оплата проведена, нажмите «Проверить оплату».");unlock()}
else note("Оплата 50 ₽ через Robokassa. Паспортные поля вводятся после подтверждения оплаты только в браузере.");
window.addEventListener("pageshow",()=>{if(!unlocked&&getClaim())unlock()});
`;
