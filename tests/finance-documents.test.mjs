import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "../node_modules/typescript/lib/typescript.js";
import { webcrypto } from "node:crypto";
async function fixture({
  allowed = true,
  valid = true,
  size = 9,
  copyOk = true,
  auditOk = true,
  ready = false,
} = {}) {
  let handler;
  const calls = [];
  const doc = {
    id: "doc-id",
    owner_id: "user-id",
    object_key: "finance/proof/staging.pdf",
    file_name: "bukti.pdf",
    file_size: size,
    mime_type: "application/pdf",
    status: ready ? "ready" : "staged",
  };
  const context = vm.createContext({
    Request,
    Response,
    Uint8Array,
    TextDecoder,
    crypto: webcrypto,
    Deno: { serve: (f) => (handler = f) },
    fetch: async (url, options) => {
      calls.push({ fetch: url, options });
      return options?.method === "PUT"
        ? new Response("", { status: copyOk ? 200 : 500 })
        : new Response(valid ? "%PDF-test" : "not-a-pdf", {
            headers: { "Content-Type": "application/pdf" },
          });
    },
  });
  const rpc = async (name, payload) => {
    calls.push({ rpc: name, payload });
    return {
      data: name === "finance_prepare_document" ? doc : doc,
      error:
        name === "finance_note_document_download" && !auditOk
          ? new Error("Audit failed")
          : null,
    };
  };
  const client = (_url, key, options) => ({
    auth: {
      getUser: async () => ({
        data: {
          user:
            options?.global?.headers?.Authorization === "Bearer fixture-user"
              ? { id: "user-id" }
              : null,
        },
        error: null,
      }),
    },
    rpc,
    from: () => {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        single: async () => ({
          data: allowed ? doc : null,
          error: allowed ? null : new Error("Denied"),
        }),
      };
      return query;
    },
  });
  const deps = {
    supabase: new vm.SyntheticModule(
      ["createClient"],
      function () {
        this.setExport("createClient", client);
      },
      { context },
    ),
    s3: new vm.SyntheticModule(
      ["requiredEnv", "createS3SignedUrl"],
      function () {
        this.setExport("requiredEnv", (n) =>
          n === "SUPABASE_SERVICE_ROLE_KEY" ? "service-key" : "fixture",
        );
        this.setExport("createS3SignedUrl", async (args) => {
          calls.push({ sign: args });
          return "https://storage.example.test/" + args.objectKey;
        });
      },
      { context },
    ),
  };
  const source = await readFile(
    new URL(
      "../supabase/functions/finance-documents/index.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const module = new vm.SourceTextModule(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
    { context },
  );
  await module.link((name) =>
    name.startsWith("https:") ? deps.supabase : deps.s3,
  );
  await module.evaluate();
  return {
    calls,
    request: async (operation, token = "fixture-user") =>
      handler(
        new Request("https://example.test/finance-documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: JSON.stringify({
            operation,
            document_id: doc.id,
            purpose: "proof",
            file_name: "bukti.pdf",
            mime_type: "application/pdf",
            file_size: 9,
          }),
        }),
      ),
  };
}
test("evidence operations require a validated user and a visible/owned document", async () => {
  const f = await fixture();
  assert.equal((await f.request("prepare", null)).status, 401);
  assert.equal((await f.request("prepare", "anon-key")).status, 401);
  assert.equal(f.calls.length, 0);
  const denied = await fixture({ allowed: false });
  assert.equal((await denied.request("complete")).status, 400);
  assert.equal(denied.calls.length, 0);
});
test("completion validates actual bytes and seals a distinct private key before marking ready", async () => {
  const f = await fixture();
  assert.equal((await f.request("complete")).status, 200);
  const put = f.calls.find((x) => x.sign?.method === "PUT").sign;
  assert.match(put.objectKey, /^finance\/ready\/doc-id\//);
  assert.notEqual(put.objectKey, "finance/proof/staging.pdf");
  const marked = f.calls.find((x) => x.rpc === "finance_mark_document_ready");
  assert.equal(marked.payload.p_object_key, put.objectKey);
  assert.equal(
    f.calls.filter((x) => x.rpc === "finance_mark_document_ready").length,
    1,
  );
});
test("invalid media, size mismatch or failed sealing never marks evidence ready", async () => {
  for (const options of [{ valid: false }, { size: 10 }, { copyOk: false }]) {
    const f = await fixture(options);
    assert.equal((await f.request("complete")).status, 400);
    assert.equal(
      f.calls.some((x) => x.rpc === "finance_mark_document_ready"),
      false,
    );
  }
});
test("ready documents are idempotent and proof URLs are not returned when audit logging fails", async () => {
  const f = await fixture({ ready: true });
  assert.equal((await f.request("complete")).status, 200);
  assert.equal(f.calls.length, 0);
  const noAudit = await fixture({ auditOk: false });
  const r = await noAudit.request("download");
  assert.equal(r.status, 400);
  assert.equal((await r.json()).signedUrl, undefined);
});
