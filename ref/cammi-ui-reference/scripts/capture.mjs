/**
 * Screenshot every screen at desktop and phone width for side-by-side review.
 *   npm run build && npx vite preview --port 4173   (in one terminal)
 *   node scripts/capture.mjs [baseUrl] [outDir]      (needs `playwright`)
 * Point baseUrl at the real Next.js app to capture the implementation the same way
 * (then pass routes manually; this script reads the reference app's index).
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:4173/";
const out = process.argv[3] ?? "reference-screenshots";
const widths = [1440, 390];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base);
const paths = await page.$$eval("main a[href^='#/']", (links) => links.map((a) => a.getAttribute("href").slice(1)));
for (const width of widths) {
  await mkdir(`${out}/${width}`, { recursive: true });
  await page.setViewportSize({ width, height: 900 });
  for (const path of paths) {
    await page.goto(`${base}#${path}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const name = path === "/" ? "landing" : path.replace(/^\//, "").replace(/\//g, "__");
    await page.screenshot({ path: `${out}/${width}/${name}.png`, fullPage: true });
  }
}
console.log(`Captured ${paths.length} screens × ${widths.length} widths into ${out}/`);
await browser.close();
