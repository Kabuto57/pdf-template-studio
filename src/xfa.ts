// An XFA layer for Adobe Acrobat / Reader, with the same pages, fields and mandatory rules as the plain PDF form.
// Many work laptops have Acrobat JavaScript switched off by IT. Acrobat then runs no PDF scripts, but it still runs
// an XFA form's own scripts (the bank's smart form keeps working). So the rules live here as XFA scripts too:
// ticking a box sets the target field's XFA "required" (nullTest) and outlines it in red, like the smart form does.
// Acrobat draws the form from this layer (NeedsRendering) and saves the answers in its "datasets" packet. Browsers
// and other viewers ignore XFA and show the plain PDF form underneath, so the same file works everywhere.
import {
  PDFCheckBox, PDFDict, PDFDocument, PDFDropdown, PDFName, PDFRadioGroup, PDFRawStream, PDFTextField, PDFArray, PDFString,
  decodePDFRawStream, type Color, type PDFWidgetAnnotation,
} from "pdf-lib";
import { safe, subId, type Field, type Kind, type Template, type Value, type Values } from "./pdf";

type Op =
  | { k: "text"; x: number; y: number; w: number; size: number; bold: boolean; text: string; color?: Color }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; t: number; color?: Color }
  | { k: "rect"; x: number; y: number; w: number; h: number; fill?: Color; stroke?: Color; sw: number }
  | { k: "oval"; x: number; y: number; rx: number; ry: number; sw: number };

/** Records what is drawn on each new page, so the XFA layer can draw the same. Call right after PDFDocument.create(). */
export function recordDrawing(doc: PDFDocument): Op[][] {
  const pages: Op[][] = [], add = doc.addPage.bind(doc);
  doc.addPage = ((...a: Parameters<PDFDocument["addPage"]>) => {
    const p = add(...a), ops: Op[] = [];
    pages.push(ops);
    const { drawText, drawLine, drawRectangle, drawEllipse } = p;
    p.drawText = (text, o = {}) => { ops.push({ k: "text", x: o.x ?? 0, y: o.y ?? 0, w: o.font?.widthOfTextAtSize(text, o.size ?? 24) ?? 0, size: o.size ?? 24, bold: !!o.font?.name.includes("Bold"), text, color: o.color }); drawText.call(p, text, o); };
    p.drawLine = o => { ops.push({ k: "line", x1: o.start.x, y1: o.start.y, x2: o.end.x, y2: o.end.y, t: o.thickness ?? 1, color: o.color }); drawLine.call(p, o); };
    p.drawRectangle = (o = {}) => { ops.push({ k: "rect", x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 150, h: o.height ?? 100, fill: o.color, stroke: o.borderColor, sw: o.borderWidth ?? 0 }); drawRectangle.call(p, o); };
    p.drawEllipse = (o = {}) => { ops.push({ k: "oval", x: o.x ?? 0, y: o.y ?? 0, rx: o.xScale ?? 100, ry: o.yScale ?? 100, sw: o.borderWidth ?? 0 }); drawEllipse.call(p, o); };
    return p;
  }) as PDFDocument["addPage"];
  return pages;
}

const W = 595.28, H = 841.89, ASCENT = 0.905; // A4 height; Arial's ascent (XFA puts the first baseline one ascent below the top)
const pt = (n: number) => `${+n.toFixed(2)}pt`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (c?: Color) => c && "red" in c ? [c.red, c.green, c.blue].map(v => Math.round(v * 255)).join(",") : "0,0,0";
const js = (activity: string, code: string, ref = "") => `<event activity="${activity}"${ref ? ` ref="${ref}"` : ""}><script contentType="application/x-javascript">${esc(code)}</script></event>`;
const edge = (on: boolean, color = "0,0,0", t = 0.6) => `<edge thickness="${pt(t)}"${on ? "" : ' presence="hidden"'}><color value="${color}"/></edge>`;
/** A field's own border: four edges and a fill, which the rules recolour. Underlined fields show neither until flagged. */
const box = (u: boolean) => `<border>${edge(!u).repeat(4)}<fill${u ? ' presence="hidden"' : ""}><color value="255,255,255"/></fill></border>`;
const font = (size: number, bold = false, color = "0,0,0") => `<font typeface="Arial" size="${pt(size)}"${bold ? ' weight="bold"' : ""}><fill><color value="${color}"/></fill></font>`;
const zero = '<margin topInset="0pt" bottomInset="0pt" leftInset="0pt" rightInset="0pt"/>';

