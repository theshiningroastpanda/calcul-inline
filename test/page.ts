// Page de test : éditeur CodeMirror + mode lecture + graphes, pilotée par e2e.mjs.
import "./dom-shim";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { buildExtension, refreshEffect } from "../src/editor";
import { DEFAULT_SETTINGS, Scope, walkDocument } from "../src/core";
import { parseGraphBlock, renderGraph } from "../src/graph";
import { makePostProcessor } from "../src/reading";
import { setLocale } from "../src/i18n";

const settings = { ...DEFAULT_SETTINGS };
const api = {
	editor(doc: string) {
		const view = new EditorView({
			state: EditorState.create({ doc, extensions: [buildExtension(() => settings), keymap.of([...defaultKeymap, indentWithTab])] }),
			parent: document.body,
		});
		return {
			doc: () => view.state.doc.toString(),
			insertTop: (text: string) => view.dispatch({ changes: { from: 0, insert: text } }),
			toggleGraphs: () => { settings.graphsUnderFunctions = !settings.graphsUnderFunctions; view.dispatch({ effects: refreshEffect.of(null) }); },
		};
	},
	reading(md: string, sections: { html: string; lineStart: number; lineEnd: number }[]) {
		const pp = makePostProcessor(() => settings);
		return sections.map((s) => {
			const el = document.body.appendChild(document.createElement("div"));
			el.innerHTML = s.html;
			pp(el, { getSectionInfo: () => ({ text: md, lineStart: s.lineStart, lineEnd: s.lineEnd }) } as never);
			return el.innerText;
		});
	},
	graph(defs: string[], block: string, theme: string) {
		let scope: Scope = new Map();
		walkDocument([...defs, "x"], settings, (_n, _t, sc) => { scope = sc; });
		const col = document.body.appendChild(document.createElement("div"));
		col.className = theme + " col";
		renderGraph(col, parseGraphBlock(block, scope, settings), settings);
		return col;
	},
	setLocale,
};
(window as unknown as { api: typeof api }).api = api;
