// Intégration CodeMirror 6 : résultat « fantôme » + Tab pour l'insérer.
import { EditorState, Prec, RangeSetBuilder, StateEffect, StateField, Extension } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType, keymap } from "@codemirror/view";
import { CalcMatch, CalcSettings, findCalc, walkDocument } from "./core";
import { GraphSpec, renderGraph, specForDefinition } from "./graph";

export const refreshEffect = StateEffect.define<null>();

interface Located extends CalcMatch { lineFrom: number; }

function* docLines(state: EditorState, upTo: number): Generator<string> {
	const doc = state.doc;
	const last = Math.min(upTo, doc.lines);
	for (let i = 1; i <= last; i++) yield doc.line(i).text;
}

/** Calculs présents dans les lignes [fromLine, toLine]. */
export function computeCalcs(state: EditorState, settings: CalcSettings, fromLine: number, toLine: number): Located[] {
	const out: Located[] = [];
	walkDocument(docLines(state, toLine), settings, (n, text, scope) => {
		if (n < fromLine) return;
		const m = findCalc(text, scope, settings);
		if (m) out.push({ ...m, lineFrom: state.doc.line(n).from });
	});
	return out;
}

/** Calcul sur lequel se trouve le curseur (curseur entre « = » et la fin des espaces). */
export function calcAtCursor(state: EditorState, settings: CalcSettings): Located | null {
	const sel = state.selection;
	if (sel.ranges.length !== 1 || !sel.main.empty) return null;
	const pos = sel.main.head;
	const line = state.doc.lineAt(pos);
	const [m] = computeCalcs(state, settings, line.number, line.number);
	if (!m) return null;
	const rel = pos - line.from;
	return rel >= m.from && rel <= m.to ? m : null;
}

export function insertCalc(view: EditorView, m: Located): void {
	const from = m.lineFrom + m.from;
	const to = m.lineFrom + m.to;
	const text = " " + m.result;
	view.dispatch({
		changes: { from, to, insert: text },
		selection: { anchor: from + text.length },
		userEvent: "input.calcul-inline",
	});
}

class GhostWidget extends WidgetType {
	constructor(readonly text: string, readonly m: Located) { super(); }
	eq(other: GhostWidget) { return other.text === this.text && other.m.lineFrom === this.m.lineFrom; }
	toDOM(view: EditorView): HTMLElement {
		const span = document.createElement("span");
		span.className = "calcul-inline-ghost";
		span.textContent = this.text;
		span.setAttribute("aria-label", "Tab ou clic pour insérer");
		span.addEventListener("mousedown", (e) => {
			e.preventDefault();
			insertCalc(view, this.m);
		});
		return span;
	}
	ignoreEvent() { return false; }
}

export function buildExtension(getSettings: () => CalcSettings): Extension {
	const plugin = ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			constructor(view: EditorView) { this.decorations = this.build(view); }
			update(u: ViewUpdate) {
				if (u.docChanged || u.viewportChanged ||
					u.transactions.some((t) => t.effects.some((e) => e.is(refreshEffect)))) {
					this.decorations = this.build(u.view);
				}
			}
			build(view: EditorView): DecorationSet {
				const b = new RangeSetBuilder<Decoration>();
				const { state } = view;
				const vr = view.visibleRanges;
				if (!vr.length) return b.finish();
				const first = state.doc.lineAt(vr[0].from).number;
				const last = state.doc.lineAt(vr[vr.length - 1].to).number;
				for (const m of computeCalcs(state, getSettings(), first, last)) {
					const pos = m.lineFrom + m.to;
					const text = (m.to > m.from ? "" : " ") + m.result;
					b.add(pos, pos, Decoration.widget({ widget: new GhostWidget(text, m), side: 1 }));
				}
				return b.finish();
			}
		},
		{ decorations: (v) => v.decorations },
	);

	// Priorité maximale : passe avant LaTeX Suite, mais ne prend Tab que si un
	// résultat est en attente sous le curseur.
	const keys = Prec.highest(
		keymap.of([{
			key: "Tab",
			run: (view) => {
				const m = calcAtCursor(view.state, getSettings());
				if (!m) return false;
				insertCalc(view, m);
				return true;
			},
		}]),
	);

	// Graphes sous « f(x) = … » : des widgets « bloc » doivent venir d'un StateField.
	const buildGraphs = (state: EditorState): DecorationSet => {
		const settings = getSettings();
		const b = new RangeSetBuilder<Decoration>();
		if (!settings.graphsUnderFunctions) return b.finish();
		walkDocument(docLines(state, state.doc.lines), settings, (n, text, scope) => {
			if (!/\(\s*[A-Za-z_]\w*\s*\)\s*=/.test(text)) return;
			const spec = specForDefinition(text, scope, settings);
			if (!spec) return;
			const key = text + "|" + scopeKey(scope) + "|" + JSON.stringify(settings);
			const line = state.doc.line(n);
			b.add(line.to, line.to, Decoration.widget({ widget: new GraphWidget(spec, key, getSettings), block: true, side: 1 }));
		});
		return b.finish();
	};
	const graphs = StateField.define<DecorationSet>({
		create: buildGraphs,
		update: (deco, tr) =>
			tr.docChanged || tr.effects.some((e) => e.is(refreshEffect)) ? buildGraphs(tr.state) : deco,
		provide: (f) => EditorView.decorations.from(f),
	});

	return [plugin, keys, graphs];
}

function scopeKey(scope: Map<string, unknown>): string {
	return [...scope].map(([k, v]) => k + "=" + String((v as { syntax?: string })?.syntax ?? v)).join(";");
}

class GraphWidget extends WidgetType {
	constructor(readonly spec: GraphSpec, readonly key: string, readonly getSettings: () => CalcSettings) { super(); }
	eq(other: GraphWidget) { return other.key === this.key; }
	toDOM(): HTMLElement {
		const div = document.createElement("div");
		div.className = "calcul-graph-block";
		renderGraph(div, this.spec, this.getSettings());
		return div;
	}
	ignoreEvent() { return true; }
}
