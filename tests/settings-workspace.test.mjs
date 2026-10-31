import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeThemes,
  settingsDraft,
  settingsPatch,
  settingsChanges,
  settingsContacts,
  validateSettings,
  validAssetUrl,
  settingsFileError,
} from "../src/lib/settingsWorkspace.ts";
const base = {
  id: "s1",
  institution_name: "YPIA",
  contact_phone: "081234567890",
  contact_email: "info@example.test",
  portal_themes: { learner: "emerald" },
  updated_at: "2026-10-31T00:00:00Z",
};
test("legacy theme config becomes five known presets and rejects prototype keys and unknown colors", () => {
  const t = normalizeThemes({
    learner: "invalid",
    teacher: "rose",
    mentor: "toString",
    unknown: "amber",
  });
  assert.equal(t.learner, "emerald");
  assert.equal(t.teacher, "rose");
  assert.equal(t.mentor, "rose");
  assert.equal(Object.keys(t).length, 5);
});
test("patch sends only changed fields and preserves intentionally cleared optional fields", () => {
  const d = settingsDraft(base);
  d.address = " Bandung ";
  d.contact_email = "";
  assert.deepEqual(settingsPatch(base, d), {
    contact_email: null,
    address: "Bandung",
  });
  assert.equal(settingsChanges(base, settingsDraft(base)).length, 0);
  d.portal_themes.mentor = "amber";
  assert.equal(settingsPatch(base, d).portal_themes.mentor, "amber");
});
test("help contacts normalize Indonesian phone numbers and never use placeholder destinations", () => {
  assert.match(settingsContacts(base).whatsapp, /wa.me\/6281234567890/);
  assert.equal(
    settingsContacts({ contact_phone: "abc", contact_email: null }).whatsapp,
    null,
  );
  assert.equal(settingsContacts(null).email, null);
  assert.equal(
    settingsContacts({
      contact_email: "foo@bar.com?bcc=bad",
      contact_phone: null,
    }).email,
    null,
  );
  assert.equal(
    settingsContacts(base).email,
    "mailto:info%40example.test?subject=Bantuan%20LMS",
  );
});
test("validation blocks empty identity, malformed contacts, credentials and insecure asset URLs", () => {
  const d = settingsDraft(base);
  assert.equal(Object.keys(validateSettings(d)).length, 0);
  assert.ok(validateSettings({ ...d, institution_name: " " }).institution_name);
  assert.ok(validateSettings({ ...d, contact_phone: "abc" }).contact_phone);
  for (const u of [
    "javascript:alert(1)",
    "http://example.test/a.png",
    "https://user:pass@example.test/a.png",
    "data:image/png;base64,hi",
  ])
    assert.equal(validAssetUrl(u), false);
  assert.equal(validAssetUrl("https://cdn.example.test/a.png"), true);
});
test("brand files reject media, disguised extensions, empty files and excessive size", () => {
  assert.equal(
    settingsFileError({ name: "logo.png", type: "image/png", size: 100 }),
    "",
  );
  for (const f of [
    { name: "logo.mp4", type: "video/mp4", size: 100 },
    { name: "logo.svg", type: "image/svg+xml", size: 100 },
    { name: "logo.png", type: "image/jpeg", size: 100 },
    { name: "logo.png", type: "image/png", size: 0 },
    { name: "logo.png", type: "image/png", size: 2097153 },
  ])
    assert.ok(settingsFileError(f));
});
