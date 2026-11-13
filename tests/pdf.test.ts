import { describe, expect, it } from "vitest";
import { PDFArray, PDFButton, PDFCheckBox, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRadioGroup, PDFRawStream, PDFDropdown, PDFTextField, decodePDFRawStream } from "pdf-lib";
import { readFileSync } from "fs";
import { generateQr, payloadScript, printForm, qrScript } from "../src/form/acrobat-script";
import { buildPdf, extractPdf, isRequired, type Field } from "../src/pdf";
import { GUARANTEE, SAMPLE } from "../src/sample";
import { LC } from "../src/lc";
import { activeRules } from "../src/form/rules";

describe("pdf form", () => {
  it("round-trips every answer through a filled PDF", async () => {
    const { data, rows, template } = await extractPdf(await buildPdf(GUARANTEE, SAMPLE));
    expect(template?.title).toBe(GUARANTEE.title);
    expect(data).toEqual(SAMPLE);
    expect(rows.find(r => r.id === "applicant_tel")).toMatchObject({ section: "Applicant", label: "Tel no", value: "+65 6123 4567" });
  });

  it("marks required questions as required PDF fields", async () => {
    const t = { title: "T", note: "", sections: [{ title: "S", fields: [{ id: "name", label: "Name", kind: "text" as const, required: true }, { id: "fax", label: "Fax", kind: "text" as const }] }] };
    const doc = await PDFDocument.load(await buildPdf(t));
    expect(doc.getForm().getTextField("name").isRequired()).toBe(true);
    expect(doc.getForm().getTextField("fax").isRequired()).toBe(false);
  });

  it("extracts empty answers from a blank form", async () => {
    const { data } = await extractPdf(await buildPdf(GUARANTEE));
    expect(data.applicant_name).toBe("");
    expect(data.agree).toBe(false);
    expect(data.attachments).toEqual([]);
  });

  it("reads a form filled by another app, without the embedded template", async () => {
    const doc = await PDFDocument.load(await buildPdf(GUARANTEE));
    doc.getForm().getTextField("applicant_tel").setText("999");
    doc.catalog.delete((await import("pdf-lib")).PDFName.of("FormTemplate"));
    const { rows } = await extractPdf(await doc.save());
    expect(rows.find(r => r.id === "applicant_tel")).toMatchObject({ label: "Tel no", value: "999" });
  });
});

describe("conditional mandatory questions", () => {
  const t = { title: "T", note: "", sections: [{ title: "S", fields: [
    { id: "drafts", label: "Drafts", kind: "radio" as const, options: ["Sight", "Term"] },
    { id: "term", label: "Term", kind: "text" as const, requiredIf: [{ field: "drafts", values: ["Term"] }] },
    { id: "tol", label: "Tolerance", kind: "check" as const },
    { id: "plus", label: "Plus", kind: "text" as const, requiredIf: [{ field: "tol", values: ["true"] }] },
  ] }] };

  it("is mandatory only when its option is picked", () => {
    const [, term, , plus] = t.sections[0].fields;
    expect(isRequired(term, { drafts: "Sight" })).toBe(false);
    expect(isRequired(term, { drafts: "Term" })).toBe(true);
    expect(isRequired(plus, { tol: false })).toBe(false);
    expect(isRequired(plus, { tol: true })).toBe(true);
  });

  it("extract flags the blank conditional answer", async () => {
    const { rows } = await extractPdf(await buildPdf(t, { drafts: "Term", tol: false }));
    expect(rows.find(r => r.id === "term")?.required).toBe(true);
    expect(rows.find(r => r.id === "plus")?.required).toBeFalsy();
  });

  it("the bank LC: picking Term, or ticking a document row, makes that row's boxes mandatory", async () => {
    const lc = (await import("../src/bank-forms.json")).default.find(f => f.code === "LC")!;
    const q = (id: string) => lc.template.sections.flatMap(s => s.fields).find(f => f.id === id) as Field;
    expect(isRequired(q("term_days"), { drafts_at: "Term" })).toBe(true);
    expect(isRequired(q("term_days"), { drafts_at: "Sight" })).toBe(false);
    expect(isRequired(q("invoice_originals"), { doc_commercial_invoice: true })).toBe(true);
    expect(isRequired(q("invoice_copies"), { doc_commercial_invoice: false })).toBe(false);
    expect(lc.template.sections.find(s => s.title === "Documents Required")?.fields.length).toBe(36);
  });
});

