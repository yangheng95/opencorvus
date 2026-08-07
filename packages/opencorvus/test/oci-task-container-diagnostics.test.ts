import { expect, test } from "bun:test"
import {
  captureFailedUnitDiagnostics,
  taskContainerRuntimeStateError,
  type OciTaskContainerControlResult,
} from "../src/execution-capsule/oci-task-container"

test("OCI Task Container failure captures terminal unit facts before explicit cleanup", async () => {
  const calls: string[][] = []
  const responses: OciTaskContainerControlResult[] = [
    {
      code: 0,
      stdout: "ActiveState=failed\nSubState=failed\nResult=exit-code\nExecMainStatus=127",
      stderr: "",
    },
    { code: 3, stdout: "runc: executable file not found in $PATH", stderr: "" },
    { code: 0, stdout: "", stderr: "" },
    { code: 0, stdout: "", stderr: "" },
  ]
  const diagnostics = await captureFailedUnitDiagnostics({
    systemctl: "/usr/bin/systemctl",
    cwd: "/srv/opencorvus",
    unitName: "opencorvus-task-contract.service",
    environment: { PATH: "/usr/bin" },
    async runControl(input) {
      calls.push(input.args)
      return responses[calls.length - 1]!
    },
  })
  const error = taskContainerRuntimeStateError({
    containerID: "opencorvus-task-contract",
    lastState: "0:inactive|1:",
    diagnostics,
  })
  expect({ calls, code: error.code, message: error.message, diagnostics: error.diagnostics }).toEqual({
    calls: [
      [
        "--user",
        "show",
        "opencorvus-task-contract.service",
        "--all",
        "--property=ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,StatusText",
      ],
      [
        "--user",
        "status",
        "opencorvus-task-contract.service",
        "--no-pager",
        "--full",
        "--lines=80",
      ],
      ["--user", "stop", "opencorvus-task-contract.service"],
      ["--user", "reset-failed", "opencorvus-task-contract.service"],
    ],
    code: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
    message:
      "Task Container opencorvus-task-contract produced no trusted runtime-state activity after 0:inactive|1:\n" +
      "Unit properties:\nActiveState=failed\nSubState=failed\nResult=exit-code\nExecMainStatus=127\n" +
      "Unit status:\nrunc: executable file not found in $PATH",
    diagnostics: {
      unitProperties: {
        code: 0,
        stdout: "ActiveState=failed\nSubState=failed\nResult=exit-code\nExecMainStatus=127",
        stderr: "",
      },
      unitStatus: {
        code: 3,
        stdout: "runc: executable file not found in $PATH",
        stderr: "",
      },
      unitStop: { code: 0, stdout: "", stderr: "" },
      unitReset: { code: 0, stdout: "", stderr: "" },
    },
  })
})
