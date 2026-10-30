// Reading PDFs that have no form fields: their text, the "Label: value" pairs in it, and the blanks
// (____ or ☐) a person would write in.
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { slug } from "./pdf";
import type { Field, Template, Values } from "./pdf";
import { COUNTRIES, CURRENCIES } from "./lists";

if (typeof window !== "undefined") GlobalWorkerOptions.workerSrc = workerUrl; // tests (Node) use the legacy build's own worker

export interface Part { x: number; y: number; w: number; size: number; text: string }
export interface Seg { x: number; end: number; text: string; parts: Part[] }
export interface Line { page: number; y: number; size: number; segs: Seg[] }

export async function readText(bytes: Uint8Array): Promise<Line[]> {
  const doc = await getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const out: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items
      .filter((i): i is TextItem => "str" in i && i.str.trim() !== "");
    out.push(...toLines(p, items.map(i => ({
      x: i.transform[4], y: i.transform[5], w: i.width, text: i.str, size: Math.hypot(i.transform[2], i.transform[3]) || i.height || 10,
    }))));
  }
  await doc.destroy();
  return out;
}

/** Groups text pieces into lines (same baseline), and each line into segments split at wide gaps. */
export function toLines(page: number, parts: Part[]): Line[] {
  const lines: Line[] = [];
  for (const p of [...parts].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find(l => Math.abs(l.y - p.y) <= Math.max(l.size, p.size) * 0.4);
    if (line) { line.segs[0].parts.push(p); line.size = Math.max(line.size, p.size); }
    else lines.push({ page, y: p.y, size: p.size, segs: [{ x: 0, end: 0, text: "", parts: [p] }] });
  }
  for (const l of lines) {
    const sorted = l.segs[0].parts.sort((a, b) => a.x - b.x);
    l.segs = [];
    for (const p of sorted) {
      const seg = l.segs[l.segs.length - 1];
      const gap = seg ? p.x - seg.end : Infinity;
      if (gap > Math.max(p.size * 1.5, 9)) l.segs.push({ x: p.x, end: p.x + p.w, text: p.text.trim(), parts: [p] });
      else {
        seg.text += (gap > p.size * 0.15 && !seg.text.endsWith(" ") ? " " : "") + p.text.trim();
        seg.end = Math.max(seg.end, p.x + p.w);
        seg.parts.push(p);
      }
    }
  }
  return lines;
}

export interface Pair { label: string; value: string; page: number }
const EMPTY = /^[_.\s-]*$/;
const TICKED = /^(?:[☒☑✓✔✗✘■]|\[[xX✓]\])\s*(.+)$/, UNTICKED = /^(?:[☐□❑▢]|\[\s?\])\s*(.+)$/;

/**
 * Finds answers in plain text: "Label: value", a label then a value further along the same line,
 * and ticked / unticked boxes.
 * ponytail: layout heuristics. A label printed above its value, or answers in table cells, are not paired.
 */
export function pairs(lines: Line[]): Pair[] {
  const out: Pair[] = [];
  const add = (label: string, value: string, page: number) => {
    label = label.replace(/[:*\s]+$/, "").trim();
    if (label && !/^\d+\.?$/.test(label)) out.push({ label, value: EMPTY.test(value) ? "" : value.trim(), page });
  };
  for (const l of lines) {
    for (let i = 0; i < l.segs.length; i++) {
      const t = l.segs[i].text, next = l.segs[i + 1]?.text;
      let m: RegExpExecArray | null;
      if ((m = TICKED.exec(t))) add(m[1], "Yes", l.page);
      else if ((m = UNTICKED.exec(t))) add(m[1], "No", l.page);
      else if ((m = /^([^:]{1,60}):\s*(.*)$/.exec(t))) {
        if (!m[2] && next !== undefined && !next.includes(":")) { add(m[1], next, l.page); i++; } else add(m[1], m[2], l.page);
      } else if (l.segs.length === 2 && i === 0 && t.length <= 40 && next) { add(t, next, l.page); i++; }
    }
  }
  return out;
}

export interface Blank { page: number; label: string; kind: "text" | "check"; x: number; y: number; w: number; h: number }

