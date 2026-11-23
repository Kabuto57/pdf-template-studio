// The studio's exported form file, loaded by lc-form's own Python, gives back exactly the form it came from.
// Needs the lc-form project next to this one (with its .venv); skipped without it (e.g. on GitHub's CI).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SMART_FORMS } from "../src/canvas/forms";
import { formFile } from "../src/canvas/form-file";

const LC_FORM = process.env.LC_FORM ?? join(homedir(), "Documents/lc-form");
const PY = join(LC_FORM, ".venv/bin/python");
const LOAD = `
import importlib.util, json, sys
sys.path[:0] = [sys.argv[1], sys.argv[2] + "/forms", sys.argv[1]]
from build import check_form
from layout import FORMATS
out = {}
for path in sys.argv[3:]:
    spec = importlib.util.spec_from_file_location("f", path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    check_form(m.FORM, m.DEFAULTS, FORMATS)
    out[path.split("/")[-1]] = {"form": m.FORM, "defaults": m.DEFAULTS, "pdfName": getattr(m, "PDF_NAME", None)}
print(json.dumps(out))
`;

describe.skipIf(!existsSync(PY))("exported form files", () => {
  it("load in lc-form and give back the same forms", () => {
    const dir = mkdtempSync(join(tmpdir(), "forms-"));
    const paths = SMART_FORMS.map(f => {
      const path = join(dir, f.file);
      writeFileSync(path, formFile(f.form, f.defaults, f.pdfName ?? undefined, f.file));
      return path;
    });
    const back = JSON.parse(execFileSync(PY, ["-c", LOAD, dir, LC_FORM, ...paths], { encoding: "utf8", cwd: LC_FORM }));
    for (const f of SMART_FORMS) expect(back[f.file], f.file).toEqual({ form: f.form, defaults: f.defaults, pdfName: f.pdfName });
  }, 30000);
});
