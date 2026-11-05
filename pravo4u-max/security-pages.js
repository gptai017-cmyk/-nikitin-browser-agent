import {securityReady,SECURITY_CONSENT_VERSION,LEAD_SOURCES,LEAD_STATUSES,LEAD_PRODUCTS} from "./security-leads.js";
import {shareHtml} from "./section-sharing.js";
const safe=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const sourceFrom=url=>LEAD_SOURCES.includes(url.searchParams.get("source"))?url.searchParams.get("source"):"DIRECT";
const qSource=source=>"?source="+encodeURIComponent(source);
const card=(heading,body,cta="")=>'<section class="card"><h2>'+heading+'</h2>'+body+cta+'</section>';
const button=(href,label)=>'<a class="button" href="'+href+'">'+label+'</a>';
const banner='<p class="warning"><strong>Внимание.</strong> Это не действующая услуга охраны. Кнопки тревоги нет, вызов ГБР не осуществляется. При непосредственной опасности звоните <a href="tel:112">112</a>.</p>';
const heading='<header><p class="brand"><a href="/store">Лекс | ПРАВО4U</a></p><h1>Безопасность</h1><p class="lead">Семья, дом и бизнес</p></header>';
function layout(title,body,ready){
 const status=ready?'':'<p class="pending">Приём персональных заявок пока не открыт: проверяется российское хранение данных и документы оператора. Информационные страницы доступны.</p>';
 return new Response('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>'+safe(title)+' | Лекс</title>'+
 '<style>:root{color-scheme:light}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Arial,sans-serif;line-height:1.5;max-width:660px;padding:20px 16px;margin:auto;color:#1d293d;background:#f9fafc}h1{font-size:27px;line-height:1.2;margin:8px 0}h2{font-size:19px;margin:4px 0 10px}h3{font-size:16px}.brand{font-size:14px;font-weight:700}.brand a{color:#2254b5}.lead{font-size:18px;color:#495e7d}.card{background:white;border:1px solid #d8e0ed;border-radius:15px;padding:18px;margin:16px 0}.card p{margin:8px 0}.button,button{display:block;text-align:center;appearance:none;border:0;width:100%;background:#2659c4;color:white;border-radius:12px;padding:15px 16px;font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}.button.secondary{background:#edf3ff;color:#244a9d}.button[aria-disabled="true"],button:disabled{opacity:.6;cursor:not-allowed}.muted{color:#516078;font-size:14px}.warning,.pending{background:#fff4e7;border:1px solid #f3d2a9;border-radius:12px;padding:13px;font-size:14px}.pending{background:#fff9eb}.price{font-weight:700;font-size:17px;color:#1c4293}.form-grid{display:grid;gap:13px}label{display:block;font-weight:650;font-size:14px}input,select,textarea{display:block;width:100%;padding:12px;border-radius:9px;border:1px solid #afbed4;min-height:45px;font:inherit;margin-top:5px;background:#fff;color:#1d293d}textarea{min-height:65px}input[type=checkbox]{width:22px;height:22px;min-height:22px;flex:none;margin:0}.consent{display:flex;align-items:flex-start;gap:10px;background:#f1f5fc;border-radius:10px;padding:13px;font-size:14px}.consent label{font-weight:400;font-size:14px}.hint{font-size:13px;color:#556b84;margin-top:4px}.hidden{display:none!important}.error{color:#b02636;font-size:14px}a{color:#2050ac}.pill{display:inline-block;background:#f1f4fa;border-radius:14px;font-size:13px;padding:5px 10px}.list{padding-left:21px}.list li{margin:8px 0} .lex-share{background:#edf4ff;border:1px solid #c7d8f3;border-radius:12px;padding:14px;margin:16px 0}.lex-share summary{font-weight:750;color:#244e9b}.lex-share-hint{font-size:14px;color:#4e5f79}.lex-share-actions{display:flex;flex-wrap:wrap;gap:9px}.lex-share-actions a{display:inline-block;text-decoration:none;padding:10px 14px;border-radius:9px;background:white;border:1px solid #c2d0e7;font-weight:650;font-size:14px} .lex-copy{width:auto!important;display:inline-block!important;font-size:14px!important;padding:10px 14px!important;background:#fff!important;color:#2050ac!important;border:1px solid #c2d0e7!important} footer{border-top:1px solid #d6deea;margin:35px 0 15px;padding-top:18px;font-size:13px;color:#667184}summary{cursor:pointer}.filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-item{border-bottom:1px solid #e5eaf2;padding:13px 0}.admin-item dt{font-weight:700;font-size:13px}.admin-item dd{margin:0 0 8px;overflow-wrap:anywhere}</style>'+
 '</head><body>'+heading+status+'<main>'+body+'</main><footer><a href="/store">Бесплатные документы Лекса</a> · <a href="/store/privacy">Политика персональных данных</a><p>ПРАВО4U — информационный сервис. Охранное реагирование не выполняется.</p></footer><script defer src="/security/share.js"></script></body></html>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
}
export const SECURITY_CLIENT_JS=String.raw`
(function(){
"use strict";
const form=document.getElementById("security-form");if(!form)return;
const sel=document.getElementById("city-choice"),other=document.getElementById("other-city"),otherBox=document.getElementById("other-city-box");
const penza=document.getElementById("penza-card"),different=document.getElementById("other-card");
const district=document.getElementById("district-box"),family=document.getElementById("family-box");
const types=document.getElementById("object-type"),msg=document.getElementById("security-message");
const source=new URLSearchParams(location.search).get("source")||"DIRECT";
function choice(){
 const p=sel.value==="penza",o=sel.value==="other";
 penza.classList.toggle("hidden",!p);different.classList.toggle("hidden",!o);
 form.classList.toggle("hidden",!p&&!o);
 otherBox.classList.toggle("hidden",!o);other.required=o;
 district.classList.toggle("hidden",!p);document.getElementById("district-or-address").required=p;
 family.classList.toggle("hidden",!p);document.getElementById("family-members").required=p;
 types.innerHTML="";
 for(const opt of [["","Выберите тип объекта"],["APARTMENT","Квартира"],["HOUSE","Частный дом"],...(o?[["BUSINESS","Бизнес"]]:[])]){
  const e=document.createElement("option");e.value=opt[0];e.textContent=opt[1];types.appendChild(e);
 }
 msg.textContent="";
}
sel.addEventListener("change",choice);choice();
form.addEventListener("submit",async function(e){
 e.preventDefault();msg.textContent="";
 if(!sel.value||!form.reportValidity())return;
 const btn=document.getElementById("send-lead");
 btn.disabled=true;btn.textContent="Отправляем…";
 const p=sel.value==="penza";
 const data={
  source:["LEX","MAX","TELEGRAM","DIRECT","PARTNER","OTHER"].includes(source)?source:"DIRECT",
  city:p?"Пенза":other.value.trim(),
  district_or_address:p?document.getElementById("district-or-address").value.trim():"",
  object_type:types.value,
  family_members:p?Number(document.getElementById("family-members").value):null,
  name:document.getElementById("name").value.trim(),
  phone:document.getElementById("phone").value.trim(),
  comment:document.getElementById("comment").value.trim(),
  referral_source:/^A[A-Za-z0-9]{10,40}$/.test(ref)?ref:null,
  website:document.getElementById("website").value,
  consent:document.getElementById("security-consent").checked,
  consent_version:"security-leads-2026-11-05-v1"
 };
 try{
  const response=await fetch("/security/api/leads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(data),credentials:"omit",cache:"no-store"});
  const saved=await response.json();
  if(!response.ok||saved.ok!==true||!saved.lead_id)throw Error("Сервис пока не может зарегистрировать заявку. Данные не сохранены — повторите позже.");
  form.replaceWith(document.createElement("div"));
  const done=document.getElementById("security-success");
  done.classList.remove("hidden");
  done.querySelector("h2").textContent="Предварительная заявка зарегистрирована";
  done.querySelector(".confirmation").textContent=p
   ?"Оплата сейчас не требуется. Это предварительная регистрация и ещё не означает постановку объекта под охрану. После запуска услуги в вашем районе мы свяжемся с вами и предложим окончательные условия подключения."
   :"Заявка зарегистрирована. Мы проверим доступных партнёров в вашем городе.";
  done.querySelector(".receipt").textContent="Номер заявки: "+saved.lead_id;
  done.scrollIntoView({block:"start"});
 }catch(err){msg.textContent=err.message||"Не удалось отправить заявку. Попробуйте позже.";btn.disabled=false;btn.textContent="Оставить предварительную заявку";}
});
})();
`;

export const SECURITY_CATALOG_JS=String.raw`
(async function(){
 try{
  const r=await fetch("/security/api/catalog",{credentials:"omit",cache:"no-store"});
  if(!r.ok)return;
  const data=await r.json();
  if(!data.ok||!Array.isArray(data.products))return;
  for(const p of data.products){
   if(!["PRAID_500","PRAID_BUSINESS"].includes(p.product_id))continue;
   if(!Number.isInteger(p.base_price_kopecks)||p.base_price_kopecks<0)continue;
   const el=document.querySelector('[data-price-for="'+p.product_id+'"]');
   if(el)el.textContent="Предварительная цена — "+(p.base_price_kopecks/100).toLocaleString("ru-RU")+" ₽/мес.";
  }
 }catch{}
})();
`;
export const SECURITY_AGENT_JS=String.raw`
(function(){
 const form=document.getElementById("security-agent-form"),message=document.getElementById("agent-message");
 if(!form)return;
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const btn=form.querySelector('button[type="submit"]');
  btn.disabled=true;message.textContent="Проверяем заявку…";
  const field=k=>form.elements.namedItem(k).value.trim();
  const payload={name:field("name"),phone:field("phone"),email:field("email"),city:field("city"),
   legal_status:field("legal_status"),comment:field("comment"),
   website:field("website"),consent:form.elements.namedItem("consent").checked,
   consent_version:"security-agent-2026-11-05-v1"};
  try{
   const r=await fetch("/security/api/agents",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),credentials:"omit",cache:"no-store"});
   const d=await r.json();
   if(!r.ok||!d.ok||d.status!=="PENDING")throw Error("Заявка не зарегистрирована.");
   form.replaceWith(document.createElement("div"));
   message.textContent="Заявка принята на проверку. Статус PENDING. Ссылка и кабинет появятся только после одобрения.";
  }catch{message.textContent="Приём заявок партнёров пока недоступен. Данные не подтверждены как сохранённые.";btn.disabled=false;}
 });
})();
`;

export const SECURITY_NETWORK_ADMIN_JS=String.raw`
(function(){
"use strict";
const form=document.getElementById("network-filter"),box=document.getElementById("network-results");
const summary=document.getElementById("network-summary"),token=document.getElementById("admin-token");
if(!form||!box||!token)return;
const baseHeaders=()=>({"Authorization":"Bearer "+token.value.trim()});
async function read(event){
 event.preventDefault();box.replaceChildren();summary.textContent="Загрузка…";
 if(!token.value.trim()){summary.textContent="Введите ключ администратора.";return;}
 const params=new URLSearchParams();
 for(const k of ["entity","city","agent_id","status"]){const v=form.elements.namedItem(k).value.trim();if(v)params.set(k,v);}
 try{
  const auth=baseHeaders();
  const [r,totals]=await Promise.all([
   fetch("/security/api/admin/network?"+params,{headers:auth,cache:"no-store",credentials:"omit"}),
   fetch("/security/api/admin/summary",{headers:auth,cache:"no-store",credentials:"omit"})
  ]);
  if(!r.ok||!totals.ok)throw Error("Нет доступа или база недоступна");
  const data=await r.json(),stats=await totals.json();
  if(!data.ok||!Array.isArray(data.items)||!stats.ok)throw Error("Неверный ответ сервера");
  summary.textContent="Выбрано: "+params.get("entity")+", записей: "+data.items.length+" (до 50). "+
   "MRR: "+((stats.summary.mrr_kopecks||0)/100).toLocaleString("ru-RU")+" ₽. "+
   "Активных клиентов: "+(stats.summary.active_clients||0)+". "+
   "Новых заявок: "+(stats.summary.new_applications||0)+". "+
   "Ожидают проверки: "+(stats.summary.agents_pending||0)+".";
  if(data.items.length===0)box.textContent="Записей пока нет.";
  for(const item of data.items){
   const wrap=document.createElement("div");wrap.className="admin-item";
   const pre=document.createElement("pre");pre.style.cssText="white-space:pre-wrap;word-break:break-word;font-size:12px";
   pre.textContent=JSON.stringify(item,null,2);wrap.append(pre);
   if(params.get("entity")==="AGENTS"&&item.status==="PENDING"){
    const b=document.createElement("button");b.type="button";b.textContent="Активировать после проверки договора";
    b.addEventListener("click",async()=>{
     const reason=prompt("Основание активации агента (не менее 5 символов)");
     if(!reason||reason.trim().length<5)return;
     b.disabled=true;
     try{
      const a=await fetch("/security/api/admin/agents/activate",{method:"POST",
       headers:{...baseHeaders(),"Content-Type":"application/json"},
       body:JSON.stringify({agent_id:item.agent_id,reason:reason.trim()}),cache:"no-store",credentials:"omit"});
      const j=await a.json();
      if(!a.ok||!j.ok)throw Error("активация отклонена");
      b.textContent="ACTIVE — обновите реестр";
     }catch{b.textContent="Ошибка активации";b.disabled=false;}
    });
    wrap.append(b);
   }
   box.append(wrap);
  }
 }catch{summary.textContent="Доступ отклонён либо российская база пока не подключена.";}
}
form.addEventListener("submit",read);

const pricing=document.getElementById("pricing-form"),pricingState=document.getElementById("pricing-status");
if(pricing){
 const prices=["PRAID_500_PRICE","PRAID_BUSINESS_PRICE"];
 const percent=["MANAGER_PERCENT_YEAR1","AGENT_PERCENT_YEAR1","SECURITY_PROVIDER_PERCENT_YEAR1",
 "MANAGER_PERCENT_YEAR2_PLUS","AGENT_PERCENT_YEAR2_PLUS","SECURITY_PROVIDER_PERCENT_YEAR2_PLUS"];
 const get=()=>({"Authorization":"Bearer "+token.value.trim()});
 async function loadPrices(){
  if(!token.value.trim()){pricingState.textContent="Введите ключ администратора";return;}
  try{
   const r=await fetch("/security/api/admin/settings",{headers:get(),cache:"no-store",credentials:"omit"});
   const d=await r.json();if(!r.ok||!d.ok)throw Error();
   for(const name of [...prices,...percent]){
    const field=pricing.elements.namedItem(name);field.value=Number(d.settings[name])/100;
   }
   pricing.elements.namedItem("COMMISSION_BASE").value=d.settings.COMMISSION_BASE;
   pricingState.textContent="Настройки загружены. Боевые платежи, выплаты и SOS выключены.";
  }catch{pricingState.textContent="Не удалось получить настройки."; }
 }
 pricing.querySelector('[data-action="load"]').addEventListener("click",loadPrices);
 pricing.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!token.value.trim()||!pricing.reportValidity())return;
  const updates={};
  for(const name of [...prices,...percent]){
   const n=Number(pricing.elements.namedItem(name).value);
   if(!Number.isFinite(n)||n<0||!Number.isInteger(Math.round(n*100)))return;
   updates[name]=String(Math.round(n*100));
  }
  updates.COMMISSION_BASE=pricing.elements.namedItem("COMMISSION_BASE").value;
  for(const period of ["YEAR1","YEAR2_PLUS"]){
   if(["MANAGER","AGENT","SECURITY_PROVIDER"].reduce((sum,k)=>sum+Number(updates[k+"_PERCENT_"+period]),0)!==10000){
    pricingState.textContent="Проценты за период должны составлять ровно 100%.";return;
   }
  }
  const reason=pricing.elements.namedItem("reason").value.trim();
  if(reason.length<5){pricingState.textContent="Укажите основание изменения.";return;}
  try{
   const r=await fetch("/security/api/admin/settings",{method:"POST",headers:{...get(),"Content-Type":"application/json"},
    body:JSON.stringify({updates,reason}),credentials:"omit",cache:"no-store"});
   const d=await r.json();if(!r.ok||!d.ok)throw Error();
   pricingState.textContent="Настройки сохранены с записью в журнал аудита.";
  }catch{pricingState.textContent="Сохранение отклонено; настройки не подтверждены."; }
 });
}

})();
`;

export const SECURITY_ADMIN_JS=String.raw`
(function(){
"use strict";
const form=document.getElementById("admin-filter"),box=document.getElementById("admin-results"),state=document.getElementById("admin-status");
const token=document.getElementById("admin-token");if(!form)return;
const labels=["lead_id","created_at","source","city","district_or_address","object_type","family_members","name","phone","comment","product","partner","referral_source","status"];
async function load(e){
 e.preventDefault();box.replaceChildren();state.textContent="Загружаем…";
 const values=new FormData(form),q=new URLSearchParams();
 for(const key of ["city","status","product","date"]){if(values.get(key))q.set(key,values.get(key));}
 try{
  const response=await fetch("/security/api/admin/leads?"+q,{headers:{"Authorization":"Bearer "+token.value.trim()},cache:"no-store",credentials:"omit"});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error("Нет доступа или база заявок пока не подключена.");
  state.textContent="Найдено заявок: "+data.leads.length+" (первые 50).";
  for(const row of data.leads){
   const item=document.createElement("article");item.className="admin-item";
   const dl=document.createElement("dl");
   for(const key of labels){
    const dt=document.createElement("dt");dt.textContent=key;
    const dd=document.createElement("dd");dd.textContent=String(row[key]??"—");
    dl.append(dt,dd);
   }
   item.appendChild(dl);box.appendChild(item);
  }
 }catch(err){state.textContent=err.message;}
}
form.addEventListener("submit",load);
})();
`;
const srcLink=(path,source)=>path+qSource(source);
export function securityPage(url,env){
 const ready=securityReady(env),path=url.pathname;
 const referralCode=/^A[A-Za-z0-9]{10,40}$/.test(url.searchParams.get("ref")||"")?url.searchParams.get("ref"):null;
 const source=referralCode?"PARTNER":sourceFrom(url);
 const shareOpts=referralCode?{referralCode}:{};
 const route=(p)=>p+"?source="+encodeURIComponent(source)+(referralCode?"&ref="+encodeURIComponent(referralCode):"");
 if(path==="/security"){
  const html=banner+
   card("Защитить квартиру / дом","<p>Узнайте о предварительном наборе на защиту квартиры или дома — в Пензе и других городах.</p>",button(route("/security/home"),"Защитить квартиру / дом"))+
   card("Безопасность бизнеса","<p>Пока готовим отдельное решение. Заявки на него не принимаем.</p>",button(route("/security/business"),"ПРАЙД Бизнес"))+
   card("Камеры и датчики","<p>Оборудование и дополнительная защита — отдельно от базовой подписки.</p>",button(route("/security/cameras"),"Камеры и датчики"))+
   card("Страхование","<p>Уже существующий раздел страхования ПРАВО4U, без изменений.</p>",button("/store/partners","Перейти к страхованию"))+
   card("Что делать при ЧП","<p>Короткая инструкция на случай угрозы жизни, пожара или происшествия.</p>",button(route("/security/emergency"),"Открыть инструкцию"))+
   card("Стать партнёром / зарабатывать на подключениях","<p>Подать заявку в агентскую сеть. Активация — только после проверки.</p>",button(route("/security/agent"),"Зарабатывать на подключениях"))+
   shareHtml("security",shareOpts);
  return layout("Безопасность",html,ready);
 }
 if(path==="/security/business")return layout("ПРАЙД Бизнес",banner+
 card("ПРАЙД Бизнес · предварительная заявка",
 '<span class="pill">Пенза · PRELAUNCH</span><p class="price" data-price-for="PRAID_BUSINESS">Ориентир — 790 ₽/мес.</p>'+
 '<p>Планируемое решение для ПВЗ, магазинов, офисов, салонов, аптек, кафе и складов. Возможность реагирования по адресу определяется ПРАЙД до подключения.</p>'+
 '<p>Будущая схема: кнопка сотрудника → ПРАЙД → реагирование по зарегистрированному договором адресу. Пока услуга не активна, кнопки нет и оплаты нет.</p>'+
 '<p class="muted">Камеры, датчики, сигнализация, монтаж, физическая КТС и дополнительные пользователи не входят автоматически в базовую цену.</p>'+
 '<p class="pending">Подача бизнес-заявок откроется после проверки российской БД, отдельного подтверждения телефона и согласования условий ПРАЙД.</p>',
 button(route("/security/cameras"),"Камеры и датчики"))+
 shareHtml("pride_business",shareOpts)+'<script defer src="/security/catalog.js"></script>',ready);
 if(path==="/security/emergency")return layout("Что делать при ЧП",card("Если есть непосредственная угроза жизни","<ol class='list'><li>По возможности перейдите в безопасное место, не подвергая себя дополнительному риску.</li><li>Позвоните по номеру <strong>112</strong> и сообщите адрес, что произошло, есть ли пострадавшие.</li><li>Следуйте указаниям экстренных служб. При необходимости предупредите близких.</li></ol><p><strong>Лекс не направляет ГБР и не заменяет службы 112.</strong></p>",button("tel:112","Позвонить 112"))+shareHtml("emergency"),ready);
 if(path==="/security/cameras")return layout("Камеры и датчики",banner+
   card("Камеры и датчики","<p>Охранная сигнализация, камеры, датчики, монтаж, видеонаблюдение и физическая КТС — отдельные услуги с отдельной ценой, договором и условиями.</p><p>Оборудование не входит в ПРАЙД 500 или ПРАЙД Бизнес автоматически. Подбор и установка пока не активированы.</p>",button(route("/security"),"Вернуться к безопасности"))+
   shareHtml("cameras",shareOpts),ready);
 if(path==="/security/agent"){
  const body=card("Зарабатывать на подключениях",
  '<p>Агентская сеть в подготовке. Предварительная модель: 20% от расчётной базы за первые 12 фактически оплаченных месяцев и 5% начиная с 13-го. Ставки и основания выплат оформляются отдельным договором.</p>'+
  '<p>Не обещаем доход и не активируем агентскую ссылку до проверки заявки.</p>')+
  '<form id="security-agent-form" class="card form-grid" novalidate><h2>Стать партнёром</h2>'+
  '<label>Имя<input name="name" minlength="2" maxlength="90" required></label>'+
  '<label>Телефон<input name="phone" type="tel" required placeholder="+7 900 000-00-00"></label>'+
  '<label>Email<input name="email" type="email" maxlength="180"></label>'+
  '<label>Город<input name="city" maxlength="80" required placeholder="Пенза"></label>'+
  '<label>Статус<select name="legal_status" required><option value="">Выберите</option><option value="SELF_EMPLOYED">Самозанятый</option><option value="IP">ИП</option><option value="PERSON">Физическое лицо</option></select></label>'+
  '<label>Комментарий<textarea name="comment" maxlength="400" rows="2"></textarea></label>'+
  '<div class="hidden" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>'+
  '<div class="consent"><input id="agent-consent" name="consent" type="checkbox" required><label for="agent-consent">Согласен на обработку данных исключительно для рассмотрения заявки партнёра. <a href="/security/consent" target="_blank" rel="noopener noreferrer">Условия</a></label></div>'+
  '<button type="submit" '+(ready?"":"disabled")+'>Подать заявку</button>'+
  (ready?"":"<p class='pending'>Приём персональных заявок заблокирован до запуска российского хранилища и подтверждения оператора данных.</p>")+
  '</form><p id="agent-message" role="status"></p><script defer src="/security/agent.js"></script>'+
  shareHtml("agent",shareOpts);
  return layout("Стать агентом",body,ready);
 }
 if(path==="/security/agent/dashboard")return layout("Кабинет агента",banner+
  card("Кабинет агента","<p>Доступ к заявкам и начислениям появится только после активации агента и внедрения подтверждённой авторизации. Никому не показываем данные по одному лишь agent_id в адресной строке.</p>"),ready);
 if(path==="/security/consent"){
  const operator=ready?safe(env.SECURITY_PD_OPERATOR_NAME):"не определён — сбор заявок отключён";
  const contact=ready?safe(env.SECURITY_PD_OPERATOR_CONTACT):"lexpravo4u@gmail.com";
  return layout("Согласие на обработку данных",card("Согласие на предварительную заявку или на рассмотрение кандидатуры агента",
   "<p><strong>Оператор:</strong> "+operator+"</p><p><strong>Контакт:</strong> "+contact+"</p>"+
   "<p><strong>Цель:</strong> регистрация предварительного интереса к услуге безопасности или рассмотрение заявления кандидата в агенты; контакт по соответствующему запросу. Это не согласие на рекламу.</p>"+
   "<p><strong>Данные:</strong> имя, телефон, город, email (только агент), статус самозанятого/ИП/физлица (только агент), район/адрес и тип объекта (только клиент), комментарий, сведения о заявке и согласии.</p>"+
   "<p><strong>Операции:</strong> сбор, запись, хранение в российской базе, использование для ответа по заявке, уточнение, удаление по обращению. Автоматической передачи заявки сторонним ЧОО не предусмотрено. При отдельном согласовании передачи потребуется отдельное основание и уведомление.</p>"+
   "<p>Согласие можно отозвать, направив запрос на <a href='mailto:lexpravo4u@gmail.com'>lexpravo4u@gmail.com</a>. Обработка прекращается в установленном законом порядке, если нет другого законного основания её продолжать.</p>"+
   "<p><a href='/store/privacy'>Действующая политика Лекса</a></p>"),ready);
 }
 if(path==="/security/home"){
 const html=banner+
 '<section class="card"><h2>Защитить квартиру или дом</h2><label for="city-choice">В каком городе находится объект?</label><select id="city-choice"><option value="">Выберите город</option><option value="penza">Пенза</option><option value="other">Другой город</option></select></section>'+
 '<section id="penza-card" class="card hidden"><span class="pill">Предварительный набор · Пенза</span><h2>ПРАЙД 500</h2><h3>Экстренная защита семьи дома</h3><p class="price" data-price-for="PRAID_500">Базовая цена после согласования — 500 ₽/мес.</p><p>Без обязательной покупки дорогой сигнализации.</p><p>Планируется тревожная кнопка для вызова группы быстрого реагирования на зарегистрированный адрес.</p><p><strong>Сейчас формируем первую группу подключения в Пензе.</strong></p><p>Предварительная заявка бесплатна.</p><p class="muted">Услуга ещё не запущена. Договор охраны не заключается, реальное реагирование не выполняется.</p></section>'+
 '<section id="other-card" class="card hidden"><h2>Подберём вариант охраны в вашем городе</h2><p>Уточним, какие профессиональные охранные организации работают в вашем городе. Сейчас только собираем предварительные обращения — не подключаем охрану и не передаём данные партнёрам.</p></section>'+
 '<form id="security-form" class="card form-grid hidden" novalidate><h2>Оставить предварительную заявку</h2>'+
 '<div id="other-city-box" class="hidden"><label for="other-city">Город<input id="other-city" name="city" maxlength="80" placeholder="Например: Самара"></label></div>'+
 '<label for="name">Ваше имя<input id="name" name="name" autocomplete="given-name" minlength="2" maxlength="90" placeholder="Как к вам обращаться" required></label>'+
 '<label for="phone">Номер телефона<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 900 000-00-00" required></label>'+
 '<div id="district-box"><label for="district-or-address">Район или адрес объекта<input id="district-or-address" name="district" maxlength="140" placeholder="Достаточно района, например: Арбеково"></label><p class="hint">Точный адрес сейчас необязателен — не указывайте квартиру и код подъезда.</p></div>'+
 '<label for="object-type">Тип объекта<select id="object-type" name="object_type" required></select></label>'+
 '<div id="family-box"><label for="family-members">Сколько человек в семье?<input id="family-members" type="number" min="1" max="30" step="1" placeholder="Например: 3"></label></div>'+
 '<label for="comment">Комментарий (необязательно)<textarea id="comment" maxlength="400" rows="2" placeholder="Например: нужен вариант для загородного дома"></textarea></label>'+
 '<div class="hidden" aria-hidden="true"><label for="website">Не заполнять<input id="website" name="website" tabindex="-1" autocomplete="off"></label></div>'+
 '<div class="consent"><input id="security-consent" name="consent" type="checkbox" required><label for="security-consent">Даю отдельное согласие на обработку указанных данных для рассмотрения предварительной заявки. <a target="_blank" rel="noopener noreferrer" href="/security/consent">Текст согласия</a> · <a target="_blank" rel="noopener noreferrer" href="/store/privacy">Политика Лекса</a>.</label></div>'+
 '<button id="send-lead" type="submit" '+(ready?"":"disabled")+'>Оставить предварительную заявку</button>'+
 (ready?"":"<p class='pending'>Заявки пока не принимаются. Мы проверяем хранение данных в РФ и сведения об операторе. Заполненные данные не отправляйте.</p>")+
 '<p id="security-message" class="error" role="alert" aria-live="polite"></p></form>'+
 '<section id="security-success" class="card hidden" aria-live="polite"><h2></h2><p class="confirmation"></p><p class="receipt muted"></p><a href="/security" class="button secondary">Вернуться к разделу</a></section>'+
 '<script defer src="/security/app.js"></script>';
 return layout("Предварительная заявка на безопасность",html+shareHtml("pride_500",shareOpts)+'<script defer src="/security/catalog.js"></script>',ready);
 }
 if(path==="/security/admin"){
  const status=ready?"":"<p class='pending'>Российское хранилище и проверенная авторизация ещё не настроены. Просмотр реальных заявок закрыт.</p>";
  const select=(name,key,options)=>'<label>'+name+'<select name="'+key+'"><option value="">Все</option>'+options.map(o=>'<option value="'+safe(o)+'">'+safe(o)+'</option>').join("")+'</select></label>';
  const body=card("Администратор · предварительные заявки",status+
  '<form id="admin-filter"><label>Ключ администратора<input id="admin-token" type="password" autocomplete="off" placeholder="Секретный ключ, не публикуется" required></label><div class="filters">'+
  '<label>Город<input name="city" maxlength="80" placeholder="Например: Пенза"></label>'+
  select("Статус","status",LEAD_STATUSES)+select("Продукт","product",LEAD_PRODUCTS)+
  '<label>Дата<input type="date" name="date"></label></div><button type="submit">Показать заявки</button></form><p id="admin-status" role="status"></p><div id="admin-results"></div>');
  const entities=["CLIENTS","AGENTS","OBJECTS","PAYMENTS","ACCRUALS","PAYOUTS","PRODUCTS","CITIES","PARTNERS"];
  const network=card("Коммерческая сеть · администратор",
    '<p class="muted">Только чтение, кроме отдельной подтверждённой активации агента. Автоплатежи, выплаты и SOS заблокированы.</p>'+
    '<form id="network-filter" class="form-grid">'+
    '<label>Раздел<select name="entity">'+entities.map(e=>'<option value="'+e+'">'+e+'</option>').join("")+'</select></label>'+
    '<label>Город<input name="city" maxlength="80"></label>'+
    '<label>Агент ID<input name="agent_id" maxlength="80"></label>'+
    '<label>Статус<input name="status" maxlength="30"></label>'+
    '<button type="submit">Показать реестр и показатели</button></form>'+
    '<p id="network-summary" role="status"></p><div id="network-results"></div>');
  const fields=[
   ["PRAID_500_PRICE","ПРАЙД 500 · ₽",500],["PRAID_BUSINESS_PRICE","ПРАЙД Бизнес · ₽",790],
   ["MANAGER_PERCENT_YEAR1","Руководитель · месяцы 1–12 · %",20],
   ["AGENT_PERCENT_YEAR1","Агент · месяцы 1–12 · %",20],
   ["SECURITY_PROVIDER_PERCENT_YEAR1","ЧОО · месяцы 1–12 · %",60],
   ["MANAGER_PERCENT_YEAR2_PLUS","Руководитель · месяц 13+ · %",20],
   ["AGENT_PERCENT_YEAR2_PLUS","Агент · месяц 13+ · %",5],
   ["SECURITY_PROVIDER_PERCENT_YEAR2_PLUS","ЧОО · месяц 13+ · %",75]
  ];
  const config=card("Параметры расчётов",
   '<p class="muted">Цены и доли меняются через российскую базу, без правки кода. Проценты в сумме должны равняться 100%.</p>'+
   '<form id="pricing-form" class="form-grid">'+
   fields.map(([key,label,value])=>'<label>'+label+'<input type="number" name="'+key+'" min="0" step="0.01" value="'+value+'" required></label>').join("")+
   '<label>База начислений<select name="COMMISSION_BASE"><option value="NET_RECEIVED">После банковской комиссии и возвратов</option><option value="GROSS_PAYMENT">До вычета банковской комиссии</option></select></label>'+
   '<label>Причина изменения<input name="reason" maxlength="400" minlength="5" placeholder="Например: протокол согласования ПРАЙД" required></label>'+
   '<button type="button" data-action="load">Загрузить действующие настройки</button>'+
   '<button type="submit">Сохранить настройки с аудитом</button></form><p id="pricing-status" role="status"></p>');
  return layout("Административный просмотр заявок",body+network+config+'<script defer src="/security/admin.js"></script><script defer src="/security/network-admin.js"></script>',ready);
 }
 return null;
}
