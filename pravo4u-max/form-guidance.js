// Local-only progressive hints for Lex's 34 free document forms.
// The script never sends, saves or uploads user input and never changes legal validation.
export const FORM_GUIDANCE_JS = String.raw`
(function(){
"use strict";
var form=document.getElementById("form");
if(!form)return;
var params=new URLSearchParams(location.search);
var type=params.get("type")||"order";
var intro=document.createElement("p");
intro.className="form-helper";
intro.textContent=type==="service"
  ?"Выберите пример подходящей услуги, затем уточните детали договора. Пример можно изменить."
  :"Заполняйте поля по порядку. Подсказки показывают формат или пример, но не заполняют юридический документ вместо вас.";
var title=document.getElementById("type");
if(title&&title.parentNode)title.insertAdjacentElement("afterend",intro);
var hints={
 service:{
  city:["Например: Пенза","Город, который стороны укажут в договоре."],
  date:["ДД.ММ.ГГГГ","Дата подписания договора."],
  provider:["Иванов Иван Иванович","ФИО исполнителя точно как в документе."],
  provider_inn:["12 цифр","Укажите действительный ИНН исполнителя. Проверяйте статус НПД в ФНС."],
  customer:["Петров Пётр Петрович","ФИО заказчика по его документу."],
  customer_address:["Город, улица, дом, квартира","Адрес, согласованный сторонами для договора."],
  subject:["Например: расшифровка аудиозаписи с таймкодами","Опишите саму услугу и её границы — что входит и что не входит."],
  result:["Например: файл DOCX с текстом и таймкодами","Как заказчик поймёт, что результат получен и соответствует заказу."],
  start:["ДД.ММ.ГГГГ","Дата начала работы."],
  end:["ДД.ММ.ГГГГ","Дата завершения работы. Должна быть не раньше начала."],
  fee:["Например: 3500","Согласованная общая сумма в рублях. Пример не подставляется автоматически."],
  pay:["Например: после приёмки, по переводу на счёт","Укажите согласованный срок и способ оплаты. Номера карт не нужны."],
  report:["Например: отправка файла по электронной почте","Как передаётся результат и как заказчик сообщает о замечаниях."]
 },
 order:{
  court:["Например: судебный участок № ...","Сведения о суде перепишите из судебного приказа."],
  case:["Номер дела из судебного приказа","Не путайте номер дела с номером исполнительного производства."],
  date:["ДД.ММ.ГГГГ","Дата вынесения приказа."],
  receiptdate:["ДД.ММ.ГГГГ","Дата фактического получения копии или дата, когда узнали о приказе."],
  sum:["Например: 15000","Укажите сумму, указанную в приказе."],
  reason:["Например: не было возможности своевременно обратиться из-за ...","Заполняйте при пропуске срока. Укажите реальные обстоятельства, которые сможете подтвердить."],
  evidence:["Например: документы о вручении, справка, билеты","Перечислите только имеющиеся подтверждения."]
 }
};
var generic=function(id,label,kind){
 var text=String(label||"").toLowerCase();
 if(/дд\.мм\.гггг|дата /.test(text))return ["ДД.ММ.ГГГГ","Дату указывайте в формате день.месяц.год."];
 if(/кадастровый номер/.test(text))return ["XX:XX:XXXXXXX:XXX","Перепишите номер из актуальной выписки ЕГРН."];
 if(/(?:фио|ф\.и\.о)/i.test(text))return ["Фамилия Имя Отчество","Указывайте точное ФИО, как в документе."];
 if(/сумм|цен[аыу]|плат[аеыу]|рубл/.test(text))return ["Сумма в рублях, без ₽","Подставьте действительную сумму из договорённости или документа."];
 if(/адрес|местонахождени|местоположени/.test(text))return ["Укажите адрес полностью","Используйте точные данные, без вымышленных примеров."];
 if(kind==="textarea")return ["Опишите своими словами","Укажите только сведения, которые относятся к вашей ситуации."];
 return ["",""];
};
var fields=Array.prototype.slice.call(form.querySelectorAll(".fgroup"));
for(var i=0;i<fields.length;i++){
 var group=fields[i];
 var control=group.querySelector("input,textarea,select");
 var lab=group.querySelector("label");
 if(!control||!lab)continue;
 if(control.tagName==="TEXTAREA")control.rows=2;
 if(control.tagName==="SELECT")continue;
 var hint=(hints[type]&&hints[type][control.id])||generic(control.id,lab.textContent,control.tagName==="TEXTAREA"?"textarea":"text");
 if(hint[0])control.placeholder=hint[0];
 if(hint[1]){
  var help=document.createElement("div");
  help.className="field-help";
  help.id="help-"+control.id;
  help.textContent=hint[1];
  group.appendChild(help);
  control.setAttribute("aria-describedby",help.id);
 }
 if(control.tagName==="TEXTAREA")control.spellcheck=true;
}
if(type==="service"){
 var samples=[
  ["Расшифровка аудио","Расшифровка переданной заказчиком аудиозаписи с разделением реплик участников и таймкодами.","Редактируемый файл DOCX со стенограммой; приёмка по фактически переданному файлу."],
  ["Уборка помещения","Разовая уборка помещения по согласованному списку работ.","Оказанные услуги по уборке помещения; приёмка осмотром заказчика."],
  ["Подготовка текстов","Написание и редактирование текстовых материалов по заданию заказчика.","Комплект текстов в электронном виде; проверка по согласованному заданию."],
  ["Создание дизайна","Разработка графического макета по техническому заданию заказчика.","Готовый графический макет в согласованном цифровом формате."],
  ["Обработка фото","Обработка предоставленных фотографий с коррекцией изображения.","Отредактированные файлы изображений в согласованном формате."],
  ["Настройка компьютера","Настройка программного обеспечения компьютера заказчика без продажи лицензий.","Работающее программное обеспечение с проверкой согласованных функций."]
 ];
 var wrapper=document.createElement("section");
 wrapper.className="preset-panel";
 var heading=document.createElement("h2");
 heading.textContent="Какую услугу заказываете?";
 var caption=document.createElement("p");
 caption.textContent="Выберите близкий пример. Текст появится только в пустых полях — вы сможете его изменить.";
 var buttons=document.createElement("div");
 buttons.className="preset-buttons";
 var status=document.createElement("p");
 status.className="preset-status";
 status.setAttribute("role","status");
 for(var k=0;k<samples.length;k++){
  (function(sample){
   var btn=document.createElement("button");
   btn.type="button";
   btn.className="preset-button";
   btn.textContent=sample[0];
   btn.addEventListener("click",function(){
    var filled=[];
    var values={subject:sample[1],result:sample[2]};
    for(var id in values){
     var target=document.getElementById(id);
     if(target&&!target.value.trim()){target.value=values[id];target.dispatchEvent(new Event("input",{bubbles:true}));filled.push(id);}
    }
    status.textContent=filled.length
      ?"Пример добавлен. Проверьте и уточните описание услуги и результата."
      :"Ваш текст сохранён. При необходимости отредактируйте поля «Услуги» и «Результат» вручную.";
    var next=document.getElementById("subject");
    if(next)next.scrollIntoView({behavior:"smooth",block:"center"});
   });
   buttons.appendChild(btn);
  })(samples[k]);
 }
 wrapper.appendChild(heading);
 wrapper.appendChild(caption);
 wrapper.appendChild(buttons);
 wrapper.appendChild(status);
 form.parentNode.insertBefore(wrapper,form);
}
var submit=document.getElementById("make");
if(submit)submit.textContent=["service","rent","loan"].indexOf(type)>=0?"Создать и скачать комплект бесплатно":"Скачать готовый документ бесплатно";
})();
`;