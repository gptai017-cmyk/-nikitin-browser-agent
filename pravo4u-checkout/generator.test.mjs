import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const code=fs.readFileSync('pravo4u-checkout/extra-docs.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/more-docs.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/rf-abroad-docs.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/realty-docs.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/realty-addons.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/doc-generator.js','utf8').replace(/\nstart\(\);\s*$/,'');
const api={};
new Function('exports',code+'\nexports.order=order;exports.rental=rental;exports.validate=validate;exports.EXTRA=EXTRA;')(api);
const orderFields={
 court:'Мировой судья судебного участка № 1 г. Пензы',case:'2-123/2026',date:'01.10.2026',
 full:'Иванов Иван Иванович',address:'г. Пенза, ул. Примерная, дом 2',
 creditor:'ООО Пример',sum:'100000',received:'received',receiptdate:'02.10.2026',
 late:'no',reason:'',evidence:''
};
api.validate('order',orderFields);
const orderFile=await api.order(orderFields);
assert.ok(orderFile instanceof Uint8Array && orderFile.length>1000);
fs.writeFileSync('/tmp/pravo_order_test.docx',orderFile);
const rentFields={
 city:'Пенза',contract_date:'23.10.2026',landlord:'Иванов Иван Иванович',landlord_passport:'58 01 123456, выдан УМВД 01.04.2019, код 580-001',
 landlord_address:'г. Пенза, ул. Примерная, д. 1',landlord_contact:'+79000000001',
 tenant:'Петров Пётр Петрович',tenant_passport:'58 02 654321, выдан УМВД 15.02.2020, код 580-002',
 tenant_address:'г. Пенза, ул. Примерная, д. 2',tenant_contact:'+79000000002',
 flat:'г. Пенза, ул. Примерная, д. 1, кв. 2',cadastral:'58:29:0101001:333',
 area:'42',rooms:'2',ownership:'Договор купли-продажи, запись ЕГРН 2022',
 residents:'нет',start:'24.10.2026',end:'23.09.2027',
 rent_amount:'25000',payday:'5',deposit:'25000',payinfo:'перевод на счет наймодателя',
 utilities:'коммунальные по счётчикам',pets:'no',visits:'30',
 property:'стол, холодильник, диван',condition:'пригодна для проживания',
 meters:'электричество 111',keys:'два комплекта',complex:'no'
};
api.validate('rent',rentFields);
const rentFile=await api.rental(rentFields);
assert.ok(rentFile instanceof Blob && rentFile.size>6000);
fs.writeFileSync('/tmp/pravo_rent_test.zip',new Uint8Array(await rentFile.arrayBuffer()));
const failed={...rentFields,complex:'yes'};
assert.throws(()=>api.validate('rent',failed),/Нужна индивидуальная проверка/);

const examples={
loan:{city:'Пенза',signed:'24.10.2026',lender:'Тестовый Займодавец',lender_passport:'58 01 000001',lender_address:'Адрес 1',borrower:'Тестовый Заёмщик',borrower_passport:'58 01 000002',borrower_address:'Адрес 2',amount:'50000',term:'24.01.2027',method:'bank',repayment:'bank',special:'no'},
service:{city:'Пенза',date:'24.10.2026',provider:'Исполнитель Тестовый',provider_inn:'583403642667',customer:'Тестовый Заказчик',customer_address:'Адрес заказчика',subject:'Подготовка цифровых материалов',result:'Файл DOCX',start:'24.10.2026',end:'30.10.2026',fee:'2500',pay:'Перевод на счёт после приёмки',report:'Электронная почта',restricted:'no'},
fssp_minimum:{office:'Отдел ФССП по адресу Примерная, 1',officer:'Пристав Тестов',full:'Тестовый Должник',address:'г. Пенза',case:'12345/26/58000-ИП',citizenship:'Российская Федерация',passport:'Паспорт 58 01 000001, выдан УМВД 01.01.2015',phone:'+79000000001',income:'Заработная плата',bank:'Тестовый банк и адрес',account:'40817810000000000001',basis:'ordinary',dependents:'no',attachments:'Справка о доходах'},
course_refund:{seller:'ООО Тестовое обучение',seller_address:'test@example.invalid',buyer:'Тестовый Покупатель',buyer_contact:'test@example.invalid',course:'Учебный курс',contract:'Заказ № 15',paid:'4500',paydate:'24.10.2026',services:'Не начались',request:'refusal',facts:'Отказ направлен 24.10.2026',refund:'Исходный способ оплаты'}
};
for(const [key,fields] of Object.entries(examples)){
 api.validate(key,fields);
 const data=await api.EXTRA[key].build(fields);
 const ext=['loan','service'].includes(key)?'zip':'docx';
 const bytes=data instanceof Blob?new Uint8Array(await data.arrayBuffer()):data;
 assert.ok(bytes.length>1000);
 fs.writeFileSync('/tmp/pravo_'+key+'_test.'+ext,bytes);
}
assert.throws(()=>api.validate('loan',{...examples.loan,special:'yes'}),/не допускается/);
assert.throws(()=>api.validate('fssp_minimum',{...examples.fssp_minimum,basis:'excluded'}),/сохранение минимума/);
assert.throws(()=>api.validate('course_refund',{...examples.course_refund,request:'defect'}),/требует проверки/);

