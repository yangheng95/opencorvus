import { expect, test } from "bun:test"
import path from "node:path"
import { userSystemdRuntimeAvailable } from "./fixture/linux-runtime"

const controllerTest = userSystemdRuntimeAvailable(["/usr/local/bin/bun", "/usr/local/bin/node"]) ? test : test.skip

controllerTest("controller termination settles the bound OCI Task container and its child process", async () => {
  const helper = path.resolve(import.meta.dir, "fixtures/execution-capsule-oci-controller-exit.ts")
  const command =
    process.platform === "win32"
      ? [
          "wsl.exe",
          "-d",
          "Ubuntu-24.04",
          "--exec",
          "/usr/local/bin/bun",
          helper.replaceAll("\\", "/").replace(/^C:/, "/mnt/c"),
        ]
      : [process.execPath, helper]
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  const result = JSON.parse(stdout) as Record<string, unknown>
  expect(result.controllerMainPID).toBeNumber()
  expect(result.controllerMainPID).toBeGreaterThan(0)
  expect({ exitCode, stderr, result: { ...result, controllerMainPID: "live" } }).toEqual({
    exitCode: 0,
    stderr: "",
    result: {
      controller: "inactive",
      controllerMainPID: "live",
      controllerTerminalMainPID: 0,
      task: "inactive",
      childExited: true,
      containerCount: 0,
    },
  })
}, 30_000)
