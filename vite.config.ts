import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

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
  build: { target: "es2022", chunkSizeWarningLimit: 1500 }, // pdf.js is ~1 MB, loaded only when a PDF needs it
  test: { include: ["tests/**/*.test.ts", "scripts/**/*.test.ts"], alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }] },
});
