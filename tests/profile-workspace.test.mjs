import { test } from "node:test";
import assert from "node:assert/strict";
import {
  profileDraft,
  profilePatch,
  profileValidation,
  profilePasswordValidation,
  profilePasswordError,
  profileInitial,
} from "../src/lib/profileWorkspace.ts";
const data = {
  profile: { id: "one", full_name: "Admin Contoh", phone: "+62 812 3456 7890" },
};
test("existing phone is loaded and name-only edits never submit an empty phone", () => {
  const draft = profileDraft(data);
  assert.equal(draft.phone, data.profile.phone);
  draft.full_name = "  Nama Baru  ";
  assert.deepEqual(profilePatch(data, draft), { full_name: "Nama Baru" });
  assert.deepEqual(profilePatch(data, { ...draft, phone: " " }), {
    full_name: "Nama Baru",
    phone: null,
  });
  assert.deepEqual(profilePatch(data, profileDraft(data)), {});
});
test("contact validation permits formats and preserves legacy untouched values", () => {
  assert.equal(profileValidation({ phone: "+62 (812) 345-6789" }), "");
  assert.match(profileValidation({ phone: "123" }), /7–20/);
  assert.match(profileValidation({ full_name: "\n" }), /Nama/);
  assert.match(profileValidation({ full_name: "A".repeat(161) }), /Nama/);
  assert.equal(profileValidation({ phone: null }), "");
  assert.equal(profileInitial("Nama Pengguna Contoh"), "NP");
});
test("password validation and server errors never echo secrets or invent success", () => {
  assert.match(profilePasswordValidation("short", "short"), /8/);
  assert.match(
    profilePasswordValidation("new-long-password", "different"),
    /belum sama/,
  );
  assert.equal(
    profilePasswordValidation("new-long-password", "new-long-password"),
    "",
  );
  assert.match(
    profilePasswordError({
      code: "reauthentication_needed",
      message: "SECRET",
    }),
    /verifikasi ulang/,
  );
  assert.equal(
    profilePasswordError({ message: "SECRET" }).includes("SECRET"),
    false,
  );
  assert.match(profilePasswordError({ code: "same_password" }), /berbeda/);
});