// The rules engine: the document-level script (a stream in the /Names /JavaScript tree).
// A stand-in for one Acrobat field: null when the PDF has no such field, as in Acrobat.
type Fake = { value: string; valueAsString: string; required?: boolean; strokeColor?: unknown; fillColor?: unknown; display?: number } | null;
const like = (doc: PDFDocument, n: string, v?: string): Fake => {
  const f = doc.getForm().getFieldMaybe(n);
  if (!f) return null;
  const value = v ?? (f instanceof PDFTextField ? "" : f instanceof PDFDropdown ? f.getSelected()[0] ?? "" : "Off");
  const hidden = ((f.acroField.getWidgets()[0]?.dict.lookup(PDFName.of("F")) as PDFNumber | undefined)?.asNumber() ?? 0) & 2;
  return { value, valueAsString: value, display: hidden ? 1 : 0 };
};
const library = (doc: PDFDocument) => {
  const names = ((doc.catalog.lookup(PDFName.of("Names")) as PDFDict).lookup(PDFName.of("JavaScript")) as PDFDict).lookup(PDFName.of("Names")) as PDFArray;
  const stream = (names.lookup(1) as PDFDict).lookup(PDFName.of("JS")) as PDFRawStream;
  return String.fromCharCode(...decodePDFRawStream(stream).decode());
};

describe("checks built into the PDF (Acrobat / Reader)", () => {
  // Runs the PDF's own recalculation script against a stand-in for Acrobat's document object.
  async function acrobat(values: Record<string, string>) {
    const { LC } = await import("../src/lc");
    const doc = await PDFDocument.load(await buildPdf(LC.template));
    const fields: Record<string, Fake> = {};
    const acro = { getField: (n: string) => n in fields ? fields[n] : (fields[n] = like(doc, n, values[n])) };
    const missing = new Function("color", "console", `${library(doc)}; return lcRules(this);`).call(acro, { red: "red", black: "black", white: "white", transparent: "none" }, { println() {} });
    return { fields, missing: missing as string[] };
  }

  it("a ticked document row turns its boxes red and required, as in the app", async () => {
    const off = await acrobat({});
    expect(off.fields.invoice_originals?.required).toBe(false);
    const on = await acrobat({ doc_commercial_invoice: "Yes" });
    expect(on.fields.invoice_originals).toMatchObject({ required: true, strokeColor: "red" });
    expect(on.missing).toContain("Commercial invoice: originals");
    const filled = await acrobat({ doc_commercial_invoice: "Yes", invoice_originals: "3" });
    expect(filled.fields.invoice_originals).toMatchObject({ required: false, strokeColor: "black" }); // no Acrobat red outline once answered
  }, 20000); // builds the LC twice: slow on a busy machine

  it("ticking a box re-checks straight away (mouse-up action on the tick box)", async () => {
    const { LC } = await import("../src/lc");
    const doc = await PDFDocument.load(await buildPdf(LC.template));
    const w = doc.getForm().getCheckBox("doc_commercial_invoice").acroField.getWidgets()[0].dict;
    const up = ((w.lookup(PDFName.of("AA")) as PDFDict).lookup(PDFName.of("U")) as PDFDict).lookup(PDFName.of("JS")) as PDFHexString;
    expect(up.decodeText()).toBe("lcRules(this);");
  });

  it("picking Term makes the term boxes mandatory", async () => {
    const { missing } = await acrobat({ drafts: "Yes", drafts_at: "Term" });
    expect(missing).toEqual(expect.arrayContaining(["Term: days", "days after", "If it is a term LC, please select one"]));
  });
});

it("the Check form button and the save / print warnings are valid scripts", async () => {
  const { LC } = await import("../src/lc");
  const doc = await PDFDocument.load(await buildPdf(LC.template));
  const js = (a: PDFDict) => ((a.lookup(PDFName.of("JS")) as PDFHexString).decodeText());
  const btn = doc.getForm().getButton("__check_form").acroField.getWidgets()[0].dict.lookup(PDFName.of("A")) as PDFDict;
  const aa = doc.catalog.lookup(PDFName.of("AA")) as PDFDict;
  for (const a of [btn, aa.lookup(PDFName.of("WS")) as PDFDict, aa.lookup(PDFName.of("WP")) as PDFDict]) expect(() => new Function("app", js(a))).not.toThrow();
  const alerts: string[] = [];
  new Function("app", `var lcRules = function () { return ["Amount"]; }; ${js(btn)}`)({ alert: (m: string) => alerts.push(m) });
  expect(alerts[0]).toContain("1 mandatory question is still blank");
  // ... and puts the cursor on the first problem.
  const focused: string[] = [];
  new Function("app", `var lcRules = function () { var m = ["Amount"]; m.first = "amount"; return m; }; ${js(btn)}`)
    .call({ getField: (n: string) => ({ setFocus: () => focused.push(n) }) }, { alert() {} });
  expect(focused).toEqual(["amount"]);
});

