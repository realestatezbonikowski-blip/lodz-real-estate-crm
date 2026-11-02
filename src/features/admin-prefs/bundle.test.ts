// Keeps the full admin dictionaries out of the browser's JavaScript.
//
// Why this can break silently: a client component (forms.tsx) imports labels.ts; if labels.ts, or anything it
// imports, ever imports translate.ts / dictionary.ts / dict-*.ts at runtime, both complete dictionaries
// (about 35 KB of texts, including server-only ones) are shipped to every visitor. A bundler may hide the
// problem by tree-shaking an unused function, which is exactly how this was safe by accident before.
//
// Two checks:
//   1. SOURCE (always runs): follows the RUNTIME imports of every "use client" module through the
//      project's files and fails if it can reach a server-only translation module. Type-only imports are
//      erased by the compiler and are ignored. The detector is itself tested on a synthetic leak.
//      PROVES: the source cannot import the dictionaries into a browser module.
//      DOES NOT PROVE: what the bundler finally emits (that is check 2), or anything about third-party packages.
//   2. BUILD OUTPUT (runs only if a production build exists in .next): searches the browser chunks for texts
//      that exist only in the server-only part of the dictionaries.
//      PROVES: the build that happens to be in .next had no such text in its browser chunks.
//      DOES NOT PROVE: anything about a later build. It is skipped, not failed, when there is no build, so it
//      is a local check after `npm run build`, not a CI gate. A text that is a prop (the client subset) is
//      delivered in the page data, not in the chunks, so its absence from the chunks is expected.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, test } from "node:test";
import { dictionaries } from "./dictionary.ts";

const ROOT = process.cwd();
const norm = (p: string) => normalize(p).replaceAll("\\", "/");

/** Modules a browser must never reach at runtime: the full dictionaries and everything that reads them. */
const SERVER_ONLY = [
  "src/features/admin-prefs/translate.ts",
  "src/features/admin-prefs/dictionary.ts",
  "src/features/admin-prefs/dict-pl.ts",
  "src/features/admin-prefs/dict-en.ts",
  "src/features/admin-prefs/server.ts",
];

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const isClientModule = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(src);
const isServerActionModule = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(src);

/** Specifiers that survive compilation: `import type`, `export type` and imports made only of `type` members are erased. */
export function runtimeImports(source: string): string[] {
  const code = stripComments(source);
  const out: string[] = [];
  for (const m of code.matchAll(/\b(import|export)\s+(type\s+)?(?:([\w*${}\s,]*?)\s+from\s+)?["']([^"']+)["']/g)) {
    if (m[2]) continue; // import type / export type
    const clause = (m[3] ?? "").trim();
    const named = /^(?:[\w$]+\s*,\s*)?\{([\s\S]*)\}$/.exec(clause)?.[1];
    if (named !== undefined && !/^[\w$]+\s*,/.test(clause)) {
      const members = named.split(",").map((x) => x.trim()).filter(Boolean);
      if (members.length > 0 && members.every((x) => x.startsWith("type "))) continue; // { type A, type B }
    }
    out.push(m[4]!);
  }
  for (const m of code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) out.push(m[1]!);
  return out;
}

/** Resolves a project import to a file key, or undefined for packages and files that do not exist. */
function resolveImport(from: string, spec: string, has: (p: string) => boolean): string | undefined {
  let base: string;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = norm(join(dirname(from), spec));
  else return undefined;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) if (has(cand)) return cand;
  return undefined;
}

/** For every client module: the server-only modules it can reach at runtime, with the path that gets there. */
export function leaks(files: Map<string, string>): string[] {
  const found: string[] = [];
  const has = (p: string) => files.has(p);
  for (const [entry, src] of files) {
    if (!isClientModule(src)) continue;
    const seen = new Set<string>([entry]);
    const queue: string[][] = [[entry]];
    while (queue.length) {
      const path = queue.shift()!;
      const here = path[path.length - 1]!;
      const text = files.get(here)!;
      if (here !== entry && isServerActionModule(text)) continue; // a client import of a server action is a network stub, not the module
      for (const spec of runtimeImports(text)) {
        const next = resolveImport(here, spec, has);
        if (!next || seen.has(next)) continue;
        seen.add(next);
        if (SERVER_ONLY.includes(next)) found.push([...path, next].join(" -> "));
        else queue.push([...path, next]);
      }
    }
  }
  return found;
}

function readProject(): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.set(norm(relative(ROOT, p)), readFileSync(p, "utf8"));
    }
  };
  walk(join(ROOT, "src"));
  return files;
}

