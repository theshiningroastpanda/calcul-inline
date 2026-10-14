// Graphes de fonctions : analyse du bloc ```graphe, échantillonnage (pur) et rendu SVG.
import { CalcSettings, Scope, math, normalize, rawEvaluate, readFunction } from "./core";

type Fn = (x: unknown) => unknown;

export interface Series { label: string; fn: Fn; }
export interface GraphSpec {
	series: Series[];
	xmin: number; xmax: number; xunit: string | null;
	ymin?: number; ymax?: number;
	height: number;
	errors: string[];
}
export interface Sampled {
	label: string;
	pts: [number, number | null][];
	yunit: string | null;
}

interface UnitLike { type: "Unit"; toNumber(u: string): number; formatUnits(): string; simplify?: () => UnitLike }
const isUnit = (v: unknown): v is UnitLike =>
	!!v && typeof v === "object" && (v as { type?: string }).type === "Unit";

// --------------------------------------------------------------------------
// Construction de la spécification

function evalBound(src: string, scope: Scope, settings: CalcSettings): unknown {
	return rawEvaluate(normalize(src, settings), new Map(scope));
}

function parseRange(src: string, scope: Scope, settings: CalcSettings):
	{ a: number; b: number; unit: string | null } | null {
	const m = /^(.+?)\s*(?:\.\.|…)\s*(.+)$/.exec(src.trim());
	if (!m) return null;
	try {
		const A = evalBound(m[1], scope, settings);
		const B = evalBound(m[2], scope, settings);
		const unit = isUnit(B) ? B.formatUnits() : isUnit(A) ? A.formatUnits() : null;
		const num = (v: unknown) => (isUnit(v) ? v.toNumber(unit as string) : Number(v));
		const a = num(A), b = num(B);
		if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
		return { a: Math.min(a, b), b: Math.max(a, b), unit };
	} catch {
		return null;
	}
}

let anon = 0;
function anonymous(expr: string, scope: Scope, settings: CalcSettings): Fn | null {
	try {
		const name = `__g${anon++}`;
		const fn = rawEvaluate(`${name}(x) = ${normalize(expr, settings)}`, new Map(scope));
		return typeof fn === "function" ? (fn as Fn) : null;
	} catch {
		return null;
	}
}

/** Bloc ```graphe : une fonction ou expression par ligne, plus des options. */
export function parseGraphBlock(src: string, scopeIn: Scope, settings: CalcSettings): GraphSpec {
	const scope: Scope = new Map(scopeIn);
	const spec: GraphSpec = { series: [], xmin: -10, xmax: 10, xunit: null, height: 260, errors: [] };
	for (const raw of src.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#") || line.startsWith("%")) continue;

		const opt = /^(x|y|hauteur|height)\s*:\s*(.+)$/i.exec(line);
		if (opt) {
			const key = opt[1].toLowerCase();
			if (key === "hauteur" || key === "height") {
				const h = Number(opt[2]);
				if (h >= 120 && h <= 800) spec.height = h;
				continue;
			}
			const r = parseRange(opt[2], scope, settings);
			if (!r) { spec.errors.push(`Intervalle illisible : « ${line} » (ex. x: -5..5 ou x: 0..20 ms)`); continue; }
			if (key === "x") { spec.xmin = r.a; spec.xmax = r.b; spec.xunit = r.unit; }
			else { spec.ymin = r.a; spec.ymax = r.b; }
			continue;
		}

		// Définition : f(x) = ...
		const def = readFunction(line, scope, settings);
		if (def) {
			scope.set(def[0], def[1]);
			spec.series.push({ label: line.replace(/\$/g, ""), fn: def[1] as Fn });
			continue;
		}
		// Nom d'une fonction connue : « f » ou « f(x) »
		const named = /^([A-Za-z_]\w*)(?:\s*\(\s*[A-Za-z_]\w*\s*\))?$/.exec(line);
		if (named && typeof scope.get(named[1]) === "function") {
			const f = scope.get(named[1]) as Fn & { syntax?: string };
			spec.series.push({ label: f.syntax ?? named[1], fn: f });
			continue;
		}
		// Expression en x : « x^2 - 1 », « sin(x) »
		const fn = /\bx\b/.test(line) ? anonymous(line, scope, settings) : null;
		if (fn) spec.series.push({ label: line, fn });
		else spec.errors.push(`Pas compris : « ${line} »`);
	}
	if (!spec.series.length && !spec.errors.length) spec.errors.push("Aucune fonction à tracer.");
	return spec;
}

