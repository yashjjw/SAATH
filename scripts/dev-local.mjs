// Local dev server: serves public/ and runs api/*.ts handlers, without the Vercel CLI.
// Usage: npm run dev:local   (compiles to .devbuild/, then serves on http://localhost:3000)
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Load .env.local (real environment variables win over the file).
try { process.loadEnvFile(".env.local"); } catch { console.warn("No .env.local found; copy .env.example to .env.local"); }

const PORT = Number(process.env.PORT ?? 3000);
const OUT = ".devbuild";
execSync(`npx tsc --noEmit false --outDir ${OUT} --declaration false`, { stdio: "inherit" });
execSync(`echo '{"type":"module"}' > ${OUT}/package.json`);
process.env.CHAT_TEST_PASSWORD ??= "local";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

function wrap(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(o)); return res; };
  res.send = (b) => { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, "");
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      req.body = /json/.test(req.headers["content-type"] ?? "") ? JSON.parse(raw || "{}")
        : Object.fromEntries(new URLSearchParams(raw));
      const mod = await import(pathToFileURL(join(process.cwd(), OUT, "api", `${name}.js`)).href).catch(() => null);
      if (!mod) { res.statusCode = 404; return res.end("no such function"); }
      return await mod.default(req, wrap(res));
    }
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const body = await readFile(join("public", file)).catch(() => null);
    if (!body) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
    res.end(body);
  } catch (e) {
    console.error(e); res.statusCode = 500; res.end("server error");
  }
}).listen(PORT, () => console.log(`SAATH local: http://localhost:${PORT}  (test password: ${process.env.CHAT_TEST_PASSWORD})`));
