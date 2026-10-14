import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { buildExtension, refreshEffect } from "../src/editor";
import { DEFAULT_SETTINGS } from "../src/core";
const settings = { ...DEFAULT_SETTINGS };
const view = new EditorView({ state: EditorState.create({ doc: "Texte\nf(x) = x^2\n```graphe\ng(x) = x\n```\nfin", extensions: [buildExtension(() => settings)] }), parent: document.body });
(window as any).count = () => document.querySelectorAll(".calcul-graph").length;
(window as any).toggle = () => { settings.graphsUnderFunctions = !settings.graphsUnderFunctions; view.dispatch({ effects: refreshEffect.of(null) }); };
(window as any).edit = () => view.dispatch({ changes: { from: 0, insert: "h(t) = 2*t\n" } });
