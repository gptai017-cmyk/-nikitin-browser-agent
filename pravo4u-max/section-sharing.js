// Opt-in native sharing for MAX and Telegram. Security pages may preserve an explicit agent referral code; no recipient tracking.
const ROOT="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
export const SHARE_SECTIONS=Object.freeze({
 aviation:{title:"Авиапассажирам",text:"Лекс: задержка и отмена рейса — права пассажира и бесплатные обращения в DOCX.",path:"/aviation"},
 security:{title:"Безопасность",text:"Лекс: безопасность семьи, дома и имущества. В Пензе — предварительный набор, не действующая охрана.",path:"/security?source=DIRECT"},
 home:{title:"Защитить квартиру или дом",text:"Лекс: предварительная заявка на защиту квартиры или дома. Подача заявок откроется после проверки хранения данных; охранная услуга пока не действует.",path:"/security/home?source=DIRECT"},
 business_security:{title:"Безопасность бизнеса",text:"Лекс: раздел о безопасности бизнеса. Информационный раздел, без подключения охраны.",path:"/security/business?source=DIRECT"},
 emergency:{title:"Что делать при ЧП",text:"Короткая памятка Лекса на случай ЧП. При непосредственной опасности звоните 112.",path:"/security/emergency"},
 insurance:{title:"Страхование и ипотека",text:"Лекс: раздел страхования и ипотеки. Предложения партнёров открываются по мере проверки условий.",path:"/store/partners"},
 documents:{title:"34 бесплатных документа",text:"Лекс: 34 бесплатных конструктора DOCX. Выберите ситуацию, заполните и скачайте документ.",path:"/store"},
 individual:{title:"Индивидуальный документ",text:"Лекс: индивидуальная подготовка документа по отдельному согласованию.",path:"/services/individual"},
 transcription:{title:"Расшифровка аудио",text:"Лекс: расшифровка аудио с ручной проверкой. Стоимость уточняется до начала работы.",path:"/services/transcription"},
 order:{title:"Судебный приказ",text:"Лекс: возражения на судебный приказ и полезная инструкция.",path:"/guides/court-order"},
 fssp:{title:"Приставы и взыскания",text:"Лекс: бесплатные документы и инструкции по действиям с приставами.",path:"/guides/order-from-fssp"},
 realty:{title:"Недвижимость",text:"Лекс: бесплатные формы договоров и актов по недвижимости.",path:"/store"},
 business:{title:"Документы для бизнеса",text:"Лекс: бесплатные договоры и претензии для бизнеса.",path:"/store"},
 consumer:{title:"Права потребителя",text:"Лекс: практические инструкции и бесплатные документы для покупателей.",path:"/guides/delivery-delay"},
 car:{title:"Автоюрист",text:"Лекс: помощь с документами и ситуациями для автовладельца.",path:"/store"}
});
export function shareLinks(section,ref=""){
 const cfg=SHARE_SECTIONS[section];
 if(!cfg)throw Error("unknown_share_section");
 const targetUrl=new URL(cfg.path,ROOT);
 const code=String(ref||"").trim().toUpperCase();
 if(code){
  if(!["security","home","business_security"].includes(section)||!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code))throw Error("unsafe_referral_code");
  targetUrl.searchParams.set("ref",code);
 }
 const target=targetUrl.href;
 if(!target.startsWith(ROOT+"/"))throw Error("unsafe_share_target");
 const message=cfg.text+"\n"+target;
 return {
  title:cfg.title,target,
  max:"https://max.ru/:share?text="+encodeURIComponent(message),
  telegram:"https://t.me/share/url?url="+encodeURIComponent(target)+"&text="+encodeURIComponent(cfg.text)
 };
}
export function shareButtons(section,platform="MAX",ref=""){
 const urls=shareLinks(section,ref);
 const primary=platform==="TELEGRAM"?["telegram","Telegram"]:["max","MAX"];
 const secondary=platform==="TELEGRAM"?["max","MAX"]:["telegram","Telegram"];
 return [
  [{type:"link",text:"↗ Поделиться разделом в "+primary[1],url:urls[primary[0]]}],
  [{type:"link",text:"Поделиться в "+secondary[1],url:urls[secondary[0]]}]
 ];
}
export function shareHtml(section,ref=""){
 const u=shareLinks(section,ref);
 return '<section class="lex-share" aria-label="Поделиться разделом"><details><summary>↗ Поделиться этим разделом</summary>'+
 '<p class="lex-share-hint">Отправьте ссылку знакомому — он откроет именно раздел «'+u.title+'», а не главное меню.</p>'+
 '<div class="lex-share-actions"><a href="'+u.max+'" target="_blank" rel="noopener noreferrer">Отправить в MAX</a>'+
 '<a href="'+u.telegram+'" target="_blank" rel="noopener noreferrer">Отправить в Telegram</a></div></details></section>';
}

const INPUT_SECTIONS={
 "авиапассажирам":"aviation","авиаправа":"aviation","задержка рейса":"aviation",
 "безопасность":"security","защитить квартиру":"home","защитить квартиру / дом":"home",
 "безопасность бизнеса":"business_security","что делать при чп":"emergency",
 "страхование":"insurance","страхование и ипотека":"insurance","осаго":"insurance",
 "документы":"documents","подобрать документ":"documents","бесплатные документы":"documents",
 "индивидуальный документ":"individual","расшифровка аудио":"transcription",
 "судебный приказ":"order","приставы и взыскания":"fssp",
 "недвижимость":"realty","права потребителя":"consumer","бизнес":"business","автоюрист":"car"
};
const START_INPUT={
 security:"безопасность",home:"защитить квартиру / дом",insurance:"страхование и ипотека",
 documents:"подобрать документ",aviation:"авиапассажирам",transcription:"расшифровка аудио",
 individual:"индивидуальный документ",order:"судебный приказ",
 realty:"недвижимость",consumer:"права потребителя",business:"бизнес",fssp:"приставы и взыскания"
};
export function startInput(payload){
 return typeof payload==="string"&&/^[a-z_]{1,40}$/.test(payload)?(START_INPUT[payload]||"/start"):"/start";
}
export function withSectionShare(input,answer,platform="MAX"){
 if(!answer||!Array.isArray(answer.buttons))return answer;
 const x=String(input||"").trim().toLowerCase().replace(/^[^\p{L}\p{N}\/]+/u,"").replace(/\s+/g," ");
 const key=INPUT_SECTIONS[x];
 return key?{...answer,buttons:[...answer.buttons,...shareButtons(key,platform)]}:answer;
}
