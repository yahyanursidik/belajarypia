import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardPercentage,
  dashboardProgram,
  dashboardPeriod,
  dashboardHref,
  dashboardQueueHref,
  dashboardIntentHref,
  dashboardAuditLabel,
} from "../src/lib/dashboardWorkspace.ts";
import {
  wibDateKey,
  validDateKey,
  inWibDateRange,
} from "../src/lib/dateRange.ts";
test("percentages distinguish absent denominator from zero completion and clamp display values", () => {
  assert.equal(dashboardPercentage(0, 0), null);
  assert.equal(dashboardPercentage(0, 10), 0);
  assert.equal(dashboardPercentage(1, 3), 33);
  assert.equal(dashboardPercentage(20, 10), 100);
});
test("date ranges consistently use WIB across admission, financial timestamps and day-only paid dates", () => {
  assert.equal(wibDateKey("2026-10-30T17:00:00Z"), "2026-10-31");
  assert.equal(wibDateKey("2026-10-30T16:59:59Z"), "2026-10-30");
  assert.equal(wibDateKey("2026-10-31"), "2026-10-31");
  assert.equal(wibDateKey("2026-02-30"), "");
  assert.equal(validDateKey("2024-02-29"), true);
  assert.equal(validDateKey("2026-02-29"), false);
  assert.equal(
    inWibDateRange("2026-10-30T17:00:00Z", "2026-10-31", "2026-10-31"),
    true,
  );
  assert.equal(
    inWibDateRange("2026-10-31T17:00:00Z", "2026-10-31", "2026-10-31"),
    false,
  );
});
test("dashboard links preserve program, dates and supported destination filters", () => {
  const a = new URL(
    dashboardQueueHref("admission", "abc"),
    "https://local.test",
  );
  assert.equal(a.searchParams.get("tab"), "review");
  assert.equal(a.searchParams.get("status"), "pending");
  assert.equal(a.searchParams.get("program"), "abc");
  assert.match(dashboardQueueHref("helpdesk_overdue", null), /queue=overdue/);
  assert.match(dashboardQueueHref("assessment", null), /status=pending/);
  assert.match(dashboardQueueHref("programs_empty", "abc"), /abc\/kurikulum/);
  const money = new URL(
    dashboardHref("/system/keuangan", "abc", {
      tab: "transactions",
      status: "verified",
      from: "2026-10-01",
      to: "2026-10-31",
    }),
    "https://local.test",
  );
  assert.equal(money.searchParams.get("to"), "2026-10-31");
  assert.match(dashboardIntentHref("invoice", "abc"), /action=invoice/);
  assert.match(dashboardIntentHref("announcement", "abc"), /tab=compose/);
  assert.equal(
    dashboardIntentHref("admission", "abc"),
    "/system/program/abc/pendaftaran",
  );
});
test("periods and identifiers are bounded and unknown audit actions remain neutral", () => {
  for (const v of [null, "bad", "0", "31"])
    assert.equal(dashboardPeriod(v), 30);
  assert.equal(dashboardPeriod("7"), 7);
  assert.equal(dashboardProgram("bad"), null);
  assert.equal(
    dashboardProgram("00000000-0000-4000-8000-000000000001"),
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    dashboardAuditLabel({ action: "mystery", entity_type: "unknown" }),
    "Aktivitas data",
  );
  assert.equal(
    dashboardAuditLabel({
      action: "finance_transaction.verified",
      entity_type: "transaction",
    }),
    "Pembayaran diverifikasi",
  );
});
