// Moteur de calcul : pur, sans dépendance à Obsidian, testable en Node.
import { create, all, MathJsInstance } from "mathjs";

export interface CalcSettings {
	precision: number;        // chiffres significatifs
	decimalComma: boolean;    // accepte/affiche 2,5 au lieu de 2.5
	showInReading: boolean;   // affiche les résultats en mode lecture / export
	graphsUnderFunctions: boolean; // graphe automatique sous « f(x) = … »
}

export const DEFAULT_SETTINGS: CalcSettings = {
	precision: 10,
	decimalComma: false,
	showInReading: true,
	graphsUnderFunctions: true,
};

export interface CalcMatch {
	eq: number;         // index du "=" déclencheur dans la ligne
	from: number;       // début de la zone remplacée à l'insertion (juste après "=")
	to: number;         // fin de la zone (après les espaces qui suivent "=")
	expr: string;       // expression évaluée (après conversion)
	result: string;     // résultat formaté
}

export type Scope = Map<string, unknown>;

// ---------------------------------------------------------------------------
// Instance mathjs « bac à sable » : on désactive tout ce qui modifie l'état.
const math: MathJsInstance = create(all, {});
const evaluate = math.evaluate.bind(math);
const FUNCS = new Set([
	"sqrt", "cbrt", "nthRoot", "abs", "exp", "log", "log10", "log2", "ln",
	"sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sinh", "cosh", "tanh",
	"round", "floor", "ceil", "fix", "min", "max", "mean", "median", "sum", "prod",
	"gcd", "lcm", "mod", "pow", "factorial", "combinations", "permutations", "deg", "rad",
]);
const CONSTS = new Set(["pi", "e", "tau", "phi", "i"]);

// mathjs n'a pas ln : on l'ajoute, et deg()/rad() pratiques en signal.
math.import(
	{
		ln: (x: number) => math.log(x),
		deg: (x: number) => (x * 180) / Math.PI,
		rad: (x: number) => (x * Math.PI) / 180,
	},
	{ override: true },
);

// Verrouillage APRÈS nos ajouts.
const blocked = () => { throw new Error("fonction désactivée"); };
math.import(
	{
		import: blocked, createUnit: blocked, evaluate: blocked, parse: blocked,
		simplify: blocked, derivative: blocked, resolve: blocked, reviver: blocked,
	},
	{ override: true },
);

// ---------------------------------------------------------------------------
// Conversion LaTeX / unicode -> syntaxe mathjs

function readGroup(s: string, i: number): [string, number] | null {
	// s[i] doit être "{" ; renvoie le contenu et l'index après "}"
	if (s[i] !== "{") return null;
	let depth = 0;
	for (let j = i; j < s.length; j++) {
		if (s[j] === "{") depth++;
		else if (s[j] === "}") { depth--; if (depth === 0) return [s.slice(i + 1, j), j + 1]; }
	}
	return null;
}

function convertFracSqrt(s: string): string {
	let out = "";
	let i = 0;
	while (i < s.length) {
		if (s.startsWith("\\frac", i) || s.startsWith("\\dfrac", i) || s.startsWith("\\tfrac", i)) {
			let j = s.indexOf("{", i);
			const a = j >= 0 ? readGroup(s, j) : null;
			const b = a ? readGroup(s, a[1]) : null;
			if (a && b) { out += `((${convertFracSqrt(a[0])})/(${convertFracSqrt(b[0])}))`; i = b[1]; continue; }
		}
		if (s.startsWith("\\sqrt", i)) {
			let j = i + 5;
			let n: string | null = null;
			if (s[j] === "[") { const k = s.indexOf("]", j); if (k > 0) { n = s.slice(j + 1, k); j = k + 1; } }
			const a = readGroup(s, j);
			if (a) {
				const inner = convertFracSqrt(a[0]);
				out += n ? `nthRoot(${inner}, ${n})` : `sqrt(${inner})`;
				i = a[1];
				continue;
			}
		}
		if (s.startsWith("\\text", i) || s.startsWith("\\mathrm", i) || s.startsWith("\\operatorname", i)) {
			const j = s.indexOf("{", i);
			const a = j >= 0 ? readGroup(s, j) : null;
			if (a) { out += ` ${a[0]} `; i = a[1]; continue; }
		}
		out += s[i];
		i++;
	}
	return out;
}

