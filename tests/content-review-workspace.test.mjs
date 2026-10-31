import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentFilters,
  safeContentUrl,
  contentDecisionError,
  contentEditorHref,
  contentStatus,
} from "../src/lib/contentReviewWorkspace.ts";
test("URL filters are constrained and preserve literal search punctuation", () => {
  const f = contentFilters(
    new URLSearchParams(
      "status=toString&kind=__proto__&program=bad&page=-2&size=999&q=%25()%2C",
    ),
  );
  assert.equal(f.status, "draft");
  assert.equal(f.kind, "all");
  assert.equal(f.program, null);
  assert.equal(f.page, 1);
  assert.equal(f.size, 20);
  assert.equal(f.q, "%(),");
});
test("external URL case and query are preserved, unsafe schemes and credentials rejected", () => {
  assert.equal(
    safeContentUrl("https://example.test/Folder?Key=ABC"),
    "https://example.test/Folder?Key=ABC",
  );
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:pass@example.test",
    "//example.test",
  ])
    assert.equal(safeContentUrl(url), null);
});
test("decisions require real changes, completeness and notes; archives reopen as draft", () => {
  assert.match(
    contentDecisionError("published", "", "draft", false),
    /Lengkapi/,
  );
  assert.match(contentDecisionError("locked", "", "draft", true), /catatan/);
  assert.match(contentDecisionError("published", "", "archived", true), /draf/);
  assert.equal(
    contentDecisionError("draft", "Perlu revisi", "published", true),
    "",
  );
  assert.equal(contentDecisionError("published", "", "draft", true), "");
});
test("programme editor receives exact lesson and safe review return, future release is scheduled", () => {
  const href = contentEditorHref(
    { lesson: { id: "lesson-1" }, context: { program_id: "program-1" } },
    new URLSearchParams("status=locked&q=Materi"),
  );
  const u = new URL(href, "http://localhost");
  assert.equal(u.pathname, "/system/program/program-1/kurikulum");
  assert.equal(u.searchParams.get("reviewLesson"), "lesson-1");
  assert.equal(
    u.searchParams.get("reviewReturn"),
    "/system/konten?status=locked&q=Materi&lesson=lesson-1",
  );
  assert.equal(
    contentStatus({
      visibility_status: "published",
      release_at: "2999-01-01T00:00:00Z",
    }),
    "scheduled",
  );
  assert.equal(
    contentStatus({
      visibility_status: "draft",
      release_at: "2999-01-01T00:00:00Z",
    }),
    "draft",
  );
});
