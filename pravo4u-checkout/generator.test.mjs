import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const code=fs.readFileSync('pravo4u-checkout/doc-generator.js','utf8').replace(/\nstart\(\);\s*$/,'');
const api={};
new Function('exports',code+'\nexports.order=order;exports.rental=rental;exports.validate=validate;')(api);
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
console.log('All local document generator tests PASS');
