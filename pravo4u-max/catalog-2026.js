// PRAVO4U verified interactive catalogue, legal review date 2026-10-24.
// All local constructors currently available as FREE public tests. No activation of payments.
const BASE="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export const LIVE_CATALOG=[
 ["Судебный приказ","Возражения относительно исполнения судебного приказа","order","DOCX","10 дней со дня получения; просрочка требует причин вне контроля должника (ст.128–129 ГПК РФ)."],
 ["Недвижимость","Договор найма квартиры","rent","5 DOCX в ZIP","Стандартный найм, без долей, представителей и спорных условий."],
 ["Недвижимость","ДКП земельного участка","land_sale","4 DOCX в ZIP","Простая продажа одним собственником; ЕГРН, межевание и обременения обязательно проверить."],
 ["Недвижимость","ДКП земельного участка с жилым домом","land_house_sale","4 DOCX в ZIP","Оба объекта зарегистрированы; продажа одним собственником, без долей и обременений."],
 ["Недвижимость","ДКП садового (дачного) земельного участка","garden_land_sale","4 DOCX в ZIP","Садоводство по ЕГРН, без принадлежащего продавцу зарегистрированного дома."],
 ["Недвижимость","ДКП садового участка с садовым или жилым домом","garden_house_sale","4 DOCX в ZIP","Земля и зарегистрированный дом; назначение по ЕГРН, проверка прав и расчётов."],
 ["Недвижимость","ДКП квартиры","flat_sale","4 DOCX в ZIP","Только единственный совершеннолетний собственник, без обременений и сохраняемых прав пользования."],
 ["Недвижимость","ДКП гаража как отдельного объекта","garage_sale","4 DOCX в ZIP","Гараж учтён в ЕГРН; права на землю и необходимость её отчуждения проверяются отдельно."],
 ["Недвижимость","Предварительный ДКП земельного участка","realty_preliminary","2 DOCX в ZIP","Простая сделка; срок основного договора и ЕГРН."],
 ["Недвижимость","Соглашение об авансе по ДКП участка","realty_advance","2 DOCX в ZIP","Только при действующем предварительном договоре."],
 ["Недвижимость","Соглашение о задатке по предварительному ДКП","realty_deposit","2 DOCX в ZIP","Статьи 380–381 ГК РФ; предварительный договор обязателен."],
 ["Недвижимость","Аренда земельного участка до 11 месяцев","land_lease_short","3 DOCX в ZIP","Частная земля, без застройки, госземли и субаренды."],
 ["Недвижимость","Расторжение предварительного ДКП участка","realty_prelim_end","2 DOCX в ZIP","До заключения основного договора и регистрации права."],
 ["Бизнес","Договор беспроцентного займа граждан","loan","3 DOCX в ZIP","Подтверждение фактической передачи займа и специальные условия — отдельно."],
 ["Бизнес","Договор оказания услуг с самозанятым","service","3 DOCX в ZIP","Проверка статуса НПД на дату расчёта обязательна."],
 ["Приставы и взыскания","Сохранение прожиточного минимума","fssp_minimum","DOCX","Для обычного взыскания, при наличии доходов; предусмотрены законные исключения."],
 ["Права потребителя","Возврат денег за онлайн-курс","course_refund","DOCX","Отказ от услуг: проверка оказанных услуг и фактических расходов."],
 ["Приставы и взыскания","Ознакомление с материалами исполнительного производства","fssp_files","DOCX","Только для стороны исполнительного производства (ст.50 №229-ФЗ)."],
 ["Приставы и взыскания","Получение копий постановлений ФССП","fssp_copy","DOCX","Для должника или взыскателя по конкретному производству."],
 ["Приставы и взыскания","Жалоба старшему приставу","fssp_complaint","DOCX","Проверка 10-дневного срока (ст.122 №229-ФЗ)."],
 ["Судебные документы","Ознакомление с гражданским делом","court_files","DOCX","Лицо должно быть участником дела (ст.35 ГПК РФ)."],
 ["Бизнес","Требование о возврате займа","loan_demand","DOCX","Для стандартного подтверждённого займа, с учётом срока возврата."],
 ["Бизнес","Соглашение о расторжении договора услуг","service_end","DOCX","Только если стороны согласны по расчётам и прекращению обязательств."],
 ["Бизнес","Претензия об оплате оказанных услуг","service_claim","DOCX","Необходимы доказательства объёма, сроков и оказания услуг."],
 ["Права потребителя","Отказ от интернет-покупки","online_return","DOCX","Проверка срока, индивидуальных свойств и сохранности товара."],
 ["Права потребителя","Возврат денег за товар с недостатком","defect_return","DOCX","Для типового нетехнически сложного товара при соблюдении сроков."],
 ["Права потребителя","Возврат предоплаты за непоставленный товар","prepayment_delay","DOCX","Согласован срок передачи, срок нарушен; требование по ст.23.1 ЗоЗПП."],
 ["Бизнес","Договор подряда на ремонт","work_contract","3 DOCX в ZIP","Только стандартные работы без строительства и специальных допусков."],
 ["Бизнес","Купля-продажа движимой вещи","goods_sale","2 DOCX в ZIP","Для продажи обычного разрешённого товара между гражданами."],
 ["Автоюрист","Договор купли-продажи автомобиля","vehicle_sale","3 DOCX в ZIP","Нужно самостоятельно проверить VIN, залоги и запреты регистрации."],
 ["Недвижимость","Акт возврата квартиры по найму","rent_return","DOCX","Только после фактической передачи квартиры, без спорных расчётов."],
 ["Права потребителя","Требование возврата аванса за услуги","service_advance","DOCX","Отказ потребителя от услуг; фактические расходы учитываются по закону."],
 ["Право РФ из-за рубежа","Запрос копии договора и документов по правоотношениям РФ","rf_remote_contract_copy","DOCX","Для собственных документов без банковской тайны, судебных ограничений и полномочий третьих лиц."],
 ["Право РФ из-за рубежа","Запрос субъекта персональных данных российскому оператору","rf_pd_request","DOCX","Статья 14 Закона №152-ФЗ; применяется только к собственным сведениям."],

];
const planned=[
 ["Недвижимость","Сделки с долями, несовершеннолетними, доверенностями, ипотекой и спорными правами — только индивидуально"],
 ["Недвижимость","Предварительный договор недвижимости, задаток, долевая собственность — только после юридической проверки"],
 ["Приставы и взыскания","Процессуальные жалобы с пропущенными сроками, сложные исполнительные случаи — только через юриста"],
 ["Автоюрист","Споры по ДТП, ОСАГО, штрафам с пропуском срока — только после проверки материалов"],
 ["Бизнес","Конструкторы с лицензированием, недвижимостью, банкротством и корпоративными сделками — требуют индивидуальной проверки"]
];
const esc=x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const groups=[...new Set(LIVE_CATALOG.map(x=>x[0]))];
const quickForms=[
 ["order","Отменить судебный приказ"],
 ["rent","Договор найма квартиры"],
 ["service","Договор услуг с самозанятым"],
 ["fssp_minimum","Сохранить прожиточный минимум"],
 ["online_return","Вернуть интернет-покупку"],
 ["prepayment_delay","Оплатил товар, но его не доставили"]
];
const quickCard=([id,name])=>'<a class="quick-card" href="/compose?type='+encodeURIComponent(id)+'"><span>'+esc(name)+'</span><small>Заполнить бесплатно →</small></a>';
const shareLexUrl="https://t.me/share/url?url="+encodeURIComponent(BASE+"/store")+"&text="+encodeURIComponent("Бесплатные документы Лекса — выбери ситуацию, заполни и скачай DOCX. Может пригодиться!");
const guideCard=([href,title])=>'<a class="guide-card" href="'+href+'">'+esc(title)+'</a>';
const guideCards=[
 ["/guides/court-order","Пришёл судебный приказ — что делать"],
 ["/guides/order-from-fssp","О приказе узнал от приставов"],
 ["/guides/delivery-delay","Товар оплатил, но его нет"],
 ["/guides/online-course","Как вернуть деньги за онлайн-курс"],
 ["/guides/rent","Как оформить найм квартиры"],
 ["/guides/npd-contract","Договор с самозанятым"]
];
export const STORE_HTML=
'<section class="catalog-hero"><p class="lex-kicker">ДОКУМЕНТЫ</p><h2>Нужный документ. Без лишних шагов.</h2><p>34 бесплатных конструктора DOCX без срока акции: выберите ситуацию, заполните форму и скачайте результат. Данные анкеты остаются на вашем устройстве.</p><p class="catalog-steps">Выбрать → Заполнить → Скачать</p><p class="catalog-share"><a href="'+shareLexUrl+'" target="_blank" rel="noopener noreferrer">Поделиться бесплатным Лексом с другом</a></p></section>'+
'<section class="catalog-section"><h2>✈️ Задержали или отменили рейс?</h2><p>Права пассажиров и три бесплатных обращения в DOCX.</p><a class="catalog-action" href="/aviation">Разобраться с рейсом →</a></section>'+
'<section class="catalog-section"><h2>Чаще всего ищут</h2><div class="quick-grid">'+quickForms.map(quickCard).join('')+'</div></section>'+
'<section class="catalog-section" id="documents"><h2>Все 34 документа по темам</h2><p class="catalog-muted">Все 34 формы бесплатны. Введите название или выберите тему.</p><div class="catalog-search"><label for="doc-search">Поиск по документам</label><input id="doc-search" type="search" placeholder="Например: участок, пристав, возврат денег" autocomplete="off" aria-controls="doc-results"><p class="catalog-search-count" id="doc-search-count" role="status" aria-live="polite">Показаны все 34 документа</p></div><div class="catalog-categories">'+groups.map((g,i)=>'<a href="#catalog-group-'+i+'">'+esc(g)+'</a>').join('')+'</div><div id="doc-results">'+
groups.map((g,i)=>'<details class="group" data-catalog-group id="catalog-group-'+i+'" '+(i===0?'open':'')+'><summary><strong>'+esc(g)+'</strong><span class="group-count">'+LIVE_CATALOG.filter(x=>x[0]===g).length+' форм</span></summary>'+
LIVE_CATALOG.filter(x=>x[0]===g).map(([section,title,key,format,note])=>'<article class="catalog-item"><div class="catalog-item-main"><h3>'+esc(title)+'</h3><small>'+esc(format)+'</small></div><p class="catalog-note">'+esc(note)+'</p><a class="catalog-action" href="/compose?type='+encodeURIComponent(key)+'">Заполнить бесплатно →</a></article>').join('')+'</details>').join('')+'</div></section>'+
'<section class="catalog-section"><h2>Не знаете, с чего начать?</h2><p class="catalog-muted">Выберите короткую инструкцию по вашей ситуации — без сложных юридических формулировок.</p><div class="guide-grid">'+guideCards.map(guideCard).join('')+'</div></section>'+
'<section class="catalog-section catalog-assist"><h2>Не нашли свою ситуацию?</h2><p>Опишите задачу — поможем определить подходящий документ или оценить индивидуальную подготовку.</p><a class="catalog-action" href="/services/individual">Индивидуальный документ →</a><p><a href="mailto:lexpravo4u@gmail.com?subject=%D0%9B%D0%B5%D0%BA%D1%81%20%7C%20%D0%B7%D0%B0%D0%BF%D1%80%D0%BE%D1%81%20%D0%BD%D0%B0%20%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82">Отправить запрос на документ</a></p></section>'+
'<section class="catalog-section catalog-community"><h2>ПРАВО4U — полезные истории и подсказки</h2><p>Разбираем ситуации из жизни: покупки, долги, жильё, деньги и права. Без юридической воды.</p><p><a href="/go/telegram?from=catalog" target="_blank" rel="noopener noreferrer">Telegram-канал</a> · <a href="/go/max?from=catalog" target="_blank" rel="noopener noreferrer">MAX-канал</a></p><small>Подписка добровольная. Персональную рекламу не рассылаем.</small></section>'+
'<details class="group catalog-extra"><summary>Дополнительные образцы и ограничения</summary><p><a href="/documents/order.docx">Возражения на приказ — пустой DOCX</a></p><p><a href="/documents/rent.docx">Договор найма — пустой DOCX</a></p><p><strong>Для сложных случаев:</strong> типовой шаблон не заменяет правовую проверку.</p>'+
planned.map(([group,title])=>'<p><strong>'+esc(group)+':</strong> '+esc(title)+'</p>').join('')+'</details>'+
'<p class="catalog-footer">ПРАВО4U — цифровой помощник, а не адвокат. Сверяйте факты и документы перед подписанием. <a href="/store/terms">Условия</a> · <a href="/store/privacy">Персональные данные</a> · <a href="mailto:lexpravo4u@gmail.com">Связаться</a></p>';
// Progressive enhancement only: all links and category lists work without JavaScript.
export const CATALOG_UI_JS = String.raw`(function(){
"use strict";
const input=document.getElementById("doc-search"),status=document.getElementById("doc-search-count");
if(!input||!status)return;
const groups=[...document.querySelectorAll("details[data-catalog-group]")];
const all=groups.flatMap(g=>[...g.querySelectorAll(".catalog-item")]);
document.querySelectorAll(".catalog-categories a").forEach(link=>link.addEventListener("click",()=>{const target=document.querySelector(link.getAttribute("href"));if(target)target.open=true;}));
const normalize=s=>String(s||"").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").trim();
input.addEventListener("input",function(){
 const raw=normalize(input.value);
 const aliases=(raw.includes("продать")&&raw.includes("участ"))?"дкп земельного участка":(raw.includes("отменить")&&raw.includes("приказ"))?"возражения относительно исполнения судебного приказа":(raw.includes("сдать")&&raw.includes("квартир"))?"договор найма квартиры":raw;
 const terms=aliases.split(/\s+/).filter(Boolean);let matched=0;
 for(const g of groups){let count=0;
  for(const item of g.querySelectorAll(".catalog-item")){
   const visible=terms.every(t=>normalize(item.textContent).includes(t));item.hidden=!visible;if(visible){count++;matched++;}
  }
  g.hidden=count===0;if(terms.length&&count)g.open=true;
 }
 if(!terms.length){groups.forEach((g,i)=>{g.hidden=false;g.open=i===0;});}
 status.textContent=terms.length?(matched?"Найдено документов: "+matched:"Ничего не найдено. Попробуйте другое слово."):"Показаны все "+all.length+" документов";
});
try{
 const initial=new URL(location.href).searchParams.get("q");
 if(initial){input.value=initial.slice(0,80);input.dispatchEvent(new Event("input",{bubbles:true}));}
}catch{}
})();`;