/** Where someone would write on a printed form: runs of underscores, and empty tick boxes. */
export function blanks(lines: Line[]): Blank[] {
  const out: Blank[] = [];
  lines.forEach((l, li) => l.segs.forEach((seg, si) => {
    for (const p of seg.parts) {
      const at = (i: number) => p.x + (p.w * i) / Math.max(1, p.text.length);
      let prev = 0;
      for (const m of p.text.matchAll(/_{3,}/g)) {
        const earlier = seg.parts.slice(0, seg.parts.indexOf(p)).map(q => q.text).join(" ").split(/_{3,}/).at(-1);
        const label = [p.text.slice(prev, m.index), prev ? "" : earlier, l.segs[si - 1]?.text, lines[li - 1]?.segs.at(-1)?.text]
          .map(s => (s ?? "").replace(/[:*\s]+$/, "").trim()).find(Boolean) ?? "Field";
        // Underscores are about half an em wide in most fonts; anchor on the item's start or end when the run touches it.
        const uw = p.size * 0.556, n = m[0].length, end = m.index + n === p.text.trimEnd().length;
        const x = m.index === 0 ? p.x : end ? p.x + p.w - n * uw : at(m.index);
        out.push({ page: l.page, label, kind: "text", x, y: p.y - 3, w: m.index === 0 || end ? n * uw : at(m.index + n) - at(m.index), h: p.size + 5 });
        prev = m.index + m[0].length;
      }
      for (const m of p.text.matchAll(/[☐□❑▢]|\[\s?\]/g)) {
        const after = p.text.slice(m.index + m[0].length).split(/[☐□❑▢]|\[\s?\]/)[0].trim();
        out.push({ page: l.page, label: after || "Tick box", kind: "check", x: at(m.index), y: p.y - 1, w: p.size, h: p.size });
      }
    }
  }));
  return out;
}

// ---- XFA "smart forms" (Adobe LiveCycle). pdf.js lays them out as an HTML-like tree, values included.
interface XNode { name: string; attributes?: Record<string, any>; children?: XNode[]; value?: string }
export interface XfaField {
  path: string[]; // subforms from the root, e.g. ["form1", "BG", "applicantAndBeneficiary", "subApplicantInfo"]
  name: string; ui: "text" | "long" | "check" | "radio" | "select"; caption: string; options: string[]; value: string | boolean;
  required: boolean; // mandatory in the form (its "required" setting, or a * in the question)
}
export interface Xfa { fields: XfaField[]; titles: Record<string, string> }

/** Reads an XFA form's fields (with any answers), or undefined if the PDF is not XFA. Handles owner-password encryption. */
export async function readXfa(bytes: Uint8Array): Promise<Xfa | undefined> {
  const doc = await getDocument({ data: bytes.slice(), enableXfa: true, isEvalSupported: false }).promise;
  try {
    return doc.isPureXfa && doc.allXfaHtml ? xfaFields(doc.allXfaHtml as unknown as XNode) : undefined;
  } finally { await doc.destroy(); }
}

const cls = (n: XNode): string[] => n.attributes?.class ?? [];
const words = (n: XNode): string => [n.value ?? "", ...(n.children ?? []).map(words)].join(" ").replace(/\s+/g, " ").trim();
const find = (n: XNode, ok: (m: XNode) => boolean): XNode | undefined => ok(n) ? n : (n.children ?? []).reduce<XNode | undefined>((f, k) => f ?? find(k, ok), undefined);
const isCaption = (m: XNode) => cls(m).includes("xfaCaption") || cls(m).includes("xfaCaptionForCheckButton");
const isUi = (m: XNode) => ["input", "textarea", "select", "button"].includes(m.name);

export function xfaFields(root: XNode): Xfa {
  const fields: XfaField[] = [], titles: Record<string, string> = {};
  const walk = (n: XNode, path: string[]) => {
    const c = cls(n), name: string | undefined = n.attributes?.xfaName;
    if (c.includes("xfaExclgroup")) {
      const opts: { caption: string; on: boolean }[] = [];
      let required = false;
      const each = (m: XNode) => {
        if (!cls(m).includes("xfaField")) return (m.children ?? []).forEach(each);
        const input = find(m, isUi), cap = find(m, isCaption);
        if (input?.attributes?.required || input?.attributes?.["aria-required"] === true) required = true;
        if (input?.name === "input") opts.push({ caption: (cap && words(cap)) || input.attributes?.xfaOn || "", on: !!input.attributes?.checked });
      };
      each(n);
      fields.push({ path, name: name ?? "choice", ui: "radio", caption: "", options: opts.map(o => o.caption), value: opts.find(o => o.on)?.caption ?? "", required });
      return;
    }
    if (c.includes("xfaField")) {
      const ui = find(n, isUi), cap = find(n, isCaption), caption = cap ? words(cap) : "";
      if (!ui || !name) return;
      const a = ui.attributes ?? {};
      const required = !!a.required || a["aria-required"] === true || /\*\s*$/.test(caption);
      // Read-only with text in it = a printed label (e.g. a table heading). Read-only and empty = unlocked by the form's script later.
      if ((c.includes("xfaReadOnly") || cls(ui).includes("xfaReadOnly")) && (a.value || a.textContent)) return;
      if (ui.name === "button") { const m = /\(([A-Z]+)\)\s*$/.exec(caption); if (m) titles[m[1]] = caption; return; }
      if (ui.name === "textarea") fields.push({ path, name, ui: "long", caption, options: [], value: a.textContent ?? "", required });
      else if (ui.name === "select") {
        const opts = (ui.children ?? []).filter(o => !o.attributes?.hidden);
        fields.push({ path, name, ui: "select", caption, options: opts.map(o => (o.value ?? "").trim()).filter(Boolean),
          value: (opts.find(o => o.attributes?.selected)?.value ?? "").trim(), required });
      } else if (a.type === "checkbox") fields.push({ path, name, ui: "check", caption, options: [], value: !!a.checked, required });
      else if (a.type === "text") fields.push({ path, name, ui: "text", caption, options: [], value: a.value ?? "", required });
      return;
    }
    const next = c.includes("xfaSubform") && name ? [...path, name] : path;
    (n.children ?? []).forEach(k => walk(k, next));
  };
  walk(root, []);
  return { fields, titles };
}