describe("the JavaScript version", async () => {
  const bytes = await buildPdf(LC.template, LC.defaults, "javascript"), doc = await PDFDocument.load(bytes);
  const js = (o: unknown) => (((o as PDFDict).lookup(PDFName.of("JS"))) as PDFHexString).decodeText();
  it("has Check form and Reset form on every page; Reset asks first, then clears and re-checks", () => {
    for (const n of ["__check_form", "__reset_form"]) expect(doc.getForm().getButton(n).acroField.getWidgets()).toHaveLength(doc.getPageCount());
    const reset = js(doc.getForm().getButton("__reset_form").acroField.getWidgets()[0].dict.lookup(PDFName.of("A")));
    const calls: string[] = [], d = { resetForm: () => calls.push("reset") };
    new Function("app", "lcRules", reset).call(d, { alert: () => 3 }, () => calls.push("rules")); // No
    expect(calls).toEqual([]);
    new Function("app", "lcRules", reset).call(d, { alert: () => 4 }, () => calls.push("rules")); // Yes
    expect(calls).toEqual(["reset", "rules"]);
    // Reset goes back to the starting answers (e.g. Full Swift), not to blank.
    expect(doc.getForm().getRadioGroup("mode_of_advising").acroField.dict.get(PDFName.of("DV"))).toBeDefined();
  });
  it("Generate QR Code, then Print Form: problems stop both; Print Form needs an up-to-date code", () => {
    const last = doc.getPages()[doc.getPageCount() - 1].ref.toString();
    const action = (n: string) => {
      const ws = doc.getForm().getButton(n).acroField.getWidgets();
      expect(ws.map(w => w.P()?.toString())).toEqual([last]); // once, at the end of the form
      return js(ws[0].dict.lookup(PDFName.of("A")));
    };
    expect(action("__generate_qr")).toBe(generateQr);
    expect(action("__print_form")).toBe(printForm);
    // The from-scratch prompt carries the same: the document script (lcRules then lcPayload) and both buttons.
    const full = readFileSync("public/lc-ai-complete-build-prompt.txt", "utf8");
    const of = (name: string) => full.split(`---------------- BEGIN ${name} ----------------\n`)[1].split(`\n---------------- END ${name}`)[0];
    expect(`${of("lcRules")}\n${of("lcPayload")}\n${of("lcQrMatrix and lcDrawQr")}`).toBe(library(doc));
    // ... and so does the fix for Acrobat installations that don't draw barcode fields.
    const fix = readFileSync("public/lc-ai-qr-rows-fix-prompt.txt", "utf8");
    const fx = (name: string) => fix.split(`---------------- BEGIN ${name} ----------------\n`)[1].split(`\n---------------- END ${name}`)[0];
    expect([fx("lcQrMatrix and lcDrawQr"), fx("Generate QR Code")]).toEqual([qrScript, generateQr]);
    expect([of("Generate QR Code"), of("Print Form")]).toEqual([generateQr, printForm]);
    // ... and the drafts-percentage update carries the same lcRules.
    const drafts = readFileSync("public/lc-ai-drafts-percent-prompt.txt", "utf8");
    expect(drafts.split("---------------- BEGIN lcRules ----------------\n")[1].split("\n---------------- END lcRules")[0]).toBe(of("lcRules"));
    // A stand-in for Acrobat: the QR field, the answers lcPayload reports, and what happens.
    const run = (code: string, qr: { value: string }, missing: string[], answers: string) => {
      const log: string[] = [];
      const d = { numPages: 4, pageNum: 0, print: (...a: unknown[]) => log.push(`print ${a.join(",")}`), getField: (n: string) => n === "__qr" ? qr : { setFocus: () => log.push(`focus ${n}`) } };
      const lcRules = () => Object.assign([...missing], { bad: [], first: missing.length ? "application_date" : "" });
      const lcPayload = () => JSON.stringify({ saved: String(Math.random()), data: { applicant_name: answers } }) + "   ";
      const lcDrawQr = (_: unknown, text: string) => log.push(`draw ${text.length}`);
      new Function("app", "lcRules", "lcPayload", "lcDrawQr", code).call(d, { alert: (m: string) => log.push(m.split(".")[0]) }, lcRules, lcPayload, lcDrawQr);
      return { log, page: d.pageNum };
    };
    const qr = { value: "" };
    expect(run(generateQr, qr, ["Date"], "ACME").log).toEqual(["The QR code cannot be generated yet", "focus application_date"]);
    expect(qr.value).toBe("");
    expect(run(printForm, qr, [], "ACME").log).toEqual(["Please press Generate QR Code first, so the printed form carries the QR code"]);
    const made = run(generateQr, qr, [], "ACME");
    expect(made.page).toBe(3);
    expect(made.log).toEqual([`draw ${qr.value.length}`, `The QR code has been generated from your answers (${qr.value.length} characters)`]);
    // Anything going wrong is shown, not swallowed (e.g. the document script lost lcPayload).
    const broken = { log: [] as string[] };
    new Function("app", "lcRules", "lcPayload", "lcDrawQr", generateQr).call({ numPages: 4, getField: () => ({}) }, { alert: (m: string) => broken.log.push(m.split("\n")[0]) }, () => Object.assign([], { bad: [] }), () => { throw new Error("lcPayload is not defined"); }, () => {});
    expect(broken.log).toEqual(["The QR code could not be generated: Error: lcPayload is not defined"]);
    expect(JSON.parse(qr.value).data.applicant_name).toBe("ACME");
    expect(run(printForm, qr, [], "ACME").log).toEqual(["print true,0,3,false,true"]);   // same answers (a later time is fine)
    expect(run(printForm, qr, [], "ACME LTD").log).toEqual(["Your answers have changed since the QR code was generated"]);
  });
  it("QR code: drawn by the form's own script into 177 comb rows on the last page (no Acrobat barcode feature)", () => {
    const form = doc.getForm(), box = form.getTextField("__qr"), last = doc.getPages()[doc.getPageCount() - 1];
    expect(box.acroField.dict.has(PDFName.of("PMD"))).toBe(false);          // a plain hidden field holding the JSON
    expect(box.acroField.dict.has(PDFName.of("AA"))).toBe(false);           // made only by Generate QR Code
    for (const y of [0, 88, 176]) {
      const row = form.getTextField(`__qr_${y}`);
      expect(row.acroField.getWidgets()[0].P()?.toString()).toBe(last.ref.toString());
      expect([row.isCombed(), row.getMaxLength(), row.isReadOnly()]).toEqual([true, 177, true]);
      expect(row.acroField.dict.lookup(PDFName.of("DA"))?.toString()).toMatch(/^\(\/ZaDb [\d.]+ Tf 0 g\)$/);
      expect(row.acroField.getWidgets()[0].dict.has(PDFName.of("DA"))).toBe(false); // inherits ZapfDingbats from the field
    }
    // The encoder: a version 40 symbol with its finder patterns and timing line in place.
    const m = new Function(`${qrScript}; return lcQrMatrix(${JSON.stringify("x".repeat(2300))});`)() as boolean[][];
    expect(m.length).toBe(177);
    const finder = (x: number, y: number) => [0, 6].every(i => m[y + i][x] && m[y][x + i]) && !m[y + 1][x + 1] && m[y + 3][x + 3];
    expect([finder(0, 0), finder(170, 0), finder(0, 170)]).toEqual([true, true, true]);
    expect(m[6].slice(8, 20).map(Number).join("")).toBe("101010101010");
    // The script given to the company AI word for word is the one in this PDF.
    const prompt = readFileSync("public/lc-ai-confirm-print-prompt.txt", "utf8");
    expect(prompt.split("---------------- BEGIN lcPayload ----------------\n")[1].split("\n---------------- END lcPayload")[0]).toBe(payloadScript(LC.template));
    // Run it on the starting answers: only answered questions, keyed by field name; no "__" fields or buttons.
    const fields = form.getFields();
    const as = (f: (typeof fields)[number]) =>
      f instanceof PDFTextField ? { type: "text", value: f.getText() ?? "", valueAsString: f.getText() ?? "" } :
      f instanceof PDFCheckBox ? { type: "checkbox", value: f.isChecked() ? "Yes" : "Off" } :
      f instanceof PDFRadioGroup ? { type: "radiobutton", value: f.getSelected() ?? "Off" } :
      f instanceof PDFDropdown ? { type: "combobox", value: f.getSelected()[0] ?? "", valueAsString: f.getSelected()[0] ?? "" } :
      f instanceof PDFButton ? { type: "button" } : { type: "text", value: "", valueAsString: "" };
    const d = { numFields: fields.length, getNthFieldName: (i: number) => fields[i].getName(), getField: (n: string) => { const f = form.getFieldMaybe(n); return f && as(f); } };
    const out = JSON.parse(new Function(`${payloadScript(LC.template)}; return lcPayload(this);`).call(d));
    expect(out).toMatchObject({ form: "LC-01", version: "1.0", complete: true });
    expect(out.data).toMatchObject({ mode_of_advising: "Full Swift", presentation_days: "21", bank_charges: true, post_shipment_financing: true });
    expect(Object.keys(out.data).some(k => k.startsWith("__"))).toBe(false);
    expect(new Function(`${payloadScript(LC.template)}; return lcPayload(this);`).call(d)).toHaveLength(2300); // padded: always the same size of code
  });
  it("text boxes: letters upper-cased as typed, characters SWIFT can't carry refused", () => {
    const k = js((doc.getForm().getTextField("applicant_name").acroField.dict.lookup(PDFName.of("AA")) as PDFDict).lookup(PDFName.of("K")));
    const type = (change: string) => { const event = { willCommit: false, change, rc: true }; new Function("event", "app", k)(event, { beep() {} }); return event; };
    expect(type("tan & co")).toMatchObject({ change: "TAN & CO", rc: true });
    expect(type("é").rc).toBe(false);
    expect(type("*").rc).toBe(false);
  });
});

