// DRAWING A LAID-OUT FORM AS SVG: one <svg> per page, in PDF points, looking like the PDF lc-form builds
// (the same shapes, plus each field's box as pdf_writer.py draws it). Text is Helvetica/Arial, which share widths.
import { H, W, headerButtons, type Laid, type RGB, type Widget } from "./layout";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const col = (c: RGB) => `rgb(${c.map(v => Math.round(v * 255)).join(",")})`;
const n = (v: number) => +v.toFixed(2);
const Y = (y: number) => n(H - y);

function widget(w: Widget, type: string, value: unknown, on: boolean, multiline?: boolean, size = 8.5): string {
  if (w.hidden) return "";
  const [x1, y1, x2, y2] = w.rect, bw = w.border ? w.bw ?? 0 : 0;
  const x = x1 + bw / 2, y = y1 + bw / 2, ww = x2 - x1 - bw, hh = y2 - y1 - bw;
  const stroke = w.border ? ` stroke="${col(w.border)}" stroke-width="${bw}"` : "";
  const fill = w.bg ? col(w.bg) : "none";
  if (type === "radio") {
    const r = ww / 2 - bw / 2;
    return `<circle cx="${n(x + ww / 2)}" cy="${Y(y + hh / 2)}" r="${n(r)}" fill="${fill}"${stroke}/>` +
      (on ? `<circle cx="${n(x + ww / 2)}" cy="${Y(y + hh / 2)}" r="${n(ww * 0.21)}"/>` : "");
  }
  let s = `<rect x="${n(x)}" y="${Y(y + hh)}" width="${n(ww)}" height="${n(hh)}" fill="${fill}"${stroke}/>`;
  if (type === "check" && on) s += `<path d="M${n(x + ww * 0.2)} ${Y(y + hh * 0.5)}l${n(ww * 0.22)} ${n(hh * 0.25)} ${n(ww * 0.38)} ${n(-hh * 0.55)}" fill="none" stroke="#000" stroke-width="1.2"/>`;
  if (w.caption) s = `<rect x="${n(x)}" y="${Y(y + hh)}" width="${n(ww)}" height="${n(hh)}" fill="#000"/><text x="${n(x + ww / 2)}" y="${Y(y + (hh - 8 * 0.72) / 2)}" font-size="8" fill="#fff" text-anchor="middle">${esc(w.caption)}</text>`;
  if (typeof value === "string" && value && (type === "text" || type === "choice")) {
    const lines = multiline ? value.split("\n") : [value];
    s += lines.map((l, i) => `<text x="${n(x + 2)}" y="${Y(multiline ? y + hh - 2 - size - i * size * 1.2 : y + (hh - size * 0.72) / 2)}" font-size="${n(size)}">${esc(l)}</text>`).join("");
  }
  return s;
}

/** The pages as SVG elements (strings), widths in points; the caller scales them with CSS. `boxes: false` leaves out the
 *  answer boxes and buttons (the fill page puts live ones on top). */
export function pagesSvg(laid: Laid, boxes = true): string[] {
  const buttons = boxes ? headerButtons(laid.pages.length) : [];
  return laid.pages.map((shapes, p) => {
    let body = "";
    for (const s of shapes) {
      if (s.t === "text") body += `<text x="${n(s.x)}" y="${Y(s.y)}" font-size="${n(s.size)}"${s.bold ? ' font-weight="bold"' : ""}${s.color.some(Boolean) ? ` fill="${col(s.color)}"` : ""} xml:space="preserve">${esc(s.s)}</text>`;
      else if (s.t === "line") body += `<line x1="${n(s.x1)}" y1="${Y(s.y1)}" x2="${n(s.x2)}" y2="${Y(s.y2)}" stroke="${col(s.color)}" stroke-width="${s.w}"/>`;
      else body += `<rect x="${n(s.x)}" y="${Y(s.y + s.h)}" width="${n(s.w)}" height="${n(s.h)}" fill="${s.fill ? col(s.fill) : "none"}"${s.border ? ` stroke="${col(s.border)}" stroke-width="${s.bw}"` : ""}${s.dash ? ' stroke-dasharray="2 2"' : ""}/>`;
    }
    for (const f of boxes ? laid.fields : [])
      for (const w of f.widgets) {
        if (w.page !== p) continue;
        const on = f.type === "radio" ? String(f.value) === w.state : f.value === true;
        body += widget(w, f.type, f.type === "choice" && f.name.endsWith("__list") && !f.value ? "Pick a date" : f.value, on, f.multiline, f.size);
      }
    for (const b of buttons.filter(b => b.page === p)) body += widget({ page: p, rect: [b.x, b.y, b.x + b.w, b.y + b.h], caption: b.caption }, "button", "", false);
    return `<svg class="cv-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" role="img" aria-label="Page ${p + 1}">${body}</svg>`;
  });
}
