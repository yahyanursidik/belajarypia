import { test } from "node:test";
import assert from "node:assert/strict";
import {
  helpdeskPage,
  helpdeskLinks,
  validateHelpdesk,
  newHelpdeskCommand,
  sameHelpdeskCommand,
  definitiveHelpdeskFailure,
  helpdeskDate,
} from "../src/lib/helpdeskWorkspace.ts";
test("pagination and guidance validation use bounded, clear inputs", () => {
  for (const v of ["0", "-2", "2.5", "abc", null])
    assert.equal(helpdeskPage(v), 1);
  assert.equal(helpdeskPage("3"), 3);
  assert.match(validateHelpdesk({ subject: "x", message: "Hello" }), /judul/);
  assert.match(validateHelpdesk({ subject: "Judul", message: "x" }), /pesan/);
  assert.equal(
    validateHelpdesk({ subject: "Judul", message: "Pesan lengkap" }),
    "",
  );
});
test("context links stay within role routes", () => {
  const t = {
    target_program_id: "p",
    participant_id: "e",
    invoice_id: "i",
    invoice_number: "INV A",
  };
  assert.equal(helpdeskLinks(t, "helpdesk").length, 0);
  assert.equal(helpdeskLinks(t, "mentor").length, 0);
  assert.equal(helpdeskLinks(t, "guardian").length, 0);
  assert.equal(helpdeskLinks(t, "super_admin").length, 3);
  assert.ok(helpdeskLinks(t, "finance")[0].href.startsWith("/admin/keuangan"));
  assert.equal(
    helpdeskLinks(t, "participant")[0].href,
    "/learner/keuangan?invoice=i",
  );
});
test("lost acknowledgement retains original timestamp and key; edits require reconciliation", () => {
  const c = newHelpdeskCommand(
    "helpdesk_reply",
    { p_id: "a", p_body: "Isi", p_expected_updated_at: "old" },
    "key",
  );
  assert.equal(c.args.p_request_key, "key");
  assert.equal(c.args.p_expected_updated_at, "old");
  assert.equal(
    sameHelpdeskCommand(c, "helpdesk_reply", {
      p_id: "a",
      p_body: "Isi",
      p_expected_updated_at: "new",
    }),
    true,
  );
  assert.equal(
    sameHelpdeskCommand(c, "helpdesk_reply", { p_id: "b", p_body: "Isi" }),
    false,
  );
  assert.equal(
    sameHelpdeskCommand(c, "helpdesk_reply", { p_id: "a", p_body: "Berbeda" }),
    false,
  );
});
test("definitive rollback failures differ from uncertain network failures; dates are WIB", () => {
  for (const code of ["40001", "42501", "P0001", "23503"])
    assert.equal(definitiveHelpdeskFailure({ code }), true);
  for (const code of ["08006", "PGRST202", ""])
    assert.equal(definitiveHelpdeskFailure({ code }), false);
  assert.match(helpdeskDate("2026-10-31T00:00:00Z"), /07[.:]00/);
});
