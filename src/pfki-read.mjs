import { chromium } from "playwright";

const origin = "https://xn--80af5akm8c.xn--h1adou.xn--p1ai";
const loginUrl = origin + "/identity/account/login?ReturnUrl=/user/profile";
const exactProject = /^ПФКИ-\d{2}-\d-\d{6}$/;
const clean = s => String(s || "").trim();
const ratingLabel = /рейтинг|итогов.{0,15}балл|набран.{0,15}балл|результат.{0,15}экспертиз/i;

export async function readPfki(task) {
  const project = clean(task.project);
  if (!exactProject.test(project)) throw Error("PFKI_PROJECT_INVALID");
  const login = process.env.PFKI_LOGIN;
  const password = process.env.PFKI_PASSWORD;
  if (!login || !password) return {status:"failed",code:"PFKI_SECRETS_MISSING"};
  let browser, stage = "launch";
  const redact = s => String(s || "").split(password).join("[REDACTED]").split(login).join("[REDACTED]");
  try {
    browser = await chromium.launch({headless:true,channel:"chrome"});
    const context = await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:"block"});
    // Never transmit account data to a third-party origin. Allow only official PFKI requests.
    await context.route("**/*", async route => {
      const req=route.request();
      let u; try{u=new URL(req.url());}catch{return route.abort();}
      if(u.origin!==origin) return route.abort();
      return route.continue();
    });
    const page=await context.newPage();
    const body=async()=>redact(await page.locator("body").innerText({timeout:12000}).catch(()=> ""));
    const pause=ms=>page.waitForTimeout(ms);
    const visible=async loc=>await loc.isVisible().catch(()=>false);
    const clickVisible=async loc=>{
      for(let i=0;i<Math.min(await loc.count(),20);i++){
        const el=loc.nth(i);
        if(await visible(el)){await el.click({timeout:8000});return true;}
      }
      return false;
    };
    stage="login";
    await page.goto(loginUrl,{waitUntil:"domcontentloaded",timeout:35000});
    if(new URL(page.url()).origin!==origin) return {status:"failed",code:"PFKI_ORIGIN_MISMATCH"};
    const pw=page.locator('input[type="password"]:visible').first();
    await pw.waitFor({state:"visible",timeout:15000});
    const form=pw.locator("xpath=ancestor::form[1]");
    if(await form.count()!==1) return {status:"failed",code:"PFKI_LOGIN_FORM_NOT_FOUND"};
    const action=await form.getAttribute("action");
    if(new URL(action||page.url(),page.url()).origin!==origin) return {status:"failed",code:"PFKI_FORM_ORIGIN_MISMATCH"};
    const user=form.locator('input[type="email"],input[autocomplete="username"],input[type="text"]').first();
    if(!await visible(user)) return {status:"failed",code:"PFKI_LOGIN_FIELD_NOT_FOUND"};
    const submit=form.getByRole("button",{name:/^(вход|войти)$/i}).first();
    if(!await visible(submit)) return {status:"failed",code:"PFKI_LOGIN_BUTTON_NOT_FOUND"};
    await user.fill(login);
    await pw.fill(password);
    await submit.click({timeout:10000});
    await page.waitForURL(u=>!u.pathname.toLowerCase().includes("/identity/account/login"),{timeout:25000}).catch(()=>{});
    await pause(1800);
    if(await visible(page.locator('input[type="password"]:visible').first()) || /\/identity\/account\/login/i.test(page.url())){
      return {status:"failed",code:"PFKI_AUTH_NOT_CONFIRMED",details:(await body()).slice(0,2000)};
    }
    stage="projects";
    const projectLocator=()=>page.getByText(project,{exact:true});
    if(!await visible(projectLocator().first())){
      await clickVisible(page.getByText("Мои проекты",{exact:true})).catch(()=>false);
      await projectLocator().first().waitFor({state:"visible",timeout:15000}).catch(()=>{});
    }
    if(!await visible(projectLocator().first())){
      return {status:"partial",code:"PFKI_PROJECT_NOT_FOUND",url:page.url(),details:(await body()).slice(0,2200)};
    }
    const row=await projectLocator().first().evaluate(e=>(e.closest("tr,[role=row]")||e.parentElement?.parentElement||e).innerText).catch(()=>project);
    stage="project";
    await clickVisible(projectLocator());
    await pause(2200);
    await page.waitForLoadState("domcontentloaded",{timeout:8000}).catch(()=>{});
    let details=await body();
    const before=details;
    // Only navigate an explicit rating link/number in the rating region.
    stage="rating";
    const candidates=await page.evaluate(()=>{
      const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const rx=/рейтинг|итогов.{0,15}балл|набран.{0,15}балл|результат.{0,15}экспертиз/i;
      const num=/^\s*\d{1,3}(?:[,.]\d{1,3})?\s*(?:балл(?:а|ов)?)?\s*$/i;
      const nodes=[...document.querySelectorAll('a,button,[role=button],[role=link],[title],[data-bs-toggle],span')];
      return nodes.map((e,i)=>{
        const t=(e.innerText||e.textContent||"").trim();
        const attr=[e.getAttribute("title"),e.getAttribute("aria-label")].filter(Boolean).join(" ");
        const near=(e.parentElement?.innerText||"").trim().slice(0,240);
        const click=e.matches('a,button,[role=button],[role=link],[data-bs-toggle]')||getComputedStyle(e).cursor==="pointer";
        const dangerous=/отправ|подать|удал|отозва|создать|сохран|подпис|редакт/i.test(t+" "+attr);
        const score=!vis(e)||!click||dangerous?0:((rx.test(attr)||rx.test(t))&&t.length<90?5:num.test(t)&&rx.test(near)?4:num.test(t)&&/балл/i.test(near)?3:0);
        return {i,t,attr,near,score};
      }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
    });
    if(candidates.length){
      const best=candidates[0];
      const loc=page.locator('a,button,[role=button],[role=link],[title],[data-bs-toggle],span').nth(best.i);
      await loc.click({timeout:8000}).catch(()=>{});
      await pause(1400);
      details=await body();
    }
    const tables=await page.locator("table:visible").allInnerTexts().catch(()=>[]);
    const dialogs=await page.locator('[role="dialog"]:visible,.modal.show').allInnerTexts().catch(()=>[]);
    const ratingPresent=ratingLabel.test(details);
    return {
      status:"completed",authenticated:true,project,project_row:redact(row),url:page.url(),
      rating_candidates:candidates.slice(0,12).map(c=>({text:redact(c.t),label:redact(c.attr),near:redact(c.near)})),
      rating_label_present:ratingPresent,
      project_text:before.slice(0,16000),
      after_rating_text:details.slice(0,18000),
      tables:tables.map(x=>redact(x).slice(0,12000)).slice(0,8),
      dialogs:dialogs.map(x=>redact(x).slice(0,12000)).slice(0,5)
    };
  }catch(e){
    return {status:"failed",code:"PFKI_BROWSER_STAGE_FAILED",stage,error_type:e?.name||"Error"};
  }finally{await browser?.close().catch(()=>{});}
}
