import assert from "node:assert/strict"
import test from "node:test"
import { canManageMenuPerformance, canViewAnalytics } from "../lib/permissions"

test("POS operators can manage cafe ingredients and recipes", () => {
  assert.equal(canManageMenuPerformance("POS_OPERATOR"), true)
})

test("menu access remains available to managers and administrators", () => {
  assert.equal(canManageMenuPerformance("MANAGER"), true)
  assert.equal(canManageMenuPerformance("ADMIN"), true)
  assert.equal(canManageMenuPerformance("OWNER"), true)
})

test("regular users cannot manage menu performance", () => {
  assert.equal(canManageMenuPerformance("USER"), false)
  assert.equal(canManageMenuPerformance(undefined), false)
})

test("POS operators do not gain access to the broader analytics dashboard", () => {
  assert.equal(canViewAnalytics("POS_OPERATOR"), false)
})
