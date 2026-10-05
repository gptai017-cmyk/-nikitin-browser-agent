import { chromium } from "playwright";

const targetUrl =
  process.env.TARGET_URL ||
  "https://example.com";

const task =
  process.env.TASK ||
  "Open the page";

console.log("TASK:", task);
console.log("TARGET:", targetUrl);

const browser = await chromium.launch({
  headless: true
});

try {
  const page = await browser.newPage();

  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  console.log(
    "TITLE:",
    await page.title()
  );

  console.log(
    "URL:",
    page.url()
  );
} finally {
  await browser.close();
}
