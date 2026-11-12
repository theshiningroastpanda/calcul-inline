// Mini-simulation des aides DOM qu'Obsidian ajoute au navigateur
// (createDiv, createSpan, createSvg, toggleClass, setCssProps, empty).
type Info = { cls?: string; text?: string; attr?: Record<string, string | number> } | string | undefined;

function apply(el: Element, o: Info): void {
	if (!o) return;
	if (typeof o === "string") { el.setAttribute("class", o); return; }
	if (o.cls) el.setAttribute("class", o.cls);
	if (o.text !== undefined) el.textContent = o.text;
	for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, String(v));
}
function make(tag: string, o: Info, parent?: Node): HTMLElement {
	const el = document.createElement(tag);
	apply(el, o);
	parent?.appendChild(el);
	return el;
}
const N = Node.prototype as unknown as Record<string, unknown>;
N.createEl = function (this: Node, tag: string, o: Info) { return make(tag, o, this); };
N.createDiv = function (this: Node, o: Info) { return make("div", o, this); };
N.createSpan = function (this: Node, o: Info) { return make("span", o, this); };
N.createSvg = function (this: Node, tag: string, o: Info) {
	const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
	apply(el, o);
	this.appendChild(el);
	return el;
};
const E = Element.prototype as unknown as Record<string, unknown>;
E.toggleClass = function (this: Element, c: string, v: boolean) { this.classList.toggle(c, v); };
E.empty = function (this: Element) { this.replaceChildren(); };
E.setCssProps = function (this: HTMLElement, p: Record<string, string>) {
	for (const [k, v] of Object.entries(p)) this.style.setProperty(k, v);
};
const W = window as unknown as Record<string, unknown>;
W.createDiv = (o: Info) => make("div", o);
W.createSpan = (o: Info) => make("span", o);
