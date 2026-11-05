// Public, handoff-safe section links. No personal/user/referral identifiers and no auto-sending.
// MAX: official https://max.ru/:share?text=... ; Telegram: official https://t.me/share/url?url=...&text=...
export const SHARE_ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export const SHARE_TOPICS=Object.freeze({
 lex:{title:"Лекс — 34 бесплатных документа",path:"/store",description:"Бесплатные документы и полезные инструкции — выбирайте нужную ситуацию."},
 security:{title:"Безопасность семьи и дома — Лекс",path:"/security",description:"Защита квартиры или дома: предварительный набор в Пензе и других городах. Охрана пока не подключается."},
 security_home:{title:"Предварительное подключение защиты дома — Лекс",path:"/security/home",description:"ПРАЙД 500 в Пензе и подбор по другим городам. Предварительная информация, без действующего реагирования и оплаты."},
 security_emergency:{title:"Что делать при ЧП — Лекс",path:"/security/emergency",description:"Полезная памятка на случай ЧП. При опасности звоните 112."},
 insurance:{title:"Страхование и ипотека — Лекс",path:"/store/partners",description:"Информация о страховании недвижимости, ОСАГО и ипотеки в ПРАВО4U. Предложения проверяются."},
 individual:{title:"Индивидуальные документы — Лекс",path:"/services/individual",description:"Узнайте, как заказать документ под свою ситуацию."},
 transcription:{title:"Расшифровка аудио — ЕЦЦУ",path:"/services/transcription",description:"Перевод аудиозаписей в текст с таймкодами и ручной проверкой. Можно запросить расчёт."}
});
export function sectionURL(topic,source="DIRECT"){
 const x=SHARE_TOPICS[topic];if(!x)throw Error("topic_not_allowed");
 return SHARE_ROOT+x.path+(x.path.startsWith("/security")?"?source="+(source==="MAX"||source==="TELEGRAM"?source:"OTHER"):"");
}
export function sharePlatformLinks(topic){
 const x=SHARE_TOPICS[topic];if(!x)throw Error("topic_not_allowed");
 const toMax=sectionURL(topic,"MAX"),toTelegram=sectionURL(topic,"TELEGRAM");
 const text=x.title+"\n"+x.description+"\n"+toMax;
 return {
  max:"https://max.ru/:share?text="+encodeURIComponent(text),
  telegram:"https://t.me/share/url?url="+encodeURIComponent(toTelegram)+"&text="+encodeURIComponent(x.title+"\n"+x.description),
  direct:SHARE_ROOT+x.path,
  title:x.title
 };
}
const htmlEscape=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function shareSectionHTML(topic){
 const links=sharePlatformLinks(topic);
 return '<aside class="share-section" aria-label="Поделиться разделом"><h2>Полезно? Поделитесь разделом</h2>'+
  '<p>Друг откроет именно эту страницу. Никаких подарочных документов, звёзд и платных подписок.</p>'+
  '<div class="share-section-actions"><a href="'+htmlEscape(links.max)+'" target="_blank" rel="noopener noreferrer">Поделиться в MAX</a>'+
  '<a href="'+htmlEscape(links.telegram)+'" target="_blank" rel="noopener noreferrer">Поделиться в Telegram</a></div>'+
  '<p><small>Отправка произойдёт только после вашего выбора адресата и подтверждения в мессенджере.</small></p></aside>';
}
export const SHARE_SECTION_CSS='.share-section{margin:25px 0;padding:18px;background:#f5f8fd;border:1px solid #d7e1f0;border-radius:13px}.share-section h2{margin:0 0 8px;font-size:18px;line-height:1.3}.share-section p{font-size:14px;color:#465772;margin:9px 0}.share-section-actions{display:flex;flex-wrap:wrap;gap:10px}.share-section-actions a{display:inline-block;text-decoration:none;background:white;border:1px solid #bdd0ed;border-radius:9px;padding:10px 13px;font-weight:650;font-size:14px}';