function draw(o: Op): string {
  // A fixed width with room to spare: a growable one wraps in viewers whose font runs wider.
  if (o.k === "text") return `<draw x="${pt(o.x)}" y="${pt(H - o.y - o.size * ASCENT)}" w="${pt(Math.min(o.w * 1.25 + 6, W - o.x))}" minH="0pt"><ui><textEdit/></ui>`
    + `<value><text>${esc(o.text)}</text></value>${font(o.size, o.bold, col(o.color))}${zero}<para vAlign="top"/></draw>`;
  if (o.k === "line") return `<draw x="${pt(Math.min(o.x1, o.x2))}" y="${pt(H - Math.max(o.y1, o.y2))}" w="${pt(Math.abs(o.x2 - o.x1))}" h="${pt(Math.abs(o.y2 - o.y1))}">`
    + `<value><line>${edge(true, col(o.color), o.t)}</line></value></draw>`;
  if (o.k === "rect") return `<draw x="${pt(o.x)}" y="${pt(H - o.y - o.h)}" w="${pt(o.w)}" h="${pt(o.h)}"><value><rectangle>${edge(o.sw > 0, col(o.stroke), o.sw)}`
    + `<fill${o.fill ? "" : ' presence="hidden"'}><color value="${col(o.fill)}"/></fill></rectangle></value></draw>`;
  return `<draw x="${pt(o.x - o.rx)}" y="${pt(H - o.y - o.ry)}" w="${pt(2 * o.rx)}" h="${pt(2 * o.ry)}"><value><arc circular="0">${edge(true, "0,0,0", o.sw)}</arc></value></draw>`;
}

/**
 * The rules engine as an XFA script object (same logic as lcRules in pdf.ts, in XFA's object model).
 * run(id, v) re-checks every rule, treating `id` as answered `v` (a drop-down's change event fires before its value is set).
 */