const otherKeys=Object.keys(api.EXTRA).filter(k=>!Object.hasOwn(examples,k));
for(const key of otherKeys){
 const spec=api.EXTRA[key], input={};
 for(const [name,label,type,options] of spec.fields){
   if(type==='select')input[name]=options[0].split('|')[0];
   else if(name==='vin')input[name]='XTA210990Y1234567';
   else if(name==='keys')input[name]='2';
   else if(name==='land_cad')input[name]='58:05:0701901:123';
   else if(name==='object_cad')input[name]='58:05:0701901:124';
   else if(name==='land_area'||name==='object_area')input[name]='650';
   else if(name==='price'&&['land_house_sale','garden_house_sale','realty_advance','realty_deposit'].includes(key))input[name]='60000';
   else if(name==='return_sum')input[name]='0';
   else if(name==='due_day')input[name]='5';
   else if(name==='main_due')input[name]='24.01.2027';
   else if(name==='end'&&key==='land_lease_short')input[name]='24.11.2026';
   else if(['price','land_price','building_price','sum','paid','debt','fee','rent','deposit'].includes(name))input[name]='30000';
   else if(['date','signed','contract_date','due','start','end','known','purchase','orderdate','notice','deliverydate','maturity_date','settlement_date','handover','payment_due','return_due'].includes(name))input[name]='24.10.2026';
   else input[name]='Тестовые сведения для поля '+label;
 }
 api.validate(key,input);
 const data=await spec.build(input),ext=spec.zip?'zip':'docx';
 const bytes=data instanceof Blob?new Uint8Array(await data.arrayBuffer()):data;
 assert.ok(bytes.length>1000,'Empty output: '+key);
 fs.writeFileSync('/tmp/pravo_'+key+'_test.'+ext,bytes);
 if(spec.zip) assert.ok(bytes.length>3000,'Too small ZIP: '+key);
}
for(const key of ['fssp_complaint','vehicle_sale','work_contract','online_return','defect_return']){
  const spec=api.EXTRA[key],data={};
  for(const [name,label,type,options] of spec.fields)data[name]=type==='select'?options[0].split('|')[0]:['price','sum','paid'].includes(name)?'30000':['date','start','end','due','known','orderdate','purchase','notice'].includes(name)?'24.10.2026':name==='vin'?'XTA210990Y1234567':'Тест';
  if(key==='fssp_complaint')data.deadline='outside';
  if(key==='vehicle_sale')data.risk='yes';
  if(key==='work_contract')data.complex='yes';
  if(key==='online_return')data.delivery='late';
  if(key==='defect_return')data.excluded='yes';
  assert.throws(()=>api.validate(key,data),/проверки|стоп-фактор|не допускается|Срок|юридической/i,'Failed stop-factor: '+key);
}
// Transaction safeguards: never auto-generate a deal without surveyed boundaries / verified title.
const baseRealty={};
for(const [field,label,type,opts] of api.EXTRA.land_house_sale.fields){
 baseRealty[field]=type==='select'?opts[0].split('|')[0]:
 field==='land_cad'?'58:05:0701901:123':
 field==='object_cad'?'58:05:0701901:124':
 ['land_area','object_area'].includes(field)?'650':
 field==='price'?'60000':
 ['land_price','building_price'].includes(field)?'30000':
 ['signed','settlement_date','handover'].includes(field)?'28.10.2026':'Тестовое значение';
}
assert.throws(()=>api.validate('land_house_sale',{...baseRealty,boundaries:'no'}),/границ/i);
assert.throws(()=>api.validate('land_house_sale',{...baseRealty,encumbrances:'yes'}),/проверки/i);
assert.throws(()=>api.validate('land_house_sale',{...baseRealty,object_cad:'58:05:0701901:123'}),/отличаться/i);
assert.throws(()=>api.validate('land_house_sale',{...baseRealty,price:'50000'}),/совпадать/i);
assert.throws(()=>api.validate('land_house_sale',{...baseRealty,residents:'yes'}),/пользования/i);
// Additional standard property safeguards
const deposit={};
for(const [field,label,type,opts] of api.EXTRA.realty_deposit.fields)deposit[field]=type==='select'?opts[0].split('|')[0]:field==='land_cad'?'58:05:0701901:123':field==='price'?'60000':field==='sum'?'30000':['signed','payment_due'].includes(field)?'24.10.2026':'Тест';
assert.throws(()=>api.validate('realty_deposit',{...deposit,prelim_confirm:'no'}),/предварительн/i);
assert.throws(()=>api.validate('realty_advance',{...deposit,risks:'yes'}),/проверки/i);
console.log('All '+(6+otherKeys.length)+' local document generators PASS, 10+ stop checks.');

