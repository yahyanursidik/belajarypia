import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import ts from "../node_modules/typescript/lib/typescript.js";
const id = "00000000-0000-4000-8000-000000000001";
async function fixture({
  allowed = true,
  selected = true,
  uploadOk = true,
  registerOk = true,
} = {}) {
  let handler;
  const calls = [];
  const asset = {
    object_key: `branding/${id}.png`,
    public_url: `https://project.supabase.co/functions/v1/settings-assets?asset=${id}`,
  };
  const ctx = vm.createContext({
    Request,
    Response,
    File,
    FormData,
    URL,
    Uint8Array,
    TextDecoder,
    crypto: webcrypto,
    Deno: { serve: (f) => (handler = f) },
    fetch: async (url, options) => {
      calls.push({ fetch: url, options });
      return new Response("", { status: uploadOk ? 200 : 500 });
    },
  });
  const createClient = (_url, _key, options) => ({
    auth: {
      getUser: async () => ({
        data: {
          user:
            options?.global?.headers?.Authorization === "Bearer valid"
              ? { id }
              : null,
        },
        error: null,
      }),
    },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      return {
        name,
        data:
          name === "settings_can_manage"
            ? allowed
            : { asset_id: args.p_id, url: args.p_url },
        error:
          name === "settings_register_brand_asset" && !registerOk
            ? Error("audit failed")
            : null,
      };
    },
    from: (name) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: asset, error: null }),
        limit: async () => ({
          data: [{ logo_url: selected ? asset.public_url : null }],
          error: null,
        }),
      };
      calls.push({ table: name });
      return q;
    },
  });
  const deps = {
    supabase: new vm.SyntheticModule(
      ["createClient"],
      function () {
        this.setExport("createClient", createClient);
      },
      { context: ctx },
    ),
    s3: new vm.SyntheticModule(
      ["requiredEnv", "createS3SignedUrl"],
      function () {
        this.setExport("requiredEnv", (n) =>
          n === "SUPABASE_URL" ? "https://project.supabase.co" : "fixture-key",
        );
        this.setExport("createS3SignedUrl", async (a) => {
          calls.push({ sign: a });
          return "https://s3.example.test/" + a.objectKey;
        });
      },
      { context: ctx },
    ),
  };
  const code = await readFile(
    new URL("../supabase/functions/settings-assets/index.ts", import.meta.url),
    "utf8",
  );
  const m = new vm.SourceTextModule(
    ts.transpileModule(code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
    { context: ctx },
  );
  await m.link((n) => (n.startsWith("https:") ? deps.supabase : deps.s3));
  await m.evaluate();
  return { calls, request: handler };
}
function upload(file, token = "valid") {
  const body = new FormData();
  body.append("file", file);
  return new Request(
    "https://project.supabase.co/functions/v1/settings-assets",
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    },
  );
}
const png = () =>
  new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])],
    "logo.png",
    { type: "image/png" },
  );
test("upload rejects absent/invalid auth and unauthorized roles before touching storage", async () => {
  const f = await fixture({ allowed: false });
  assert.equal((await f.request(upload(png(), null))).status, 401);
  assert.equal((await f.request(upload(png(), "invalid"))).status, 401);
  assert.equal((await f.request(upload(png()))).status, 403);
  assert.equal(
    f.calls.some((c) => c.sign),
    false,
  );
});
test("upload rejects disguised content, unsupported media and oversized files", async () => {
  const f = await fixture();
  for (const file of [
    new File(["not a png"], "logo.png", { type: "image/png" }),
    new File(["video"], "clip.mp4", { type: "video/mp4" }),
    new File([new Uint8Array(2097153)], "large.png", { type: "image/png" }),
  ])
    assert.equal((await f.request(upload(file))).status, 400);
  assert.equal(
    f.calls.some((c) => c.sign),
    false,
  );
});
test("verified images receive an immutable key; storage and registration failures never report success", async () => {
  const f = await fixture();
  const response = await f.request(upload(png()));
  assert.equal(response.status, 200);
  const r = await response.json();
  assert.ok(r.asset_id);
  assert.ok(f.calls.find((c) => c.sign).sign.objectKey.startsWith("branding/"));
  assert.equal(f.calls.find((c) => c.sign).sign.acl, "private");
  assert.equal(
    f.calls.find((c) => c.rpc === "settings_register_brand_asset").args.p_mime,
    "image/png",
  );
  for (const options of [{ uploadOk: false }, { registerOk: false }]) {
    const bad = await fixture(options);
    assert.equal((await bad.request(upload(png()))).status, 500);
  }
});
test("public reads expose only explicitly selected current logos and never unselected or malformed IDs", async () => {
  const f = await fixture();
  const url = `https://project.supabase.co/functions/v1/settings-assets?asset=${id}`;
  assert.equal((await f.request(new Request(url))).status, 302);
  const hidden = await fixture({ selected: false });
  assert.equal((await hidden.request(new Request(url))).status, 404);
  assert.equal(
    hidden.calls.some((c) => c.sign),
    false,
  );
  assert.equal(
    (
      await f.request(
        new Request(
          "https://project.supabase.co/functions/v1/settings-assets?asset=../private",
        ),
      )
    ).status,
    404,
  );
});
