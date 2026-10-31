import { test } from "node:test";
import assert from "node:assert/strict";
import {
  certificateLayout,
  defaultCertificateLayout,
  validateCertificateTemplate,
  queueProgress,
  confirmedCertificateBatch,
  certificatePage,
  certificatePath,
} from "../src/lib/certificateWorkspace.ts";
test("layout matches renderer, migrates legacy positions and preserves zero", () => {
  assert.deepEqual(certificateLayout(null), defaultCertificateLayout);
  assert.equal(certificateLayout({ name_x: 0 }).name_x, 0);
  assert.equal(
    certificateLayout({ recipient_name: { x: 200, y: 150 } }).name_y,
    150,
  );
  for (const bad of [null, "Infinity", "-3", "NaN", "1.5"])
    assert.equal(certificatePage(bad), 1);
});
test("template validation rejects media, arbitrary URLs, blank/invalid numeric fields and out-of-bounds positions", () => {
  assert.equal(
    validateCertificateTemplate("Syahadah", "p1", defaultCertificateLayout, ""),
    "",
  );
  for (const path of [
    "https://example.test/a.pdf",
    "../a.pdf",
    "a.png",
    "a.mp4",
    "/a.pdf",
  ])
    assert.ok(
      validateCertificateTemplate("Name", "p1", defaultCertificateLayout, path),
    );
  for (const layout of [
    { ...defaultCertificateLayout, name_x: -1 },
    { ...defaultCertificateLayout, name_y: 600 },
    { ...defaultCertificateLayout, name_size: 0 },
    { ...defaultCertificateLayout, no_size: NaN },
  ])
    assert.ok(validateCertificateTemplate("Name", "p1", layout, ""));
});
test("queue progress is bounded and confirmed response must match selected participants", () => {
  assert.deepEqual(
    queueProgress({ total_jobs: 3, completed_jobs: 1, failed_jobs: 1 }),
    { percent: 33, remaining: 1 },
  );
  assert.equal(
    queueProgress({ total_jobs: 0, completed_jobs: 0, failed_jobs: 0 }).percent,
    0,
  );
  assert.throws(() =>
    confirmedCertificateBatch({ batch_id: "b", total_jobs: 4 }, 3),
  );
  assert.equal(
    confirmedCertificateBatch(
      { batch_id: "b", total_jobs: 3, status: "pending" },
      3,
    ).batch_id,
    "b",
  );
  assert.equal(
    certificatePath("/system", "antrean", "p1", "b1"),
    "/system/sertifikat/antrean?program=p1&batch=b1",
  );
});
