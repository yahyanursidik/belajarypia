import { test } from "node:test";
import assert from "node:assert/strict";
import {
  userFilters,
  userChangeError,
  userScopeModes,
  usersCsv,
  userStatus,
} from "../src/lib/usersWorkspace.ts";
const data = {
  profile: { id: "actor", status: "active" },
  auth: { account_exists: true, login_blocked: false },
  assignments: [
    { id: "a1", code: "admin", scope_type: "unit", scope_id: "unit1" },
    { id: "s1", code: "super_admin", scope_type: null, scope_id: null },
  ],
  options: {
    units: [{ id: "unit1", status: "active" }],
    programs: [{ id: "p1", status: "active" }],
  },
  participants: [],
  children: [],
};
test("filters constrain IDs, pages and known values without changing literal search", () => {
  const f = userFilters(
    new URLSearchParams(
      "role=unknown&status=bad&program=bad&page=-1&size=12&q=%25(),",
    ),
  );
  assert.equal(f.role, "all");
  assert.equal(f.status, "all");
  assert.equal(f.program, null);
  assert.equal(f.page, 1);
  assert.equal(f.size, 25);
  assert.equal(f.q, "%(),");
});
test("scope choices reflect actual backend support", () => {
  assert.deepEqual(userScopeModes("finance"), ["global"]);
  assert.deepEqual(userScopeModes("admin"), ["global", "unit"]);
  assert.deepEqual(userScopeModes("helpdesk"), ["global", "unit", "program"]);
});
test("exact assignment decisions reject stale targets, own superadmin removal and duplicates", () => {
  assert.match(
    userChangeError(
      { operation: "revoke", assignment_id: "s1", reason: "Akhir tugas" },
      data,
      "actor",
    ),
    /sendiri/,
  );
  assert.equal(
    userChangeError(
      { operation: "revoke", assignment_id: "a1", reason: "Akhir tugas" },
      data,
      "actor",
    ),
    "",
  );
  assert.match(
    userChangeError(
      {
        operation: "grant",
        role: "admin",
        scope_type: "unit",
        scope_id: "unit1",
        reason: "Penugasan",
      },
      data,
      "actor",
    ),
    /sudah ada/,
  );
  assert.match(
    userChangeError(
      { operation: "grant", role: "participant", reason: "Penugasan" },
      data,
      "actor",
    ),
    /profil peserta/,
  );
  assert.match(
    userChangeError(
      {
        operation: "grant",
        role: "finance",
        scope_type: "unit",
        scope_id: "unit1",
        reason: "Penugasan",
      },
      data,
      "actor",
    ),
    /belum didukung/,
  );
});
test("CSV preserves scope names, escapes cells and neutralizes spreadsheet formulas", () => {
  const csv = usersCsv([
    {
      full_name: '=HYPERLINK("x")',
      email: "+test@example.test",
      status: "inactive",
      created_at: "2026-10-31T00:00:00Z",
      assignments: [
        { code: "admin", name: "Admin", scope_name: "Unit A" },
        { code: "admin", name: "Admin", scope_name: "Unit B" },
      ],
    },
  ]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'+test@example.test"));
  assert.ok(csv.includes("Admin · Unit A; Admin · Unit B"));
  assert.equal(userStatus("inactive"), "Profil nonaktif");
});
