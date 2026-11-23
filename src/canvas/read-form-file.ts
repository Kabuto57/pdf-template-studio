// READING AN lc-form FORM FILE BACK (the studio's code editor): the Python the studio writes (form-file.ts), and
// hand-written form files in the same style, give back the form, so editing the code changes the canvas.
// It understands what form files use: `from ... import ...`, assignments (FORM = {...}, DEFAULTS, PDF_NAME and
// any list or text constant), the helpers of build.py section 1 (section, text ... select, when, ticked, answered,
// not_before, after, in_range, account_length), strings (also triple-quoted and side by side), numbers,
// True / False / None, lists, dicts, `+` and list[index]. Loops and functions (`for`, `def`) are refused with the
// line they are on: build those forms with lc-form, or write their questions out one per line.
import { LISTS } from "./forms";
import type { Check, Field, Kind, Rule, Section, Template, Values } from "../pdf";

type Tok = { t: "name" | "num" | "str" | "p"; v: string; line: number };
export interface ReadForm { template: Template; defaults: Values; pdfName?: string }

function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  const fail = (msg: string): never => { throw new Error(`Line ${line}: ${msg}`); };
  const ESC: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'", "\n": "" };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "\\" && src[i + 1] === "\n") { i += 2; line++; continue; } // a line carried on
    const name = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 80));
    if (name && !(/^[rbfuRBFU]{1,2}$/.test(name[0]) && /["']/.test(src[i + name[0].length]))) {
      out.push({ t: "name", v: name[0], line }); i += name[0].length; continue;
    }
    if (name) { // a string prefix: r"..." is read as is; f"..." can't be read
      if (/f/i.test(name[0])) fail('f-strings (f"...") are not supported here: write the text out');
      i += name[0].length;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i, i + 40));
    if (num) { out.push({ t: "num", v: num[0], line }); i += num[0].length; continue; }
    if (c === '"' || c === "'") {
      const triple = src.startsWith(c.repeat(3), i), end = triple ? c.repeat(3) : c, start = line;
      let j = i + end.length, text = "";
      while (j < src.length && !src.startsWith(end, j)) {
        if (src[j] === "\n") { if (!triple) fail("a text in quotes isn't closed"); line++; }
        if (src[j] !== "\\") { text += src[j++]; continue; }
        const e = src[j + 1];
        if (e === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(j + 2, j + 6))) { text += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)); j += 6; }
        else { text += ESC[e] ?? `\\${e}`; if (e === "\n") line++; j += 2; }
      }
      if (j >= src.length) { line = start; fail("a text in quotes isn't closed"); }
      out.push({ t: "str", v: text, line: start });
      i = j + end.length;
      continue;
    }
    if ("()[]{},=:+.-*".includes(c)) { out.push({ t: "p", v: c, line }); i++; continue; }
    fail(`unexpected "${c}"`);
  }
  return out;
}

type Call = { fn: string; args: unknown[]; kw: Record<string, unknown>; line: number };

