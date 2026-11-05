import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
import { FORMATS, buildPdf, dateOptions, extractPdf, isActive, joinDate, type Field, type Values } from "../src/pdf";
import { SAMPLES } from "../src/demo-applications";
import { validateLc } from "../src/form/validate";
import { LC, LC_SAMPLE } from "../src/lc";
import { buildLcPdf } from "../src/lc-pdf";

describe("LC in the bank's layout", () => {
  it("has a box for every question and gives every answer back", async () => {
    const pdf = await buildLcPdf(LC_SAMPLE);
    const names = new Set((await PDFDocument.load(pdf)).getForm().getFields().map(f => f.getName()));
    const missing = LC.template.sections.flatMap(s => s.fields).filter(f => !names.has(f.kind === "checks" ? `${f.id}__0` : f.kind === "date" ? `${f.id}__list` : f.id)).map(f => f.id);
    // The bank's layout has 3 address lines, as the smart form does; the 4th line is only in the new design.
    expect(missing).toEqual(["applicant_address_4", "beneficiary_address_4"]);
    const { data } = await extractPdf(pdf);
    for (const [k, v] of Object.entries(LC_SAMPLE)) expect([k, data[k]]).toEqual([k, v]);
  });
});

describe("fields can be typed in, in Acrobat", () => {
  // Acrobat needs the font named in each field's /DA in the form's /DR; without it clicking a field does nothing.
  it.each([["original look", () => buildLcPdf()], ["new design", () => buildPdf(LC.template)]])("%s", async (_, make) => {
    const doc = await PDFDocument.load(await make());
    const af = doc.getForm().acroForm.dict;
    const fonts = (af.lookup(PDFName.of("DR")) as PDFDict).lookup(PDFName.of("Font")) as PDFDict;
    for (const f of doc.getForm().getFields()) {
      const da = f.acroField.dict.lookup(PDFName.of("DA"))?.toString() ?? "";
      const name = /\/([\w-]+) [\d.]+ Tf/.exec(da)?.[1];
      if (name && name !== "dummy__noop") expect(fonts.has(PDFName.of(name)), `${f.getName()} uses /${name}`).toBe(true);
    }
  });
});

describe("within Adobe's limits", () => {
  // Acrobat refuses strings over 32,767 bytes (PDF architectural limit); pdf.js and Chrome/Edge don't mind.
  const longest = (doc: PDFDocument) => {
    let max = 0;
    const walk = (o: unknown, seen = new Set<unknown>()): void => {
      if (seen.has(o)) return; seen.add(o);
      if (o instanceof PDFString || o instanceof PDFHexString) max = Math.max(max, o.asBytes().length);
      else if (o instanceof PDFDict) for (const [, v] of o.entries()) walk(v, seen);
      else if (o instanceof PDFArray) for (const v of o.asArray()) walk(v, seen);
    };
    for (const [, o] of doc.context.enumerateIndirectObjects()) walk(o instanceof PDFRawStream ? o.dict : o);
    return max;
  };
  it.each([["original look", () => buildLcPdf(LC_SAMPLE)], ["new design", () => buildPdf(LC.template, LC_SAMPLE)]])("%s: no string over 32,767 bytes", async (_, make) => {
    expect(longest(await PDFDocument.load(await make()))).toBeLessThanOrEqual(32767);
  });
});

describe("red frames without JavaScript", () => {
  it.each([
    // the tick box itself + 4 strips around each of the 6 boxes: made out to (3 options), freight (2), notify party (1),
    // + a grey "not yet" shade under each of those 6 boxes
    ["original look", () => buildLcPdf(), 1 + 4 * 6 + 6],
    // the tick box + per question: 4 strips around all its options + its label in red; + the 6 shades
    ["new design", () => buildPdf(LC.template), 1 + 3 * (4 + 1) + 6],
  ] as const)("%s: ticking Bill of lading frames its 3 questions", async (_, make, n) => {
    const form = (await PDFDocument.load(await make())).getForm();
    expect(form.getCheckBox("doc_bill_of_lading").acroField.getWidgets().length).toBe(n);
  });
});

