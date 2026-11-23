// A PDF OF THE CANVAS: the smart-form layout (layout.ts) written with pdf-lib, so what you download is what the
// canvas shows: the same pages and the same fillable boxes, with the answers. It has no Acrobat scripts (no red
// boxes that follow the answers, no Check form, no QR code): `python build.py <form file>` in lc-form makes the
// full form. Dates are one DD/MM/YYYY box here (lc-form adds a list of dates under Acrobat's calendar).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { finishForm, tip } from "../form/look";
import { stamp } from "../form/stored-template";
import type { Template, Values } from "../pdf";
import { H, W, layout, safe, type RGB, type Widget } from "./layout";

const c = (x: RGB) => rgb(x[0], x[1], x[2]);

export async function writePdf(t: Template, values: Values = {}): Promise<Uint8Array> {
  const laid = layout(t, values);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.setTitle(safe(t.title));
  doc.setCreator("PDF Template Studio");
  stamp(doc, t); // the form travels inside its PDF, for Extract and the workbench

  const pages = laid.pages.map(shapes => {
    const page = doc.addPage([W, H]);
    for (const s of shapes) {
      if (s.t === "text") page.drawText(s.s, { x: s.x, y: s.y, size: s.size, font: s.bold ? bold : font, color: c(s.color) });
      else if (s.t === "line") page.drawLine({ start: { x: s.x1, y: s.y1 }, end: { x: s.x2, y: s.y2 }, thickness: s.w, color: c(s.color) });
      else page.drawRectangle({ x: s.x, y: s.y, width: s.w, height: s.h, color: s.fill && c(s.fill), borderColor: s.border && c(s.border), borderWidth: s.border ? s.bw : 0, borderDashArray: s.dash ? [2, 2] : undefined });
    }
    return page;
  });

  const form = doc.getForm();
  const box = (w: Widget, f: PDFFont = font) => {
    const b = w.border ? w.bw ?? 0 : 0, [x1, y1, x2, y2] = w.rect;
    return { x: x1 + b / 2, y: y1 + b / 2, width: x2 - x1 - b, height: y2 - y1 - b, font: f, borderWidth: b,
      borderColor: w.border ? c(w.border) : undefined, backgroundColor: w.bg ? c(w.bg) : undefined };
  };
  const on = (w: Widget): PDFPage => pages[w.page];
  for (const f of laid.fields) {
    if (f.name.endsWith("__list")) continue; // the date list: one date box instead
    const w = f.widgets[0];
    if (f.type === "text") {
      const field = form.createTextField(f.name);
      if (f.multiline) field.enableMultiline();
      if (f.max) field.setMaxLength(f.max);
      if (typeof f.value === "string" && f.value) field.setText(f.value);
      field.addToPage(on(w), box({ ...w, hidden: false }));
      field.setFontSize(f.size ?? 8.5);
      if (f.required) field.enableRequired();
      if (f.readOnly) field.enableReadOnly();
      tip(field, f.tooltip ?? f.name);
    } else if (f.type === "choice") {
      const field = form.createDropdown(f.name);
      field.addOptions(f.options ?? []);
      if (typeof f.value === "string" && f.value) field.select(f.value);
      field.addToPage(on(w), box(w));
      field.setFontSize(f.size ?? 8.5);
      if (f.required) field.enableRequired();
      tip(field, f.tooltip ?? f.name);
    } else if (f.type === "check") {
      const field = form.createCheckBox(f.name);
      field.addToPage(on(w), box(w));
      if (f.value === true) field.check();
      if (f.required) field.enableRequired();
      tip(field, f.tooltip ?? f.name);
    } else if (f.type === "radio") {
      const field = form.createRadioGroup(f.name);
      for (const x of f.widgets) field.addOptionToPage(f.options![+x.state!], on(x), box(x));
      if (typeof f.value === "number") field.select(f.options![f.value]);
      if (f.required) field.enableRequired();
      tip(field, f.tooltip ?? f.name);
    }
  }
  finishForm(doc, font);
  return doc.save();
}
