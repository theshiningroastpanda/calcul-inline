import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage(); p.on("pageerror", e => console.log("ERR", e.message));
await p.goto("file://" + process.cwd() + "/test/page2.html");
console.log("au départ (f seulement, pas g dans le bloc code):", await p.evaluate(() => count()));
await p.evaluate(() => edit()); console.log("après ajout h(t):", await p.evaluate(() => count()));
await p.evaluate(() => toggle()); console.log("masqué:", await p.evaluate(() => count()));
await p.evaluate(() => toggle()); console.log("réaffiché:", await p.evaluate(() => count()));
await b.close();
