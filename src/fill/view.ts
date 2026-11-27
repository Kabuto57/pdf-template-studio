// A FORM ON THE PAGE: the form's pages as lc-form's layout draws them (SVG: wording, sections, lines), with a real box over
// every PDF box. What the boxes show (value, red outline, locked, hidden) is what the scripts wrote in doc.ts; what the
// person does (typing, ticking) is handed to engine.ts, which runs lc-form's scripts. Nothing is sent or stored anywhere.
import { H, M, W, type PdfField, type Widget } from "../canvas/layout";
import { pagesSvg } from "../canvas/render";
import { h } from "../dom";
import type { Colour, Field } from "./doc";
import { dateProblem, type Engine } from "./engine";
import { confirm, say, whenQuiet } from "./ui";

const pt = (n: number) => `${+n.toFixed(2)}pt`;
const grey = (g: number) => `rgb(${Math.round(g * 255)},${Math.round(g * 255)},${Math.round(g * 255)})`;
/** Acrobat's colour array as CSS. */
export const css = (c: Colour) => c[0] === "RGB" ? `rgb(${[1, 2, 3].map(i => Math.round(+c[i] * 255)).join(",")})` : c[0] === "G" ? grey(+c[1]) : "transparent";
const dmy = (iso: string) => iso.split("-").reverse().join("/");
/** lc-form's extra QR code page (its hidden page template "qrx"): heading, a line of wording, the footer; the frames are drawn over it. */
const extraSvg = (code: string) => `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="QR code page, continued">`
  + `<text x="${M}" y="56" font-size="11" font-weight="bold">APPLICATION QR CODE (CONTINUED)</text>`
  + `<text x="${M}" y="70" font-size="8" fill="#808080">More codes of the same application, continuing from the QR code page. The Bank scans every code, in order. Do not write on or fold the codes.</text>`
  + `<line x1="${M}" y1="${H - 36}" x2="${W - M}" y2="${H - 36}" stroke="#bfbfbf" stroke-width=".5"/>`
  + `<text x="${M}" y="${H - 24}" font-size="7" fill="#808080">${code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></svg>`;
const iso = (d: string) => (/^\d\d\/\d\d\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : "");

interface Bound { wrap: HTMLElement; el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; widget: Widget }

