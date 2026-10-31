import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applicationStatus,
  filterApplications,
  summarizeApplications,
  latestProgramForms,
  programAdmissionState,
  draftFromForm,
  validateAdmissionDraft,
  confirmedAdmissionResult,
  admissionPage,
} from "../src/lib/admissionWorkspace.ts";
const program = {
  id: "p1",
  code: "THS",
  name: "Tahsin",
  status: "active",
  curriculum_model: "angkatan",
  feature_flags: {},
};
const application = (id, applicant_id, program_id, review_status) => ({
  id,
  applicant_id,
  program_id,
  review_status,
  applicants: {
    full_name: 'Nama, "contoh"',
    email: "a@example.test",
    phone: "0812",
    status: "accepted",
  },
  programs: program,
});
test("per-program decisions override aggregate applicant state and counts distinguish choices from people", () => {
  const rows = [
    application("c1", "a1", "p1", "submitted"),
    application("c2", "a1", "p2", "accepted"),
  ];
  assert.equal(applicationStatus(rows[0]), "submitted");
  assert.deepEqual(summarizeApplications(rows), {
    total: 2,
    people: 1,
    pending: 1,
    submitted: 1,
    under_review: 0,
    revision_requested: 0,
    accepted: 1,
    rejected: 0,
  });
  assert.equal(
    filterApplications(rows, "p1", "pending", "a@example").length,
    1,
  );
  assert.equal(filterApplications(rows, "p2", "pending", "").length, 0);
  assert.equal(filterApplications(rows, "all", "all", "%_(),").length, 0);
});
test("latest form is deterministic and inactive/direct modes are not counted as open forms", () => {
  const forms = [
    { id: "f1", program_id: "p1", status: "active", created_at: "2026-01-01" },
    { id: "f2", program_id: "p1", status: "draft", created_at: "2026-02-01" },
  ];
  assert.equal(latestProgramForms(forms).get("p1").id, "f2");
  assert.equal(
    programAdmissionState({ ...program, status: "draft" }, forms[0]),
    "inactive",
  );
  assert.equal(
    programAdmissionState(
      { ...program, feature_flags: { use_direct_enrollment: true } },
      forms[0],
    ),
    "direct",
  );
});
test("form validation rejects reversed windows, duplicate options, missing groups and unsafe links", () => {
  const draft = draftFromForm(null, program, []);
  assert.equal(validateAdmissionDraft(draft, program), null);
  assert.match(
    validateAdmissionDraft(
      {
        ...draft,
        registration_open_at: "2026-11-02",
        registration_close_at: "2026-11-01",
      },
      program,
    ),
    /setelah/,
  );
  assert.match(
    validateAdmissionDraft(
      {
        ...draft,
        fields: [
          {
            field_key: "x",
            label: "Pilihan",
            field_type: "select",
            options_json: ["A", "a"],
          },
        ],
      },
      program,
    ),
    /berbeda/,
  );
  assert.match(
    validateAdmissionDraft(
      {
        ...draft,
        group_settings: { ...draft.group_settings, platform: "whatsapp" },
      },
      program,
    ),
    /Tambahkan/,
  );
  assert.match(
    validateAdmissionDraft(
      {
        ...draft,
        group_settings: {
          ...draft.group_settings,
          platform: "whatsapp",
          general_groups: [
            { name: "Grup", link: "javascript:alert(1)", click_limit: 1 },
          ],
        },
      },
      program,
    ),
    /HTTP/,
  );
});
test("confirmed acceptance requires both participant and enrollment, while notes can acknowledge legacy accepted applications", () => {
  assert.throws(() => confirmedAdmissionResult({}, true), /mengonfirmasi/);
  assert.throws(
    () =>
      confirmedAdmissionResult({ choice_id: "c", status: "accepted" }, true),
    /peserta/,
  );
  assert.equal(
    confirmedAdmissionResult({ choice_id: "c", status: "accepted" }).status,
    "accepted",
  );
  assert.equal(
    confirmedAdmissionResult(
      {
        choice_id: "c",
        status: "accepted",
        participant_id: "p",
        enrollment_id: "e",
      },
      true,
    ).enrollment_id,
    "e",
  );
  assert.equal(admissionPage("Infinity"), 1);
  assert.equal(admissionPage("-1"), 1);
  assert.equal(admissionPage("2"), 2);
});

test("an older active form remains visible when a newer draft exists until explicit archival", () => {
  const forms = [
    { id: "f1", program_id: "p1", status: "active", created_at: "2026-01-01" },
    { id: "f2", program_id: "p1", status: "draft", created_at: "2026-02-01" },
  ];
  assert.equal(programAdmissionState(program, forms[1], forms), "open");
});
