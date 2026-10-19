import { afterEach, expect, test } from "bun:test"
import { currentPermissionMode } from "../src/services/permission-mode"
import { setConfigSnapshot } from "../src/store/app"

afterEach(() => setConfigSnapshot(null))

test("accepted permission modes project their exact canonical value", () => {
  for (const mode of ["ask", "full_access"] as const) {
    setConfigSnapshot({ permission_mode: mode })
    expect(currentPermissionMode()).toBe(mode)
  }
})

test("an unloaded configuration projects an unavailable mode", () => {
  setConfigSnapshot(null)
  expect(currentPermissionMode()).toBe(undefined)
})

test("a snapshot without a recognized mode projects an unavailable mode", () => {
  for (const snapshot of [{}, { permission_mode: "unknown" }]) {
    setConfigSnapshot(snapshot)
    expect(currentPermissionMode()).toBe(undefined)
  }
})
