// Editable legal blanks only. No user input, names, data collection or payment.
const enc=new TextEncoder();
const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const LINE="____________________________________________________";
const docs={
 order:[
 "Мировому судье судебного участка № ___________",
 "Адрес судебного участка: "+LINE,
 "Должник (ФИО): "+LINE,
 "Адрес для корреспонденции: "+LINE,
 "Взыскатель: "+LINE,
 "Дело № ____________",
 "ВОЗРАЖЕНИЯ ОТНОСИТЕЛЬНО ИСПОЛНЕНИЯ СУДЕБНОГО ПРИКАЗА",
 "Судебным приказом мирового судьи судебного участка № ___ от «___» _________ 20___ г. по делу № ____________ взыскана задолженность в пользу "+LINE+".",
 "С судебным приказом не согласен(на). Возражаю относительно его исполнения.",
 "На основании статьи 129 Гражданского процессуального кодекса Российской Федерации ПРОШУ отменить судебный приказ от «___» _________ 20___ г. по делу № ________________.",
 "Дата получения копии приказа (если известна): _______________.",
 "Приложения (при необходимости): "+LINE,
 "Дата: «___» ___________ 20___ г.   Подпись: _______________",
 "ВАЖНО: десятидневный срок представления возражений исчисляется со дня получения копии приказа (статьи 128–129 ГПК РФ). При пропуске срока требуется отдельно оценить обстоятельства, препятствовавшие своевременной подаче, и их подтверждение."
 ],
 rent:[
 "ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ — БЛАНК ДЛЯ ЗАПОЛНЕНИЯ",
 "г. _______________        «___» __________ 20___ г.",
 "Наймодатель (ФИО) "+LINE+" и Наниматель (ФИО) "+LINE+" заключили договор:",
 "1. Наймодатель предоставляет для проживания квартиру по адресу "+LINE+". Кадастровый номер (если известен): _______________. Право наймодателя подтверждается: "+LINE+".",
 "2. Срок найма: с «___» _______ 20___ г. по «___» _______ 20___ г. Сроки и регистрационные последствия стороны проверяют до подписания.",
 "3. Ежемесячная плата ___________ рублей. Срок внесения: до ____ числа. Способ расчетов: "+LINE+". Распределение коммунальных расходов: "+LINE+".",
 "4. Обеспечительный платеж (если предусмотрен): __________ рублей. Условия зачета и возврата: "+LINE+".",
 "5. Квартира, ключи, показания приборов учета и перечень имущества передаются по подписываемому сторонами акту приема-передачи.",
 "6. Наниматель использует помещение для проживания, соблюдает права соседей и оплачивает согласованные расходы. Нормальный износ сам по себе не является ущербом.",
 "7. Условия ремонта, осмотров, домашних животных и совместного проживания: "+LINE+".",
 "8. Досрочное прекращение, выселение и взаиморасчеты определяются обязательными нормами законодательства РФ.",
 "9. Подписи: Наймодатель __________________ /________. Наниматель __________________ /________.",
 "АКТ ПРИЕМА-ПЕРЕДАЧИ",
 "К договору от «___» __________ 20___ г. Квартира: "+LINE+". Дата передачи: __________. Состояние: "+LINE+". Показания счетчиков: "+LINE+". Передано ключей: __________. Имущество по описи: "+LINE+". Подписи: "+LINE
 ]};
function crc(buf){let n=~0;for(const b of buf){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^(-(n&1)&0xedb88320);}return (~n)>>>0;}
const put16=(a,n)=>a.push(n&255,n>>>8&255);
const put32=(a,n)=>a.push(n&255,n>>>8&255,n>>>16&255,n>>>24&255);
function makeZip(files){const a=[],c=[];let offset=0;for(const [name,str]of files){const n=enc.encode(name),d=enc.encode(str),sum=crc(d),h=[];put32(h,0x04034b50);put16(h,20);put16(h,2048);put16(h,0);put16(h,0);put16(h,0);put32(h,sum);put32(h,d.length);put32(h,d.length);put16(h,n.length);put16(h,0);a.push(new Uint8Array(h),n,d);
 const x=[];put32(x,0x02014b50);put16(x,20);put16(x,20);put16(x,2048);put16(x,0);put16(x,0);put16(x,0);put32(x,sum);put32(x,d.length);put32(x,d.length);put16(x,n.length);put16(x,0);put16(x,0);put16(x,0);put16(x,0);put32(x,0);put32(x,offset);c.push(new Uint8Array(x),n);offset+=h.length+n.length+d.length;
 }const size=c.reduce((s,b)=>s+b.length,0),end=[];put32(end,0x06054b50);put16(end,0);put16(end,0);put16(end,files.length);put16(end,files.length);put32(end,size);put32(end,offset);put16(end,0);return new Blob([...a,...c,new Uint8Array(end)],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});}
export function blankDocx(kind){if(!Object.hasOwn(docs,kind))return null;
 const lines=[...docs[kind],"Образец для самостоятельного заполнения. Не официальный бланк и не индивидуальная юридическая консультация. Впишите персональные данные в файл самостоятельно; не присылайте их в чат."];
 const para=lines.map((x,i)=>'<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/>'+([6,0].includes(i)?'<w:b/>':'')+'</w:rPr><w:t xml:space="preserve">'+esc(x)+'</w:t></w:r></w:p>').join("");
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+para+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>';
 const files=[["[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],["_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],["word/document.xml",xml]];
 return {file:kind==="order"?"pravo4u_order_blank.docx":"pravo4u_rent_blank.docx",data:makeZip(files)};
}