/** Spécification pour le graphe automatique sous « f(x) = … ». */
export function specForDefinition(line: string, scope: Scope, settings: CalcSettings): GraphSpec | null {
	if (/=\s*\$?\s*$/.test(line)) return null;
	const m = /^\s*(?:[-*+]\s+)?\$?\s*([A-Za-z_]\w*)\s*\(\s*([A-Za-z_]\w*)\s*\)\s*=/.exec(line);
	if (!m) return null;
	const def = readFunction(line, scope, settings);
	if (!def) return null;
	const spec: GraphSpec = {
		series: [{ label: line.trim().replace(/\$/g, ""), fn: def[1] as Fn }],
		xmin: -10, xmax: 10, xunit: null, height: 200, errors: [],
	};
	// N'affiche que si la fonction donne des nombres sur l'intervalle par défaut
	const s = sample(spec, 41);
	return s[0].pts.filter((p) => p[1] !== null).length >= 5 ? spec : null;
}

// --------------------------------------------------------------------------
// Échantillonnage

export function sample(spec: GraphSpec, n = 400): Sampled[] {
	return spec.series.map((s) => {
		const raw: [number, unknown][] = [];
		for (let i = 0; i < n; i++) {
			const x = spec.xmin + ((spec.xmax - spec.xmin) * i) / (n - 1);
			let v: unknown = null;
			try { v = s.fn(spec.xunit ? math.unit(x, spec.xunit) : x); } catch { v = null; }
			raw.push([x, v]);
		}
		// Unité de y : celle (simplifiée) de la plus grande valeur → « mA » plutôt que « V / kohm »
		let yunit: string | null = null;
		let best: { abs: number; v: UnitLike } | null = null;
		for (const [, v] of raw) {
			if (!isUnit(v)) continue;
			const a = Math.abs((v as unknown as { value: number }).value);
			if (Number.isFinite(a) && (!best || a > best.abs)) best = { abs: a, v };
		}
		if (best) {
			try {
				// toString choisit le bon préfixe (5 mA) ; on garde la partie unité
				const simple = best.v.simplify ? best.v.simplify() : best.v;
				yunit = String(simple).replace(/^[-+]?[\d.]+(e[-+]?\d+)?\s*/i, "") || simple.formatUnits();
				best.v.toNumber(yunit);
			} catch { yunit = best.v.formatUnits(); }
		}
		const pts: [number, number | null][] = raw.map(([x, v]) => {
			let y: number | null = null;
			try {
				if (typeof v === "number") y = yunit === null ? v : null;
				else if (isUnit(v) && yunit !== null) y = v.toNumber(yunit);
			} catch { y = null; }
			return [x, y !== null && Number.isFinite(y) ? y : null];
		});
		return { label: s.label, pts, yunit };
	});
}

export function yRange(data: Sampled[], spec: GraphSpec): [number, number] {
	if (spec.ymin !== undefined && spec.ymax !== undefined) return [spec.ymin, spec.ymax];
	const ys = data.flatMap((d) => d.pts.map((p) => p[1]).filter((y): y is number => y !== null)).sort((a, b) => a - b);
	if (!ys.length) return [-1, 1];
	// Percentiles 2–98 % : une asymptote (tan, 1/x) n'écrase pas tout le graphe
	const q = (p: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];
	let lo = q(0.02), hi = q(0.98);
	const span = ys[ys.length - 1] - ys[0];
	if (span <= (hi - lo) * 1.5) { lo = ys[0]; hi = ys[ys.length - 1]; }
	if (hi - lo < 1e-12) { const d = Math.abs(lo) * 0.5 || 1; lo -= d; hi += d; }
	const pad = (hi - lo) * 0.08;
	return [lo - pad, hi + pad];
}