describe("questions that only apply once something is ticked", () => {
  it("the sample answers only questions that apply", () => {
    for (const f of LC.template.sections.flatMap(s => s.fields)) if (LC_SAMPLE[f.id] !== undefined && LC_SAMPLE[f.id] !== false) expect(isActive(f, LC_SAMPLE), f.id).toBe(true);
  });
  it("bank charges options are locked until the box is ticked", async () => {
    const f = LC.template.sections.flatMap(s => s.fields).find(f => f.id === "bank_charges_for")!;
    expect(isActive(f, {})).toBe(false);
    expect(isActive(f, { bank_charges: true })).toBe(true);
  });
});

describe("dates: Acrobat's calendar when its JavaScript runs, drop-downs otherwise", () => {
  const script = async (pdf: Uint8Array) => {
    const doc = await PDFDocument.load(pdf);
    const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("JavaScript"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
    return new TextDecoder().decode(decodePDFRawStream(names.lookup(1, PDFDict).lookup(PDFName.of("JS")) as PDFRawStream).decode());
  };
  it.each([["original look", () => buildLcPdf(LC_SAMPLE)], ["new design", () => buildPdf(LC.template, LC_SAMPLE)]])("%s", async (_, make) => {
    const pdf = await make(), js = await script(pdf);
    const fields: Record<string, any> = { expiry_date: { display: 1 } };
    const d = { getField: (n: string) => fields[n] ??= { display: 0 } };
    // In Acrobat the calendar box is shown and the drop-downs hidden; in other viewers (Chrome: "pdfium") nothing changes.
    const quiet = { println() {} }; // the checks also run on opening; this fake has no real fields for them
    new Function("app", "display", "console", js).call(d, { viewerType: "pdfium" }, { visible: 0, hidden: 1 }, quiet);
    expect(fields.expiry_date.display).toBe(1);
    new Function("app", "display", "console", js).call(d, { viewerType: "Exchange-Pro" }, { visible: 0, hidden: 1 }, quiet);
    expect([fields.expiry_date.display, fields.expiry_date__list.display]).toEqual([0, 1]);
    // The box has Acrobat's date format (which brings the calendar) and refuses dates that don't exist.
    const form = (await PDFDocument.load(pdf)).getForm(), box = form.getTextField("expiry_date");
    expect(box.acroField.dict.lookup(PDFName.of("AA"), PDFDict).toString()).toMatch(/AFDate_FormatEx|<FEFF0041/);
    // Hidden box: the drop-downs are the answer. Shown box (Acrobat switched): the box is the answer.
    box.setText("15/08/2027");
    expect((await extractPdf(await form.doc.save())).data.expiry_date).toBe(LC_SAMPLE.expiry_date);
    box.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(4));
    expect((await extractPdf(await form.doc.save())).data.expiry_date).toBe("15/08/2027");
  });
});

describe("the date list only offers real dates", () => {
  it("no 31 Feb or 30 Feb; 29 Feb only in leap years; a year back to two years ahead", () => {
    const o = dateOptions(new Date(2026, 10, 4));
    expect([o[0], o[o.length - 1]]).toEqual(["01 Nov 2025", "30 Nov 2028"]);
    expect(o.filter(d => /^(29|30|31) Feb/.test(d))).toEqual(["29 Feb 2028"]);
    expect(o.filter(d => /^31 (Apr|Jun|Sep|Nov)/.test(d))).toEqual([]);
    expect(new Set(o).size).toBe(o.length);
    expect(joinDate(["15 Mar 2026"])).toBe("15/03/2026");
    expect(joinDate(["Pick a date"])).toBe("");
    expect(joinDate(["15", "03 Mar", "2026"])).toBe("15/03/2026"); // forms made with day / month / year lists
  });
});

