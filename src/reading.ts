// Mode lecture (et export PDF) : ajoute le résultat après les calculs en texte.
import { MarkdownPostProcessorContext } from "obsidian";
import { CalcSettings, Scope, findCalc, walkDocument } from "./core";
import { parseGraphBlock, renderGraph, specForDefinition } from "./graph";

// Cache : scope disponible à chaque ligne du dernier document vu.
let cache: { key: string; scopes: Scope[] } | null = null;

function scopeAtLine(text: string, line: number, settings: CalcSettings): Scope {
	const key = `${settings.precision}|${settings.decimalComma}|${text}`;
	if (!cache || cache.key !== key) {
		const scopes: Scope[] = [];
		walkDocument(text.split("\n"), settings, (n, _t, scope) => { scopes[n] = new Map(scope); });
		cache = { key, scopes };
	}
	// Ligne ignorée (code, frontmatter) : on remonte jusqu'à la précédente connue
	return lookup(line) ?? new Map();
}

function lookup(line: number): Scope | null {
	if (!cache) return null;
	for (let n = line; n > 0; n--) if (cache.scopes[n]) return cache.scopes[n];
	return null;
}

/** Scope si la ligne est du texte normal (pas du code ni du frontmatter). */
function scopeIfNormal(text: string, line: number, settings: CalcSettings): Scope | null {
	scopeAtLine(text, line, settings);
	return cache?.scopes[line] ?? null;
}

const SKIP = "code, pre, .math, mjx-container, .calcul-inline-result, .frontmatter";

function isEndOfLine(node: Node): boolean {
	let n: Node | null = node.nextSibling;
	while (n) {
		if (n.nodeName === "BR") return true;
		if (n.nodeType === Node.TEXT_NODE && !(n.textContent ?? "").trim()) { n = n.nextSibling; continue; }
		return false;
	}
	// Dernier nœud de son parent : fin de ligne si le parent est un bloc
	const p = node.parentElement;
	return !!p && /^(P|LI|TD|TH|DIV|H[1-6]|BLOCKQUOTE)$/.test(p.nodeName);
}

export function makePostProcessor(getSettings: () => CalcSettings) {
	return (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const settings = getSettings();
		const info = ctx.getSectionInfo(el);
		// Scope = variables définies jusqu'à la fin de cette section
		const scope = info ? scopeAtLine(info.text, info.lineEnd + 1, settings) : new Map();

		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		const targets: Text[] = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const t = n as Text;
			if (t.parentElement?.closest(SKIP)) continue;
			if (/=\s*$/.test(t.data) && isEndOfLine(t)) targets.push(t);
		}
		for (const t of settings.showInReading ? targets : []) {
			// On reconstitue la ligne visible depuis le début du bloc / dernier <br>
			let line = t.data;
			for (let p = t.previousSibling; p && p.nodeName !== "BR"; p = p.previousSibling) {
				line = (p.textContent ?? "") + line;
			}
			const m = findCalc(line, scope, settings);
			if (!m) continue;
			const span = document.createElement("span");
			span.className = "calcul-inline-result";
			span.textContent = (/\s$/.test(t.data) ? "" : " ") + m.result;
			t.after(span);
		}

		// Graphes sous les définitions de fonctions
		if (settings.graphsUnderFunctions && info) {
			const lines = info.text.split("\n");
			for (let i = info.lineStart; i <= info.lineEnd; i++) {
				const sc = scopeIfNormal(info.text, i + 1, settings);
				if (!sc) continue;
				const spec = specForDefinition(lines[i], sc, settings);
				if (spec) renderGraph(el, spec, settings);
			}
		}
	};
}

/** Bloc ```graphe */
export function makeGraphBlockProcessor(getSettings: () => CalcSettings) {
	return (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
		const settings = getSettings();
		const info = ctx.getSectionInfo(el);
		const scope = info ? scopeAtLine(info.text, info.lineStart + 1, settings) : new Map();
		renderGraph(el, parseGraphBlock(source, scope, settings), settings);
	};
}
