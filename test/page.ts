import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { buildExtension } from "../src/editor";
import { DEFAULT_SETTINGS } from "../src/core";
const view = new EditorView({
  state: EditorState.create({ doc: "R = 1 kohm\nC = 100 nF\ng(x) = 2*x\n", extensions: [buildExtension(() => DEFAULT_SETTINGS), keymap.of([...defaultKeymap, indentWithTab])] }),
  parent: document.body,
});
(window as any).view = view;
