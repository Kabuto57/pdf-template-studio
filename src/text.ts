// Reading PDFs that have no form fields: their text, the "Label: value" pairs in it, and the blanks
// (____ or ☐) a person would write in.
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

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
