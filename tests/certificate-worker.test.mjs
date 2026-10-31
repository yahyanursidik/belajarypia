import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "../node_modules/typescript/lib/typescript.js";
const id = "00000000-0000-4000-8000-000000000001";
async function worker({ background = null, uploadOk = true } = {}) {
  let handler;
  const calls = [],
    draws = [];
  const job = {
    id,
    claim_token: "claim-token",
    snapshot: {
      recipient_name: "Peserta Uji",
      program_name: "Tahsin",
      program_id: "program-id",
      background_object_key: background,
      template_data_json: {
        name_x: 0,
        name_y: 300,
        name_size: 32,
        no_x: 120,
        no_y: 250,
        no_size: 14,
      },
    },
  };
  const rpc = async (name, payload) => {
    calls.push({ name, payload });
    return {
      data: ["claim_certificate_jobs", "admin_claim_certificate_jobs"].includes(
        name,
      )
        ? [job]
        : { status: payload?.p_error ? "pending" : "completed" },
      error: null,
    };
  };
  const page = {
    getSize: () => ({ width: 842, height: 595 }),
    drawText: (text, options) => draws.push({ text, ...options }),
  };
  const pdf = {
    addPage: () => {},
    getPages: () => [page],
    embedFont: async () => ({
      widthOfTextAtSize: (text, size) => text.length * size * 0.4,
    }),
    save: async () => new Uint8Array([37, 80, 68, 70]),
  };
  const pdfModule = {
    PDFDocument: { create: async () => pdf, load: async () => pdf },
    rgb: () => ({}),
    StandardFonts: { Helvetica: "regular", HelveticaBold: "bold" },
  };
  const context = vm.createContext({
    Request,
    Response,
    URL,
    Uint8Array,
    console,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return new Response(new Uint8Array(), { status: uploadOk ? 200 : 500 });
    },
    Deno: {
      env: {
        get: (key) =>
          key === "SUPABASE_SERVICE_ROLE_KEY"
            ? "fixture-service-key"
            : "fixture",
      },
      serve: (callback) => {
        handler = callback;
      },
    },
  });
  const modules = new Map();
  async function load(path) {
    if (modules.has(path)) return modules.get(path);
    if (path.startsWith("https://esm.sh/@supabase/")) {
      const m = new vm.SyntheticModule(
        ["createClient"],
        function () {
          this.setExport("createClient", (_url, _key, options) => ({
            rpc,
            auth: {
              getUser: async () =>
                options?.global?.headers?.Authorization ===
                "Bearer fixture-admin"
                  ? { data: { user: { id: "admin" } }, error: null }
                  : {
                      data: { user: null },
                      error: new Error("Invalid fixture user"),
                    },
            },
          }));
        },
        { context },
      );
      modules.set(path, m);
      return m;
    }
    if (path.startsWith("https://esm.sh/pdf-lib")) {
      const m = new vm.SyntheticModule(
        Object.keys(pdfModule),
        function () {
          for (const [k, v] of Object.entries(pdfModule)) this.setExport(k, v);
        },
        { context },
      );
      modules.set(path, m);
      return m;
    }
    if (path.endsWith("/s3.ts")) {
      const m = new vm.SyntheticModule(
        ["requiredEnv", "createS3SignedUrl"],
        function () {
          this.setExport("requiredEnv", (key) =>
            key === "SUPABASE_SERVICE_ROLE_KEY"
              ? "fixture-service-key"
              : "fixture",
          );
          this.setExport("createS3SignedUrl", async (args) => {
            calls.push({ s3: args });
            return "https://example.test/storage";
          });
        },
        { context },
      );
      modules.set(path, m);
      return m;
    }
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const m = new vm.SourceTextModule(code, { context, identifier: path });
    modules.set(path, m);
    await m.link(async (specifier) =>
      load(
        specifier.startsWith("https:")
          ? specifier
          : new URL(specifier, new URL(path, import.meta.url)).href,
      ),
    );
    return m;
  }
  const module = await load(
    "../supabase/functions/process-certificate-queue/index.ts",
  );
  await module.evaluate();
  return { handler, calls, draws };
}
const request = (auth) =>
  new Request("https://example.test/worker", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: "{}",
  });
test("worker rejects unauthenticated and normal user calls before fetching jobs", async () => {
  const w = await worker();
  for (const auth of [undefined, "Bearer participant-jwt"])
    assert.equal((await w.handler(request(auth))).status, 403);
  assert.equal(w.calls.length, 0);
});
test("worker preserves x=0, uploads to claim-specific path, and finalizes only after upload", async () => {
  const w = await worker();
  const response = await w.handler(request("Bearer fixture-service-key"));
  assert.equal(response.status, 200);
  assert.equal(w.draws[0].x, 0);
  const upload = w.calls.find((c) => c.s3?.method === "PUT");
  assert.equal(
    upload.s3.objectKey,
    `certificates/program-id/${id}/claim-token.pdf`,
  );
  assert.equal(upload.s3.acl, undefined);
  const end = w.calls.find((c) => c.name === "finish_certificate_job");
  assert.equal(end.payload.p_error, null);
});
test("invalid background or failed storage never finalizes a certificate successfully", async () => {
  for (const options of [
    { background: "media/audio.mp3" },
    { uploadOk: false },
  ]) {
    const w = await worker(options);
    await w.handler(request("Bearer fixture-service-key"));
    const finish = w.calls.find((c) => c.name === "finish_certificate_job");
    assert.ok(finish.payload.p_error);
  }
});

test("admin processing requires an explicit batch and uses the scoped claim function", async () => {
  const w = await worker();
  const response = await w.handler(
    new Request("https://example.test/worker", {
      method: "POST",
      headers: { Authorization: "Bearer fixture-admin" },
      body: JSON.stringify({ batch_id: "batch-id" }),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(
    w.calls.find((c) => c.name === "admin_claim_certificate_jobs").payload
      .p_batch_id,
    "batch-id",
  );
  assert.equal(
    w.calls.some((c) => c.name === "claim_certificate_jobs"),
    false,
  );
});

test('S3 HMAC accepts typed arrays and ArrayBuffers without changing the RFC 4231 signature',async()=>{const source=await readFile(new URL('../supabase/functions/_shared/s3.ts',import.meta.url),'utf8');const code=ts.transpileModule(source+'\nexport {hmacHex};',{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const context=vm.createContext({crypto,TextEncoder,Uint8Array,ArrayBuffer});const module=new vm.SourceTextModule(code,{context});await module.link(()=>{});await module.evaluate();const key=new Uint8Array(20).fill(0x0b);const expected='b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7';for(const input of [key,key.buffer])assert.equal(await module.namespace.hmacHex(input,'Hi There'),expected);});
