# Changelog

## 0.3.3

- Calculations in lists now work: a leading bullet is no longer read as a minus sign (`- 48000 * 2 =` gives `96000`, not `-96000`). Numbered lists, task checkboxes, blockquotes and headings are handled the same way.
- Variables and functions can be defined in numbered lists, task items, blockquotes and headings.
- `-5` without a space is still a negative number.

## 0.3.2

- Release files now come with GitHub artifact attestations, so their provenance can be verified.
- Release notes are filled in automatically.

## 0.3.1

- Interface in English, and in French when Obsidian is set to French.
- New `graph` code block (the `graphe` alias still works).
- Compatibility fix for iOS versions older than 16.4.
- Settings appear in the settings search (Obsidian 1.13 and later).
- Plugin renamed to Inline Calcul.

## 0.3.0

- First public version: inline calculations with Tab to insert, units, variables, custom functions, LaTeX, reading view and function graphs.