describe("formats", () => {
  it("phone and account numbers: right keys, right shape", () => {
    expect(["+65 6123 4567", "(021) 5888-1234"].every(v => FORMATS.phone.ok.test(v))).toBe(true);
    expect(["abc", "6123 ext 4", "+"].some(v => FORMATS.phone.ok.test(v))).toBe(false);
    expect(new RegExp(FORMATS.phone.bad).test("a")).toBe(true);
    expect(["072-123456-7", "0721234567"].every(v => FORMATS.account.ok.test(v))).toBe(true);
    expect(["072 123", "ABC123", "-12"].some(v => FORMATS.account.ok.test(v))).toBe(false);
  });
  it("the sample answers pass their own formats", () => {
    for (const f of LC.template.sections.flatMap(s => s.fields))
      if (f.format && typeof LC_SAMPLE[f.id] === "string") expect(FORMATS[f.format].ok.test(LC_SAMPLE[f.id] as string), f.id).toBe(true);
  });
});

describe("Check form button: blanks, formats and funny characters", () => {
  // Runs the PDF's own script against a stand-in for Acrobat's fields.
  const lcRules = async (make: () => Promise<Uint8Array>) => {
    const doc = await PDFDocument.load(await make());
    const names = (doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("JavaScript"), PDFDict).lookup(PDFName.of("Names"), PDFArray));
    const js = new TextDecoder().decode(decodePDFRawStream(names.lookup(1, PDFDict).lookup(PDFName.of("JS")) as PDFRawStream).decode());
    return (values: Record<string, unknown>) => {
      const fields: Record<string, any> = {};
      for (const f of LC.template.sections.flatMap(s => s.fields)) {
        const v = values[f.id];
        if (f.kind === "date") { // one list of dates: "15 Mar 2026"
          const [dd, mm, yy] = typeof v === "string" && v ? v.split("/") : [];
          const p = dd ? `${dd} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mm - 1] ?? "Xxx"} ${yy}` : "Pick a date";
          fields[`${f.id}__list`] = { value: p, valueAsString: p };
        } else if (f.kind === "checks") (f.options ?? []).forEach((o, i) => { fields[`${f.id}__${i}`] = { value: Array.isArray(v) && v.includes(o) ? "Yes" : "Off" }; });
        else fields[f.id] = { value: f.kind === "check" ? (v ? "Yes" : "Off") : v ?? (f.kind === "radio" ? "Off" : ""), valueAsString: String(v ?? "") };
      }
      const d = { getField: (n: string) => fields[n] ?? null };
      const m = new Function("color", "console", `${js}; return lcRules;`)({ red: 1, black: 0, white: 0, transparent: 0 }, { println: (e: string) => { throw new Error(e); } })(d);
      return { miss: [...m] as string[], bad: m.bad as string[], first: m.first as string, red: (id: string) => fields[id].strokeColor === 1, fields };
    };
  };
  it.each([["original look", () => buildLcPdf()], ["new design", () => buildPdf(LC.template)]])("%s", async (_, make) => {
    const check = await lcRules(make);
    expect(check(LC_SAMPLE)).toMatchObject({ miss: [], bad: [] });
    const r = check({ ...LC_SAMPLE, contact_tel: "6123 ABC", applicant_name: "Café * Co", expiry_date: "31/02/2026", amount: "4,80,000.0.0" });
    expect(r.miss).toEqual([]);
    expect(r.bad.join("\n")).toMatch(/Tel no.*phone number/);
    expect(r.bad.join("\n")).toMatch(/Applicant name.*remove é \*/);
    expect(r.bad.join("\n")).toMatch(/expiry.*not a real date/);
    expect(r.bad.join("\n")).toMatch(/Amount.*not an amount/);
    expect(r.red("contact_tel")).toBe(true);
    expect(r.red("expiry_date__list")).toBe(true);
    expect(check({ ...LC_SAMPLE, expiry_date: "" }).miss.join()).toMatch(/expiry/i);
    expect(check({ ...LC_SAMPLE, expiry_date: "" }).miss.join()).toMatch(/expiry/i); // nothing picked
    expect(check({ ...LC_SAMPLE, applicant_name: "" }).miss).toContain("Applicant name");
    // unticking "All bank charges" locks its options; ticking unlocks them
    expect(check({ ...LC_SAMPLE, bank_charges: false }).fields.bank_charges_for.readonly).toBe(true);
    expect(check(LC_SAMPLE).fields.bank_charges_for.readonly).toBe(false);
  });
  // The PDF's own script must flag exactly the questions the website's validator (validateLc) flags, once locked
  // answers are cleared (which the script does, like the smart form): every trigger on and off, every sample.
  it("flags the same questions as the website's validator", async () => {
    const check = await lcRules(() => buildPdf(LC.template, {}, "javascript"));
    const all = LC.template.sections.flatMap(s => s.fields);
    const blankOf = (f: Field) => (f.kind === "check" ? false : f.kind === "checks" ? [] : "");
    const variants: Values[] = [LC.defaults, LC_SAMPLE, ...SAMPLES.map(x => x.answers),
      { ...LC_SAMPLE, expiry_date: "01/12/2026", amount: "0.00", price_basis: "CIP" }, { ...LC_SAMPLE, latest_shipment_date: "01/01/2026" }];
    for (const id of new Set(all.flatMap(f => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])]).map(r => r.field))) {
      const f = all.find(q => q.id === id)!;
      for (const v of f.kind === "check" ? [true, false] : f.options ?? []) variants.push({ ...LC_SAMPLE, [id]: v }, { ...LC.defaults, [id]: v });
    }
    let flagged = 0;
    for (const data of variants) {
      const cleared: Values = { ...data };
      for (let changed = true; changed;) { // clear what doesn't apply, until nothing changes
        changed = false;
        for (const f of all) if (!isActive(f, cleared) && JSON.stringify(cleared[f.id] ?? blankOf(f)) !== JSON.stringify(blankOf(f))) { cleared[f.id] = blankOf(f); changed = true; }
      }
      const expected = [...new Set(validateLc(cleared).map(i => i.id))].sort();
      if (expected.length) flagged++;
      const r = check(data);
      const shown = (f: Field) => f.kind === "checks" ? `${f.id}__0` : f.kind === "date" ? `${f.id}__list` : f.id;
      expect(all.filter(f => r.fields[shown(f)]?.strokeColor === 1).map(f => f.id).sort(), JSON.stringify(data).slice(0, 200)).toEqual(expected);
    }
    expect(variants.length).toBeGreaterThan(100);
    expect(flagged).toBeGreaterThan(variants.length / 2); // most variants have something to flag
  });

  it("checks across answers, locked answers cleared, and where the first problem is", async () => {
    const check = await lcRules(() => buildPdf(LC.template, {}, "javascript"));
    const r = check({ ...LC_SAMPLE, expiry_date: "01/12/2026", amount: "0.00", price_basis: "CIF" });
    const bad = r.bad.join("\n");
    expect(bad).toMatch(/expiry.*: is before the latest shipment date/i);
    expect(bad).toMatch(/Amount: must be more than zero/);
    expect(bad).toMatch(/For FOB\/CFR\/FCA\/CPT: is only for FOB\/CFR\/FCA\/CPT, but price basis is CIF/);
    expect(r.red("insurance_arrangement")).toBe(true);
    expect(r.red("amount")).toBe(true);
    expect(check({ ...LC_SAMPLE, latest_shipment_date: "01/10/2026" }).bad.join()).toMatch(/Latest shipment date: is before the application date/);
    // Unticking "Drafts" locks and clears everything under it, as the smart form does.
    const locked = check({ ...LC_SAMPLE, drafts: false });
    expect(locked.fields.drafts_at).toMatchObject({ value: "Off", readonly: true });
    expect(locked.fields.term_days).toMatchObject({ value: "", readonly: true });
    expect(locked).toMatchObject({ miss: [], bad: [] });
    // "Check form" goes to the first problem, top to bottom: the date on a blank form, else the first wrong answer.
    expect(check({}).first).toBe("application_date__list");
    expect(check({ ...LC_SAMPLE, contact_tel: "61 ABC" }).first).toBe("contact_tel");
  });
});
