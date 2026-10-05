import { chromium } from "playwright";
import fs from "node:fs/promises";

const browser = await chromium.launch({
  headless: true
});

const page = await browser.newPage();

try {
  await page.setContent(
    "<!doctype html><html><head><title>Browser OK</title></head><body><h1>Browser OK</h1></body></html>"
  );

  const title = await page.title();
  const heading =
    await page.locator("h1").first().textContent();

  const result = {
    ok:
      title === "Browser OK" &&
      heading === "Browser OK",
    url: "local-browser-test",
    title,
    heading,
    checkedAt: new Date().toISOString()
  };

  await fs.mkdir("artifacts", {
    recursive: true
  });

  await page.screenshot({
    path: "artifacts/browser-test.png",
    fullPage: true
  });

  await fs.writeFile(
    "artifacts/result.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(
    JSON.stringify(result, null, 2)
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
