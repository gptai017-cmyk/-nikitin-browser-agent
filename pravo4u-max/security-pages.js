import {securityReady,SECURITY_CONSENT_VERSION,LEAD_SOURCES,LEAD_STATUSES,LEAD_PRODUCTS} from "./security-leads.js";
import {shareHtml} from "./section-sharing.js";
const safe=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const sourceFrom=url=>LEAD_SOURCES.includes(url.searchParams.get("source"))?url.searchParams.get("source"):"DIRECT";
const qSource=source=>"?source="+encodeURIComponent(source);
const card=(heading,body,cta="")=>'<section class="card"><h2>'+heading+'</h2>'+body+cta+'</section>';
const button=(href,label)=>'<a class="button" href="'+href+'">'+label+'</a>';
const banner='<p class="warning"><strong>Внимание.</strong> Это не действующая услуга охраны. Кнопки тревоги нет, вызов ГБР не осуществляется. При непосредственной опасности звоните <a href="tel:112">112</a>.</p>';
const heading='<header><p class="brand"><a href="/store">Лекс | ПРАВО4U</a></p><h1>Безопасность</h1><p class="lead">Семья, дом и бизнес</p></header>';
function layout(title,body,ready,connectOrigin=""){
 const status=ready?'':'<p class="pending">Приём персональных заявок пока не открыт: проверяется российское хранение данных и документы оператора. Информационные страницы доступны.</p>';
 const connect=connectOrigin?" "+connectOrigin:"";
 return new Response('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>'+safe(title)+' | Лекс</title>'+
 '<style>:root{color-scheme:light}*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Arial,sans-serif;line-height:1.5;max-width:660px;padding:20px 16px;margin:auto;color:#1d293d;background:#f9fafc}h1{font-size:27px;line-height:1.2;margin:8px 0}h2{font-size:19px;margin:4px 0 10px}h3{font-size:16px}.brand{font-size:14px;font-weight:700}.brand a{color:#2254b5}.lead{font-size:18px;color:#495e7d}.card{background:white;border:1px solid #d8e0ed;border-radius:15px;padding:18px;margin:16px 0}.card p{margin:8px 0}.button,button{display:block;text-align:center;appearance:none;border:0;width:100%;background:#2659c4;color:white;border-radius:12px;padding:15px 16px;font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}.button.secondary{background:#edf3ff;color:#244a9d}.button[aria-disabled="true"],button:disabled{opacity:.6;cursor:not-allowed}.muted{color:#516078;font-size:14px}.warning,.pending{background:#fff4e7;border:1px solid #f3d2a9;border-radius:12px;padding:13px;font-size:14px}.pending{background:#fff9eb}.price{font-weight:700;font-size:17px;color:#1c4293}.form-grid{display:grid;gap:13px}label{display:block;font-weight:650;font-size:14px}input,select,textarea{display:block;width:100%;padding:12px;border-radius:9px;border:1px solid #afbed4;min-height:45px;font:inherit;margin-top:5px;background:#fff;color:#1d293d}textarea{min-height:65px}input[type=checkbox]{width:22px;height:22px;min-height:22px;flex:none;margin:0}.consent{display:flex;align-items:flex-start;gap:10px;background:#f1f5fc;border-radius:10px;padding:13px;font-size:14px}.consent label{font-weight:400;font-size:14px}.hint{font-size:13px;color:#556b84;margin-top:4px}.hidden{display:none!important}.error{color:#b02636;font-size:14px}a{color:#2050ac}.pill{display:inline-block;background:#f1f4fa;border-radius:14px;font-size:13px;padding:5px 10px}.list{padding-left:21px}.list li{margin:8px 0} .lex-share{background:#edf4ff;border:1px solid #c7d8f3;border-radius:12px;padding:14px;margin:16px 0}.lex-share summary{font-weight:750;color:#244e9b}.lex-share-hint{font-size:14px;color:#4e5f79}.lex-share-actions{display:flex;flex-wrap:wrap;gap:9px}.lex-share-actions a{display:inline-block;text-decoration:none;padding:10px 14px;border-radius:9px;background:white;border:1px solid #c2d0e7;font-weight:650;font-size:14px}footer{border-top:1px solid #d6deea;margin:35px 0 15px;padding-top:18px;font-size:13px;color:#667184}summary{cursor:pointer}.filters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.admin-item{border-bottom:1px solid #e5eaf2;padding:13px 0}.admin-item dt{font-weight:700;font-size:13px}.admin-item dd{margin:0 0 8px;overflow-wrap:anywhere}</style>'+
 '</head><body>'+heading+status+'<main>'+body+'</main><footer><a href="/store">Бесплатные документы Лекса</a> · <a href="/store/privacy">Политика персональных данных</a><p>ПРАВО4U — информационный сервис. Охранное реагирование не выполняется.</p></footer></body></html>',{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; connect-src 'self'"+connect+"; form-action 'none'; base-uri 'none'; frame-ancestors 'none'","referrer-policy":"no-referrer","x-content-type-options":"nosniff"}});
}
export const SECURITY_CLIENT_JS=String.raw`
(function(){
"use strict";
const form=document.getElementById("security-form");if(!form)return;
const params=new URLSearchParams(location.search);
const sel=document.getElementById("city-choice"),other=document.getElementById("other-city"),otherBox=document.getElementById("other-city-box");
const penza=document.getElementById("penza-card"),penzaBusiness=document.getElementById("penza-business-card"),different=document.getElementById("other-card");
const district=document.getElementById("district-box"),family=document.getElementById("family-box");
const types=document.getElementById("object-type"),msg=document.getElementById("security-message");
const source=params.get("source")||"DIRECT",referral=params.get("ref")||"",businessMode=params.get("mode")==="business";
function syncFields(){
 const p=sel.value==="penza",business=types.value==="BUSINESS";
 family.classList.toggle("hidden",!p||business);
 document.getElementById("family-members").required=p&&!business;
}
function choice(){
 const p=sel.value==="penza",o=sel.value==="other";
 penza.classList.toggle("hidden",!p||businessMode);
 if(penzaBusiness)penzaBusiness.classList.toggle("hidden",!p||!businessMode);
 different.classList.toggle("hidden",!o);
 form.classList.toggle("hidden",!p&&!o);
 otherBox.classList.toggle("hidden",!o);other.required=o;
 district.classList.toggle("hidden",!p);document.getElementById("district-or-address").required=p;
 types.innerHTML="";
 const opts=businessMode
  ?[["","Выберите тип объекта"],["BUSINESS","Бизнес"]]
  :[["","Выберите тип объекта"],["APARTMENT","Квартира"],["HOUSE","Частный дом"],...(o?[["BUSINESS","Бизнес"]]:[])];
 for(const opt of opts){const e=document.createElement("option");e.value=opt[0];e.textContent=opt[1];types.appendChild(e);}
 if(businessMode)types.value="BUSINESS";
 syncFields();msg.textContent="";
}
sel.addEventListener("change",choice);types.addEventListener("change",syncFields);
if(businessMode)sel.value="penza";choice();
form.addEventListener("submit",async function(e){
 e.preventDefault();msg.textContent="";
 if(!sel.value||!form.reportValidity())return;
 const btn=document.getElementById("send-lead");
 btn.disabled=true;btn.textContent="Отправляем…";
 const p=sel.value==="penza",business=types.value==="BUSINESS";
 const data={
  source:["LEX","MAX","TELEGRAM","DIRECT","PARTNER","OTHER"].includes(source)?source:"DIRECT",
  city:p?"Пенза":other.value.trim(),
  district_or_address:p?document.getElementById("district-or-address").value.trim():"",
  object_type:types.value,
  family_members:p&&!business?Number(document.getElementById("family-members").value):null,
  name:document.getElementById("name").value.trim(),
  phone:document.getElementById("phone").value.trim(),
  comment:document.getElementById("comment").value.trim(),
  referral_code:referral,
  referral_source:referral?"AGENT_LINK":null,
  website:document.getElementById("website").value,
  consent:document.getElementById("security-consent").checked,
  consent_version:"security-leads-2026-11-05-v2"
 };
 try{
  const gateResponse=await fetch("/security/api/intake-token",{method:"POST",credentials:"omit",cache:"no-store"});
  const gate=await gateResponse.json();
  if(!gateResponse.ok||gate.ok!==true||!gate.token||!gate.endpoint)throw Error("Приём заявок временно недоступен.");
  const response=await fetch(gate.endpoint,{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",
   headers:{"content-type":"application/json","x-lex-intake-token":gate.token},body:JSON.stringify(data)});
  const saved=await response.json();
  if(!response.ok||saved.stored!==true||!saved.lead_id)throw Error("Сервис пока не может зарегистрировать заявку. Данные не сохранены — повторите позже.");
  form.replaceWith(document.createElement("div"));
  const done=document.getElementById("security-success");
  done.classList.remove("hidden");
  done.querySelector("h2").textContent="Предварительная заявка зарегистрирована";
  done.querySelector(".confirmation").textContent=p
   ?"Оплата сейчас не требуется. Это предварительная регистрация и ещё не означает постановку объекта под охрану. После запуска услуги мы предложим окончательные условия подключения."
   :"Заявка зарегистрирована. Мы проверим доступных партнёров в вашем городе.";
  done.querySelector(".receipt").textContent="Номер заявки: "+saved.lead_id;
  done.scrollIntoView({block:"start"});
 }catch(err){msg.textContent=err.message||"Не удалось отправить заявку. Попробуйте позже.";btn.disabled=false;btn.textContent="Оставить предварительную заявку";}
});
})();
`;
export const SECURITY_ADMIN_JS=String.raw`
(function(){
"use strict";
const form=document.getElementById("admin-filter"),box=document.getElementById("admin-results"),state=document.getElementById("admin-status");
const token=document.getElementById("admin-token");if(!form)return;
const labels=["lead_id","created_at","source","city","district_or_address","object_type","family_members","name","phone","comment","product","partner","agent_id","agent_referral_code","referral_source","status"];
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
const refFrom=url=>/^[A-Z0-9][A-Z0-9_-]{2,63}$/i.test(url.searchParams.get("ref")||"")?url.searchParams.get("ref").toUpperCase():"";
const srcLink=(path,source,ref="",extra={})=>{const q=new URLSearchParams({source});if(ref)q.set("ref",ref);for(const [k,v] of Object.entries(extra))if(v!=null)q.set(k,String(v));return path+"?"+q.toString();};
export function securityPage(url,env){
 const ready=securityReady(env),source=sourceFrom(url),ref=refFrom(url),path=url.pathname;
 const connectOrigin=ready?new URL(env.SECURITY_RU_PUBLIC_BASE).origin:"";
 if(path==="/security"){
  const html=banner+
   card("Защитить квартиру / дом","<p>Предварительное подключение ПРАЙД 500 в Пензе и подбор партнёров в других городах.</p>",button(srcLink("/security/home",source,ref),"Защитить квартиру / дом"))+
   card("Защитить бизнес","<p>Предварительный набор ПРАЙД Бизнес для ПВЗ, магазинов, офисов, салонов и других объектов.</p>",button(srcLink("/security/business",source,ref),"Защитить бизнес"))+
   card("Камеры и датчики","<p>Дополнительное усиление защиты после запуска: камеры, датчики и охранная сигнализация. Не включаются автоматически в базовую подписку.</p>")+
   card("Страхование","<p>Существующий раздел страхования ПРАВО4U, без изменений.</p>",button("/store/partners","Перейти к страхованию"))+
   card("Что делать при ЧП","<p>Короткая инструкция на случай угрозы жизни, пожара или происшествия.</p>",button("/security/emergency","Открыть инструкцию"))+
   card("Стать партнёром / зарабатывать на подключениях","<p>Агентская сеть готовится к запуску. Клиенты будут закрепляться за подтверждённым агентским кодом, а начисления — считаться только по фактическим оплатам.</p>")+
   shareHtml("security",ref);
  return layout("Безопасность",html,ready,connectOrigin);
 }
 if(path==="/security/business")return layout("ПРАЙД Бизнес",banner+
  card("ПРАЙД Бизнес","<span class='pill'>Предварительный набор · Пенза</span><p class='price'>Планируемый тариф — 790 ₽/мес.</p><p>Для ПВЗ, магазина, офиса, салона, аптеки, кафе, склада и других небольших объектов.</p><p>Базовый сценарий после запуска: тревожная кнопка сотрудника → ПРАЙД → реагирование на зарегистрированный адрес.</p><p class='muted'>Сигнализация, камеры, датчики и физическая КТС — отдельные дополнительные услуги.</p>",button(srcLink("/security/home",source,ref,{mode:"business"}),"Оставить предварительную заявку"))+
  shareHtml("business_security",ref),ready,connectOrigin);
 if(path==="/security/emergency")return layout("Что делать при ЧП",card("Если есть непосредственная угроза жизни","<ol class='list'><li>По возможности перейдите в безопасное место, не подвергая себя дополнительному риску.</li><li>Позвоните по номеру <strong>112</strong> и сообщите адрес, что произошло, есть ли пострадавшие.</li><li>Следуйте указаниям экстренных служб. При необходимости предупредите близких.</li></ol><p><strong>Лекс не направляет ГБР и не заменяет службы 112.</strong></p>",button("tel:112","Позвонить 112")),ready,connectOrigin);
 if(path==="/security/consent"){
  const operator=ready?safe(env.SECURITY_PD_OPERATOR_NAME):"не определён — сбор заявок отключён";
  const contact=ready?safe(env.SECURITY_PD_OPERATOR_CONTACT):"lexpravo4u@gmail.com";
  return layout("Согласие на обработку данных",card("Согласие на предварительную заявку",
   "<p><strong>Оператор:</strong> "+operator+"</p><p><strong>Контакт:</strong> "+contact+"</p>"+
   "<p><strong>Цель:</strong> регистрация предварительного интереса к услуге безопасности, уточнение возможности подключения и контакт по этому запросу. Это не согласие на рекламу.</p>"+
   "<p><strong>Данные:</strong> имя, телефон, город, район/адрес, тип объекта, количество членов семьи (для Пензы), комментарий, служебные сведения о заявке и согласии.</p>"+
   "<p><strong>Операции:</strong> сбор, запись, хранение в российской базе, использование для ответа по заявке, уточнение, удаление по обращению. Автоматической передачи заявки сторонним ЧОО не предусмотрено. При отдельном согласовании передачи потребуется отдельное основание и уведомление.</p>"+
   "<p>Согласие можно отозвать, направив запрос на <a href='mailto:lexpravo4u@gmail.com'>lexpravo4u@gmail.com</a>. Обработка прекращается в установленном законом порядке, если нет другого законного основания её продолжать.</p>"+
   "<p><a href='/store/privacy'>Действующая политика Лекса</a></p>"),ready,connectOrigin);
 }
 if(path==="/security/home"){
 const html=banner+
 '<section class="card"><h2>Защитить квартиру, дом или бизнес</h2><label for="city-choice">В каком городе находится объект?</label><select id="city-choice"><option value="">Выберите город</option><option value="penza">Пенза</option><option value="other">Другой город</option></select></section>'+
 '<section id="penza-card" class="card hidden"><span class="pill">Предварительный набор · Пенза</span><h2>ПРАЙД 500</h2><h3>Экстренная защита семьи дома</h3><p class="price">Планируемый тариф — 500 ₽/мес.</p><p>Без обязательной покупки дорогой сигнализации.</p><p>Планируется тревожная кнопка для вызова группы быстрого реагирования на зарегистрированный адрес.</p><p><strong>Сейчас формируем первую группу подключения в Пензе.</strong></p><p>Предварительная заявка бесплатна.</p><p class="muted">Услуга ещё не запущена. Договор охраны не заключается, реальное реагирование не выполняется.</p></section>'+
 '<section id="penza-business-card" class="card hidden"><span class="pill">Предварительный набор · Пенза</span><h2>ПРАЙД Бизнес</h2><p class="price">Планируемый тариф — 790 ₽/мес.</p><p>Тревожная кнопка сотрудника и реагирование на зарегистрированный адрес после запуска.</p><p>Камеры, датчики, сигнализация и физическая КТС подключаются отдельно при необходимости.</p><p class="muted">Сейчас это только предварительная заявка — действующей охраны и кнопки вызова ещё нет.</p></section>'+
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
 return layout("Предварительная заявка на безопасность",html+shareHtml("home",ref),ready,connectOrigin);
 }
 if(path==="/security/admin"){
  const status=ready?"":"<p class='pending'>Российское хранилище и проверенная авторизация ещё не настроены. Просмотр реальных заявок закрыт.</p>";
  const select=(name,key,options)=>'<label>'+name+'<select name="'+key+'"><option value="">Все</option>'+options.map(o=>'<option value="'+safe(o)+'">'+safe(o)+'</option>').join("")+'</select></label>';
  const body=card("Администратор · предварительные заявки",status+
  '<form id="admin-filter"><label>Ключ администратора<input id="admin-token" type="password" autocomplete="off" placeholder="Секретный ключ, не публикуется" required></label><div class="filters">'+
  '<label>Город<input name="city" maxlength="80" placeholder="Например: Пенза"></label>'+
  select("Статус","status",LEAD_STATUSES)+select("Продукт","product",LEAD_PRODUCTS)+
  '<label>Дата<input type="date" name="date"></label></div><button type="submit">Показать заявки</button></form><p id="admin-status" role="status"></p><div id="admin-results"></div>');
  return layout("Административный просмотр заявок",body+'<script defer src="/security/admin.js"></script>',ready,connectOrigin);
 }
 return null;
}
