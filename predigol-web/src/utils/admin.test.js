import test from "node:test";
import assert from "node:assert/strict";
import { isAdminUser } from "./admin.js";

test("isAdminUser usa rol admin o bandera es_admin", () => {
  assert.equal(isAdminUser({ rol: "admin" }), true);
  assert.equal(isAdminUser({ es_admin: true }), true);
  assert.equal(isAdminUser({ rol: "user", es_admin: false }), false);
  assert.equal(isAdminUser(null), false);
});