export function niceTicks(a: number, b: number, target = 6): number[] {
	const raw = (b - a) / target;
	const mag = Math.pow(10, Math.floor(Math.log10(raw)));
	const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw) ?? 10 * mag;
	const out: number[] = [];
	for (let v = Math.ceil(a / step) * step; v <= b + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
	return out;
}

// --------------------------------------------------------------------------
// Rendu

const NS = "http://www.w3.org/2000/svg";
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) {
	const e = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	parent?.appendChild(e);
	return e;
}

function fmt(v: number, settings: CalcSettings, digits = 4): string {
	let s = math.format(v, { precision: digits, lowerExp: -4, upperExp: 6 } as never);
	if (settings.decimalComma) s = s.replace(".", ",");
	return s;
}

export function renderGraph(container: HTMLElement, spec: GraphSpec, settings: CalcSettings): void {
	const root = container.appendChild(document.createElement("div"));
	root.className = "calcul-graph";

	if (spec.errors.length) {
		const err = root.appendChild(document.createElement("div"));
		err.className = "calcul-graph-error";
		err.textContent = spec.errors.join(" · ");
		if (!spec.series.length) return;
	}

	const all = sample(spec);
	// Une unité de y par graphe : jamais deux échelles sur un même axe
	const groups = new Map<string, { d: Sampled; i: number }[]>();
	all.forEach((d, i) => {
		const k = d.yunit ?? "";
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push({ d, i });
	});
	for (const g of groups.values()) renderPlot(root, g, spec, settings, groups.size > 1);
}

