// Produces .vercel/output (Vercel Build Output API v3):
//   static/            the built client (from `vite build`)
//   functions/api.func one bundled Node function serving /api/*
// Bundling ourselves avoids depending on how Vercel compiles TypeScript.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";

const out = ".vercel/output";
if (!existsSync("dist/client/index.html")) throw new Error("Run `vite build` first (dist/client missing).");
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/static`, { recursive: true });
cpSync("dist/client", `${out}/static`, { recursive: true });

const fn = `${out}/functions/api.func`;
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: ["src/server/vercel.ts"],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  logLevel: "warning",
  // Some dependencies are CommonJS and call require(); give the ESM bundle one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 60 }, null, 2),
);

writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: "^/api/(.*)$", dest: "/api?__path=$1" },
        { src: "^/assets/(.*)$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
        { handle: "filesystem" },
        { src: "^/(.*)$", dest: "/index.html" },
      ],
    },
    null,
    2,
  ),
);
console.log("Built .vercel/output");
