import assert from "node:assert/strict";
import {patchTelegramFreeShare,REWARDS_PATCH_MARK} from "../src/telegram-free-share-patch.mjs";
const root="https://pravo4u-max.cbd-legal-cloudflare-worker.workers.dev";
const fixture=[
 'var VERSION = "2.2.2";',
 '/* LEX_SECURITY_MENU_2026_11_05 */',
 '/* LEX_DOC_GATE_FAIL_CLOSED_2026_11_03 */',
 'function mainMenu(){ return {inline_keyboard: []}; }',
 '      [{ text: "🛡️ Безопасность", url: "'+root+'/security?source=TELEGRAM" }],',
 'async function showHome(env, chatId, messageId = null) {',
 '  const available = await giftBalance(env, chatId);',
 '  const text2 = LEX_START + `\\n\\n🎁 Ваши подарки: ${available}. ${available>0?"Подарок":"Подарите документ другу"}`;',
 '  return sendText(env,chatId,text2,{reply_markup:mainMenu()});',
 '}',
 '__name(showHome, "showHome");',
 '  async function screen(env, id) {',
 '    await send(env,id,"🎁 Ваши подарки",[]);',
 '  }',
 '  __name(screen, "screen");',
 '  async function offer(env, id) {',
 '    await send(env,id,"🎁 Первый документ в подарок",[]);',
 '    return true;',
 '  }',
 '  __name(offer, "offer");',
 '  async function invite(env, id, share = false) {',
 '    await send(env,id,"Первый документ в подарок. Затем 25 ⭐",[]);',
 '  }',
 '  __name(invite, "invite");',
 '  async function onboarding(env, id) {',
 '    await send(env,id,"🎁 Подарок",[]);',
 '  }',
 '  __name(onboarding, "onboarding");',
 'async function handleUpdate(env, update) {',
 '  if(await growth.update(env,update))return;',
 '}',
 'function publicPage(env){return "Первый документ нового пользователя — в подарок.";}'
].join("\n").padEnd(1000120," ");
const after=patchTelegramFreeShare(fixture);
assert.match(after,/LEX_FREE_REWARDS_AND_SECTION_SHARING_2026_11_05/);
assert.match(after,/Все 34 типовых документа доступны бесплатно/);
assert.match(after,/Поделиться безопасностью/);
assert.match(after,/Поделиться страхованием/);
assert.match(after,/\/store\/partners/);
assert.match(after,/\/security\?source=TELEGRAM/);
assert.match(after,/https:\/\/t\.me\/share\/url\?/);
assert.ok(!after.includes('Первый документ в подарок. Затем 25 ⭐'));
assert.ok(!after.includes('Первый документ нового пользователя — в подарок.'));
assert.throws(()=>patchTelegramFreeShare(after),/already_patched/);
assert.throws(()=>patchTelegramFreeShare(fixture.replace("LEX_SECURITY_MENU_2026_11_05","MISSING")),/unknown_telegram/);
assert.match(after,/callback_query\.data\.startsWith\("gift:"\)/);
assert.match(after,/ref_\[a-f0-9\]/);
assert.doesNotThrow(()=>new Function(after));
console.log("TELEGRAM FREE SHARE PATCH PASS: old gift invitations and Star messaging disabled, existing handler structure retained");
