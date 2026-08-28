import { expect, test } from "bun:test"
import { cleanImportFailureDetail } from "../script/check/module-topology"

test("module-topology reports exact clean-import child termination facts", () => {
  expect(
    cleanImportFailureDetail({
      stderr: "",
      exitCode: null,
      signalCode: "SIGTERM",
      exitedDueToTimeout: true,
    }),
  ).toBe("timed out after 120000ms (SIGTERM)")
  expect(
    cleanImportFailureDetail({
      stderr: "",
      exitCode: null,
      signalCode: "SIGKILL",
      exitedDueToTimeout: false,
    }),
  ).toBe("terminated by signal SIGKILL")
  expect(
    cleanImportFailureDetail({
      stderr: "import failed with exact stderr",
      exitCode: 1,
      signalCode: null,
      exitedDueToTimeout: false,
    }),
  ).toBe("import failed with exact stderr")
})
