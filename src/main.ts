import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { EditorView } from "@codemirror/view";
import { CalcSettings, DEFAULT_SETTINGS } from "./core";
import { buildExtension, calcAtCursor, insertCalc, refreshEffect } from "./editor";
import { makeGraphBlockProcessor, makePostProcessor } from "./reading";

export default class CalculInlinePlugin extends Plugin {
	settings: CalcSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.registerEditorExtension(buildExtension(() => this.settings));
		const reading = makePostProcessor(() => this.settings);
		this.registerMarkdownPostProcessor((el, ctx) => {
			if (this.settings.showInReading || this.settings.graphsUnderFunctions) reading(el, ctx);
		});
		this.registerMarkdownCodeBlockProcessor("graphe", makeGraphBlockProcessor(() => this.settings));

		this.addCommand({
			id: "basculer-graphes",
			name: "Afficher / masquer les graphes sous les fonctions",
			callback: async () => {
				this.settings.graphsUnderFunctions = !this.settings.graphsUnderFunctions;
				await this.saveSettings();
				new Notice(`Graphes sous les fonctions : ${this.settings.graphsUnderFunctions ? "affichés" : "masqués"}`);
			},
		});

		this.addCommand({
			id: "inserer-resultat",
			name: "Insérer le résultat du calcul",
			editorCallback: (editor) => {
				// editor.cm = EditorView CM6 (API interne mais stable d'Obsidian)
				const view = (editor as unknown as { cm?: EditorView }).cm;
				const m = view && calcAtCursor(view.state, this.settings);
				if (view && m) insertCalc(view, m);
				else new Notice("Aucun calcul sous le curseur (place-le juste après le « = »).");
			},
		});

		this.addSettingTab(new CalculInlineSettingTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Rafraîchit les éditeurs ouverts
		this.app.workspace.iterateAllLeaves((leaf) => {
			const cm = ((leaf.view as MarkdownView)?.editor as unknown as { cm?: EditorView } | undefined)?.cm;
			cm?.dispatch({ effects: refreshEffect.of(null) });
			if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
		});
	}
}

class CalculInlineSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: CalculInlinePlugin) { super(app, plugin); }

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Chiffres significatifs")
			.setDesc("Précision des résultats affichés (1 à 15).")
			.addSlider((s) => s.setLimits(1, 15, 1).setValue(this.plugin.settings.precision)
				.setDynamicTooltip()
				.onChange(async (v) => { this.plugin.settings.precision = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Résultats en mode lecture")
			.setDesc("Affiche aussi les résultats en mode lecture et dans les exports PDF "
				+ "(sauf pour les calculs en LaTeX).")
			.addToggle((t) => t.setValue(this.plugin.settings.showInReading)
				.onChange(async (v) => { this.plugin.settings.showInReading = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Graphe sous les fonctions")
			.setDesc("Trace automatiquement f(x) = … sous sa définition (x de -10 à 10). "
				+ "Les blocs ```graphe restent toujours affichés. Aussi disponible en commande.")
			.addToggle((t) => t.setValue(this.plugin.settings.graphsUnderFunctions)
				.onChange(async (v) => { this.plugin.settings.graphsUnderFunctions = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Virgule décimale")
			.setDesc("Accepte 2,5 dans les calculs et affiche les résultats avec une virgule. "
				+ "Attention : max(2,5) devient alors max(2.5).")
			.addToggle((t) => t.setValue(this.plugin.settings.decimalComma)
				.onChange(async (v) => { this.plugin.settings.decimalComma = v; await this.plugin.saveSettings(); }));
	}
}
