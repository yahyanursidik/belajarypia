import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] ?? "all";
if (!["all", "unit", "sql"].includes(mode)) throw new Error("Pilih all, unit, atau sql.");
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .filter((name) => {
    const sql = /PGLITE_MODULE|@electric-sql\/pglite/.test(readFileSync(new URL(`../tests/${name}`, import.meta.url), "utf8"));
    return mode === "all" || (mode === "sql" ? sql : !sql);
  })
  .map((name) => `tests/${name}`);
if (!files.length) throw new Error("Tidak ada pengujian yang dipilih.");
// Edge Function fixtures link Deno imports into an isolated VM without network access.
const result = spawnSync(process.execPath, ["--experimental-vm-modules", "--test", "--test-concurrency=1", ...files], {
  cwd: root, stdio: "inherit", env: process.env,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
