"use strict";
// PRAVO4U local-only document composer. No fetch, analytics, storage or form submission.
const $=id=>document.getElementById(id);
const one=(t,c='',x='')=>{const z=document.createElement(t);if(c)z.className=c;if(x)z.textContent=x;return z};
const definitions={
 order:{name:"Возражения относительно исполнения судебного приказа",fields:[
 ["court","Мировой судья, судебный участок и адрес","text"],["case","Номер дела","text"],
 ["date","Дата судебного приказа (ДД.ММ.ГГГГ)","text"],["full","ФИО должника","text"],
 ["address","Адрес должника","text"],["creditor","ФИО или наименование взыскателя","text"],
 ["sum","Сумма взыскания, рублей","text"],
 ["received","Получена ли копия приказа?","select",["received|Да","not_received|Нет","unknown|Неизвестно"]],
 ["receiptdate","Дата получения копии либо дата, когда узнали о приказе (ДД.ММ.ГГГГ)","text"],
 ["late","Нужно обосновать подачу за пределами 10-дневного срока?","select",["no|Нет","yes|Да"]],
 ["reason","Причина невозможности своевременного направления (если срок пропущен)","textarea"],
 ["evidence","Доказательства причины пропуска срока (если имеются)","textarea"]
 ]},
 rent:{name:"Комплект найма квартиры",fields:[
 ["city","Город заключения","text"],["contract_date","Дата договора (ДД.ММ.ГГГГ)","text"],
 ["landlord","Наймодатель — ФИО","text"],["landlord_passport","Паспорт наймодателя: серия, номер, кем и когда выдан, код подразделения","textarea"],
 ["landlord_address","Адрес регистрации наймодателя","textarea"],["landlord_contact","Контакт наймодателя","text"],
 ["tenant","Наниматель — ФИО","text"],["tenant_passport","Паспорт нанимателя: серия, номер, кем и когда выдан, код подразделения","textarea"],
 ["tenant_address","Адрес регистрации нанимателя","textarea"],["tenant_contact","Контакт нанимателя","text"],
 ["flat","Адрес квартиры","textarea"],["cadastral","Кадастровый номер или «не указан»","text"],
 ["area","Площадь в кв. м","text"],["rooms","Количество комнат","text"],["ownership","Основание собственности и запись ЕГРН","textarea"],
 ["residents","Кто будет проживать с нанимателем (или «нет»)","textarea"],
 ["start","Дата начала найма (ДД.ММ.ГГГГ)","text"],["end","Дата окончания (не более 11 месяцев)","text"],
 ["rent_amount","Плата за месяц, ₽","text"],["payday","Число ежемесячной оплаты (1–28)","text"],
 ["deposit","Обеспечительный платёж, ₽ (если нет — 0)","text"],["payinfo","Способ оплаты и реквизиты либо «наличными под расписку»","textarea"],
 ["utilities","Коммунальные расходы","textarea"],["pets","Домашние животные","select",["no|Нет","yes|Да, с соблюдением правил содержания"]],
 ["visits","Интервал между плановыми осмотрами, дней (30–180)","text"],
 ["property","Опись имущества: наименование, состояние и известные дефекты","textarea"],
 ["condition","Состояние квартиры и выявленные недостатки","textarea"],["meters","Показания счётчиков либо «указать при передаче»","textarea"],
 ["keys","Ключи: число комплектов и назначение","text"],
 ["complex","Есть доли, несколько собственников, представитель, спор о правах, срок больше 11 месяцев, недееспособность или специальные условия?","select",["no|Нет","yes|Да, нужна консультация"]]
 ]}
};
const enc=new TextEncoder();
const u16=(a,n)=>a.push(n&255,n>>>8&255);
const u32=(a,n)=>a.push(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
function crc32(bytes){let c=-1;for(const v of bytes){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^(-(c&1)&0xedb88320)}return(c^-1)>>>0}
function zip(entries){const out=[],central=[];let position=0;
for(const [filename,raw] of entries){const name=enc.encode(filename),data=typeof raw==='string'?enc.encode(raw):raw,crc=crc32(data);
const local=[];u32(local,0x04034b50);u16(local,20);u16(local,2048);u16(local,0);u16(local,0);u16(local,0);u32(local,crc);u32(local,data.length);u32(local,data.length);u16(local,name.length);u16(local,0);
out.push(new Uint8Array(local),name,data);
const c=[];u32(c,0x02014b50);u16(c,20);u16(c,20);u16(c,2048);u16(c,0);u16(c,0);u16(c,0);u32(c,crc);u32(c,data.length);u32(c,data.length);u16(c,name.length);u16(c,0);u16(c,0);u16(c,0);u16(c,0);u32(c,0);u32(c,position);central.push(new Uint8Array(c),name);
position+=local.length+name.length+data.length;
}const size=central.reduce((a,x)=>a+x.length,0),end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,entries.length);u16(end,entries.length);u32(end,size);u32(end,position);u16(end,0);
return new Blob([...out,...central,new Uint8Array(end)]);}
const xml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
async function docx(title,lines){const content=lines.map(p=>'<w:p><w:pPr><w:spacing w:before="80" w:after="110" w:line="300" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">'+xml(p)+'</w:t></w:r></w:p>').join('');
return await awaitBlob(zip([
 ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
 ['word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/></w:rPr><w:t>'+xml(title)+'</w:t></w:r></w:p>'+content+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1276" w:right="1134"/></w:sectPr></w:body></w:document>']
 ]))}
async function awaitBlob(blob){return new Uint8Array(await blob.arrayBuffer())}
function parseDate(v){const m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);if(!m)return null;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));if(d.getUTCDate()!==+m[1]||d.getUTCMonth()!==+m[2]-1)return null;return d}
function validate(kind,d){
const skip=new Set(kind==='order'?['reason','evidence']:[]);
for(const [id,label] of definitions[kind].fields){if(skip.has(id))continue;if(!String(d[id]??'').trim())throw Error('Заполните: '+label);}
if(kind==='order'){
if(!parseDate(d.date)||!parseDate(d.receiptdate))throw Error('Проверьте даты в формате ДД.ММ.ГГГГ');
if(d.late==='yes'&&!d.reason.trim())throw Error('При пропуске срока необходимо указать причины');
if(!/^\d+(?:[.,]\d{1,2})?$/.test(d.sum.replaceAll(' ','')))throw Error('Проверьте сумму взыскания');
}else{
if(d.complex!=='no')throw Error('Стандартный конструктор не подходит. Нужна индивидуальная проверка юриста.');
const dates=['contract_date','start','end'].map(x=>parseDate(d[x]));
if(dates.some(x=>!x)||dates[1]<dates[0]||dates[2]<dates[1])throw Error('Проверьте даты договора и начала/окончания найма');
let lim=new Date(dates[1]);lim.setUTCMonth(lim.getUTCMonth()+11);lim.setUTCDate(lim.getUTCDate()-1);
if(dates[2]>lim)throw Error('В этом конструкторе срок найма не должен превышать 11 месяцев');
if(!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(d.rent_amount)||Number(d.rent_amount.replace(',','.'))<=0)throw Error('Проверьте плату');
if(!/^\d{1,9}(?:[.,]\d{1,2})?$/.test(d.deposit))throw Error('Проверьте обеспечительный платеж');
if(+d.payday<1||+d.payday>28||+d.visits<30||+d.visits>180)throw Error('Проверьте число оплаты и интервал осмотров');
if(!/^\d+(?:[.,]\d+)?$/.test(d.area)||!(+d.rooms>0))throw Error('Проверьте площадь и количество комнат');
}
}
function order(d){return docx('ВОЗРАЖЕНИЯ ОТНОСИТЕЛЬНО ИСПОЛНЕНИЯ СУДЕБНОГО ПРИКАЗА',[
 'Мировому судье: '+d.court,'Должник: '+d.full,'Адрес: '+d.address,'Взыскатель: '+d.creditor,'Дело № '+d.case,
 'Судебный приказ от '+d.date+' по делу № '+d.case+' предусматривает взыскание '+d.sum+' руб. в пользу '+d.creditor+'.',
 'С судебным приказом не согласен(на) и возражаю относительно его исполнения.',
 d.received==='received'?'Копия судебного приказа получена '+d.receiptdate+'.':'Копия приказа своевременно не получена либо дата вручения не установлена. О приказе стало известно '+d.receiptdate+'.',
 ...(d.late==='yes'?[
 'Возражения направляются после установленного срока. Своевременному представлению препятствовали следующие обстоятельства, не зависевшие от должника: '+d.reason+'.',
 'Подтверждающие документы: '+(d.evidence||'сведения и доказательства прилагаются при наличии')+'.',
 'Прошу принять возражения с учетом части 2 статьи 129 ГПК РФ; причины пропуска требуют оценки суда.'
 ]:[]),
 'По статьям 128 и 129 ГПК РФ должник вправе представить возражения относительно исполнения судебного приказа, а при поступлении своевременных возражений приказ подлежит отмене.',
 'ПРОШУ: '+(d.late==='yes'?'1. Принять возражения, представленные за пределами срока, при наличии подтверждённых не зависящих от должника причин. 2. ':'')+'Отменить судебный приказ от '+d.date+' по делу № '+d.case+'.',
 'Приложения: копия судебного приказа и подтверждающие сведения о сроках/доставке (при наличии).',
 'Дата: __________________      Подпись: __________________ /'+d.full+'/',
 'Перед подачей проверьте суд, реквизиты, срок и наличие доказательств. Проект подготовлен по ответам пользователя.'
])}
async function rental(d){const parties='Наймодатель '+d.landlord+' (паспорт: '+d.landlord_passport+', регистрация: '+d.landlord_address+'), и Наниматель '+d.tenant+' (паспорт: '+d.tenant_passport+', регистрация: '+d.tenant_address+')';
const heading='Договор найма жилого помещения';
const base=['г. '+d.city+'  '+d.contract_date,parties+' заключили договор о нижеследующем.'];
const contract=[...base,
'1. Предмет договора. Наймодатель передаёт Нанимателю за плату во временное владение и пользование для проживания квартиру по адресу '+d.flat+'. Площадь '+d.area+' кв. м, комнат '+d.rooms+', кадастровый номер '+d.cadastral+'.',
'2. Наймодатель подтверждает право на квартиру: '+d.ownership+'. Наличие прав третьих лиц, обременений и иных ограничений проверяется сторонами до подписания.',
'3. Срок найма: с '+d.start+' по '+d.end+'. Проживающие лица: '+d.residents+'. Поднаём не допускается без отдельного законного соглашения.',
'4. Плата за месяц: '+d.rent_amount+' рублей до '+d.payday+' числа. Порядок расчётов: '+d.payinfo+'.',
'5. Обеспечительный платёж: '+d.deposit+' рублей. Взаимозачёт и возврат — после сверки обязательств, состояния квартиры и нормального износа с составлением документа.',
'6. Коммунальные и иные расходы оплачиваются так: '+d.utilities+'. Стороны фиксируют показания приборов при передаче и возврате.',
'7. Домашние животные: '+(d.pets==='yes'?'допускаются с соблюдением обязательных требований':'условия проживания с животными подлежат предварительному согласованию')+'.',
'8. Состояние квартиры: '+d.condition+'. Имущество и ключи передаются по отдельному акту с описью. Плановые осмотры — не чаще одного раза в '+d.visits+' дней по предварительному согласованию.',
'9. Наниматель обеспечивает сохранность помещения, своевременно сообщает об авариях. Наймодатель выполняет обязательные по закону работы и не препятствует согласованному пользованию.',
'10. Изменения договора оформляются письменно. Досрочное прекращение, возврат квартиры и взаиморасчёты осуществляются согласно применимым нормам ГК РФ и письменным соглашениям сторон.',
'11. По окончании стороны подписывают акт возврата с показаниями счётчиков и фиксацией состояния имущества. При споре сохраняют подтверждающие документы.',
'12. Подписи и контакты. Наймодатель: '+d.landlord+', '+d.landlord_contact+', подпись ____________. Наниматель: '+d.tenant+', '+d.tenant_contact+', подпись ____________.',
'Перед подписанием необходимо сверить сведения ЕГРН, полномочия собственника, сроки и фактическое состояние квартиры.'
];
const act=['К договору от '+d.contract_date+' по адресу '+d.flat+'.','Предполагаемая дата передачи '+d.start+'. Фактическая дата: ______________.','Показания счётчиков по информации сторон: '+d.meters+'. Фактические показания: ______________.','Состояние помещения: '+d.condition+'.','Передано ключей: '+d.keys+'.','Переданное имущество сверено по прилагаемой описи.','Наймодатель: _______ /'+d.landlord+'/   Наниматель: _______ /'+d.tenant+'/','Акт подписывается только при фактической передаче.'];
const inventory=['Адрес: '+d.flat+'.','Имущество, техника и выявленные дефекты: '+d.property+'.','Дополнения и фотофиксация: ____________________________________.','Подписи сторон (после фактической сверки): _____________________'];
const rec=['К договору от '+d.contract_date+'.','Получатель: '+d.landlord+'. Плательщик: '+d.tenant+'.','Назначение платежа: найм/обеспечительный платёж (нужное подчеркнуть).','ФАКТИЧЕСКИ полученная сумма: _____________ руб. Дата и время: ___________.','Способ расчёта и банковское подтверждение: _______________________.','Расписка подписывается только после фактического поступления денег.','Подпись получателя: _______________'];
const guide=['Проверьте действительность паспортных данных и сведения о праве собственности по ЕГРН.','Передавайте имущество, деньги и ключи только с подтверждением фактического события; не подписывайте расписку задним числом.','Срок менее года: отдельно проверьте требования о регистрации обременения применительно к конкретной сделке.','Оформите по экземпляру договора, акта и описи каждой стороне.','Эти документы являются автоматизированными проектами без проверки госреестров. При долях, споре, представительстве, нестандартных расчетах или сроке более 11 месяцев нужна консультация.'];
const entries=[];
for(const [name,title,lines] of [
['01_dogovor.docx',heading,contract],['02_akt.docx','Акт приёма-передачи квартиры',act],['03_opis.docx','Опись имущества',inventory],['04_raspiska.docx','Расписка — заполнять после расчёта',rec],['05_instrukciya.docx','Инструкция сторонам',guide]])entries.push([name,await docx(title,lines)]);
return zip(entries);
}
function start(){
const type=new URLSearchParams(location.search).get('type')==='rent'?'rent':'order';
$('type').textContent=definitions[type].name;
$('form').replaceChildren();
for(const [id,label,kind,options] of definitions[type].fields){const group=one('div','fgroup'),lab=one('label','',label),input=kind==='textarea'?one('textarea'):kind==='select'?one('select'):one('input');input.id=id;input.name=id;input.autocomplete='off';input.spellcheck=false;input.maxLength=kind==='textarea'?1800:350;
if(kind==='select'){input.appendChild(one('option','','Выберите'));for(const z of options||[]){const [v,n]=z.split('|');const o=one('option','',n);o.value=v;input.appendChild(o)}}
if(kind==='text')input.type='text';
lab.setAttribute('for',id);group.append(lab,input);$('form').appendChild(group)}
$('make').addEventListener('click',async()=>{
const d={};for(const [id] of definitions[type].fields)d[id]=$(id).value.trim();
try{validate(type,d);$('error').textContent='';$('make').disabled=true;
const file=type==='rent'?await rental(d):await order(d);
const ext=type==='rent'?'zip':'docx',url=URL.createObjectURL(new Blob([file],{type:type==='rent'?'application/zip':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
const a=one('a');a.href=url;a.download=type==='rent'?'PRAVO4U_naim_komplekt.zip':'PRAVO4U_vozrazheniya.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
$('message').textContent='Готово. Файл создан на вашем устройстве; сведения не отправлялись на сервер. Перед использованием проверьте содержание.';
}catch(e){$('error').textContent=e.message||'Ошибка подготовки документа'}finally{$('make').disabled=false}
});
}
start();