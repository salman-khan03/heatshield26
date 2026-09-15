// Captures the key demo states with a local Chrome (software WebGL) for review and Devpost.
//   npm run dev   (in another terminal)
//   node scripts/screenshots.mjs [baseUrl]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "..", "docs", "screenshots");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));

const clickText = (text, scope = "body") =>
  page.evaluate(
    (t, s) => {
      const el = [...document.querySelector(s).querySelectorAll("button")].find((b) => b.innerText.trim().startsWith(t));
      if (!el) throw new Error(`button not found: ${t}`);
      el.click();
    },
    text,
    scope,
  );
const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log("saved", name);
};

// Landing
await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 90000 });
await sleep(1500);
await shot("01-landing");

// Planner baseline
await page.goto(`${BASE}/planner`, { waitUntil: "networkidle2", timeout: 90000 });
await page.waitForSelector(".maplibregl-canvas", { timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll("aside")[1]?.innerText.includes("Highest-risk zones".toUpperCase()) || document.querySelectorAll("aside")[1]?.innerText.includes("HIGHEST-RISK"), { timeout: 60000 });
await sleep(9000);
await shot("02-planner-risk");

// Select the top-ranked zone
await page.evaluate(() => {
  const aside = document.querySelectorAll("aside")[1];
  const row = [...aside.querySelectorAll("ol button")][0];
  row.click();
});
await sleep(3500);
await shot("03-zone-detail");

// 3D view
await clickText("3D", "aside");
await sleep(3500);
await shot("04-3d");
await clickText("2D", "aside");
await sleep(1500);

// Optimizer
await page.evaluate(() => {
  const tab = [...document.querySelectorAll("[role=tab]")].find((b) => b.innerText.trim().startsWith("Optimize"));
  tab.click();
});
await sleep(600);
await clickText("Optimize $1M plan", "body");
await sleep(5000);
await shot("05-optimized-plan");

// Crowd layer with routes
await clickText("Crowd", "aside");
await clickText("Show modeled routes", "aside");
await sleep(3000);
await shot("06-crowd-routes");

await browser.close();
