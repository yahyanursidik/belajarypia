import { test } from "node:test";
import assert from "node:assert/strict";
import {
  announcementState,
  announcementLocal,
  announcementInstant,
  validateAnnouncement,
  announcementPayload,
  announcementUnread,
  announcementPage,
  announcementInboxPath,
  announcementAction,
  sortAnnouncements,
} from "../src/lib/announcementWorkspace.ts";
const now = Date.parse("2026-10-31T00:00:00Z");
const form = {
  title: " Jadwal kelas ",
  content: " Pesan ",
  target_role: "participant",
  target_program_id: "p1",
  target_class_id: "c1",
  mode: "draft",
  publish_at: "",
  expires_at: "",
  is_pinned: false,
  action_kind: "program",
};
const item = {
  id: "a",
  status: "published",
  publish_at: null,
  expires_at: null,
  revision: 2,
  created_at: "2026-10-30T00:00:00Z",
  action_kind: "program",
  target_program_id: "p1",
  is_pinned: false,
};
test("publication states obey exact start/end boundaries and unavailable learning sources", () => {
  assert.equal(announcementState(item, now), "live");
  assert.equal(
    announcementState(
      { ...item, publish_at: new Date(now + 1).toISOString() },
      now,
    ),
    "scheduled",
  );
  assert.equal(
    announcementState(
      { ...item, expires_at: new Date(now).toISOString() },
      now,
    ),
    "expired",
  );
  assert.equal(
    announcementState({ ...item, status: "archived" }, now),
    "archived",
  );
  assert.equal(
    announcementState(
      { ...item, source: "lesson", source_available: false },
      now,
    ),
    "draft",
  );
});
test("WIB local input round trips independent of process timezone and rejects impossible dates", () => {
  assert.equal(
    announcementInstant("2026-10-31T07:00"),
    "2026-10-31T00:00:00.000Z",
  );
  assert.equal(announcementLocal("2026-10-31T00:00:00Z"), "2026-10-31T07:00");
  for (const v of [
    "2026-02-30T07:00",
    "2026-10-31T25:00",
    "2026-10-31",
    "invalid",
  ])
    assert.equal(announcementInstant(v), null);
});
test("form validation requires valid targets, future schedule and expiry after publication", () => {
  assert.equal(validateAnnouncement(form, now), "");
  assert.match(validateAnnouncement({ ...form, title: " " }, now), /judul/);
  assert.match(
    validateAnnouncement({ ...form, target_program_id: "" }, now),
    /program/,
  );
  assert.match(
    validateAnnouncement(
      { ...form, mode: "schedule", publish_at: "2026-10-31T07:00" },
      now,
    ),
    /setelah/,
  );
  assert.match(
    validateAnnouncement(
      {
        ...form,
        mode: "schedule",
        publish_at: "2026-10-31T09:00",
        expires_at: "2026-10-31T08:00",
      },
      now,
    ),
    /berakhir/,
  );
  const p = announcementPayload({
    ...form,
    mode: "schedule",
    publish_at: "2026-10-31T09:00",
  });
  assert.equal(p.title, "Jadwal kelas");
  assert.equal(p.status, "published");
  assert.equal(p.publish_at, "2026-10-31T02:00:00.000Z");
});
test("read state follows content revision and pagination rejects malformed values", () => {
  assert.equal(
    announcementUnread({ ...item, read_at: "2026-10-30", read_revision: 1 }),
    true,
  );
  assert.equal(
    announcementUnread({ ...item, read_at: "2026-10-30", read_revision: 2 }),
    false,
  );
  for (const n of [null, "-1", "0", "NaN", "1.5", "999999999999999999"])
    assert.equal(announcementPage(n), 1);
  assert.equal(announcementPage("3"), 3);
});
test("internal actions and inbox links respect portal roles", () => {
  assert.equal(
    announcementAction(item, "participant").to,
    "/learner/program/p1",
  );
  assert.equal(
    announcementAction(item, "super_admin").to,
    "/system/program/p1/peserta",
  );
  assert.equal(announcementAction(item, "finance"), null);
  assert.equal(announcementAction(item, "guardian"), null);
  assert.equal(
    announcementAction({ ...item, action_kind: "payment" }, "finance").to,
    "/admin/keuangan?program=p1",
  );
  assert.equal(
    announcementAction(
      { ...item, action_kind: "lesson", source_lesson_id: "l1" },
      "participant",
    ).to,
    "/learner/lesson/l1",
  );
  assert.equal(announcementInboxPath("mentor"), "/teacher/pengumuman");
  assert.equal(announcementInboxPath("guardian"), "/learner/pengumuman");
});
test("pinned items precede recency without mutating input", () => {
  const rows = [
    item,
    { ...item, id: "b", is_pinned: true, created_at: "2026-01-01T00:00:00Z" },
  ];
  assert.equal(sortAnnouncements(rows)[0].id, "b");
  assert.equal(rows[0].id, "a");
});