describe("every conditional rule lights up its field (the PDF's own script)", async () => {
  const { LC } = await import("../src/lc");
  const { buildLcPdf } = await import("../src/lc-pdf");
  const fields = LC.template.sections.flatMap(s => s.fields), byId = new Map(fields.map(f => [f.id, f]));
  // The answer that makes each rule apply, as Acrobat reports it (tick boxes "Yes"/"Off", radios their option).
  const trigger = (id: string, values: string[]) => byId.get(id)!.kind === "check" ? (values[0] === "true" ? "Yes" : "Off") : values[0];
  const cases = fields.flatMap(f => (f.requiredIf ?? []).filter(r => !r.not).map(r => [f.id, r.field, trigger(r.field, r.values)] as const));
  // The trigger only counts when it applies itself (a locked question's answer is cleared), so switch on its own
  // triggers too: "Drafts at = Term" needs "Drafts" ticked.
  const chain = (id: string, value: string): Record<string, string> => {
    const up = activeRules(byId.get(id)!)[0];
    return { ...(up ? chain(up.field, trigger(up.field, up.values)) : {}), [id]: value };
  };
  for (const [name, make] of [["new design", () => buildPdf(LC.template)], ["original look", () => buildLcPdf()]] as const) {
    const doc = await PDFDocument.load(await make()), lib = library(doc);
    it.each(cases)(`${name}: %s turns red when %s = %s`, (target, by, value) => {
      const state: Record<string, Fake> = {};
      const set = chain(by, value);
      const acro = { getField: (n: string) => n in state ? state[n] : (state[n] = like(doc, n, set[n])) };
      new Function("color", "console", `${lib}; lcRules(this);`).call(acro, { red: "red", black: "black", white: "white", transparent: "none" }, { println() {} });
      const kind = byId.get(target)!.kind, shown = kind === "checks" ? state[`${target}__0`] : kind === "date" ? state[`${target}__list`] : state[target];
      expect(shown?.strokeColor).toBe("red");
    });
  }
});

