// Textes de l'interface : anglais par défaut, français si Obsidian est en français.
// Module pur (pas d'import Obsidian) : main.ts appelle setLocale() au chargement.

const en = {
	"cmd.toggleGraphs": "Toggle graphs under functions",
	"cmd.insertResult": "Insert calculation result",
	"notice.graphsShown": "Graphs under functions: shown",
	"notice.graphsHidden": "Graphs under functions: hidden",
	"notice.noCalc": "No calculation on this line (it must end with “=”).",
	"ghost.hint": "Tab or click to insert",
	"set.precision.name": "Significant digits",
	"set.precision.desc": "Precision of displayed results (1 to 15).",
	"set.reading.name": "Results in reading view",
	"set.reading.desc": "Also show results in reading view and PDF exports (except LaTeX calculations).",
	"set.graphs.name": "Graph under functions",
	"set.graphs.desc": "Automatically plot f(x) = … below its definition (x from -10 to 10). Graph code blocks are always shown.",
	"set.comma.name": "Decimal comma",
	"set.comma.desc": "Accept 2,5 in calculations and show results with a comma. Note: max(2,5) then becomes max(2.5).",
	"graph.badRange": "Unreadable range: “{0}” (e.g. x: -5..5 or x: 0..20 ms)",
	"graph.notUnderstood": "Not understood: “{0}”",
	"graph.nothing": "No function to plot.",
	"graph.aria": "Graph of {0}",
};

type Key = keyof typeof en;

const fr: Record<Key, string> = {
	"cmd.toggleGraphs": "Afficher / masquer les graphes sous les fonctions",
	"cmd.insertResult": "Insérer le résultat du calcul",
	"notice.graphsShown": "Graphes sous les fonctions : affichés",
	"notice.graphsHidden": "Graphes sous les fonctions : masqués",
	"notice.noCalc": "Aucun calcul sur cette ligne (elle doit finir par « = »).",
	"ghost.hint": "Tab ou clic pour insérer",
	"set.precision.name": "Chiffres significatifs",
	"set.precision.desc": "Précision des résultats affichés (1 à 15).",
	"set.reading.name": "Résultats en mode lecture",
	"set.reading.desc": "Affiche aussi les résultats en mode lecture et dans les exports PDF (sauf pour les calculs en LaTeX).",
	"set.graphs.name": "Graphe sous les fonctions",
	"set.graphs.desc": "Trace automatiquement f(x) = … sous sa définition (x de -10 à 10). Les blocs de code « graphe » restent toujours affichés.",
	"set.comma.name": "Virgule décimale",
	"set.comma.desc": "Accepte 2,5 dans les calculs et affiche les résultats avec une virgule. Attention : max(2,5) devient alors max(2.5).",
	"graph.badRange": "Intervalle illisible : « {0} » (ex. x: -5..5 ou x: 0..20 ms)",
	"graph.notUnderstood": "Pas compris : « {0} »",
	"graph.nothing": "Aucune fonction à tracer.",
	"graph.aria": "Graphe de {0}",
};

let current: Record<Key, string> = en;

export function setLocale(lang: string): void {
	current = lang.toLowerCase().startsWith("fr") ? fr : en;
}

export function t(key: Key, ...args: string[]): string {
	return current[key].replace(/\{(\d)\}/g, (_m: string, i: string) => args[Number(i)] ?? "");
}
