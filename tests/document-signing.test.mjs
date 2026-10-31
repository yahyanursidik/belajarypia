import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

test("document signing preserves RFC 4231 HMAC for ArrayBuffer and offset typed-array keys", async () => {
  const source = await readFile(new URL("../supabase/functions/document-signed-url/index.ts", import.meta.url), "utf8");
  const hmac = source.slice(source.indexOf("async function hmac("), source.indexOf("async function hmacHex("));
  const code = ts.transpileModule(`const encoder = new TextEncoder();\n${hmac}\nexport { hmac };`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = new vm.SourceTextModule(code, { context: vm.createContext({ crypto, TextEncoder, Uint8Array, ArrayBuffer }) });
  await module.link(() => {}); await module.evaluate();
  const key = new Uint8Array(20).fill(0x0b);
  const offset = new Uint8Array(30).fill(0xff); offset.set(key, 5);
  for (const input of [key, key.buffer, offset.subarray(5, 25)]) {
    assert.equal(Buffer.from(await module.namespace.hmac(input, "Hi There")).toString("hex"), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  }
});
