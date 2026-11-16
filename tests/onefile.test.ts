// public/build_lc_application.py: the one-file LC builder (the form, the builder and every Acrobat script in one file),
// for building the JavaScript LC on a machine with only Python. It must match the source; regenerate with
// ONEFILE=1 npx vitest run tests/onefile
import { expect, it } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { oneFile } from "../src/code-view";
import { LC } from "../src/lc";

it("the published one-file LC builder matches the source", () => {
  const now = oneFile({ issuer: "Demo Bank · Trade Services", ...LC.template, design: "new" }, LC.defaults);
  if (process.env.ONEFILE) writeFileSync("public/build_lc_application.py", now);
  expect(readFileSync("public/build_lc_application.py", "utf8")).toBe(now);
});
