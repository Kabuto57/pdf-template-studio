// The fill page in a real browser (Chromium through Playwright). Skipped cleanly when Playwright (or its browser) is not installed,
// e.g. on GitHub's CI: the repo does not depend on it. Locally: PLAYWRIGHT_DIR=<a folder with node_modules/playwright> (default:
// ~/Documents/template-studio) or `npm i --no-save playwright && npx playwright install chromium`.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { codesIn, joinCodes } from "../../src/qr-read";

/* eslint-disable @typescript-eslint/no-explicit-any */
function load(): any {
  for (const dir of [process.env.PLAYWRIGHT_DIR, join(homedir(), "Documents/template-studio")]) {
    if (!dir || !existsSync(join(dir, "node_modules/playwright"))) continue;
    try { return createRequire(join(dir, "package.json"))("playwright"); } catch { /* try the next */ }
  }
  try { return createRequire(import.meta.url)("playwright"); } catch { return undefined; }
}
const pw = load();
let browser: any;
if (pw) browser = await pw.chromium.launch().catch(() => undefined);

describe.skipIf(!browser)("the fill page in Chromium", () => {
  let server: ViteDevServer, url: string;
  beforeAll(async () => {
    server = await createServer({ server: { port: 0, host: "127.0.0.1" }, logLevel: "silent" });
    await server.listen();
    url = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}/fill/index.html`;
  });
  afterAll(async () => { await browser?.close(); await server?.close(); });

  async function open(file = "Irrevocable Documentary Credit Application") {
    const page = await (await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 3 })).newPage();
    const errors: string[] = [], external: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(String(e)));
    page.on("request", (r: { url(): string }) => { if (!r.url().startsWith("http://127.0.0.1")) external.push(r.url()); });
    await page.goto(url);
    await page.check("#accept");
    await page.click(`text=${file}`);
    await page.waitForSelector(".pg");
    return { page, errors, external };
  }
  /** The LC's own sample answers, typed in the way a customer would. */
  async function fillLc(page: any) {
    // a string, so vitest does not rewrite the import for node
    const { qs, s } = await page.evaluate(`import("/src/lc.ts").then(m => ({ qs: m.LC.template.sections.flatMap(x => x.fields), s: m.LC_SAMPLE }))`);
    for (const q of qs) {
      const v = s[q.id], box = page.locator(`[name="${q.id}"]`);
      if (v === undefined || v === "" || v === false) continue;
      if (q.kind === "check") await box.check();
      else if (q.kind === "radio") await box.nth(q.options.indexOf(v)).check();
      else if (q.kind === "checks") for (const o of v) await page.locator(`[name="${q.id}__${q.options.indexOf(o)}"]`).check();
      else if (q.kind === "select") await box.selectOption(v);
      else { await box.first().pressSequentially(v.replace(/\n/g, " ")); await box.first().press("Tab"); }
    }
    // lc-form's LC has a Port box for the port choices ("Port of ..."): the sample's place (src/lc.ts's one box) goes there
    for (const side of ["shipment_from", "shipment_to"]) {
      const port = page.locator(`[name="${side}_port"]`).first();
      await port.pressSequentially(s[`${side}_place`]);
      await port.press("Tab");
    }
  }
  const dialogText = (page: any) => page.textContent("dialog.msg[open] p");
  const ok = (page: any) => page.locator("dialog.msg[open] button.primary").click();
  const hasCancel = (page: any) => page.locator("dialog.msg[open] button:not(.primary)").isVisible();

  it("Reset form asks yes / no first, then clears the answers and the QR code", async () => {
    const { page, errors, external } = await open();
    await fillLc(page);
    await page.locator(".pg").last().scrollIntoViewIfNeeded();
    await page.click("button:text('Generate QR Code')");
    await ok(page);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBeGreaterThan(0);
    await page.click(".toolbar button:text('Reset form')");
    expect(await dialogText(page)).toBe("Are you sure you want to reset the form? All your answers will be cleared.");
    expect(await hasCancel(page)).toBe(true); // a question, not an OK-only message
    await ok(page);
    await page.waitForTimeout(300);
    expect(await page.inputValue('[name="applicant_name"]')).toBe("");
    expect(await page.locator(".qr svg").count()).toBe(0);
    expect(await page.locator("dialog.msg[open]").count()).toBe(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  }, 60000);

  it("Cancel keeps the answers; two questions in a row both work (Reset form twice); Main menu keeps the answers", async () => {
    const { page } = await open();
    await page.fill('[name="applicant_name"]', "ACME");
    await page.click(".toolbar button:text('Reset form')");
    await page.locator("dialog.msg[open] button:not(.primary)").click();
    await page.waitForTimeout(300);
    expect(await page.inputValue('[name="applicant_name"]')).toBe("ACME");
    await page.click(".toolbar button:text('Reset form')");
    await ok(page);
    await page.waitForTimeout(300);
    expect(await page.inputValue('[name="applicant_name"]')).toBe("");
    await page.fill('[name="applicant_name"]', "ACME");
    await page.click(".toolbar button:text('Main menu')"); // no question, nothing cleared
    await page.waitForSelector(".menu");
    expect(await page.locator("dialog.msg[open]").count()).toBe(0);
    expect(await page.locator(".pg").count()).toBe(0);
    expect(await page.isChecked("#accept")).toBe(true);
    await page.locator(".entry").first().click(); // the same form again: its answers are still there
    await page.waitForSelector(".pg");
    expect(await page.inputValue('[name="applicant_name"]')).toBe("ACME");
  }, 60000);

  it("a message, then a question straight after it, still asks", async () => {
    const { page } = await open();
    await page.click(".toolbar button:text('Check form')");
    await ok(page);
    await page.click(".toolbar button:text('Reset form')");
    expect(await hasCancel(page)).toBe(true);
    await ok(page);
    await page.click(".toolbar button:text('Main menu')");
    await page.waitForSelector(".menu");
  }, 60000);

  it("the most characters of a box hold when the keystroke script makes capitals: typed and inserted (pasted)", async () => {
    const { page } = await open();
    const box = page.locator('[name="applicant_name"]');
    await box.click();
    await page.keyboard.type("a".repeat(60));
    expect(await box.inputValue()).toBe("A".repeat(35));
    await box.fill("");
    await box.click();
    await page.keyboard.insertText("b".repeat(60));
    expect(await box.inputValue()).toBe("B".repeat(35));
    await box.fill("");
    await page.keyboard.insertText("c".repeat(30));
    await page.keyboard.insertText("d".repeat(30));
    expect(await box.inputValue()).toBe("C".repeat(30) + "D".repeat(5));
    await page.keyboard.press("Tab");
    await page.click(".toolbar button:text('Check form')");
    expect(await dialogText(page)).not.toContain("Applicant's name");
  }, 60000);

  it("Generate QR Code, then the codes decode (zxing) to the form's answers", async () => {
    const { page } = await open();
    await fillLc(page);
    await page.click(".toolbar button:text('Check form')");
    expect(await dialogText(page)).toMatch(/^All mandatory questions are answered/);
    await ok(page);
    await page.locator(".pg").last().scrollIntoViewIfNeeded();
    await page.click("button:text('Generate QR Code')");
    await ok(page);
    const shots = [];
    for (const svg of await page.locator(".qr:not([hidden]) svg").all()) shots.push(new Blob([await svg.screenshot()]));
    const codes = (await Promise.all(shots.map(b => codesIn(b)))).flat();
    const payload = joinCodes(codes)!;
    expect(payload.form).toBe("LC-01");
    expect(payload.complete).toBe(true);
    expect(payload.data.applicant_name).toBeTruthy();
  }, 90000);

  it("printing: no toolbar or buttons; no QR code (or a stale one) says so, on the page and in the printout", async () => {
    const { page } = await open();
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".toolbar").isVisible()).toBe(false);
    expect(await page.locator("button.sec").first().isVisible()).toBe(false);
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint"))); // what Ctrl+P / the browser's Print menu does first
    await ok(page); // the PDF's own "Before printing" warning
    await page.emulateMedia({ media: "print" });
    const note = page.locator(".nocode");
    expect(await note.isVisible()).toBe(true);
    expect(await note.textContent()).toContain("NO VALID QR CODE");
    expect(await note.textContent()).toContain("Please press Generate QR Code first");
    await page.emulateMedia({ media: "screen" });
    await fillLc(page);
    await page.click("button:text('Generate QR Code')");
    await ok(page);
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    expect(await page.locator(".nocode").isVisible()).toBe(false);
    await page.fill('[name="applicant_name"]', "SOMEONE ELSE");
    await page.keyboard.press("Tab");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    expect(await page.locator(".nocode").isVisible()).toBe(true);
    expect(await page.locator(".nocode").textContent()).toContain("answers have changed");
  }, 90000);

  it("a stale two-code LC prints no decodable code at all (both old codes are hidden, not just the first)", async () => {
    const { page } = await open();
    await fillLc(page);
    await page.click("button:text('Generate QR Code')");
    expect(await dialogText(page)).toMatch(/need 2 QR codes, so 2 codes have been generated/);
    await ok(page);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(2);
    await page.fill('[name="applicant_name"]', "SOMEONE ELSE");
    await page.keyboard.press("Tab");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".nocode").isVisible()).toBe(true);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(0);
    await page.emulateMedia({ media: "screen" });
    // generating again brings the codes back
    await page.click("button:text('Generate QR Code')");
    await ok(page);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(2);
    expect(await page.locator(".nocode").isVisible()).toBe(false);
  }, 90000);

  it("a 9,000-character application: 4 codes (2 on the QR page, 2 on one extra page), the extra page goes when the answers shrink; the codes decode", async () => {
    const { page, errors } = await open();
    await fillLc(page);
    const long = (id: string, text: string) => page.fill(`[name="${id}"]`, text).then(() => page.keyboard.press("Tab"));
    await long("goods_description", "STEEL FITTINGS GRADE 316. ".repeat(230).slice(0, 4300));
    await long("additional_conditions", "NO TRANSHIPMENT OF THE GOODS. ".repeat(100).slice(0, 1800));
    const formPages = await page.locator(".pg").count();
    await page.click("button:text('Generate QR Code')");
    const said = await dialogText(page);
    expect(said).toMatch(/need 4 QR codes, so 4 codes have been generated: two on the QR code page and the rest, two to a page, on the 1 page after it/);
    await ok(page);
    expect(await page.locator(".pg").count()).toBe(formPages + 1);
    expect(await page.locator(".pg.extra .qr:not([hidden]) svg").count()).toBe(2);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(4);
    const shots = [];
    for (const svg of await page.locator(".qr:not([hidden]) svg").all()) shots.push(new Blob([await svg.screenshot()]));
    const payload = joinCodes((await Promise.all(shots.map(b => codesIn(b)))).flat())!;
    expect(payload.complete).toBe(true);
    expect(payload.data.goods_description).toBe("STEEL FITTINGS GRADE 316. ".repeat(230).slice(0, 4300).trim());
    // printing: the extra page is part of the printout while its codes are valid
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".pg").count()).toBe(formPages + 1);
    await page.emulateMedia({ media: "screen" });
    // a stale printout has no extra page: nothing scannable is left
    await page.fill('[name="applicant_name"]', "SOMEONE ELSE");
    await page.keyboard.press("Tab");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    expect(await page.locator(".pg.extra").count()).toBe(0);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(0);
    await page.emulateMedia({ media: "screen" });
    // shorter answers: one code, no extra page
    await long("goods_description", "STEEL FITTINGS");
    await long("additional_conditions", "NONE");
    await page.click("button:text('Generate QR Code')");
    expect(await dialogText(page)).toContain("has been generated");
    await ok(page);
    expect(await page.locator(".pg").count()).toBe(formPages);
    expect(await page.locator(".qr:not([hidden]) svg").count()).toBe(1);
    expect(errors).toEqual([]);
  }, 120000);

  it("two messages queued back to back: the second is not dismissed by the first one's late close event", async () => {
    const { page } = await open();
    // the page's own queue (same module instance as the page uses)
    await page.evaluate(`import("/src/fill/ui.ts").then(m => { window.__done = []; m.say("FIRST"); m.confirm("SECOND").then(v => window.__done.push(v)); })`);
    expect(await dialogText(page)).toBe("FIRST");
    await ok(page);
    await page.waitForTimeout(400); // long enough for the first box's asynchronous close event to arrive
    expect(await dialogText(page)).toBe("SECOND");
    expect(await page.evaluate("window.__done")).toEqual([]);
    await ok(page);
    await page.waitForTimeout(200);
    expect(await page.evaluate("window.__done")).toEqual([true]);
  }, 60000);

  it("leaving a date box with a date that does not exist says so and keeps the old answer", async () => {
    const { page } = await open();
    const box = page.locator('[name="application_date"]');
    await box.fill("15/06/2026");
    await page.keyboard.press("Tab");
    await box.fill("31/02/2026");
    await page.keyboard.press("Tab");
    expect(await dialogText(page)).toContain("should match format dd/mm/yyyy");
    await ok(page);
    expect(await box.inputValue()).toBe("15/06/2026");
  }, 60000);
});
