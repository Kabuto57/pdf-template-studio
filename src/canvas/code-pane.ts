// THE CODE PANE (canvas, like Overleaf): the form file beside the pages. Edits on the canvas rewrite the code;
// typing in the code redraws the canvas once it reads (read-form-file.ts), and a line it can't read is named
// under the editor (the canvas keeps the last form that read). Clicking a question's line selects it.
import { h } from "../dom";

export interface CodeHost {
  /** The code read: replace the form with it. Throws if it can't be read. */
  apply(code: string): void;
  /** The cursor is on a question's line (its id) or a section's line (its title). */
  pick(what: { id?: string; title?: string }): void;
}

let host: CodeHost, input: HTMLTextAreaElement, gutter: HTMLElement, colours: HTMLElement, status: HTMLElement, timer = 0;
let dirty = false; // typed since the code was last written from the form

export function codePane(h_: CodeHost): HTMLElement {
  host = h_;
  gutter = h("pre", { className: "cp-gutter", "aria-hidden": "true" });
  input = h("textarea", {
    className: "cp-input", spellcheck: false, wrap: "off", "aria-label": "Form file (Python)",
    oninput: () => { dirty = true; numbers(); paint(); clearTimeout(timer); timer = window.setTimeout(read, 350); },
    onscroll: () => { gutter.scrollTop = colours.scrollTop = input.scrollTop; colours.scrollLeft = input.scrollLeft; },
    onclick: () => cursorMoved(), onkeyup: (e: KeyboardEvent) => e.key.startsWith("Arrow") && cursorMoved(),
    onkeydown: (e: KeyboardEvent) => { // Tab indents, as in a code editor
      if (e.key !== "Tab") return;
      e.preventDefault();
      input.setRangeText("    ", input.selectionStart, input.selectionEnd, "end");
      input.dispatchEvent(new Event("input"));
    },
  });
  status = h("p", { className: "cp-status", role: "status" });
  colours = h("pre", { className: "cp-colours", "aria-hidden": "true" });
  return h("section", { className: "cp", "aria-label": "Code" },
    h("div", { className: "cp-body" }, gutter, h("div", { className: "cp-text" }, colours, input)),
    status);
}

/** Shows the code written from the form, unless the person is typing in it. */
export function showCode(code: string) {
  if (!input || (dirty && document.activeElement === input)) return;
  if (input.value === code) return;
  const top = input.scrollTop;
  input.value = code;
  dirty = false;
  numbers();
  paint();
  input.scrollTop = top;
  say("");
}

/** Marks a question's (or section's) line and scrolls it into view. */
export function markLine(find?: RegExp) {
  gutter.querySelectorAll(".on").forEach(el => el.classList.remove("on"));
  if (!find || !input) return;
  const lines = input.value.split("\n"), i = lines.findIndex(l => find.test(l));
  if (i < 0) return;
  gutter.children[i]?.classList.add("on");
  const lineH = parseFloat(getComputedStyle(input).lineHeight) || 18;
  if (document.activeElement !== input) {
    const y = i * lineH;
    if (y < input.scrollTop || y > input.scrollTop + input.clientHeight - lineH * 2) input.scrollTop = y - input.clientHeight / 3;
  }
}

// Colours: the textarea's text is transparent over a copy of it with each kind of word coloured.
const WORDS = /("""[\s\S]*?"""|"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(#.*)|\b(from|import|True|False|None)\b|\b(section|text|long|date|radio|checks|check|select|when|ticked|answered|not_before|after|in_range|account_length)(?=\()|\b(\d+(?:\.\d+)?)\b|\b([A-Z][A-Z0-9_]+)\b/g;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function paint() {
  let html = "", last = 0;
  for (const m of input.value.matchAll(WORDS)) {
    const kind = ["str", "note", "key", "fn", "num", "name"][m.slice(1).findIndex(x => x !== undefined)];
    html += `${esc(input.value.slice(last, m.index))}<span class="cp-${kind}">${esc(m[0])}</span>`;
    last = m.index! + m[0].length;
  }
  colours.innerHTML = `${html}${esc(input.value.slice(last))}\n`;
}

function read() {
  try {
    host.apply(input.value);
    dirty = false;
    say("");
  } catch (e) {
    say((e as Error).message, true);
  }
}

function numbers() {
  const n = input.value.split("\n").length;
  if (gutter.children.length !== n) gutter.replaceChildren(...Array.from({ length: n }, (_, i) => h("span", {}, String(i + 1))));
}

function say(msg: string, bad = false) {
  status.textContent = msg || "Edit the code or the page: each follows the other.";
  status.classList.toggle("bad", bad);
  gutter.querySelectorAll(".bad").forEach(el => el.classList.remove("bad"));
  const line = bad && /^Line (\d+)/.exec(msg);
  if (line) gutter.children[+line[1] - 1]?.classList.add("bad");
}

function cursorMoved() {
  const before = input.value.slice(0, input.selectionStart), from = before.lastIndexOf("\n") + 1;
  const end = input.value.indexOf("\n", from), text = input.value.slice(from, end < 0 ? undefined : end);
  const q = /^\s*(?:text|long|date|radio|checks|check|select)\(\s*"(\w+)"/.exec(text);
  const s = /^\s*section\(\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  if (q) host.pick({ id: q[1] });
  else if (s) host.pick({ title: JSON.parse(`"${s[1]}"`) });
}
