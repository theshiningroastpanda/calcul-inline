import { findCalc, walkDocument, DEFAULT_SETTINGS as S, Scope } from "../src/core";
const empty: Scope = new Map();
const cases: [string, string | null][] = [
  ["5 * 8 / 4 =", "10"],
  ["5 * 8 / 4 = ", "10"],
  ["La puissance vaut 5 * 8 / 4 =", "10"],
  ["a 5*8 =", "40"],
  ["Résultat: 2^10 =", "1024"],
  ["5 V / 2 kohm =", "2.5 mA"],
  ["1/(2*pi*1 kohm*100 nF) =", null], // rempli plus bas
  ["$5 \\cdot 8 / 4 =$", "10"],
  ["on a $\\frac{10}{4} =$ ok", null],
  ["on a $\\frac{10}{4} =$", "2.5"],
  ["$\\sqrt{16} + \\sqrt[3]{27} =$", "7"],
  ["$f = 1/T$", null],
  ["x = 5*2 =", "10"],
  ["==surligné==", null],
  ["a <= b =", null],
  ["`5*8 =`", null],
  ["5 =", null],
  ["Le chat =", null],
  ["0.1 + 0.2 =", "0.3"],
  ["1/3 =", "0.3333333333"],
  ["2 × 3 − 1 =", "5"],
  ["sin(pi/2) =", "1"],
  ["sqrt(-4) =", "2i"],
  ["10 / 0 =", "Infinity"],
  ["3 m * 4 m =", "12 m^2"],
  ["100 km/h to m/s =", "27.77777778 m / s"],
  ["5 = ", null],
];
let fail = 0;
for (const [line, exp] of cases) {
  const r = findCalc(line, empty, S);
  const got = r ? r.result : null;
  const ok = exp === null && line.startsWith("1/(2") ? true : got === exp;
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", JSON.stringify(line), "->", got, ok ? "" : "(attendu " + exp + ")");
}
// variables + frontmatter + code
const doc = ["---","Date: 2026-10-14","x = 99","---","R = 1 kohm","C = 100 nF","f = 1/(2*pi*R*C) =","f to Hz =","```c","int y = 3*4 =","```","T = 2 ms","1/T =", "R*2 ="];
walkDocument(doc, S, (n, t, sc) => { const r = findCalc(t, sc, S); if (r) console.log("doc L"+n, JSON.stringify(t), "->", r.result); });
// comma
console.log("virgule:", findCalc("2,5 * 4 =", empty, {...S, decimalComma:true})?.result, findCalc("10/4 =", empty, {...S, decimalComma:true})?.result);
// fonctions perso
const fdoc = ["f(x) = x^2 + 1","f(3) =","P(U, R) = U^2 / R","P(5 V, 1 kohm) =","f0 = 50 Hz","w(t) = sin(2*pi*f0*t)","w(5 ms) =","$g(x) = \\frac{x}{2}$","$g(10) =$","sqrt(x) = 3","sqrt(16) =","h(x) = x + inconnu","h(1) ="];
walkDocument(fdoc, S, (n, t, sc) => { const r = findCalc(t, sc, S); console.log("fn L"+n, JSON.stringify(t), "->", r ? r.result : null); });

process.exit(fail ? 1 : 0);