export function normalize(raw: string, settings: CalcSettings): string {
	let s = raw;
	s = convertFracSqrt(s);
	s = s
		.replace(/\\left|\\right/g, "")
		.replace(/\\cdot|\\times|·|×|⋅/g, "*")
		.replace(/\\div|÷/g, "/")
		.replace(/−/g, "-")
		.replace(/\\pi|π/g, "pi")
		.replace(/\\ln\b/g, "ln")
		.replace(/\\log\b/g, "log10")
		.replace(/\\(sin|cos|tan|exp|arcsin|arccos|arctan|sinh|cosh|tanh)\b/g, (_m, f) =>
			f.startsWith("arc") ? "a" + f.slice(3) : f)
		.replace(/\\[,;:! ]|~/g, " ")
		.replace(/\\%/g, "%")
		.replace(/²/g, "^2").replace(/³/g, "^3")
		.replace(/√\s*\(/g, "sqrt(")
		.replace(/√\s*([0-9.]+)/g, "sqrt($1)")
		.replace(/µ|μ/g, "u")
		.replace(/Ω/g, "ohm")
		.replace(/{/g, "(").replace(/}/g, ")");
	if (settings.decimalComma) s = s.replace(/(\d),(\d)/g, "$1.$2");
	return s.trim();
}

// ---------------------------------------------------------------------------
// Évaluation & formatage

function isUsefulValue(v: unknown): boolean {
	if (typeof v === "number") return !Number.isNaN(v);
	if (v === null || typeof v !== "object") return false;
	const t = (v as { type?: string }).type;
	return t === "Unit" || t === "Complex" || t === "BigNumber" || t === "Fraction";
}

export function formatValue(v: unknown, settings: CalcSettings): string {
	let out = math.format(v as never, {
		precision: settings.precision,
		lowerExp: -6,
		upperExp: 15,
	} as never);
	if (settings.decimalComma) out = out.replace(/(\d)\.(\d)/g, "$1,$2");
	return out;
}

export function tryEvaluate(expr: string, scope: Scope): unknown | undefined {
	if (!expr || /[=<>]/.test(expr)) return undefined;
	try {
		const v = evaluate(expr, new Map(scope));
		return isUsefulValue(v) ? v : undefined;
	} catch {
		return undefined;
	}
}

// Un début d'expression plausible : chiffre, parenthèse, signe, fonction(…),
// constante ou variable connue. Évite qu'un mot français (« a », « m »…) soit
// pris pour une unité.
function plausibleStart(sub: string, scope: Scope): boolean {
	if (/^[0-9.(\-+]/.test(sub) || sub.startsWith("sqrt(")) return true;
	const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(sub);
	if (!m) return false;
	const w = m[1];
	if (scope.has(w)) return true;
	if (CONSTS.has(w)) return true;
	if (FUNCS.has(w) && /^\s*\(/.test(sub.slice(w.length))) return true;
	return false;
}

function isTrivial(expr: string): boolean {
	return /^[-+]?\s*\d+(\.\d+)?$/.test(expr.trim());
}

// ---------------------------------------------------------------------------
// Détection dans une ligne

function countUnescaped(s: string, ch: string, end: number): { count: number; last: number } {
	let count = 0, last = -1;
	for (let i = 0; i < end; i++) {
		if (s[i] === "\\") { i++; continue; }
		if (s[i] === ch) { count++; last = i; }
	}
	return { count, last };
}

export function findCalc(line: string, scope: Scope, settings: CalcSettings): CalcMatch | null {
	// Le « = » déclencheur est suivi seulement d'espaces, puis fin de ligne ou « $ ».
	const m = /=([ \t]*)(\$\$?)?[ \t]*$/.exec(line);
	if (!m) return null;
	const eq = m.index;
	const prev = line[eq - 1];
	if (prev === undefined || "=<>!:".includes(prev)) return null; // ==, <=, >=, !=, :=

	// Pas dans du code inline
	if (countUnescaped(line, "`", eq).count % 2 === 1) return null;

	const dollars = countUnescaped(line, "$", eq);
	const inMath = dollars.count % 2 === 1;
	if (m[2] && !inMath) return null; // « = $ » hors maths : on ignore

	// Segment : depuis le dernier « = » (ou « $ ») avant le déclencheur
	let start = 0;
	if (inMath) start = dollars.last + 1;
	const lastEq = line.lastIndexOf("=", eq - 1);
	if (lastEq >= start) start = lastEq + 1;
	const segment = line.slice(start, eq);

	// Candidats : début du segment puis chaque début de mot ; le plus à gauche gagne.
	const starts: number[] = [];
	for (let i = 0; i < segment.length; i++) {
		if (segment[i] === " " || segment[i] === "\t") continue;
		if (i === 0 || /[\s:;]/.test(segment[i - 1])) starts.push(i);
	}
	for (const p of starts) {
		const expr = normalize(segment.slice(p), settings);
		if (!expr || isTrivial(expr) || !plausibleStart(expr, scope)) continue;
		const v = tryEvaluate(expr, scope);
		if (v === undefined) continue;
		const spaces = m[1].length;
		return { eq, from: eq + 1, to: eq + 1 + spaces, expr, result: formatValue(v, settings) };
	}
	return null;
}

// ---------------------------------------------------------------------------
// Variables : lignes « nom = expression » (sans « = » final)

const ASSIGN = /^\s*(?:[-*+]\s+)?\$?\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^=].*?)\s*\$?\s*$/;

// Fonctions perso : « f(x) = x^2 + 1 », « P(U, R) = U^2 / R »
const FN_ASSIGN = /^\s*(?:[-*+]\s+)?\$?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*\)\s*=\s*([^=].*?)\s*\$?\s*$/;