/** "txtApplicantName" -> "Applicant name", "subApplicantInfo" -> "Applicant info". */
export const humanize = (s: string) => {
  const w = s.replace(/^(txt|drp|chk|rad|subfrm|sub|btn|ddl|cbo|num|dt|frm)(?=[A-Z0-9])/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .split(/[\s_]+/).filter(Boolean).map((x, i) => /^[A-Z0-9]{2,}$/.test(x) ? x : i ? x.toLowerCase() : x[0].toUpperCase() + x.slice(1).toLowerCase());
  return w.join(" ") || s;
};

/** An XFA field's section, its own question, and the group it sits in (used to tell repeats apart). */
export function xfaLabel(f: XfaField): { section: string; own: string; group: string } {
  const raw = f.caption && f.caption.length <= 80 ? f.caption : humanize(f.name);
  let own = raw.replace(/[\s:*]+$/, ""); // the * becomes the field's `required` flag
  if (/^radio button list$/i.test(own)) own = humanize(f.path.at(-1) ?? f.name); // a generic name: use its subform's
  return { section: humanize(f.path[2] ?? f.path[1] ?? "Form"), own: own || humanize(f.name), group: humanize(f.path[3] ?? "") };
}

/** The forms inside an XFA bundle (top-level subforms with questions), with their titles. */
export function xfaForms(x: Xfa): { code: string; title: string; count: number; answered: number }[] {
  const by = new Map<string, XfaField[]>();
  for (const f of x.fields) if (f.path[1]) by.set(f.path[1], [...by.get(f.path[1]) ?? [], f]);
  return [...by].map(([code, fs]) => ({
    code, title: x.titles[code] ?? humanize(code), count: fs.length,
    answered: fs.filter(f => f.value !== "" && f.value !== false).length,
  }));
}

/** One form of an XFA bundle as a template (keys from the questions), plus its current answers. */
export function xfaTemplate(x: Xfa, code: string): { template: Template; values: Values; keys: Map<XfaField, string> } {
  const sections = new Map<string, Field[]>(), values: Values = {}, keys = new Map<XfaField, string>(), used = new Set<string>();
  const mine = x.fields.filter(f => f.path[1] === code), seen = new Map<string, number>();
  for (const f of mine) { const o = xfaLabel(f).own.toLowerCase(); seen.set(o, (seen.get(o) ?? 0) + 1); }
  for (let f of mine) {
    const { section, own, group } = xfaLabel(f);
    // Repeated questions ("Tel no" for applicant and beneficiary) get their group in front.
    const label = seen.get(own.toLowerCase())! > 1 && group ? `${group}: ${own}` : f.ui === "check" && f.caption ? f.caption.replace(/[\s*]+$/, "") : own;
    let id = slug(label).slice(0, 40), n = 2;
    while (used.has(id)) id = `${slug(label).slice(0, 40)}_${n++}`;
    used.add(id); keys.set(f, id);
    // Drop-downs the form fills by script at run time have no options in the file: use the standard
    // currency / country lists, or a text box for anything else.
    const list = f.options.length > 1 || f.ui === "check" || f.ui === "radio" ? undefined
      : /curr|ccy/i.test(f.name) ? CURRENCIES : /countr/i.test(f.name) ? COUNTRIES : undefined;
    const kind = list ? "select" : f.ui === "text" && /date/i.test(f.name) ? "date" : f.ui === "select" && !f.options.length ? "text" : f.ui;
    if (list) f = { ...f, options: list };
    sections.set(section, [...sections.get(section) ?? [], {
      id, label, kind, ...(kind === "radio" || kind === "select" ? { options: f.options } : {}),
      ...(kind === "text" || kind === "date" || kind === "select" ? { half: true } : {}),
      ...(f.required ? { required: true } : {}),
    }]);
    values[id] = f.value;
  }
  return {
    template: { title: x.titles[code] ?? humanize(code), note: "", sections: [...sections].map(([title, fields]) => ({ title, fields })) },
    values, keys,
  };
}
