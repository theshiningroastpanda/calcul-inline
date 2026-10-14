import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(()=>chromium.launch());
const p = await b.newPage();
p.on("pageerror", e => console.log("ERR", e.message));
await p.goto("file://" + process.cwd() + "/test/reading.html");
console.log(await p.evaluate(() => [...document.body.querySelectorAll("div")].map(d => d.innerText).join("\n---\n")));
await b.close();
