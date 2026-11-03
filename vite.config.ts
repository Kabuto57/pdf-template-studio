import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const page = (f: string) => fileURLToPath(new URL(f, import.meta.url));

// Nothing loads or is sent anywhere except the site itself; the preview is drawn on canvases.
const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' blob: data:",
  "font-src 'self' data: blob:", "connect-src 'self'", "base-uri 'none'", "form-action 'none'",
].join("; ");
const csp = (): Plugin => ({
  name: "csp",
  apply: "build", // the dev server needs inline scripts and a websocket
  transformIndexHtml: html => html.replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
});

export default defineConfig({
  base: "./",
  plugins: [csp()],
  build: {
    target: "es2022", chunkSizeWarningLimit: 1500,
    // The demo guide, the bank's website (demo-bank/), the customer's email (customer-mail/), the ops workbench (trade-ops/), and the studio.
    rollupOptions: { input: { index: page("index.html"), bank: page("demo-bank/index.html"), mail: page("customer-mail/index.html"), ops: page("trade-ops/index.html"), studio: page("studio.html") } },
  }, // pdf.js is ~1 MB, loaded only when a PDF needs it
  test: { include: ["tests/**/*.test.ts", "scripts/**/*.test.ts"], alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }] },
});