export function readFunction(line: string, scope: Scope, settings: CalcSettings): [string, unknown] | null {
	const m = FN_ASSIGN.exec(line);
	if (!m) return null;
	const [, name, params, body] = m;
	if (FUNCS.has(name)) return null;
	// « f(x) = x^2 = ... » : on garde seulement la définition
	const rhs = body.split(/(?<![<>!=])=(?!=)/)[0].trim();
	if (!rhs) return null;
	try {
		const local: Scope = new Map(scope);
		const fn = evaluate(`${name}(${params}) = ${normalize(rhs, settings)}`, local);
		return typeof fn === "function" ? [name, fn] : null;
	} catch {
		return null;
	}
}

export function readAssignment(line: string, scope: Scope, settings: CalcSettings): [string, unknown] | null {
	if (/=\s*\$?\s*$/.test(line)) return null; // ligne de calcul, pas une définition
	const fn = readFunction(line, scope, settings);
	if (fn) return fn;
	const m = ASSIGN.exec(line);
	if (!m) return null;
	const name = m[1];
	if (FUNCS.has(name) || CONSTS.has(name)) return null;
	// « x = 5*2 = 10 » : on prend le dernier membre
	const parts = m[2].split(/(?<![<>!=])=(?!=)/).map((p) => p.trim()).filter(Boolean);
	const rhs = parts[parts.length - 1];
	if (!rhs) return null;
	const v = tryEvaluate(normalize(rhs, settings), scope);
	return v === undefined ? null : [name, v];
}

// Parcourt un document ligne par ligne en gérant frontmatter, blocs de code et
// variables. `visit` est appelé pour chaque ligne « normale » avec le scope
// courant (variables définies au-dessus).
export function walkDocument(
	lines: Iterable<string>,
	settings: CalcSettings,
	visit: (lineNo: number, text: string, scope: Scope) => void,
): void {
	const scope: Scope = new Map();
	let n = 0;
	let inFront = false;
	let fence: string | null = null;
	for (const text of lines) {
		n++;
		if (n === 1 && text.trim() === "---") { inFront = true; continue; }
		if (inFront) { if (/^(---|\.\.\.)\s*$/.test(text)) inFront = false; continue; }
		const f = /^\s*(```+|~~~+)/.exec(text);
		if (f) {
			if (fence === null) fence = f[1][0];
			else if (f[1][0] === fence) fence = null;
			continue;
		}
		if (fence !== null) continue;
		visit(n, text, scope);
		const a = readAssignment(text, scope, settings);
		if (a) scope.set(a[0], a[1]);
	}
}

export { math, evaluate as rawEvaluate };
export function isBuiltinName(name: string): boolean { return FUNCS.has(name) || CONSTS.has(name); }
