import { makePostProcessor } from "../src/reading";
import { DEFAULT_SETTINGS } from "../src/core";
const md = "R = 1 kohm\nf(x) = x^2\n\nLe courant vaut 5 V / R =\nf(4) =\n\nPas **gras** = rien\n\n`5*8 =`\n\n- liste 2^8 =\n\n$5 \\cdot 3 =$";
const html = [
  "<p>R = 1 kohm<br>f(x) = x^2</p>",
  "<p>Le courant vaut 5 V / R =<br>f(4) =</p>",
  "<p>Pas <strong>gras</strong> = rien</p>",
  "<p><code>5*8 =</code></p>",
  "<ul><li>liste 2^8 =</li></ul>",
  "<p><span class='math'>MATH</span></p>",
];
const pp = makePostProcessor(() => DEFAULT_SETTINGS);
const ranges = [[0,1],[3,4],[6,6],[8,8],[10,10],[12,12]];
html.forEach((h, i) => {
  const el = document.createElement("div"); el.innerHTML = h; document.body.appendChild(el);
  pp(el, { getSectionInfo: () => ({ text: md, lineStart: ranges[i][0], lineEnd: ranges[i][1] }) } as any);
});
(window as any).done = true;