/** The form file's FORM, DEFAULTS and PDF_NAME. Throws an Error ("Line 12: ...") at the first thing it can't read. */
export function readFormFile(src: string): ReadForm {
  const toks = tokens(src);
  const env: Record<string, unknown> = { ...LISTS };
  let k = 0;
  const peek = (n = 0) => toks[k + n];
  const line = () => (toks[k] ?? toks[toks.length - 1])?.line ?? 1;
  const fail = (msg: string): never => { throw new Error(`Line ${line()}: ${msg}`); };
  const is = (v: string, n = 0) => peek(n)?.v === v && peek(n)?.t !== "str";
  const eat = (v: string) => { if (!is(v)) fail(`expected "${v}"${peek() ? ` but found "${peek()!.v}"` : " at the end"}`); k++; };
  const list = <T>(close: string, item: () => T) => {
    const out: T[] = [];
    while (peek() && !is(close)) { out.push(item()); if (is(",")) k++; else break; }
    eat(close);
    return out;
  };

  const atom = (): unknown => {
    const tok = toks[k++];
    if (!tok) return fail("the code ends too early");
    if (tok.t === "str") { let s = tok.v; while (peek()?.t === "str") s += toks[k++].v; return s; }
    if (tok.t === "num") return Number(tok.v);
    if (tok.v === "-" && peek()?.t === "num") return -Number(toks[k++].v);
    if (tok.v === "[") return list("]", expr);
    if (tok.v === "(") { const items = list(")", expr); return items.length === 1 && toks[k - 2]?.v !== "," ? items[0] : items; }
    if (tok.v === "{") return Object.fromEntries(list("}", () => { const key = expr(); eat(":"); return [String(key), expr()]; }));
    if (tok.t !== "name") return fail(`unexpected "${tok.v}"`);
    if (tok.v === "True") return true;
    if (tok.v === "False") return false;
    if (tok.v === "None") return null;
    if (!is("(")) return tok.v in env ? structuredClone(env[tok.v]) : fail(`unknown name "${tok.v}"`);
    k++;
    const call: Call = { fn: tok.v, args: [], kw: {}, line: tok.line };
    list(")", () => {
      if (is("*")) { k++; const v = expr(); if (!Array.isArray(v)) fail("* spreads a list"); call.args.push(...(v as unknown[])); return; }
      if (peek()?.t === "name" && is("=", 1)) { const key = toks[k].v; k += 2; call.kw[key] = expr(); }
      else if (Object.keys(call.kw).length) fail("a value without a name follows a named one (e.g. required=True)");
      else call.args.push(expr());
    });
    return helper(call);
  };
  const term = (): unknown => {
    let v = atom();
    while (is("[")) {
      k++;
      if (!Array.isArray(v)) fail("only a list can be looked up with [...]");
      const from = is(":") ? 0 : expr();
      if (is(":")) { // a slice: list[1:], list[:2], list[1:3]
        k++;
        const to = is("]") ? undefined : expr();
        eat("]");
        if (typeof from !== "number" || (to !== undefined && typeof to !== "number")) fail("a slice takes numbers, like [1:]");
        v = (v as unknown[]).slice(from as number, to as number | undefined);
        continue;
      }
      eat("]");
      if (typeof from !== "number") fail("only list[number] can be looked up");
      const arr = v as unknown[], i = from as number;
      v = arr[i < 0 ? arr.length + i : i];
      if (v === undefined) fail(`there is no item ${i} in that list`);
    }
    return v;
  };
  const expr = (): unknown => {
    let v = term();
    while (is("+")) {
      k++;
      const w = term();
      if (Array.isArray(v) && Array.isArray(w)) v = [...v, ...w];
      else if (typeof v === "string" && typeof w === "string") v += w;
      else if (typeof v === "number" && typeof w === "number") v += w;
      else fail("+ joins two lists or two texts");
    }
    return v;
  };

  while (peek()) {
    const tok = peek()!;
    if (tok.t === "str") { atom(); continue; } // the docstring
    if (tok.t === "name" && (tok.v === "from" || tok.v === "import")) { // nothing to do: the helpers are built in
      const dotted = () => { do { if (peek()?.t !== "name") fail("expected a name"); k++; } while (is(".") && ++k); };
      k++;
      if (tok.v === "from") { dotted(); eat("import"); }
      const paren = is("(") && ++k;
      do { if (is(",")) k++; if (paren && is(")")) break; dotted(); } while (is(","));
      if (paren) eat(")");
      continue;
    }
    if (tok.t === "name" && is("=", 1)) { k += 2; env[tok.v] = expr(); continue; }
    if (tok.t === "name" && ["def", "for", "while", "if", "class", "lambda"].includes(tok.v))
      fail(`"${tok.v}" is not supported in the studio's editor. Write the questions out one per line (the studio's Form file does), or build this form with lc-form.`);
    fail(`can't read "${tok.v}" here: a form file only holds imports and NAME = ... lines`);
  }

  const form = env.FORM as (Template & Record<string, unknown>) | undefined;
  if (!form || typeof form !== "object" || Array.isArray(form)) throw new Error('No "FORM = {...}" in the code.');
  if (typeof form.title !== "string") throw new Error('FORM has no "title".');
  if (!Array.isArray(form.sections)) throw new Error('FORM has no "sections": [...].');
  const defaults = (env.DEFAULTS ?? {}) as Values;
  if (typeof defaults !== "object" || Array.isArray(defaults)) throw new Error("DEFAULTS must be {...}.");
  return { template: form, defaults, ...(typeof env.PDF_NAME === "string" ? { pdfName: env.PDF_NAME } : {}) };
}

const KINDS: Kind[] = ["text", "long", "date", "radio", "checks", "check", "select"];

/** build.py's helpers: what each returns, the same dicts and lists as in Python. */
function helper({ fn, args, kw, line }: Call): unknown {
  const fail = (msg: string): never => { throw new Error(`Line ${line}: ${fn}(): ${msg}`); };
  const str = (v: unknown, what: string) => (typeof v === "string" ? v : fail(`${what} must be text in quotes`));
  const count = (n: number) => { if (args.length !== n) fail(`takes ${n} value${n === 1 ? "" : "s"} before the named ones, not ${args.length}`); };
  if (KINDS.includes(fn as Kind)) {
    count(fn === "radio" ? 3 : 2);
    const f: Record<string, unknown> = { id: str(args[0], "the id"), label: str(args[1], "the label"), kind: fn };
    if (fn === "text") f.half = true;
    if (fn === "radio") f.options = args[2];
    return { ...f, ...kw } as unknown as Field;
  }
  if (fn === "section") {
    count(1);
    return { title: str(args[0], "the title"), ...kw } as Section;
  }
  if (Object.keys(kw).length) fail(`takes no named values (${Object.keys(kw)[0]}=)`);
  const rule = (r: Rule) => [r];
  switch (fn) {
    case "when": return rule({ field: str(args[0], "the question's id"), values: args.slice(1).map(v => str(v, "each value")) });
    case "ticked": count(1); return rule({ field: str(args[0], "the question's id"), values: ["true"] });
    case "answered": count(1); return rule({ field: str(args[0], "the question's id"), values: [""], not: true });
    case "not_before": case "after": count(3);
      return { t: "order", a: str(args[0], "the later date"), b: str(args[1], "the earlier date"), s: fn === "after" ? 1 : 0, m: str(args[2], "the message") } as Check;
    case "in_range": count(4); return { t: "range", a: str(args[0], "the id"), lo: args[1], hi: args[2], m: str(args[3], "the message") } as Check;
    case "account_length": count(4); return { t: "lengths", a: str(args[0], "the id"), b: args[1] as string, by: args[2], m: str(args[3], "the message") } as Check;
  }
  return fail(`unknown: use section, ${KINDS.join(", ")}, when, ticked, answered, not_before, after, in_range or account_length`);
}
