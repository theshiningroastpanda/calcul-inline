# Calcul inline

Plugin [Obsidian](https://obsidian.md) : écris un calcul qui finit par `=`, le résultat apparaît en gris. **Tab** (ou un clic) l'insère dans la note.

```
La puissance vaut 5 * 8 / 4 =            → 10
5 V / 2 kohm =                           → 2.5 mA
100 km/h to m/s =                        → 27.77777778 m / s
$\frac{10}{4} \cdot 3 =$                 → 7.5
```

## Fonctionnalités

- **Calculs** : `+ - * / ^ !`, parenthèses, `mod`, symboles `× ÷ · − ² ³ √ π`.
- **Fonctions** : `sqrt`, `ln`, `log10`, `sin`/`cos`/`tan`…, `round`, `min`/`max`, `mean`, `combinations`, `gcd`… et les constantes `pi`, `e`, `i`.
- **Unités** (via [mathjs](https://mathjs.org)) avec préfixes et conversion `to` : `1/(2*pi*1 kohm*100 nF) =` → `1.591549431 kHz`.
- **Variables** : une ligne `R = 1 kohm` définit `R` pour les lignes en dessous.
- **Fonctions perso** : `P(U, R) = U^2 / R` puis `P(5 V, 1 kohm) =` → `25 mW`.
- **LaTeX** : `$…=$` avec `\frac`, `\sqrt`, `\cdot`, `\times`, `\pi`, `\sin`…
- **Mode lecture & export PDF** : les résultats s'affichent aussi (sauf calculs en LaTeX).
- Ignore les blocs de code, le `code inline`, le frontmatter, `==surlignage==`, `<=`, `>=`.

## Graphes

Un graphe s'affiche automatiquement sous chaque `f(x) = …` (x de -10 à 10). Commande **« Afficher / masquer les graphes sous les fonctions »** pour basculer.

Pour plusieurs courbes ou un autre intervalle, un bloc `graphe` :

````
```graphe
u(t) = 5 V * sin(2*pi*f0*t)
i(t) = u(t) / R
x: 0..40 ms
```
````

- Une fonction par ligne : définition, nom d'une fonction définie plus haut, ou expression en `x`.
- Options : `x: a..b [unité]`, `y: a..b`, `hauteur: 300`.
- Survol : réticule et valeurs. Courbes d'unités différentes → un graphe par unité.

## Réglages

Chiffres significatifs · résultats en mode lecture · graphe sous les fonctions · virgule décimale (`2,5`).

## Installation

- **BRAT** : installe [BRAT](https://github.com/TfTHacker/obsidian42-brat), puis « Add beta plugin » → `theshiningroastpanda/calcul-inline`.
- **Manuel** : télécharge `main.js`, `manifest.json` et `styles.css` depuis la [dernière release](../../releases/latest) dans `<vault>/.obsidian/plugins/calcul-inline/`, puis active le plugin.

## Développement

```bash
npm install
npm test         # tests du moteur de calcul
npm run build    # produit main.js
```

Publier une version : mettre à jour `version` dans `manifest.json` et `package.json`, ajouter la ligne dans `versions.json`, puis `git tag 0.3.1 && git push --tags`. Le workflow crée la release.

## Licence

MIT
