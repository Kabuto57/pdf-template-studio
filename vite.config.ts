import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Nothing loads or is sent anywhere except the site itself; the preview is a blob: PDF in a frame.
const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' blob: data:",
  "frame-src blob:", "object-src blob:", "connect-src 'self'", "base-uri 'none'", "form-action 'none'",
].join("; ");
const csp = (): Plugin => ({
  name: "csp",
  apply: "build", // the dev server needs inline scripts and a websocket
  transformIndexHtml: html => html.replace("<head>", `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`),
});

export default defineConfig({
  base: "./",
  plugins: [csp()],
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
});
