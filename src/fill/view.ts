// A FORM ON THE PAGE: the form's pages as lc-form's layout draws them (SVG: wording, sections, lines), with a real box over
// every PDF box. What the boxes show (value, red outline, locked, hidden) is what the scripts wrote in doc.ts; what the
// person does (typing, ticking) is handed to engine.ts, which runs lc-form's scripts. Nothing is sent or stored anywhere.
import { H, type PdfField, type Widget } from "../canvas/layout";
import { pagesSvg } from "../canvas/render";
import { h } from "../dom";
import type { Colour, Field } from "./doc";
import type { Engine } from "./engine";
import { confirm, say, whenQuiet } from "./ui";

const pt = (n: number) => `${+n.toFixed(2)}pt`;
const grey = (g: number) => `rgb(${Math.round(g * 255)},${Math.round(g * 255)},${Math.round(g * 255)})`;
/** Acrobat's colour array as CSS. */
export const css = (c: Colour) => c[0] === "RGB" ? `rgb(${[1, 2, 3].map(i => Math.round(+c[i] * 255)).join(",")})` : c[0] === "G" ? grey(+c[1]) : "transparent";
const dmy = (iso: string) => iso.split("-").reverse().join("/");
const iso = (d: string) => (/^\d\d\/\d\d\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : "");

interface Bound { wrap: HTMLElement; el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; widget: Widget }

export function mountForm(host: HTMLElement, eng: Engine, back: readonly [string, string], onMenu: () => void) {
  const { laid, doc } = eng;
  const svgs = pagesSvg(laid, false), pages: HTMLElement[] = [];
  const bound = new Map<string, Bound[]>();
  const committed = new Map<string, string>(); // each box's last answer that was accepted (a refused answer goes back to it)

  host.replaceChildren(h("div", { className: "toolbar screen" },
    h("button", { type: "button", onclick: () => ask("main") }, "Main menu"),
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
        el.setRangeText(out, el.selectionStart ?? 0, el.selectionEnd ?? 0, "end");
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    el.addEventListener("input", () => { doc.getField(f.name)!.value = el.value; doc.dirty.delete(doc.getField(f.name)!); });
    el.addEventListener("change", () => {
      const field = doc.getField(f.name)!;
      if (!eng.validate(f.name, el.value)) { field.value = committed.get(f.name) ?? ""; flush(); return; }
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
    const qr = [...doc.dirty].some(f => f.name.startsWith("__qr"));
    for (const f of doc.dirty) sync(f);
    doc.dirty.clear();
    if (qr) drawQr();
  }
  function changed(name: string) { eng.fire(name); flush(); }

  // ---- buttons
  type Script = Parameters<Engine["press"]>[0];
  function act(script: Script) { eng.press(script); flush(); }
  async function ask(what: Script | "main") {
    if (what === "reset-form") {
      if (await confirm(eng.resetQuestion())) { eng.reset(); flush(); }
    } else if (what === "main") {
      if (await confirm(back[0] + eng.form.form.title + back[1])) onMenu();
    } else act(what);
  }

  // ---- the QR page: its buttons, and the codes lcDrawQr wrote into the 2 x 177 rows
  const qrPage = pages[laid.qr.page];
  const slots = laid.qr.slots.map(([x, y, size], k) => {
    const label = h("div", { className: "qr-label" });
    label.style.left = pt(x); label.style.top = pt(H - y - size - 11); label.style.width = pt(size);
    const box = h("div", { className: "qr" });
    box.style.left = pt(x); box.style.top = pt(H - y - size); box.style.width = box.style.height = pt(size);
    box.hidden = k > 0;
    if (k > 0) box.classList.add("second");
    qrPage.append(label, box);
    return { label, box };
  });
  [["Generate QR Code", "generate-qr"], ["Print Form", "print-form"]].forEach(([caption, script], i) => {
    const b = h("button", { type: "button", className: "sec screen", onclick: () => act(script as Script) }, caption);
    b.style.left = pt(laid.qr.button[0] + i * 162); b.style.top = pt(H - laid.qr.button[1] - 22);
    b.style.width = pt(150); b.style.height = pt(22);
    qrPage.append(b);
  });
  function drawQr() {
    const codes = eng.codes();
    slots.forEach(({ label, box }, k) => {
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

  doc.onPrint = () => window.print();
  doc.onPage = n => pages[Math.min(n, pages.length - 1)].scrollIntoView({ behavior: "smooth" });
  doc.onFocus = name => whenQuiet(() => { const e = bound.get(name)?.[0]?.el; e?.scrollIntoView({ block: "center" }); e?.focus(); });
  eng.onAlert = say;
  for (const f of doc.list) sync(f);
  doc.dirty.clear();
  return { pages, bound };
}
