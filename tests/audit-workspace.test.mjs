import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditFilters,
  auditChanges,
  auditLinks,
  auditCsv,
  auditActor,
  auditActionLabel,
} from "../src/lib/auditWorkspace.ts";
const id = "00000000-0000-4000-8000-000000000001";
test("filters preserve literal search and supported deep-link constraints", () => {
  const f = auditFilters(
    new URLSearchParams(
      "category=auth&from=2026-10-31&to=2026-11-01&actor=" +
        id +
        "&q=%25(),&size=20&page=-4",
    ),
  );
  assert.equal(f.q, "%(),");
  assert.equal(f.actor, id);
  assert.equal(f.size, 25);
  assert.equal(f.page, 1);
  assert.equal(f.category, "auth");
  assert.equal(
    auditFilters(
      new URLSearchParams("category=constructor&from=2026-02-30&actor=bad"),
    ).category,
    "all",
  );
});
test("comparisons distinguish zero, false, null and missing instead of inventing old values", () => {
  assert.deepEqual(auditChanges({ score: 10 }), []);
  const r = auditChanges({
    previous: { score: null, active: false, old: "A" },
    current: { score: 0, active: true },
  });
  assert.equal(r[0].after, "0");
  assert.equal(r[1].before, "Tidak");
  assert.equal(r[2].after, "Tidak dicatat");
  assert.equal(
    auditActor({ user_id: id, actor_name: null, actor_email: null }),
    "Akun tidak tersedia",
  );
  assert.equal(
    auditActor({ user_id: null, actor_name: null, actor_email: null }),
    "Pelaku tidak tercatat",
  );
});
test("context links only use validated IDs and actual route query names", () => {
  const links = auditLinks({
    context: {
      choice_id: id,
      transaction_id: id,
      participant_id: "https://bad.test",
      ticket_id: id,
    },
    entity_type: "unknown",
  });
  assert.ok(links.some((l) => l.href.includes("choice=" + id)));
  assert.ok(links.some((l) => l.href.includes("transaction=" + id)));
  assert.ok(links.some((l) => l.href.includes("ticket=" + id)));
  assert.equal(
    links.some((l) => l.href.includes("bad.test")),
    false,
  );
});
test("CSV exports safe metadata without raw details and uses human action labels", () => {
  const csv = auditCsv([
    {
      id,
      user_id: id,
      actor_name: '=HYPERLINK("x")',
      actor_email: "+test@example.test",
      created_at: "2026-10-31T06:00Z",
      action: "user.role_granted",
      category: "auth",
      entity_type: "profile",
      entity_id: id,
      details: { password: "SECRET" },
    },
  ]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+test@example.test"));
  assert.ok(!csv.includes("SECRET"));
  assert.equal(auditActionLabel("VERIFY_PAYMENT"), "Pembayaran diverifikasi");
});