describe("two versions: JavaScript and no JavaScript", () => {
  const scan = async (mode: "javascript" | "no-javascript") => {
    const doc = await PDFDocument.load(await buildPdf(LC.template, LC.defaults, mode));
    let scripts = 0, copies = 0;
    for (const [, o] of doc.context.enumerateIndirectObjects()) {
      const d = o instanceof PDFDict ? o : undefined;
      if (!d) continue;
      if (d.get(PDFName.of("S")) === PDFName.of("JavaScript") || d.has(PDFName.of("AA"))) scripts++;
      if (d.lookup(PDFName.of("F")) instanceof PDFNumber && (d.lookup(PDFName.of("F")) as PDFNumber).asNumber() === 64) copies++;
    }
    return { scripts: scripts + (doc.catalog.has(PDFName.of("Names")) ? 1 : 0) + (doc.catalog.has(PDFName.of("AA")) ? 1 : 0), copies, check: !!doc.getForm().getFieldMaybe("__check_form") };
  };
  it("no JavaScript: no scripts at all, red frames instead", async () => {
    const r = await scan("no-javascript");
    expect(r.scripts).toBe(0);
    expect(r.copies).toBeGreaterThan(100);
    expect(r.check).toBe(false);
  });
  it("JavaScript: Acrobat's checks, no red-frame copies", async () => {
    const r = await scan("javascript");
    expect(r.scripts).toBeGreaterThan(50);
    expect(r.copies).toBe(0);
    expect(r.check).toBe(true);
  });
});
