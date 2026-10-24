import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const code=fs.readFileSync('pravo4u-checkout/extra-docs.js','utf8')+'\n'+fs.readFileSync('pravo4u-checkout/doc-generator.js','utf8').replace(/\nstart\(\);\s*$/,'');
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
fssp_minimum:{office:'Отдел ФССП по адресу Примерная, 1',officer:'Пристав Тестов',full:'Тестовый Должник',address:'г. Пенза',case:'12345/26/58000-ИП',income:'Заработная плата',bank:'Тестовый банк и адрес',account:'40817810000000000001',basis:'ordinary',dependents:'no',attachments:'Справка о доходах'},
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
console.log('All SIX local document generators PASS');