function renderPlot(root: HTMLElement, group: { d: Sampled; i: number }[], spec: GraphSpec,
	settings: CalcSettings, forceLegend: boolean): void {
	const data = group.map((g) => g.d);
	const color = (j: number) => `s${(group[j].i % 8) + 1}`;
	const [y0, y1] = yRange(data, spec);
	const W = 640, H = spec.height;
	const M = { l: 48, r: 14, t: 14, b: 26 };
	const pw = W - M.l - M.r, ph = H - M.t - M.b;
	const X = (x: number) => M.l + ((x - spec.xmin) / (spec.xmax - spec.xmin)) * pw;
	const Y = (y: number) => M.t + (1 - (y - y0) / (y1 - y0)) * ph;
	const yunit = data.find((d) => d.yunit)?.yunit ?? null;

	if (data.length >= 2 || forceLegend) {
		const lg = root.appendChild(document.createElement("div"));
		lg.className = "calcul-graph-legend";
		data.forEach((d, j) => {
			const it = lg.appendChild(document.createElement("span"));
			it.className = "calcul-graph-legend-item";
			const sw = it.appendChild(document.createElement("span"));
			sw.className = `calcul-graph-swatch ${color(j)}`;
			it.appendChild(document.createTextNode(d.label));
		});
	}

	const wrap = root.appendChild(document.createElement("div"));
	wrap.className = "calcul-graph-plot";
	const el = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
		"aria-label": `Graphe de ${data.map((d) => d.label).join(", ")}` }, wrap);

	const clipId = `cg-clip-${Math.random().toString(36).slice(2)}`;
	const defs = svg("defs", {}, el);
	svg("rect", { x: M.l, y: M.t, width: pw, height: ph }, svg("clipPath", { id: clipId }, defs));

	// Grille + graduations
	const grid = svg("g", { class: "cg-grid" }, el);
	const labels = svg("g", { class: "cg-ticks" }, el);
	for (const t of niceTicks(spec.xmin, spec.xmax, 8)) {
		svg("line", { x1: X(t), x2: X(t), y1: M.t, y2: M.t + ph }, grid);
		const tx = svg("text", { x: X(t), y: H - 8, "text-anchor": "middle" }, labels);
		tx.textContent = fmt(t, settings);
	}
	for (const t of niceTicks(y0, y1, 5)) {
		svg("line", { x1: M.l, x2: M.l + pw, y1: Y(t), y2: Y(t) }, grid);
		const ty = svg("text", { x: M.l - 6, y: Y(t) + 4, "text-anchor": "end" }, labels);
		ty.textContent = fmt(t, settings);
	}
	// Axes x = 0 / y = 0 si visibles
	const axes = svg("g", { class: "cg-axes" }, el);
	if (y0 < 0 && y1 > 0) svg("line", { x1: M.l, x2: M.l + pw, y1: Y(0), y2: Y(0) }, axes);
	if (spec.xmin < 0 && spec.xmax > 0) svg("line", { x1: X(0), x2: X(0), y1: M.t, y2: M.t + ph }, axes);
	if (spec.xunit) { const u = svg("text", { x: M.l + pw, y: M.t + ph - 6, "text-anchor": "end", class: "cg-unit" }, el); u.textContent = spec.xunit; }
	if (yunit) { const u = svg("text", { x: M.l + 6, y: M.t + 12, class: "cg-unit" }, el); u.textContent = yunit; }

	// Courbes : on coupe aux trous et aux sauts (asymptotes)
	const curves = svg("g", { "clip-path": `url(#${clipId})` }, el);
	const jump = (y1 - y0) * 1.5;
	data.forEach((d, i) => {
		let path = "", open = false, prev: number | null = null;
		for (const [x, y] of d.pts) {
			if (y === null || (prev !== null && Math.abs(y - prev) > jump)) { open = false; prev = y; if (y === null) continue; }
			path += `${open ? "L" : "M"}${X(x).toFixed(1)},${Y(Math.max(y0 - (y1 - y0) * 5, Math.min(y1 + (y1 - y0) * 5, y))).toFixed(1)}`;
			open = true; prev = y;
		}
		svg("path", { d: path, class: `cg-line ${color(i)}` }, curves);
	});

	// Survol : réticule + points + infobulle
	const cross = svg("line", { class: "cg-cross", y1: M.t, y2: M.t + ph, x1: 0, x2: 0, visibility: "hidden" }, el);
	const dots = data.map((_, i) => svg("circle", { r: 4, class: `cg-dot ${color(i)}`, visibility: "hidden" }, el));
	const tip = wrap.appendChild(document.createElement("div"));
	tip.className = "calcul-graph-tip";
	const hit = svg("rect", { x: M.l, y: M.t, width: pw, height: ph, fill: "transparent" }, el);

	const hide = () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); tip.style.display = "none"; };
	hit.addEventListener("pointerleave", hide);
	hit.addEventListener("pointermove", (ev: PointerEvent) => {
		const r = el.getBoundingClientRect();
		const px = ((ev.clientX - r.left) / r.width) * W;
		const k = Math.round(((px - M.l) / pw) * (data[0].pts.length - 1));
		if (k < 0 || k >= data[0].pts.length) return hide();
		const x = data[0].pts[k][0];
		cross.setAttribute("x1", String(X(x))); cross.setAttribute("x2", String(X(x)));
		cross.setAttribute("visibility", "visible");
		tip.replaceChildren();
		const head = tip.appendChild(document.createElement("div"));
		head.className = "calcul-graph-tip-x";
		head.textContent = `x = ${fmt(x, settings, 5)}${spec.xunit ? " " + spec.xunit : ""}`;
		data.forEach((d, i) => {
			const y = d.pts[k][1];
			const dot = dots[i];
			if (y === null || y < y0 || y > y1) dot.setAttribute("visibility", "hidden");
			else { dot.setAttribute("cx", String(X(x))); dot.setAttribute("cy", String(Y(y))); dot.setAttribute("visibility", "visible"); }
			const row = tip.appendChild(document.createElement("div"));
			const sw = row.appendChild(document.createElement("span"));
			sw.className = `calcul-graph-swatch ${color(i)}`;
			const name = d.label.split("=")[0].trim();
			row.appendChild(document.createTextNode(`${name} : ${y === null ? "—" : fmt(y, settings, 5) + (d.yunit ? " " + d.yunit : "")}`));
		});
		tip.style.display = "block";
		const left = (X(x) / W) * r.width;
		tip.style.left = `${left + 12}px`;
		tip.style.transform = left > r.width * 0.6 ? "translateX(calc(-100% - 24px))" : "";
	});
}
