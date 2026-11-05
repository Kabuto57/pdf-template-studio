// READING A FILLED PDF BACK
// Opens the PDF, reads every field's value by its name, and reads the form description stored inside the PDF
// (stored-template.ts). Together that gives every answer with its question, section and mandatory flag.
// Exact: it reads what was typed into the fields, not an image of the page.
import { PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFName, PDFNumber, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";
import { dateIds, joinDate } from "./dates";
import { isRequired } from "./rules";
import { stamped, text } from "./stored-template";
import { subId, type Extracted, type Field, type Row, type Template, type Value, type Values } from "./types";

/** Reads every answer from a filled PDF form, with the question it belongs to. */
export async function extractPdf(bytes: Uint8Array | ArrayBuffer): Promise<Extracted> {
  return extractFields(await PDFDocument.load(bytes, { ignoreEncryption: true }));
}

export async function extractFields(doc: PDFDocument): Promise<Extracted> {
  // 1. Every field's value, by field name.
  const raw = new Map<string, Value>();      // field name -> value
  const tips = new Map<string, string>();    // field name -> tooltip (used as the label for PDFs made elsewhere)
  const shown = new Set<string>();           // fields that aren't hidden
  for (const f of doc.getForm().getFields()) {
    const name = f.getName();
    if (f instanceof PDFButton || name.startsWith("__")) continue; // the built-in checks, not answers
    const value: Value =
      f instanceof PDFTextField ? f.getText() ?? "" :
      f instanceof PDFRadioGroup ? f.getSelected() ?? "" :
      f instanceof PDFCheckBox ? f.isChecked() :
      f instanceof PDFDropdown || f instanceof PDFOptionList ? f.getSelected().join(", ").trim() :
      "";
    raw.set(name, value);
    const flags = (f.acroField.getWidgets()[0]?.dict.lookup(PDFName.of("F")) as PDFNumber | undefined)?.asNumber() ?? 0;
    if (!(flags & 2)) shown.add(name); // 2 = hidden
    tips.set(name, text(f.acroField.dict.lookup(PDFName.of("TU"))) ?? name);
  }

  // 2. The form description stored inside the PDF, if it is one of ours.
  let template: Template | undefined;
  try { const json = stamped(doc); if (json) template = JSON.parse(json); } catch { /* not one of ours */ }

  // 3. One row per question.
  const rows: Row[] = [], data: Values = {};
  // Our form, but with no fields left: it was printed or "Saved as PDF". Nothing to read (the caller says why).
  if (template && !raw.size) return { template, rows, data };
  if (template) {
    for (const s of template.sections) for (const f of s.fields) {
      rows.push({ section: s.title, id: f.id, label: f.label, value: answerOf(f, raw, shown) });
      data[f.id] = rows[rows.length - 1].value;
    }
    // Mandatory or not depends on other answers, so judge once all are read.
    const fields = template.sections.flatMap(s => s.fields);
    rows.forEach((r, i) => { if (isRequired(fields[i], data)) r.required = true; });
  } else {
    // A form made elsewhere: each field's tooltip is its label.
    for (const [id, value] of raw) { rows.push({ section: "", id, label: tips.get(id)!, value }); data[id] = value; }
  }
  return { template, rows, data };
}

/** One question's answer from the raw field values. */
function answerOf(f: Field, raw: Map<string, Value>, shown: Set<string>): Value {
  // "Tick any": the options whose tick box is ticked.
  if (f.kind === "checks") return (f.options ?? []).filter((_, i) => raw.get(subId(f.id, i)) === true);
  // A date: from the drop-down list (or the older three lists), unless Acrobat showed the calendar box instead.
  const calendarShown = raw.has(f.id) && shown.has(f.id);
  if (f.kind === "date" && !calendarShown && (raw.has(dateIds(f.id)[0]) || raw.has(`${f.id}__dd`))) {
    const names = raw.has(dateIds(f.id)[0]) ? dateIds(f.id) : ["dd", "mm", "yyyy"].map(p => `${f.id}__${p}`);
    return joinDate(names.map(n => String(raw.get(n) ?? "")));
  }
  // Anything else: the field's own value.
  return raw.get(f.id) ?? (f.kind === "check" ? false : "");
}
