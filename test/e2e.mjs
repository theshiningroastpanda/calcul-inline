// Tests navigateur (Chromium via Playwright) : éditeur, mode lecture, graphes.
//   npm run test:e2e
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const out = "test/.tmp";
mkdirSync(out, { recursive: true });
await build({ entryPoints: ["test/page.ts"], bundle: true, outfile: `${out}/page.js`, logLevel: "error" });
const css = readFileSync("styles.css", "utf8");
writeFileSync(`${out}/index.html`, `<html><head><style>${css}
.col{width:700px;padding:16px;--font-ui-smaller:12px;--radius-s:4px;--shadow-s:0 2px 6px rgba(0,0,0,.15)}
.theme-light{background:#fff;--background-primary:#fff;--background-modifier-border:#e3e3e3;--text-normal:#222;--text-muted:#5c5c5c;--text-faint:#999;--text-error:#e93147}
.theme-dark{background:#1e1e1e;--background-primary:#1e1e1e;--background-modifier-border:#363636;--text-normal:#dadada;--text-muted:#b3b3b3;--text-faint:#666;--text-error:#fb464c}
</style></head><body><script src="page.js"></script></body></html>`);

let failed = 0;
const check = (name, got, want) => {
	const ok = JSON.stringify(got) === JSON.stringify(want);
	if (!ok) failed++;
	console.log(ok ? "ok  " : "FAIL", name, ok ? "" : `\n     obtenu  ${JSON.stringify(got)}\n     attendu ${JSON.stringify(want)}`);
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const open = async () => {
	const p = await browser.newPage({ viewport: { width: 760, height: 900 } });
	p.on("pageerror", (e) => { failed++; console.log("FAIL erreur page :", e.message); });
	await p.goto(`file://${process.cwd()}/${out}/index.html`);
	return p;
};

// --- Éditeur : résultat fantôme, Tab, variables, LaTeX, fonctions -------------
{
	const p = await open();
	await p.evaluate(() => { window.ed = api.editor("R = 1 kohm\nC = 100 nF\ng(x) = 2*x\n"); });
	await p.click(".cm-content");
	await p.keyboard.press("Control+End");
	await p.keyboard.type("Le résultat vaut 5 * 8 / 4 =");
	check("fantôme affiché", await p.locator(".calcul-inline-ghost").allTextContents(), [" 10"]);
	await p.keyboard.press("Tab");
	await p.keyboard.press("Enter");
	await p.keyboard.type("f = 1/(2*pi*R*C) = ");
	await p.keyboard.press("Tab");
	await p.keyboard.press("Enter");
	await p.keyboard.type("$\\frac{10}{4} =$");
	await p.keyboard.press("ArrowLeft");
	await p.keyboard.press("Tab");
	await p.keyboard.press("End");
	await p.keyboard.press("Enter");
	await p.keyboard.type("g(21) =");
	await p.keyboard.press("Tab");
	await p.keyboard.press("Enter");
	await p.keyboard.type("pas de calcul ici");
	await p.keyboard.press("Tab"); // doit indenter normalement
	check("document après Tab", (await p.evaluate(() => ed.doc())).split("\n").slice(3), [
		"Le résultat vaut 5 * 8 / 4 = 10",
		"f = 1/(2*pi*R*C) = 1.591549431 kHz",
		"$\\frac{10}{4} = 2.5$",
		"g(21) = 42",
		"  pas de calcul ici",
	]);
	check("graphe sous g(x), aucun autre", await p.locator(".calcul-graph").count(), 1);
	await p.evaluate(() => ed.insertTop("h(t) = 2*t\n"));
	check("graphe ajouté pour h(t)", await p.locator(".calcul-graph").count(), 2);
	await p.evaluate(() => ed.toggleGraphs());
	check("graphes masqués", await p.locator(".calcul-graph").count(), 0);
	await p.evaluate(() => ed.toggleGraphs());
	check("graphes réaffichés", await p.locator(".calcul-graph").count(), 2);
	check("infobulle en anglais", await p.evaluate(() => { api.editor("1+1 ="); return document.querySelector(".calcul-inline-ghost").getAttribute("aria-label"); }), "Tab or click to insert");
	await p.close();
}

// --- Mode lecture ------------------------------------------------------------
{
	const p = await open();
	const md = "R = 1 kohm\nf(x) = x^2\n\nLe courant vaut 5 V / R =\nf(4) =\n\nPas **gras** = rien\n\n`5*8 =`\n\n- liste 2^8 =";
	const texts = await p.evaluate((md) => api.reading(md, [
		{ html: "<p>R = 1 kohm<br>f(x) = x^2</p>", lineStart: 0, lineEnd: 1 },
		{ html: "<p>Le courant vaut 5 V / R =<br>f(4) =</p>", lineStart: 3, lineEnd: 4 },
		{ html: "<p>Pas <strong>gras</strong> = rien</p>", lineStart: 6, lineEnd: 6 },
		{ html: "<p><code>5*8 =</code></p>", lineStart: 8, lineEnd: 8 },
		{ html: "<ul><li>liste 2^8 =</li></ul>", lineStart: 10, lineEnd: 10 },
	]), md);
	check("lecture : résultats", [texts[1].trim(), texts[2].trim(), texts[3].trim(), texts[4].trim()],
		["Le courant vaut 5 V / R = 5 mA\nf(4) = 16", "Pas gras = rien", "5*8 =", "liste 2^8 = 256"]);
	check("lecture : graphe sous f(x)", await p.locator(".calcul-graph svg").count(), 1);
	await p.close();
}

// --- Graphes : unités, asymptotes, erreurs, survol, langue ---------------------
{
	const p = await open();
	await p.setViewportSize({ width: 1500, height: 1400 });
	await p.evaluate(() => {
		document.body.style.cssText = "display:flex;margin:0;font-family:sans-serif";
		for (const theme of ["theme-light", "theme-dark"]) {
			const defs = ["f0 = 50 Hz", "R = 1 kohm"];
			const col = api.graph(defs, "sin(x)\ncos(x)\ng(x) = x/5\nx: -2*pi..2*pi", theme);
			for (const b of ["u(t) = 5 V * sin(2*pi*f0*t)\ni(t) = u(t) / R\nx: 0..40 ms", "tan(x)\n1/x\nx: -5..5\ny: -6..6", "truc bizarre\nx: a..b"]) {
				col.append(...api.graph(defs, b, theme).childNodes);
			}
		}
	});
	const light = p.locator(".theme-light");
	check("3 courbes + légende", [await light.locator(".calcul-graph").nth(0).locator("path.cg-line").count(), await light.locator(".calcul-graph").nth(0).locator(".calcul-graph-legend-item").count()], [3, 3]);
	check("unités différentes → 2 graphes", await light.locator(".calcul-graph").nth(1).locator("svg").count(), 2);
	check("unités des axes", await light.locator(".calcul-graph").nth(1).locator("text.cg-unit").allTextContents(), ["ms", "V", "ms", "mA"]);
	check("erreurs en anglais", await light.locator(".calcul-graph-error").innerText(), "Not understood: “truc bizarre” · Unreadable range: “x: a..b” (e.g. x: -5..5 or x: 0..20 ms)");
	const bb = await light.locator(".calcul-graph").nth(1).locator("svg").nth(1).boundingBox();
	await p.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height / 2);
	await p.mouse.move(bb.x + bb.width * 0.31, bb.y + bb.height / 2);
	const tip = light.locator(".calcul-graph").nth(1).locator(".calcul-graph-tip").nth(1);
	check("infobulle visible au survol", [await tip.isVisible(), /^x = [\d.]+ ms\ni\(t\) : -?[\d.]+ mA$/.test(await tip.innerText())], [true, true]);
	await p.screenshot({ path: `${out}/graphs.png`, fullPage: true });
	check("erreur en français", await p.evaluate(() => { api.setLocale("fr"); return api.graph([], "", "theme-light").innerText; }), "Aucune fonction à tracer.");
	await p.close();
}

await browser.close();
console.log(failed ? `\n${failed} échec(s)` : "\nTout passe.");
process.exit(failed ? 1 : 0);
