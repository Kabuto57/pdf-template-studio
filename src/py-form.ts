// READING A FORM WRITTEN IN PYTHON
// The studio's code editor holds the form as Python (FORM = form(..., sections=[section("...", text(...), ...)])),
// the same code build_form.py runs. This reads that code back into a form, so editing the code changes the form.
// It understands only what that code uses: calls of form / section / text / long / date / radio / checks / check /
// select / when, strings, numbers, True / False / None, lists, dicts and # comments. Anything else is an error that
// says where.
import type { Field, Kind, Rule, Section, Template, Values } from "./pdf";

type Tok = { t: "name" | "num" | "str" | "p"; v: string; line: number };

function tokens(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0, line = 1;
  const fail = (msg: string) => { throw new Error(`Line ${line}: ${msg}`); };
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "#") { while (i < src.length && src[i] !== "\n") i++; continue; }
    const name = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (name) { out.push({ t: "name", v: name[0], line }); i += name[0].length; continue; }
    const num = /^-?\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: num[0], line }); i += num[0].length; continue; }
    if (c === '"' || c === "'") {
      const ESC: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
      let j = i + 1, text = "";
      while (j < src.length && src[j] !== c) {
        if (src[j] === "\n") fail("a text in quotes isn't closed");
        if (src[j] !== "\\") { text += src[j++]; continue; }
        const e = src[j + 1];
        if (e === "u" && /^[0-9a-fA-F]{4}$/.test(src.slice(j + 2, j + 6))) { text += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16)); j += 6; }
        else { text += ESC[e] ?? `\\${e}`; j += 2; }
      }
      if (j >= src.length) fail("a text in quotes isn't closed");
      out.push({ t: "str", v: text, line });
      i = j + 1;
      continue;
    }
    if ("()[]{},=:".includes(c)) { out.push({ t: "p", v: c, line }); i++; continue; }
    fail(`unexpected "${c}"`);
  }
  return out;
}

type Call = { fn: string; args: unknown[]; kw: Record<string, unknown>; line: number };

function parse(src: string) {
  const toks = tokens(src);
  let k = 0;
  const peek = () => toks[k], line = () => (toks[k] ?? toks[toks.length - 1])?.line ?? 1;
  const fail = (msg: string): never => { throw new Error(`Line ${line()}: ${msg}`); };
  const eat = (v: string) => { if (peek()?.v !== v || peek()?.t === "str") fail(`expected "${v}"${peek() ? ` but found "${peek().v}"` : " at the end"}`); k++; };
  const list = <T>(close: string, item: () => T) => {
    const out: T[] = [];
    while (peek() && peek().v !== close) { out.push(item()); if (peek()?.v === ",") k++; else break; }
    eat(close);
    return out;
  };
  const value = (): unknown => {
    const tok = toks[k++];
    if (!tok) return fail("the code ends too early");
    if (tok.t === "str") return tok.v;
    if (tok.t === "num") return Number(tok.v);
    if (tok.t === "p" && tok.v === "[") return list("]", value);
    if (tok.t === "p" && tok.v === "{") return Object.fromEntries(list("}", () => { const key = value(); eat(":"); return [String(key), value()]; }));
    if (tok.t === "name") {
      if (tok.v === "True") return true;
      if (tok.v === "False") return false;
      if (tok.v === "None") return null;
      if (peek()?.v !== "(") return fail(`unknown name "${tok.v}"`);
      k++;
      const call: Call = { fn: tok.v, args: [], kw: {}, line: tok.line };
      list(")", () => {
        if (peek()?.t === "name" && toks[k + 1]?.v === "=") { const key = toks[k].v; k += 2; call.kw[key] = value(); }
        else if (Object.keys(call.kw).length) fail("a value without a name follows a named one (e.g. half=True)");
        else call.args.push(value());
      });
      return evaluate(call);
    }
    return fail(`unexpected "${tok.v}"`);
  };
  while (peek() && !(peek().t === "name" && peek().v === "FORM" && toks[k + 1]?.v === "=")) k++;
  if (!peek()) throw new Error('No "FORM = form(...)" in the code.');
  k += 2;
  const form = value();
  if (peek()) fail(`unexpected "${peek().v}" after the form`);
  return form;
}

const KINDS: Kind[] = ["text", "long", "date", "radio", "checks", "check", "select"];

/** What each function returns: the same as build_form.py's functions of the same name. */
function evaluate({ fn, args, kw, line }: Call): unknown {
  const fail = (msg: string): never => { throw new Error(`Line ${line}: ${fn}(): ${msg}`); };
  const str = (v: unknown, what: string) => (typeof v === "string" ? v : fail(`${what} must be text in quotes`));
  if (fn === "when") {
    const { not_, ...rest } = kw;
    if (Object.keys(rest).length) fail(`unknown option ${Object.keys(rest)[0]}`);
    return { field: str(args[0], "the field"), values: args.slice(1).map(v => str(v, "each value")), ...(not_ ? { not: true } : {}) } as Rule;
  }
  if (fn === "section") {
    const fields = args.slice(1);
    if (!fields.every(f => f && typeof f === "object" && "kind" in (f as object))) fail("after the title, list the questions: text(...), date(...), ...");
    return { title: str(args[0], "the title"), fields: fields as Field[], ...kw } as Section;
  }
  if (fn === "form") {
    const [title = kw.title, sections = kw.sections, note = kw.note ?? ""] = args;
    if (!Array.isArray(sections)) fail("sections=[...] is missing");
    const { title: _t, sections: _s, note: _n, ...more } = kw;
    return { title: str(title, "the title"), note, sections, ...more };
  }
  if (KINDS.includes(fn as Kind)) {
    const [id = kw.id, label = kw.label, options = kw.options] = args;
    const { id: _i, label: _l, options: _o, ...more } = kw;
    if (options != null && !(Array.isArray(options) && options.every(o => typeof o === "string"))) fail('options must be a list of texts, e.g. ["Yes", "No"]');
    if (/^(radio|checks|select)$/.test(fn) && !options) fail('needs its options, e.g. ["Yes", "No"]');
    const key = str(id, "the key");
    if (!/^\w+$/.test(key)) fail(`the key "${key}" may only have letters, digits and _`);
    return { id: key, label: str(label, "the label"), kind: fn as Kind, ...(options ? { options } : {}), ...more } as Field;
  }
  return fail(`unknown function: use form, section, when, or ${KINDS.join(", ")}`);
}

/** The form and its starting answers, from the editor's Python. Throws an Error ("Line 12: ...") if it can't. */
export function readPythonForm(src: string): { template: Template; values: Values } {
  const form = parse(src) as Template & { defaults?: Values };
  if (!form || typeof form !== "object" || !Array.isArray(form.sections)) throw new Error("FORM must be form(title=..., sections=[...])");
  const keys = form.sections.flatMap(s => s.fields.map(f => f.id));
  const twice = keys.find((k, i) => keys.indexOf(k) !== i);
  if (twice) throw new Error(`Two questions have the key "${twice}": each needs its own.`);
  const { defaults = {}, ...template } = form;
  return { template: template as Template, values: defaults };
}
