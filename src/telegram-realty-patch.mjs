// Surgical Telegram Lex patch. Operates on a downloaded Worker bundle locally in CI.
// Never commit or log the downloaded Worker source; its secrets/bindings stay untouched.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const MENU_MARK='/* PRAVO4U_LEX_REALTY_CATALOG_2026_10_28 */';
const ANCHOR=[
 '  const sectionMatch = /^section_(fssp|military|car|realty|business|lawyer)$/u.exec(query.data || "");',
 '  if (sectionMatch) {',
 '    await showLeadCategory(env, chatId, messageId, sectionMatch[1]);',
 '    return;',
 '  }'
].join('\n');
const ROOT='https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev';
const products=[
 ['ДКП участка','land_sale'],
 ['Участок и жилой дом','land_house_sale'],
 ['Садовый участок','garden_land_sale'],
 ['Садовый участок и дом','garden_house_sale'],
 ['ДКП квартиры','flat_sale'],
 ['ДКП гаража','garage_sale']
];
export function patchTelegramScript(original){
 if(!original.includes('var VERSION = "2.2.2";'))throw Error('Unexpected Telegram Worker version; refusing to update');
 if(original.includes(MENU_MARK))throw Error('Realty integration already present; no duplicate');
 if(original.split(ANCHOR).length!==2)throw Error('Callback section anchor not unique; no patch');
 const rows=[
 ...products.map(([label,id])=>[{text:label,url:ROOT+'/compose?type='+id}]),
 [{text:'📑 Все документы ПРАВО4U',url:ROOT+'/store'}]
 ];
 const added=[
 '  if (sectionMatch) {',
 '    await showLeadCategory(env, chatId, messageId, sectionMatch[1]);',
 '    if (sectionMatch[1] === "realty") {',
 '      '+MENU_MARK,
 '      try {',
 '        await sendText(env, chatId, "📄 Договоры недвижимости: выберите типовой комплект. Анкета и DOCX откроются в браузере. В сложных сделках нужна индивидуальная проверка.", {',
 '          reply_markup: {inline_keyboard: '+JSON.stringify(rows)+'}',
 '        });',
 '      } catch(e) { console.error("lex_realty_catalog_links_unavailable"); }',
 '    }',
 '    return;',
 '  }'
 ].join('\n');
 return original.replace(ANCHOR,ANCHOR.replace([
 '  if (sectionMatch) {',
 '    await showLeadCategory(env, chatId, messageId, sectionMatch[1]);',
 '    return;',
 '  }'
 ].join('\n'),added));
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw Error('Usage: node src/telegram-realty-patch.mjs original.js patched.js');
 const before=fs.readFileSync(input,'utf8');
 const after=patchTelegramScript(before);
 if(after.length<=before.length||after.length-before.length>5000)throw Error('Unexpected diff size');
 fs.writeFileSync(output,after);
 console.log('Patch validated: exactly one Telegram realty menu insertion; size delta '+(after.length-before.length)+' bytes.');
}