describe("source: no browser module can reach the server-only translation modules", () => {
  const project = readProject();

  test("the project's real client modules are clean", () => {
    assert.deepEqual(leaks(project), []);
  });

  test("the scan really looked at the browser modules and followed their imports (guards against a vacuous pass)", () => {
    const clients = [...project].filter(([, s]) => isClientModule(s)).map(([f]) => f);
    for (const must of ["src/features/crm/components/forms.tsx", "src/features/admin-prefs/provider.tsx", "src/features/admin-prefs/controls.tsx", "src/app/admin/(app)/error.tsx"]) {
      assert.ok(clients.includes(must), `${must} must be recognised as a client module`);
    }
    // forms.tsx -> labels.ts is the link that used to lead to translate.ts
    assert.ok(runtimeImports(project.get("src/features/crm/components/forms.tsx")!).includes("../labels"));
    assert.ok(resolveImport("src/features/crm/components/forms.tsx", "../labels", (p) => project.has(p)) === "src/features/crm/labels.ts");
    // the client-safe translation core is reachable from the provider (so a leak through it would have been seen)
    assert.ok(runtimeImports(project.get("src/features/admin-prefs/provider.tsx")!).includes("./core.ts"));
  });

  test("labels.ts, the file browser components import, has type-only imports from the translation area", () => {
    const labels = project.get("src/features/crm/labels.ts")!;
    const fromAdminPrefs = runtimeImports(labels).filter((s) => s.includes("admin-prefs"));
    assert.deepEqual(fromAdminPrefs, [], "labels.ts must take `t` as an argument, not import the translator");
  });

  test("the detector itself: it flags a leak through an intermediate module, and ignores type-only imports and server actions", () => {
    const mk = (entries: Record<string, string>) => new Map(Object.entries(entries));
    const translate = "src/features/admin-prefs/translate.ts";
    assert.deepEqual(
      leaks(mk({ "src/a.tsx": `"use client";\nimport { x } from "./b";`, "src/b.ts": `import { createT } from "./features/admin-prefs/translate.ts";\nexport const x = createT;`, [translate]: "export const createT = 1;" })),
      ["src/a.tsx -> src/b.ts -> src/features/admin-prefs/translate.ts"],
    );
    assert.deepEqual(leaks(mk({ "src/a.tsx": `"use client";\nimport { y } from "@/features/admin-prefs/translate";`, [translate]: "" })), ["src/a.tsx -> src/features/admin-prefs/translate.ts"], "the @/ alias is followed");
    assert.deepEqual(leaks(mk({ "src/a.tsx": `"use client";\nimport type { T } from "./features/admin-prefs/translate.ts";\nimport { type U, type V } from "./features/admin-prefs/translate.ts";`, [translate]: "" })), [], "type-only imports are erased by the compiler");
    assert.deepEqual(leaks(mk({ "src/a.tsx": `"use client";\nimport { act } from "./actions";`, "src/actions.ts": `"use server";\nimport { createT } from "./features/admin-prefs/translate.ts";`, [translate]: "" })), [], "a server action is called over the network, its imports stay on the server");
    assert.deepEqual(leaks(mk({ "src/a.tsx": `"use client";\nimport { v, type W } from "./features/admin-prefs/translate.ts";`, [translate]: "" })).length, 1, "a mixed import still imports the module");
    assert.deepEqual(leaks(mk({ "src/server-page.tsx": `import { createT } from "./features/admin-prefs/translate.ts";`, [translate]: "" })), [], "server components may use the translator");
  });
});

describe("build output: browser chunks of the current production build (skipped when there is no build)", () => {
  const chunksDir = join(ROOT, ".next", "static");
  const have = existsSync(chunksDir);

  function chunkText(): string {
    const parts: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (name.endsWith(".js")) parts.push(readFileSync(p, "utf8"));
      }
    };
    walk(chunksDir);
    return parts.join("\n");
  }

  /** The longest plain stretch of a text (no placeholders, quotes or backslashes), long enough to be unique. */
  const sentinel = (text: string) => text.split(/[{}"'\\“”„]/).sort((a, b) => b.length - a.length)[0]!.trim();
  const asciiEscaped = (s: string) => s.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

  test("no server-only admin text is in the browser JavaScript", { skip: have ? false : "no production build in .next (run `npm run build` first)" }, () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    const prefixes = (/CLIENT_PREFIXES = \[([^\]]*)\]/.exec(layout)![1]!.match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
    const js = chunkText();

    // Positive controls: the files were read, and a string that IS bundled for the browser is found by the same search.
    assert.ok(js.length > 100_000, "browser chunks were found and read");
    assert.ok(js.includes("crm-theme"), "control: the theme cookie name (from prefs.ts, bundled for the toggle) must be found");

    const leaked: string[] = [];
    let checked = 0;
    for (const lang of ["pl", "en"] as const) {
      for (const [key, text] of Object.entries(dictionaries[lang] as Record<string, string>)) {
        if (prefixes.some((p) => key.startsWith(p))) continue; // these are sent to the browser on purpose, as page data
        const s = sentinel(text);
        if (s.length < 24) continue;
        checked++;
        if (js.includes(s) || js.includes(asciiEscaped(s))) leaked.push(`${lang} ${key}`);
      }
    }
    assert.ok(checked >= 100, `enough server-only texts were checked (${checked})`);
    assert.deepEqual(leaked, [], "server-only texts found in browser chunks: a client module imports the dictionaries again");
  });
});
