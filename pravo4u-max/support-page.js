// Donations are monetary gifts through an external provider, NEVER payment for DOCX,
// a consultation, account access, insurance, protection or any other product.
// No bank details, donor PII, card data, payment status, webhooks or provider API here.
// The external link is only released after the recipient and provider page are verified.
const esc=x=>String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
export function verifiedSupportUrl(env={}){
 if(env.LEX_SUPPORT_LINK_VERIFIED!=="true"||env.LEX_SUPPORT_PROVIDER!=="CLOUDTIPS"||
    typeof env.LEX_SUPPORT_URL!=="string")return null;
 try{
  const u=new URL(env.LEX_SUPPORT_URL.trim());
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return null;
  const host=u.hostname.toLowerCase();
  if(host!=="cloudtips.ru"&&!host.endsWith(".cloudtips.ru"))return null;
  if(u.pathname.length<2||/^\/(?:faq|donations|tpost|ru|authors|about|contacts|privacy|terms|login)(?:\/|$)/i.test(u.pathname))
   return null;
  if(u.search||u.pathname.includes("//")||u.pathname.includes("\\")||u.pathname.length>180)return null;
  return u.href;
 }catch{return null}
}
export function supportContent(env={}){
 const link=verifiedSupportUrl(env);
 const payment=link?
   '<p><strong>Добровольный перевод доступен.</strong> Деньги направляются выбранному вами получателю через внешний сервис CloudTips, а не в кассу ЛЕКС.</p>'+
   '<p><a class="cta" href="'+esc(link)+'" rel="noopener noreferrer external nofollow" referrerpolicy="no-referrer" target="_blank">Поддержать проект — перейти в CloudTips</a></p>'+
   '<p class="catalog-muted">На открывшейся странице проверьте имя получателя, сумму и комиссию до подтверждения. При несовпадении получателя ничего не переводите. Возможность перевода и точные комиссии определяет CloudTips.</p>':
   '<p><strong>Сейчас денежные переводы не подключены.</strong> Ссылка на приём поддержки появится здесь только после проверки владельца платёжной страницы и её реквизитов. Не переводите деньги по неофициальным сообщениям и реквизитам, выдаваемым за ЛЕКС.</p>';
 return [
'<h2>Поддержать бесплатный проект ПРАВО4U</h2>',
'<p class="status"><strong>34 юридических конструктора бесплатны для всех.</strong> ЛЕКС помогает самостоятельно готовить типовые документы и разбираться в последовательности действий. Поддержка проекта всегда по желанию и не влияет на доступ.</p>',
'<section class="card"><h3>Как помочь без денег</h3><p>Расскажите о ЛЕКС тем, кому нужны документы, поделитесь полезной инструкцией, сообщите об ошибке или предложите новый шаблон.</p>'+
'<p><a href="/go/telegram?from=support" target="_blank" rel="noopener noreferrer">Канал в Telegram</a> · <a href="/go/max?from=support" target="_blank" rel="noopener noreferrer">Канал в MAX</a> · <a href="mailto:lexpravo4u@gmail.com?subject=%D0%9F%D0%A0%D0%90%D0%92%D0%9E4U%20%E2%80%94%20%D0%BF%D0%BE%D0%BC%D0%BE%D1%89%D1%8C%20%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82%D1%83">Написать автору</a></p></section>',
'<section class="card"><h3>Добровольная денежная поддержка</h3>'+payment+
'<p>Денежная поддержка — это безвозмездный перевод. Она <strong>не является оплатой</strong> документа, консультации, подписки или иных услуг. За неё не предоставляются привилегии, индивидуальные документы, юридическая помощь или специальные условия. Доступ к бесплатным формам не зависит от суммы и факта перевода.</p></section>',
'<p>ПРАВО4U не является благотворительным фондом или НКО и не объявляет благотворительный сбор. Если перевод доступен, его получает указанный на внешней странице адресат, а не вымышленная организация. Пользователь вправе не переводить ничего.</p>',
'<p><a href="/store/terms">Условия бесплатного использования</a> · <a href="/store/privacy">Политика данных</a>.</p>'
 ].join("");
}
// Keep existing callers/tests compatible; production renders supportContent(env).
export const SUPPORT_HTML=supportContent();