function rulesScript(t: Template, paths: Map<string, string>, underlined: Set<string>): string {
  const all = t.sections.flatMap(s => s.fields), byId = new Map(all.map(f => [f.id, f]));
  const model: Record<string, { k: Kind; l: string; p: string | string[]; c?: 1; s?: 1; u?: 1; o?: string[]; r?: [string, string[], 0 | 1][] }> = {};
  const add = (f: Field) => model[f.id] ??= {
    k: f.kind, l: safe(f.label), ...(underlined.has(f.id) ? { u: 1 as const } : {}),
    ...(f.kind === "checks" ? { o: (f.options ?? []).map(safe), p: (f.options ?? []).map((_, i) => paths.get(subId(f.id, i)) ?? "") } : { p: paths.get(f.id) ?? "" }),
  };
  for (const f of all.filter(f => f.required || f.requiredIf)) {
    Object.assign(add(f), { c: 1 as const }, f.required ? { s: 1 as const } : {}, f.requiredIf ? { r: f.requiredIf.map(r => [r.field, r.values.map(safe), r.not ? 1 : 0] as [string, string[], 0 | 1]) } : {});
    for (const r of f.requiredIf ?? []) { const by = byId.get(r.field); if (by) add(by); }
  }
  return `var M = ${JSON.stringify(model)};
function has(a, x) { for (var i = 0; i < a.length; i++) if (a[i] == x) return true; return false; }
function node(p) { return p ? xfa.resolveNode(p) : null; }
function raw(n) { return n == null || n.rawValue == null ? "" : String(n.rawValue); }
function val(id, oid, ov) {
  var m = M[id], a = [], i;
  if (id == oid) return ov == null ? "" : String(ov);
  if (m.k == "checks") { for (i = 0; i < m.o.length; i++) if (raw(node(m.p[i])) == "1") a.push(m.o[i]); return a; }
  if (m.k == "check") return raw(node(m.p)) == "1" ? "true" : "false";
  return raw(node(m.p));
}
function empty(x) { return typeof x == "object" ? !x.length : x === ""; }
function need(id, oid, ov) {
  var m = M[id], r = m.r || [], i, j, x, hit;
  if (m.s) return true;
  for (i = 0; i < r.length; i++) {
    x = val(r[i][0], oid, ov); hit = false;
    if (typeof x == "object") { for (j = 0; j < x.length; j++) if (has(r[i][1], x[j])) hit = true; } else hit = has(r[i][1], x);
    if (r[i][2] ? !hit && !empty(x) : hit) return true;
  }
  return false;
}
function look(f, bad, u) {
  var b = f.border, i, e;
  for (i = 0; i < 4; i++) { e = b.getElement("edge", i); e.presence = bad || !u ? "visible" : "hidden"; e.color.value = bad ? "204,0,0" : "0,0,0"; e.thickness = bad ? "1pt" : "0.6pt"; }
  b.fill.presence = bad || !u ? "visible" : "hidden";
  b.fill.color.value = bad ? "255,224,224" : "255,255,255";
}
function run(oid, ov) {
  var miss = [], id, m, q, b, i, n, k;
  for (id in M) {
    m = M[id]; if (!m.c) continue;
    q = need(id, oid, ov); b = q && (m.k == "check" ? val(id, oid, ov) != "true" : empty(val(id, oid, ov)));
    if (b) miss.push(m.l);
    if (m.k == "checks") { for (i = 0; i < m.p.length; i++) { n = node(m.p[i]); if (n) look(n, b, m.u); } continue; }
    n = node(m.p); if (!n) continue;
    if (m.k != "check") n.validate.nullTest = q ? "error" : "disabled";
    if (m.k == "radio") { for (i = 0; i < n.nodes.length; i++) { k = n.nodes.item(i); if (k.className == "field") look(k, b, m.u); } }
    else look(n, b, m.u);
  }
  return miss;
}
function report(always) {
  var m = run();
  if (m.length) xfa.host.messageBox("This form is not complete: " + m.length + " mandatory question" + (m.length > 1 ? "s are" : " is") + " still blank (outlined in red):\\n\\n- " + m.slice(0, 20).join("\\n- ") + (m.length > 20 ? "\\n- ..." : "") + "\\n\\nPlease fill them in before you send the form.", "Check form", 1);
  else if (always) xfa.host.messageBox("All mandatory questions are answered. You can save the form and send it.", "Check form", 3);
}`;
}

const real = (w: PDFWidgetAnnotation) => w.dict.has(PDFName.of("MK")); // not one of addRedFrames' frame copies
const fontSize = (da?: string) => Number(/([\d.]+)\s+Tf/.exec(da ?? "")?.[1]) || 8;

/**
 * Adds the XFA layer to a finished form: the recorded drawing, every field (same name, place and answer), and the
 * rules. `underlined`: fields drawn as a bottom line (the original look), which get a box only when flagged.
 */
