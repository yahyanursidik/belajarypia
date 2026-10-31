import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "../node_modules/typescript/lib/typescript.js";
const source = await readFile(
  new URL("../src/lib/financeWorkspace.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const f = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("money and balances distinguish verified amounts from pending reservations", () => {
  for (const v of [0, -1, Infinity, NaN, "", null, true, 1.001, 1e11])
    assert.equal(f.validMoney(v), false);
  for (const v of [1, "0.01", 125000.25]) assert.equal(f.validMoney(v), true);
  assert.deepEqual(
    f.invoiceBalance({ id: "i", amount: 100 }, [
      { invoice_id: "i", status: "verified", amount: 40 },
      { invoice_id: "i", status: "pending", amount: 30 },
      { invoice_id: "i", status: "void", amount: 90 },
    ]),
    { paid: 40, pending: 30, remaining: 60, available: 30 },
  );
});
test("payment methods exclude placeholder accounts, unsafe URLs, mismatched purposes and programs", () => {
  const bank = {
    id: "c",
    is_active: true,
    channel_type: "bank",
    bank_name: "Bank Contoh",
    account_holder: "Yayasan Contoh",
    account_number: "0000000000",
  };
  assert.equal(f.paymentChannelReady(bank), false);
  bank.account_number = "1234567890";
  assert.equal(f.paymentChannelReady(bank), true);
  assert.equal(f.safeFinanceUrl("javascript:alert(1)"), null);
  assert.equal(
    f.channelsForPurpose(
      [{ ...bank, purpose: "donation", program_id: "p" }],
      "class",
      "p",
    ).length,
    0,
  );
  assert.equal(
    f.channelsForPurpose(
      [{ ...bank, purpose: "both", program_id: "p" }],
      "class",
      "other",
    ).length,
    0,
  );
  assert.equal(
    f.paymentChannelReady({
      channel_type: "qris",
      is_active: true,
      account_holder: "Yayasan",
      qris_image_url: "https://example.test/qr.png",
    }),
    true,
  );
});
test("file and follow-up rules reject media, oversized files and invalid reminder dates", () => {
  assert.match(
    f.validateFinanceFile(
      { name: "audio.mp3", type: "audio/mpeg", size: 100 },
      "proof",
    ),
    /Gunakan/,
  );
  assert.match(
    f.validateFinanceFile(
      { name: "bukti.pdf", type: "application/pdf", size: 6 * 1024 * 1024 },
      "proof",
    ),
    /5 MB/,
  );
  assert.match(
    f.validateFinanceFile(
      { name: "qr.pdf", type: "application/pdf", size: 100 },
      "qr",
    ),
    /Gunakan/,
  );
  assert.equal(
    f.validateFinanceFile(
      { name: "bukti.png", type: "image/png", size: 100 },
      "proof",
    ),
    "",
  );
  assert.equal(
    f.nextFinanceReminder("2026-12-31", "monthly", 15),
    "2027-01-15",
  );
  assert.equal(f.nextFinanceReminder("2026-10-31", "once", 1), null);
  assert.throws(() => f.nextFinanceReminder("2026-10-31", "monthly", 31));
  assert.equal(f.financePage("-1"), 1);
});
test("decimal installments keep cent precision instead of rejecting the exact remainder", () => {
  const balance = f.invoiceBalance({ id: "i", amount: 0.3 }, [
    { invoice_id: "i", status: "verified", amount: 0.1 },
  ]);
  assert.equal(balance.remaining, 0.2);
  assert.equal(balance.available, 0.2);
  assert.equal(0.2 > balance.available, false);
  assert.deepEqual(
    f.invoiceBalance({ id: "i", amount: 0.6 }, [
      { invoice_id: "i", status: "verified", amount: 0.1 },
      { invoice_id: "i", status: "verified", amount: 0.2 },
      { invoice_id: "i", status: "pending", amount: 0.3 },
    ]),
    { paid: 0.3, pending: 0.3, remaining: 0.3, available: 0 },
  );
});
