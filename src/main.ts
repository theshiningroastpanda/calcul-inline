import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, SettingDefinitionItem, getLanguage } from "obsidian";
import { Extension } from "@codemirror/state";
import { CalcMatch, CalcSettings, DEFAULT_SETTINGS, findCalc, walkDocument } from "./core";
import { buildExtension } from "./editor";
import { setLocale, t } from "./i18n";
import { makeGraphBlockProcessor, makePostProcessor } from "./reading";

export default class CalculInlinePlugin extends Plugin {
	settings: CalcSettings = { ...DEFAULT_SETTINGS };
	// Même tableau tout au long de la vie du plugin : on le vide/remplit puis
	// workspace.updateOptions() reconfigure les éditeurs ouverts.
	private editorExtensions: Extension[] = [];

	async onload() {
		setLocale(getLanguage());
		const saved = (await this.loadData()) as Partial<CalcSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };

		this.editorExtensions.push(buildExtension(() => this.settings));
		this.registerEditorExtension(this.editorExtensions);

		const reading = makePostProcessor(() => this.settings);
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (this.settings.showInReading || this.settings.graphsUnderFunctions) reading(el, ctx);
		});
		const graphBlock = makeGraphBlockProcessor(() => this.settings);
		this.registerMarkdownCodeBlockProcessor("graph", graphBlock);
		this.registerMarkdownCodeBlockProcessor("graphe", graphBlock);

		this.addCommand({
			id: "toggle-graphs",
			name: t("cmd.toggleGraphs"),
			callback: async () => {
				this.settings.graphsUnderFunctions = !this.settings.graphsUnderFunctions;
				await this.saveSettings();
				new Notice(t(this.settings.graphsUnderFunctions ? "notice.graphsShown" : "notice.graphsHidden"));
			},
		});

		this.addCommand({
			id: "insert-result",
			name: t("cmd.insertResult"),
			editorCallback: (editor) => {
				const cur = editor.getCursor();
				const hit: { m: CalcMatch | null } = { m: null };
				const lines = editor.getValue().split("\n").slice(0, cur.line + 1);
				walkDocument(lines, this.settings, (n, text, scope) => {
					if (n === cur.line + 1) hit.m = findCalc(text, scope, this.settings);
				});
				if (!hit.m) {
					new Notice(t("notice.noCalc"));
					return;
				}
				const text = " " + hit.m.result;
				editor.replaceRange(text, { line: cur.line, ch: hit.m.from }, { line: cur.line, ch: hit.m.to });
				editor.setCursor({ line: cur.line, ch: hit.m.from + text.length });
			},
		});

		this.addSettingTab(new CalculInlineSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Éditeurs : nouvelle instance de l'extension dans le même tableau
		this.editorExtensions.length = 0;
		this.editorExtensions.push(buildExtension(() => this.settings));
		this.app.workspace.updateOptions();
		// Mode lecture
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
		});
	}
}

class CalculInlineSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: CalculInlinePlugin) { super(app, plugin); }

	// Obsidian ≥ 1.13 : réglages déclaratifs (visibles dans la recherche des réglages).
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: t("set.precision.name"), desc: t("set.precision.desc"),
				control: { type: "slider", key: "precision", min: 1, max: 15, step: 1 } },
			{ name: t("set.reading.name"), desc: t("set.reading.desc"), control: { type: "toggle", key: "showInReading" } },
			{ name: t("set.graphs.name"), desc: t("set.graphs.desc"), control: { type: "toggle", key: "graphsUnderFunctions" } },
			{ name: t("set.comma.name"), desc: t("set.comma.desc"), control: { type: "toggle", key: "decimalComma" } },
		];
	}

	getControlValue(key: string): unknown {
		return this.plugin.settings[key as keyof CalcSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		Object.assign(this.plugin.settings, { [key]: value });
		await this.plugin.saveSettings();
	}

	// Obsidian < 1.13 : rendu classique.
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = () => this.plugin.saveSettings();

		new Setting(containerEl)
			.setName(t("set.precision.name"))
			.setDesc(t("set.precision.desc"))
			.addSlider((c) => c.setLimits(1, 15, 1).setValue(s.precision)
				.onChange(async (v) => { s.precision = v; await save(); }));

		new Setting(containerEl)
			.setName(t("set.reading.name"))
			.setDesc(t("set.reading.desc"))
			.addToggle((c) => c.setValue(s.showInReading)
				.onChange(async (v) => { s.showInReading = v; await save(); }));

		new Setting(containerEl)
			.setName(t("set.graphs.name"))
			.setDesc(t("set.graphs.desc"))
			.addToggle((c) => c.setValue(s.graphsUnderFunctions)
				.onChange(async (v) => { s.graphsUnderFunctions = v; await save(); }));

		new Setting(containerEl)
			.setName(t("set.comma.name"))
			.setDesc(t("set.comma.desc"))
			.addToggle((c) => c.setValue(s.decimalComma)
				.onChange(async (v) => { s.decimalComma = v; await save(); }));
	}
}
