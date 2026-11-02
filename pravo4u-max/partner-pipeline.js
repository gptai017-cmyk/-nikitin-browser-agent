// Internal partner pipeline for Russian-city growth. NOT an affiliate offer or a production referral link.
// Do not publish attributed URLs until a signed/accepted agreement, verified tracking and ad clearance.
export const MAJOR_CITY_WAVE=[
  "Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань",
  "Нижний Новгород","Краснодар","Самара","Ростов-на-Дону","Челябинск",
  "Уфа","Красноярск","Пермь","Воронеж","Волгоград","Омск"
];
export const PARTNER_PIPELINE=Object.freeze([
 {id:"etagi",company:"Этажи",segment:"realty_agent",priority:1,status:"approval_required",terms_url:"https://partners.etagi.pro/",consumer_link:null,conditions:"До 20% от комиссии при подтвержденной сделке; проверка оферты, формы заявок и допустимого налогового режима обязательна."},
 {id:"kontur_realty",company:"Контур.Недвижимость",segment:"realty_due_diligence",priority:1,status:"approval_required",terms_url:"https://kontur.ru/partnership/online/rules",consumer_link:null,conditions:"Исключены НПД и АУСН, договор агентский. Возможен иной допустимый формат при отдельном оформлении."},
 {id:"dvitex",company:"Двитекс",segment:"legal",priority:2,status:"approval_required",terms_url:"https://www.dvitex.ru/for_partners/",consumer_link:null,conditions:"10% первого договора, 5% следующих в течение года, условия фиксации клиента — после подключения."},
 {id:"sravni",company:"Сравни",segment:"insurance",priority:1,status:"tracking_prepared_ad_clearance_required",terms_url:"https://partner.sravni.ru/dashboard",consumer_link:null,conditions:"Идентификатор 101540; собственные ссылки сохранены в partner-offers.js; публикация заблокирована до оформления рекламы."}
]);
