# Inline Calcul

An [Obsidian](https://obsidian.md) plugin: type a calculation ending with `=` and the result appears in grey right after it. Press **Tab** (or click) to insert it into the note.

```
The power is 5 * 8 / 4 =                 → 10
5 V / 2 kohm =                           → 2.5 mA
100 km/h to m/s =                        → 27.77777778 m / s
$\frac{10}{4} \cdot 3 =$                 → 7.5
```

The interface is in English, and in French when Obsidian is set to French.

## Features

- **Arithmetic**: `+ - * / ^ !`, parentheses, `mod`, and symbols such as `× ÷ · − ² ³ √ π`.
- **Functions**: `sqrt`, `ln`, `log10`, `sin`/`cos`/`tan`…, `round`, `min`/`max`, `mean`, `combinations`, `gcd`… and the constants `pi`, `e`, `i`.
- **Units** (powered by [mathjs](https://mathjs.org)) with prefixes and `to` conversion: `1/(2*pi*1 kohm*100 nF) =` → `1.591549431 kHz`.
- **Variables**: a line `R = 1 kohm` defines `R` for the lines below it.
- **Custom functions**: `P(U, R) = U^2 / R`, then `P(5 V, 1 kohm) =` → `25 mW`.
- **LaTeX**: `$…=$` with `\frac`, `\sqrt`, `\cdot`, `\times`, `\pi`, `\sin`…
- **Reading view and PDF export**: results are shown there too (except for LaTeX calculations).
- Code blocks, `inline code`, frontmatter, `==highlights==`, `<=` and `>=` are ignored.

A calculation must start with a digit, a parenthesis, a function, a constant or a variable you defined. This keeps ordinary words from being read as units.

## Graphs

A graph is drawn automatically below each `f(x) = …` definition (x from -10 to 10). Use the command **Toggle graphs under functions** to show or hide them.

For several curves or another range, use a `graph` code block:

````
```graph
u(t) = 5 V * sin(2*pi*f0*t)
i(t) = u(t) / R
x: 0..40 ms
```
````

- One function per line: a definition, the name of a function defined above, or an expression in `x`.
- Options: `x: a..b [unit]`, `y: a..b`, `height: 300`.
- Hover the graph for a crosshair with values. Curves with different units get one graph per unit.

## Settings

Significant digits · results in reading view · graph under functions · decimal comma (`2,5`).

## Installation

- **BRAT**: install [BRAT](https://github.com/TfTHacker/obsidian42-brat), then "Add beta plugin" → `theshiningroastpanda/calcul-inline`.
- **Manual**: download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest) into `<vault>/.obsidian/plugins/calcul-inline/`, then enable the plugin.

## Development

```bash
npm install
npm run lint       # Obsidian's ESLint rules
npm test           # calculation engine tests
npm run test:e2e   # browser tests (needs Playwright's Chromium)
npm run build      # produces main.js
```

To publish a version: update `version` in `manifest.json` and `package.json`, add the line to `versions.json`, then create a GitHub release whose tag is that version number. The workflow builds the plugin and attaches the files.

## License

MIT