export function mountForm(host: HTMLElement, eng: Engine, onMenu: () => void) {
  const { laid, doc } = eng;
  const svgs = pagesSvg(laid, false), pages: HTMLElement[] = [];
  const bound = new Map<string, Bound[]>();
  const committed = new Map<string, string>(); // each box's last answer that was accepted (a refused answer goes back to it)

  host.replaceChildren(h("div", { className: "toolbar screen" },
    h("button", { type: "button", onclick: onMenu }, "Main menu"),
    h("strong", {}, eng.form.form.title),
    h("span", { className: "grow" }),
    h("button", { type: "button", onclick: () => act("check-form") }, "Check form"),
    h("button", { type: "button", onclick: () => ask("reset-form") }, "Reset form")));
  svgs.forEach((svg, p) => {
    const page = h("section", { className: "pg", id: `pg${p}` });
    page.insertAdjacentHTML("afterbegin", svg);
    pages.push(page);
    host.append(page);
  });

  // ---- the boxes
  const place = (wrap: HTMLElement, w: Widget) => {
    wrap.style.left = pt(w.rect[0]);
    wrap.style.top = pt(H - w.rect[3]);
    wrap.style.width = pt(w.rect[2] - w.rect[0]);
    wrap.style.height = pt(w.rect[3] - w.rect[1]);
  };
  const add = (f: PdfField, w: Widget, el: Bound["el"], extra: Node[] = []) => {
    const wrap = h("div", { className: `fw ${f.type}` }, el, ...extra);
    place(wrap, w);
    el.classList.add("f");
    el.title = f.tooltip ?? "";
    el.name = f.name;
    pages[w.page].append(wrap);
    bound.set(f.name, [...(bound.get(f.name) ?? []), { wrap, el, widget: w }]);
  };
  for (const f of laid.fields) {
    if (f.type === "choice" && f.name.endsWith("__list")) continue; // a date is typed (or picked) in its own box
    for (const w of f.widgets) {
      if (f.type === "button") {
        const b = h("button", { type: "button", className: "sec", onclick: () => ask(eng.sectionButton(f.name) ?? "check-form") }, w.caption ?? "");
        place(b, w);
        b.className = "sec screen";
        pages[w.page].append(b);
        continue;
      }
      if (f.type === "check" || f.type === "radio") {
        const el = h("input", { type: f.type === "check" ? "checkbox" : "radio" });
        el.addEventListener("change", () => {
          doc.getField(f.name)!.value = f.type === "check" ? (el.checked ? "Yes" : "Off") : f.options![+(w.state ?? 0)];
          changed(f.name);
        });
        add(f, w, el);
      } else if (f.type === "choice") {
        const el = h("select", {}, h("option", { value: "" }), ...(f.options ?? []).map(o => h("option", { value: o }, o)));
        el.addEventListener("change", () => { doc.getField(f.name)!.value = el.value; changed(f.name); });
        add(f, w, el);
      } else {
        const date = f.format === "date";
        const el = f.multiline ? h("textarea", {}) : h("input", { type: "text" });
        if (f.max) el.maxLength = f.max;
        if (date) el.placeholder = "DD/MM/YYYY";
        el.spellcheck = false;
        el.autocomplete = "off";
        text(f, el);
        add(f, w, el, date ? [calendar(el)] : []);
      }
    }
  }

  /** Typing: lc-form's keystroke script may refuse or change what goes in (upper case, letters in a number); the whole answer is
   *  checked when the person leaves the box (its validate script), and the rules re-run. */
  function text(f: PdfField, el: HTMLInputElement | HTMLTextAreaElement) {
    el.addEventListener("beforeinput", ev => {
      const e = ev as InputEvent, data =e.data ?? e.dataTransfer?.getData("text") ?? "";
      if (!e.inputType.startsWith("insert") || !data) return;
      const out = eng.keystroke(f.name, data);
      if (out === null) { e.preventDefault(); flush(); return; }
      if (out !== data) {
        e.preventDefault();
        // setRangeText ignores the box's most characters (Acrobat's MaxLen): keep to the room left
        const from = el.selectionStart ?? 0, to = el.selectionEnd ?? 0;
        const room = el.maxLength >= 0 ? el.maxLength - (el.value.length - (to - from)) : Infinity;
        const put = out.slice(0, Math.max(room, 0));
        if (!put) return;
        el.setRangeText(put, from, to, "end");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    el.addEventListener("input", () => { doc.getField(f.name)!.value = el.value; doc.dirty.delete(doc.getField(f.name)!); });
    el.addEventListener("change", () => {
      const field = doc.getField(f.name)!;
      const refused = f.format === "date" ? dateProblem((f.tooltip ?? f.name).replace(/ \(DD\/MM\/YYYY\)$/, ""), el.value) : "";
      if (refused) say(refused); // a date that does not exist: the box goes back, as with Acrobat's date format
      if (refused || !eng.validate(f.name, el.value)) { field.value = committed.get(f.name) ?? ""; flush(); return; }
      committed.set(f.name, el.value);
      changed(f.name);
    });
  }
  /** Beside a date box: a small calendar (the browser's own date picker) that fills the box in DD/MM/YYYY. */
  function calendar(el: HTMLInputElement | HTMLTextAreaElement) {
    const pick = h("input", { type: "date", className: "pick", tabIndex: -1 });
    pick.setAttribute("aria-hidden", "true");
    pick.addEventListener("change", () => {
      if (!pick.value) return;
      el.value = dmy(pick.value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return h("button", {
      type: "button", className: "cal screen", title: "Pick a date", "aria-label": "Pick a date",
      onclick: () => { pick.value = iso(el.value); try { pick.showPicker(); } catch { pick.focus(); } },
    }, "▾", pick);
  }

  // ---- what the scripts wrote, onto the page
  function sync(f: Field) {
    for (const b of bound.get(f.name) ?? []) {
      const { wrap, el } = b;
      wrap.hidden = f.display === 1 || f.display === 3;
      wrap.style.setProperty("--stroke", css(f.strokeColor));
      wrap.style.setProperty("--fill", css(f.fillColor));
      wrap.style.setProperty("--lw", pt(f.lineWidth));
      wrap.dataset.bad = String(f.strokeColor[0] === "RGB"); // red outline: printed plain
      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        el.checked = el.type === "checkbox" ? f.value !== "Off" : f.value === f.options[+(b.widget.state ?? 0)];
        el.disabled = f.readonly;
      } else if (el instanceof HTMLSelectElement) {
        if (el.value !== f.value) el.value = f.value;
        el.disabled = f.readonly;
      } else {
        if (el.value !== f.value) el.value = f.value;
        el.readOnly = f.readonly;
      }
      el.setAttribute("aria-required", String(f.required));
      if (document.activeElement !== el) committed.set(f.name, f.value);
    }
  }
  function flush() {
    const qr = [...doc.dirty].some(f => f.name.includes("__qr")); // the QR code's boxes, also on the spawned pages (P1_0.__qrx_1_5)
    for (const f of doc.dirty) sync(f);
    doc.dirty.clear();
    if (qr) { drawQr(); updateNote(); }
  }
  function changed(name: string) { eng.fire(name); flush(); }

  // ---- buttons
  type Script = Parameters<Engine["press"]>[0];
  function act(script: Script) { eng.press(script); flush(); }
  async function ask(what: Script) {
    if (what === "reset-form") {
      if (await confirm(eng.resetQuestion())) { eng.reset(); flush(); }
    } else act(what);
  }

  // ---- the QR page: its buttons, and the codes lcDrawQr wrote into the 2 x 177 rows
  const qrPage = pages[laid.qr.page];
  type Slot = { label: HTMLElement; box: HTMLElement };
  /** A code's frame and label on a page; the frame shows only while its code is in use (the first code's always does). */
  const slotOn = (page: HTMLElement, [x, y, size]: number[], first: boolean): Slot => {
    const label = h("div", { className: "qr-label" });
    label.style.left = pt(x); label.style.top = pt(H - y - size - 11); label.style.width = pt(size);
    const box = h("div", { className: "qr" });
    box.style.left = pt(x); box.style.top = pt(H - y - size); box.style.width = box.style.height = pt(size);
    box.hidden = !first;
    if (!first) box.classList.add("second");
    page.append(label, box);
    return { label, box };
  };
  const slots = laid.qr.slots.map((s, k) => slotOn(qrPage, s, k === 0));
  // the extra QR code pages (codes 3 and up, two to a page): there while the stand-in document has pages beyond the form's
  const extra: { page: HTMLElement; slots: Slot[] }[] = [];
  const formPages = laid.pages.length;
  function syncPages(want: number) {
    while (extra.length > want) extra.pop()!.page.remove();
    while (extra.length < want) {
      const page = h("section", { className: "pg extra" });
      page.insertAdjacentHTML("afterbegin", extraSvg(eng.form.form.formCode ?? eng.form.form.title));
      (extra.at(-1)?.page ?? qrPage).after(page);
      extra.push({ page, slots: laid.qr.slots.map(s => slotOn(page, s, false)) });
    }
  }
  [["Generate QR Code", "generate-qr"], ["Print Form", "print-form"]].forEach(([caption, script], i) => {
    const b = h("button", { type: "button", className: "sec screen", onclick: () => act(script as Script) }, caption);
    b.style.left = pt(laid.qr.button[0] + i * 162); b.style.top = pt(H - laid.qr.button[1] - 22);
    b.style.width = pt(150); b.style.height = pt(22);
    qrPage.append(b);
  });
  let covered = false; // the "no valid QR code" notice is up: no code, old or new, is shown or printed
  function drawQr() {
    const codes = covered ? [] : eng.codes();
    syncPages(covered ? 0 : doc.numPages - formPages);
    [...slots, ...extra.flatMap(e => e.slots)].forEach(({ label, box }, k) => {
      const code = codes[k];
      box.hidden = k > 0 && !code;
      label.textContent = code?.label ?? "";
      box.replaceChildren();
      if (!code) return;
      // one rectangle per run of dark squares: the code stays sharp however it is scaled or printed
      let d = "";
      code.rows.forEach((row, y) => { for (const m of row.matchAll(/n+/g)) d += `M${m.index! + 4} ${y + 4}h${m[0].length}v1h-${m[0].length}z`; });
      box.insertAdjacentHTML("afterbegin", `<svg viewBox="0 0 185 185" role="img" aria-label="QR code ${k + 1}"><path d="${d}" shape-rendering="crispEdges"/></svg>`);
    });
  }

  // A printout must never look complete without a valid QR code: this box covers the code's place (screen and print) whenever Print
  // Form would refuse, with the PDF's own message. The browser's own Print (Ctrl+P, menu) gets the PDF's "Before printing" warning too.
  const note = h("div", { className: "nocode", role: "alert" });
  Object.assign(note.style, { left: pt(laid.qr.slots[0][0]), top: pt(H - laid.qr.slots[0][1] - laid.qr.slots[0][2]), width: pt(laid.qr.slots[0][2]), height: pt(laid.qr.slots[0][2]) });
  note.hidden = true;
  qrPage.append(note);
  function updateNote() {
    const problem = eng.qrProblem();
    note.hidden = !problem;
    covered = !!problem;
    drawQr(); // hides every old code while the notice shows (a stale second code must not print or scan), shows them again when valid
    note.replaceChildren(...(problem ? [h("strong", {}, "NO VALID QR CODE"), h("p", {}, problem)] : []));
    for (const f of doc.dirty) sync(f);
    doc.dirty.clear();
  }
  const beforePrint = () => { eng.warnBeforePrint(); updateNote(); };
  window.addEventListener("beforeprint", beforePrint);
  doc.onPrint = () => window.print();
  doc.onPage = n => pages[Math.min(n, pages.length - 1)].scrollIntoView({ behavior: "smooth" });
  doc.onFocus = name => whenQuiet(() => { const e = bound.get(name)?.[0]?.el; e?.scrollIntoView({ block: "center" }); e?.focus(); });
  eng.onAlert = say;
  for (const f of doc.list) sync(f);
  doc.dirty.clear();
  if (eng.codes().length) updateNote(); // opened again from the menu: its codes show if still valid, else the notice (a fresh form has neither)
  return { pages, bound, destroy: () => window.removeEventListener("beforeprint", beforePrint) };
}
