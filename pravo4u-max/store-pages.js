import {partnerContent} from "./partner-offers.js";
import {clubContent} from "./retention-pages.js";
import {SUPPORT_HTML} from "./support-page.js";
import {STORE_HTML} from "./catalog-2026.js";
import {PRIVACY_HTML} from "./privacy-2026.js";
import {OFFER_HTML} from "./offer-2026.js";
// Public information pages for PRAVO4U MAX. No input forms or personal-data collection.
// Payment activation and personalized legal intake remain disabled pending verification.
// Only add required seller data using secrets/variables of this dedicated Worker.
const h=x=>String(x??'').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const BASE="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const bot="https://max.ru/se14752741_bot";
const nav='<nav><a href="/store">Документы Лекса</a> · <a href="/store/terms">Условия</a> · <a href="/store/privacy">Данные</a> · <a href="/store/refunds">Возвраты</a> · <a href="/store/partners">Партнёры</a> · <a href="/store/club">Клуб Лекса</a> · <a href="/store/support">Поддержать проект</a> · <a href="https://max.ru/se14752741_biz" target="_blank" rel="noopener noreferrer">Канал ПРАВО4U в MAX</a></nav>';
function page(title,body,env){
 const inn="583403642667";
 const phone="";
 const seller='Самозанятый Никитин Андрей Игоревич';
 return new Response(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><title>${h(title)} — ПРАВО4U</title><style>body{font:16px/1.6 system-ui,-apple-system,Arial,sans-serif;max-width:740px;padding:28px 18px;margin:auto;color:#1e2638}h1{font-size:29px;line-height:1.2}h2{font-size:20px;margin-top:30px}nav{padding:16px 0;display:flex;gap:12px;flex-wrap:wrap}nav a{color:#1748ac}.card{border:1px solid #d8e0ec;padding:19px;border-radius:12px;margin:14px 0}.status{padding:12px;background:#f5f5f5;border-radius:9px}details.group{border:1px solid #d8e0ec;border-radius:12px;padding:8px 16px;margin:14px 0}details.group>summary{cursor:pointer;padding:12px 0;font-size:17px;line-height:1.4;list-style-position:inside}details.group .card{background:#f8faff}footer{margin-top:38px;border-top:1px solid #ddd;padding-top:15px;font-size:14px}a{color:#1748ac}</style><h1>Лекс — цифровой помощник ПРАВО4U</h1><p>Здравствуйте! Я Лекс. Помогу подобрать документ по законодательству РФ и подготовить DOCX на вашем устройстве.</p>${nav}<main>${body}</main><footer><p>${seller}<br>ИНН: ${inn?h(inn):'пока не опубликован — платежи не принимаются'}<br>Город: Пенза<br>Почта для обращений: <a href="mailto:gptai017@gmail.com">gptai017@gmail.com</a>${phone?'<br>Телефон: '+h(phone):''}<br><a href="${bot}">Чат-бот ПРАВО4U в MAX</a></p><p>Публичные страницы не принимают оплату и не запрашивают паспортные данные.</p></footer></html>`,{headers:{"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'","cache-control":"public, max-age=120","x-content-type-options":"nosniff"}});
}
export function storePage(path,env){
 if(path==="/store")return page("Лекс — магазин юридических документов",STORE_HTML,env);
 if(path==="/store/partners")return page("Партнёрские сервисы: страхование, недвижимость и юристы",partnerContent(env),env);
 if(path==="/store/club")return page("Клуб Лекса — бесплатные документы и полезные услуги",clubContent(),env);
 if(path==="/store/support")return page("Поддержать бесплатный проект",SUPPORT_HTML,env);
 if(path==="/store/terms")return page("Условия бесплатного использования",OFFER_HTML,env);
 if(path==="/store/privacy")return page("Политика обработки персональных данных",PRIVACY_HTML,env);
 if(path==="/store/refunds")return page("Бесплатная выдача документов",'<h2>Документы бесплатны</h2><p>Все готовые типовые формы из каталога скачиваются бесплатно за 0 ₽. Платёж и возврат средств за выдачу таких форм не требуются, поскольку оплата не принимается.</p><p>Если документ не создаётся, напишите на <a href="mailto:gptai017@gmail.com">gptai017@gmail.com</a> без передачи паспортных данных и материалов дела.</p>',env);
 return null;
}
