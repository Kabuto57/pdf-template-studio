// RED FRAMES AND GREY SHADING THAT NEED NO JAVASCRIPT
// Many work laptops have Acrobat JavaScript switched off, so the form can't run scripts there. This uses a PDF
// feature instead: a tick box (or radio option) can have extra copies of itself, and ticking it switches every
// copy on at once.
//   Red frames: each trigger gets copies placed as four thin strips around every question its rule makes
//               mandatory, drawn red when on. Tick "Bill of lading" and its questions are framed in red.
//   Grey shade: copies under the questions that only apply once something is ticked, grey until it is.
// The copies sit underneath the real boxes, so typing and clicking still go to those.
import { AcroButtonFlags, PDFCheckBox, PDFDict, PDFDocument, PDFFont, PDFName, PDFPage, PDFRadioGroup, PDFString } from "pdf-lib";
import { activeRules } from "./rules";
import { dateIds } from "./dates";
import { safe, subId, type Field, type Rule, type Template, type Values } from "./types";

/** Where the new design drew each question: its label, and (for options) one box around all of them. */
export type Blocks = Map<string, { page: PDFPage; label: { x: number; y: number; text: string }; box?: [number, number, number, number] }>;

type Form = ReturnType<PDFDocument["getForm"]>;

export function addRedFrames(doc: PDFDocument, form: Form, t: Template, values: Values,
  look?: { blocks: Blocks; font: PDFFont }) { // new design: frame a question's options as one, and underline its label
  const ctx = doc.context, pages = doc.getPages();
  const GAP = 0.6, THICK = 1.6; // the strips sit 0.6 pt outside the box, 1.6 pt thick

  // What a copy looks like in viewers that use pictures (Chrome, Edge, Preview): nothing, red, or grey.
  const picture = (drawing: string, w: number, h: number) =>
    ctx.register(ctx.stream(drawing, { Type: "XObject", Subtype: "Form", BBox: [0, 0, w, h] }));
  const nothing = (w: number, h: number) => picture("", w, h);
  const red = (w: number, h: number) => picture(`0.85 0 0 rg 0 0 ${w} ${h} re f`, w, h);
  const grey = (w: number, h: number) => picture(`0.86 g 0 0 ${w} ${h} re f`, w, h);

  /** The tick box or radio option a rule points at: its "on" state, and whether it is on now. (Lists need JavaScript.) */
  const triggerOf = (rule: Rule) => {
    if (rule.not) return undefined;
    const trigger = form.getFieldMaybe(rule.field);
    let state: PDFName | undefined;
    if (trigger instanceof PDFCheckBox) {
      if (rule.values.includes("true")) state = trigger.acroField.getOnValue();
    } else if (trigger instanceof PDFRadioGroup) {
      const i = trigger.getOptions().indexOf(safe(rule.values[0]));
      state = i < 0 ? undefined : trigger.acroField.getOnValues()[i];
      trigger.acroField.setFlagTo(AcroButtonFlags.RadiosInUnison, true); // copies of the same option switch together
    }
    if (!state) return undefined;
    const isOn = trigger instanceof PDFCheckBox ? values[rule.field] === true : values[rule.field] === rule.values[0];
    return { owner: trigger as PDFCheckBox | PDFRadioGroup, state, isOn };
  };
  type Trigger = NonNullable<ReturnType<typeof triggerOf>>;

  /**
   * Adds one copy of the trigger at [x, y, width, height].
   * Acrobat (JavaScript off) ignores a tick box's pictures and draws its tick symbol (MK CA) in the colour and size
   * of its DA, over its background colour (MK BG), which it paints whether ticked or not. So:
   *   red:   no background; the symbol is a red square (ZapfDingbats "n") far bigger than the strip, so cut to
   *          the strip it fills it red.
   *   shade: a light grey background, and a white square when on: grey until the trigger is ticked.
   */
  const copy = (tr: Trigger, page: PDFPage, [x, y, w, h]: number[], kind: "red" | "shade" = "red") => {
    const big = Math.ceil(2 * Math.max(w, h) + 10), shade = kind === "shade";
    const on = tr.state.decodeText();
    const widget = ctx.register(ctx.obj({
      Type: "Annot", Subtype: "Widget",
      F: 64,                                  // read-only: clicks on it do nothing
      Rect: [x, y, x + w, y + h], P: page.ref, Parent: tr.owner.ref,
      AS: tr.isOn ? tr.state : PDFName.of("Off"),
      MK: shade ? { BG: [0.86], CA: PDFString.of("n") } : { CA: PDFString.of("n") },
      DA: PDFString.of(`/ZaDb ${big} Tf ${shade ? "1 g" : "0.85 0 0 rg"}`), BS: { W: 0 },
      // The same, as pictures, for every other viewer.
      AP: { N: shade ? { [on]: nothing(w, h), Off: grey(w, h) } : { [on]: red(w, h), Off: nothing(w, h) } },
    }));
    tr.owner.acroField.addWidget(widget);
    page.node.Annots()!.insert(0, widget); // underneath the real boxes, so typing and clicking still go to those
  };

  const all = t.sections.flatMap(s => s.fields);

  // Radio buttons of switchable questions are made see-through (pdf-lib paints them white), so the grey shade shows.
  // Done before any copies exist.
  for (const f of all) {
    const group = activeRules(f).length ? form.getFieldMaybe(f.id) : undefined;
    if (!(group instanceof PDFRadioGroup)) continue;
    for (const w of group.acroField.getWidgets()) w.dict.lookupMaybe(PDFName.of("MK"), PDFDict)?.delete(PDFName.of("BG"));
    group.updateAppearances();
  }

  // Each question's own boxes, noted before any copies are added (a trigger's copies are widgets of it too).
  const fieldNames = (f: Field) =>
    f.kind === "checks" ? (f.options ?? []).map((_, i) => subId(f.id, i)) :
    f.kind === "date" ? dateIds(f.id) :
    [f.id];
  const own = new Map(all.map(f => [f.id, fieldNames(f)
    .flatMap(name => form.getFieldMaybe(name)?.acroField.getWidgets() ?? [])
    .map(w => ({ w, page: pages.find(p => p.ref === w.P()) ?? pages[0], ...w.getRectangle() }))]));
  const boxes = (f: Field) => own.get(f.id) ?? [];

  // RED FRAMES: around every question a tick box or radio option makes mandatory.
  for (const f of all) for (const rule of f.requiredIf ?? []) {
    const tr = triggerOf(rule);
    if (!tr) continue; // lists and "not" rules need JavaScript; there the field still turns red
    // Four thin strips just outside the box, never over it, so clicks inside still reach the box.
    const frame = (page: PDFPage, x: number, y: number, w: number, h: number) => {
      const out = GAP + THICK;
      const top = [x - out, y + h + GAP, w + 2 * out, THICK];
      const bottom = [x - out, y - out, w + 2 * out, THICK];
      const left = [x - out, y - GAP, THICK, h + 2 * GAP];
      const right = [x + w + GAP, y - GAP, THICK, h + 2 * GAP];
      for (const strip of [top, bottom, left, right]) copy(tr, page, strip);
    };
    const block = look?.blocks.get(f.id);
    if (block?.box) frame(block.page, ...block.box);
    else for (const b of boxes(f)) frame(b.page, b.x, b.y, b.width, b.height);
    if (block && look) { // a red line under the question's label
      const { x, y, text } = block.label;
      copy(tr, block.page, [x, y - 3.5, look.font.widthOfTextAtSize(text, 8), THICK]);
    }
  }

  // GREY SHADE: under questions that only apply once something is ticked.
  // ponytail: with several switching rules, any one off shows grey; exact "any of" needs JavaScript (which also locks them).
  for (const f of all) for (const rule of activeRules(f)) {
    const tr = triggerOf(rule);
    if (tr) for (const b of boxes(f)) copy(tr, b.page, [b.x - 0.5, b.y - 0.5, b.width + 1, b.height + 1], "shade");
  }
}
