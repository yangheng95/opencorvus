import { expect, test } from "bun:test"
import { errorDiagnostic } from "../src/util/error-diagnostics"

test("retains ordered startup recovery and cleanup failures in fatal diagnostics", () => {
  const recovery = Object.assign(new Error("started Task recovery failed"), { code: "RECOVERY_FAILED" })
  const cleanup = new Error("runtime cleanup failed", { cause: new Error("ownership release failed") })
  const diagnostic = errorDiagnostic(
    new AggregateError([recovery, cleanup], "Started Task recovery and runtime cleanup failed"),
  )

  expect(diagnostic).toMatchObject({
    name: "AggregateError",
    message: "Started Task recovery and runtime cleanup failed",
    errors: [
      { name: "Error", message: "started Task recovery failed", code: "RECOVERY_FAILED" },
      {
        name: "Error",
        message: "runtime cleanup failed",
        cause: { name: "Error", message: "ownership release failed" },
      },
    ],
  })
})
