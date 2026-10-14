import { parseGraphBlock, renderGraph, specForDefinition } from "../src/graph";
import { DEFAULT_SETTINGS as S, walkDocument, Scope } from "../src/core";
let scope: Scope = new Map();
walkDocument(["f0 = 50 Hz", "R = 1 kohm"], S, () => {});
// reconstruit le scope à la main
walkDocument(["f0 = 50 Hz", "R = 1 kohm", "x"], S, (_n, _t, sc) => { scope = sc; });
const blocks = [
  ["Définition auto", null, "f(x) = x^2/4 - 3"],
  ["Bloc multi", "sin(x)\ncos(x)\ng(x) = x/5\nx: -2*pi..2*pi", null],
  ["Unités", "u(t) = 5 V * sin(2*pi*f0*t)\ni(t) = u(t) / R\nx: 0..40 ms", null],
  ["Asymptotes", "tan(x)\n1/x\nx: -5..5\ny: -6..6", null],
  ["Erreur", "truc bizarre\nx: a..b", null],
];
for (const theme of ["theme-light", "theme-dark"]) {
  const col = document.createElement("div"); col.className = theme + " col"; document.getElementById("root")!.appendChild(col);
  for (const [title, src, def] of blocks) {
    const h = document.createElement("h4"); h.textContent = title as string; col.appendChild(h);
    if (src) renderGraph(col, parseGraphBlock(src as string, scope, S), S);
    else { const sp = specForDefinition(def as string, scope, S); const p = document.createElement("p"); p.textContent = def as string; col.appendChild(p); if (sp) renderGraph(col, sp, S); }
  }
}
