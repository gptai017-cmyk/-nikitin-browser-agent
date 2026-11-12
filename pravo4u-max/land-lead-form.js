// Client-only: no storage, analytics or PII submission to Cloudflare.
// When Russian backend is unconfigured, existing email-based contact remains visible.
export const LAND_FORM_CLIENT_JS=String.raw`(function(){
"use strict";
const hosts=Array.from(document.querySelectorAll("[data-land-form-host]"));
if(!hosts.length)return;
const allowedCity=s=>String(s||"").trim().slice(0,70);
const accepted=(u)=>{try{return new URL(u).protocol==="https:"&&new URL(u).hostname!=="localhost"}catch{return false}};
function showReady(config){
 for(const host of hosts){
  const kind=host.dataset.kind||"CUSTOM_SEARCH",lotId=host.dataset.lot||"",city=allowedCity(host.dataset.city||"Пенза");
  const form=document.createElement("form");
  form.className="land-lead-form";
  form.noValidate=false;
  form.innerHTML=
  '<h3>Оставить заявку</h3>'+
  '<p class="lead-form-note">Укажите контакт — мы уточним условия и свяжемся с вами. Никакой оплаты при отправке нет.</p>'+
  '<div class="lead-two"><label>Как к вам обращаться<input name="name" maxlength="80" minlength="2" autocomplete="name" required placeholder="Ваше имя"></label>'+
  '<label>Номер телефона<input name="phone" type="tel" maxlength="25" autocomplete="tel" inputmode="tel" required placeholder="+7 999 123-45-67"></label></div>'+
  '<label>Комментарий (необязательно)<textarea name="message" maxlength="420" rows="2" placeholder="Когда удобнее связаться, что хотите уточнить"></textarea></label>'+
  '<label class="land-check"><input type="checkbox" name="consent" required><span>Согласен на обработку имени и телефона для ответа на мой запрос. <a href="/land/privacy" target="_blank" rel="noopener noreferrer">Условия обработки данных</a></span></label>'+
  '<div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>'+
  '<button type="submit" class="btn primary">Отправить заявку →</button><p class="lead-result" role="status" aria-live="polite"></p>';
  const result=form.querySelector(".lead-result"),send=form.querySelector('button[type="submit"]');
  form.addEventListener("submit",async(event)=>{
   event.preventDefault();
   if(!form.reportValidity())return;
   send.disabled=true;
   send.textContent="Отправляем…";
   result.textContent="";
   try{
    const tokenResp=await fetch("/land/api/intake-token",{method:"POST",headers:{"Accept":"application/json"},cache:"no-store",credentials:"omit"});
    if(!tokenResp.ok)throw Error("token");
    const token=await tokenResp.json();
    if(!token.ok||!token.token||!accepted(token.endpoint)||token.endpoint!==config.endpoint)throw Error("config");
    const fields=new FormData(form);
    const payload={name:String(fields.get("name")||""),phone:String(fields.get("phone")||""),
      message:String(fields.get("message")||""),website:String(fields.get("website")||""),
      kind,lot_id:lotId,city,source:"LEX",consent:fields.get("consent")==="on",consent_version:config.consent_version};
    // Personal fields are transmitted only to the audited Russian host.
    const saved=await fetch(config.endpoint,{method:"POST",mode:"cors",credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json","X-Lex-Land-Token":token.token},body:JSON.stringify(payload)});
    if(!saved.ok)throw Error("save");
    const data=await saved.json();
    if(data.ok!==true||!(/^[0-9A-F]{8}$/.test(data.request_code||"")))throw Error("receipt");
    form.reset();
    result.textContent="Заявка № "+data.request_code+" принята. Мы свяжемся с вами по указанному телефону.";
    result.classList.add("success");
    send.textContent="Отправить ещё одну заявку →";
   }catch{
    result.textContent="Не удалось отправить заявку. Проверьте соединение или воспользуйтесь электронной почтой ниже.";
    result.classList.remove("success");
    send.textContent="Повторить отправку →";
   }finally{send.disabled=false;}
  });
  host.append(form);
  host.hidden=false;
  const fallback=host.parentElement.querySelector("[data-land-mail-fallback]");
  if(fallback)fallback.hidden=true;
 }
}
fetch("/land/api/intake-config",{cache:"no-store",credentials:"omit"}).then(r=>r.ok?r.json():null)
 .then(config=>{if(config&&config.ready===true&&accepted(config.endpoint)&&config.consent_version==="land-leads-2026-11-12-v1")showReady(config)})
 .catch(()=>{});
})();`;
