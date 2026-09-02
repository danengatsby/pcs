import assert from "node:assert/strict";
import { test } from "node:test";
import { mapVolunteerStatusToAccountRole } from "../../modules/volunteers/types.js";

test("volunteer workflow should stay separate from political membership roles", () => {
  assert.equal(mapVolunteerStatusToAccountRole("nou"), "SUSTINATOR");
  assert.equal(mapVolunteerStatusToAccountRole("validat"), "SUSTINATOR");
  assert.equal(mapVolunteerStatusToAccountRole("contactat"), "SUSTINATOR");
  assert.equal(mapVolunteerStatusToAccountRole("activ"), "SUSTINATOR");
});