export function addXfa(doc: PDFDocument, t: Template, values: Values, drawn: Op[][], underlined: Set<string> = new Set()) {
  const pages = doc.getPages(), form = doc.getForm(), kinds = new Map<string, Field>();
  for (const f of t.sections.flatMap(s => s.fields)) {
    kinds.set(f.id, f);
    (f.options ?? []).forEach((_, i) => kinds.set(subId(f.id, i), f));
  }
  const body: string[][] = pages.map((_, i) => (drawn[i] ?? []).map(draw)), paths = new Map<string, string>(), data: string[] = [];
  const at = (w: PDFWidgetAnnotation) => {
    const r = w.getRectangle(), p = Math.max(0, pages.findIndex(pg => pg.ref === w.P()));
    return { p, xywh: `x="${pt(r.x)}" y="${pt(H - r.y - r.height)}" w="${pt(r.width)}" h="${pt(r.height)}"`, size: Math.min(r.width, r.height) };
  };
  const tip = (id: string) => kinds.get(id) ? `<assist><toolTip>${esc(safe(kinds.get(id)!.label))}</toolTip></assist>` : "";
  const nullTest = (id: string) => `<validate nullTest="${kinds.get(id)?.required ? "error" : "disabled"}"/>`;
  const value = (id: string): Value | undefined => {
    const f = kinds.get(id), v = f && values[f.id];
    return f?.kind === "checks" ? Array.isArray(v) && v.includes(f.options![Number(id.split("__").pop())]) : v;
  };
  const exit = js("exit", "rules.run();");

  for (const field of form.getFields()) {
    const id = field.getName(), widgets = field.acroField.getWidgets().filter(real), u = underlined.has(kinds.get(id)?.id ?? "");
    if (!widgets.length) continue;
    if (id === "__check_form") {
      const { p, xywh } = at(widgets[0]);
      body[p].push(`<field name="CheckForm" ${xywh} relevant="-print"><bind match="none"/><ui><button highlight="push"/></ui>`
        + `<caption placement="inline"><value><text>Check form</text></value>${font(9, false, "255,255,255")}<para hAlign="center" vAlign="middle"/></caption>`
        + `<border>${edge(true)}<fill><color value="0,0,0"/></fill></border>${js("click", "rules.report(true);")}</field>`);
      continue;
    }
    if (id === "__hint" && field instanceof PDFTextField) {
      const { p, xywh } = at(widgets[0]);
      body[p].push(`<draw ${xywh} relevant="-print"><ui><textEdit/></ui><value><text>${esc(field.getText() ?? "")}</text></value>${font(7)}${zero}<para hAlign="right"/></draw>`);
      continue;
    }
    if (id.startsWith("__")) continue;
    const v = value(id);
    if (field instanceof PDFRadioGroup) {
      const opts = field.getOptions(), { p } = at(widgets[0]);
      const kids = widgets.map((w, i) => { const { xywh, size } = at(w); return `<field name="o${i}" ${xywh}><ui><checkButton shape="round" size="${pt(size - 1)}"><border presence="hidden"/></checkButton></ui>`
        + `<items><text>${esc(opts[i])}</text></items>${zero}<para hAlign="center" vAlign="middle"/>${box(u)}</field>`; });
      body[p].push(`<exclGroup name="${id}" x="0pt" y="0pt" layout="position">${kids.join("")}${nullTest(id)}${tip(id)}${js("change", "rules.run();")}</exclGroup>`);
      paths.set(id, `form1.#subform[${p}].${id}`);
      if (typeof v === "string" && v) data.push(`<${id}>${esc(safe(v))}</${id}>`);
      continue;
    }
    const { p, xywh, size } = at(widgets[0]);
    paths.set(id, `form1.#subform[${p}].${id}`);
    if (field instanceof PDFCheckBox) {
      body[p].push(`<field name="${id}" ${xywh}><ui><checkButton shape="square" size="${pt(size - 1)}"><border presence="hidden"/></checkButton></ui>`
        + `<items><integer>1</integer><integer>0</integer></items>${zero}<para hAlign="center" vAlign="middle"/>${box(u)}${tip(id)}${js("change", "rules.run();")}</field>`);
      data.push(`<${id}>${v === true ? 1 : 0}</${id}>`);
    } else if (field instanceof PDFDropdown) {
      body[p].push(`<field name="${id}" ${xywh}><ui><choiceList open="onEntry" commitOn="select"><border presence="hidden"/></choiceList></ui>`
        + `<items>${field.getOptions().map(o => `<text>${esc(o)}</text>`).join("")}</items>${font(fontSize(field.acroField.getDefaultAppearance()))}`
        + `<margin leftInset="1.5pt" rightInset="1.5pt" topInset="0pt" bottomInset="0pt"/><para vAlign="middle"/>${box(u)}${nullTest(id)}${tip(id)}`
        + `${js("change", `rules.run("${id}", xfa.event.newText);`)}${exit}</field>`);
      if (typeof v === "string" && v) data.push(`<${id}>${esc(safe(v))}</${id}>`);
    } else if (field instanceof PDFTextField) {
      const multi = field.isMultiline(), max = field.getMaxLength();
      body[p].push(`<field name="${id}" ${xywh}><ui><textEdit multiLine="${multi ? 1 : 0}"><border presence="hidden"/>${zero}</textEdit></ui>`
        + `<value><text${max ? ` maxChars="${max}"` : ""}/></value>${font(fontSize(field.acroField.getDefaultAppearance()))}`
        + `<margin leftInset="1.5pt" rightInset="1.5pt" topInset="${multi ? "1.5pt" : "0pt"}" bottomInset="0pt"/><para vAlign="${multi ? "top" : "middle"}"/>`
        + `${box(u)}${nullTest(id)}${tip(id)}${exit}</field>`);
      if (typeof v === "string" && v) data.push(`<${id}>${esc(safe(v))}</${id}>`);
    }
  }

  const template = `<template xmlns="http://www.xfa.org/schema/xfa-template/2.8/"><subform name="form1" layout="tb" locale="en_GB" restoreState="auto">`
    + `<pageSet><pageArea name="Page1" id="Page1"><contentArea x="0pt" y="0pt" w="595.28pt" h="841.89pt"/><medium stock="a4" short="595.28pt" long="841.89pt"/></pageArea></pageSet>`
    + `<variables><script name="rules" contentType="application/x-javascript">${esc(rulesScript(t, paths, underlined))}</script></variables>`
    + body.map((items, i) => `<subform x="0pt" y="0pt" w="595.28pt" h="841pt" layout="position"><keep intact="contentArea"/>${i ? '<breakBefore targetType="pageArea"/>' : ""}${items.join("")}</subform>`).join("")
    + js("ready", "rules.run();", "$form") + js("preSave", "rules.report(false);", "$host") + js("prePrint", "rules.report(false);", "$host")
    + `</subform></template>`;
  const datasets = `<xfa:datasets xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/"><xfa:data><form1>${data.join("")}</form1></xfa:data></xfa:datasets>`;
  const config = `<config xmlns="http://www.xfa.org/schema/xci/2.8/"><present><pdf><version>1.7</version><adobeExtensionLevel>3</adobeExtensionLevel>`
    + `<renderPolicy>client</renderPolicy><scriptModel>XFA</scriptModel><interactive>1</interactive></pdf><xdp><packets>*</packets></xdp><destination>pdf</destination></present>`
    + `<acrobat><acrobat7><dynamicRender>required</dynamicRender></acrobat7><validate>preSubmit</validate></acrobat></config>`;
  const ctx = doc.context, stream = (s: string) => ctx.register(ctx.flateStream(new TextEncoder().encode(s)));
  const packets = [["preamble", '<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/">'], ["config", config], ["template", template], ["datasets", datasets], ["postamble", "</xdp:xdp>"]];
  form.acroForm.dict.set(PDFName.of("XFA"), ctx.obj(packets.flatMap(([name, xml]) => [PDFString.of(name), stream(xml)])));
  doc.catalog.set(ORIGINAL, stream(datasets)); // so extraction can tell whether Acrobat has saved new answers
  doc.catalog.set(PDFName.of("NeedsRendering"), ctx.obj(true));
  doc.catalog.set(PDFName.of("Extensions"), ctx.obj({ ADBE: { BaseVersion: PDFName.of("1.7"), ExtensionLevel: 3 } }));
}

const ORIGINAL = PDFName.of("FormXfaData");
const text = (o: unknown) => o instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(o).decode()) : undefined;
const unescape = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/\r\n?/g, "\n");

/**
 * The answers Acrobat saved in the XFA layer, by field name, or undefined if it never saved any (the form was
 * filled in a browser, whose answers are in the plain PDF fields).
 * ponytail: filled in Acrobat and then again in a browser keeps the Acrobat answers; nobody does that.
 */
export function xfaAnswers(doc: PDFDocument): Map<string, string> | undefined {
  const xfa = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)?.lookupMaybe(PDFName.of("XFA"), PDFArray);
  if (!xfa) return undefined;
  let datasets: string | undefined;
  for (let i = 0; i + 1 < xfa.size(); i += 2) if (xfa.lookup(i) instanceof PDFString && (xfa.lookup(i) as PDFString).decodeText() === "datasets") datasets = text(xfa.lookup(i + 1));
  const original = text(doc.catalog.lookup(ORIGINAL));
  if (!datasets || !original || datasets === original) return undefined;
  const out = new Map<string, string>();
  for (const m of datasets.matchAll(/<([\w.-]+)(?:\s[^>]*)?(?:\/>|>([^<]*)<\/\1>)/g)) out.set(m[1], unescape(m[2] ?? ""));
  return out;
}
