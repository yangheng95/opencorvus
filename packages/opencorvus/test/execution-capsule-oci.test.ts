import { expect, test } from "bun:test"
import path from "node:path"
import { randomUUID } from "node:crypto"

async function runProbe(mode?: "terminal-evidence" | "terminal-evidence-recovery") {
  const controller = `opencorvus-controller-oci-${randomUUID()}.scope`
  const helper = path.resolve(import.meta.dir, "fixtures/execution-capsule-oci-probe.ts")
  const probeArguments = mode ? ["/", mode] : []
  const command =
    process.platform === "win32"
      ? [
          "wsl.exe",
          "-d",
          "Ubuntu-24.04",
          "--exec",
          "/usr/bin/systemd-run",
          "--user",
          "--scope",
          `--unit=${controller}`,
          "--quiet",
          "/usr/local/bin/bun",
          helper.replaceAll("\\", "/").replace(/^C:/, "/mnt/c"),
          controller,
          ...probeArguments,
        ]
      : [
          "/usr/bin/systemd-run",
          "--user",
          "--scope",
          `--unit=${controller}`,
          "--quiet",
          process.execPath,
          helper,
          controller,
          ...probeArguments,
        ]
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  return Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
}

function systemdProperties(value: string) {
  return Object.fromEntries(value.split("\n").map((line) => {
    const separator = line.indexOf("=")
    return [line.slice(0, separator), line.slice(separator + 1)]
  }))
}

test("rootless OCI Task Containers isolate same-port loopback services", async () => {
  const [exitCode, stdout, stderr] = await runProbe()
  expect({ exitCode, stderr, stdout }).toEqual({ exitCode: 0, stderr: "", stdout: "A\nB\n" })
}, 30_000)

test("rootless OCI Task Containers preserve one unexpected terminal occurrence", async () => {
  const [exitCode, stdout, stderr] = await runProbe("terminal-evidence")
  const evidence = JSON.parse(stdout) as {
    first: { code: string; message: string; unitProperties: { stdout: string } }
    replay: { code: string; message: string; unitProperties: { stdout: string } }
  }
  expect({
    exitCode,
    stderr,
    firstCode: evidence.first.code,
    replayCode: evidence.replay.code,
    sameMessage: evidence.first.message === evidence.replay.message,
    sameProperties: evidence.first.unitProperties.stdout === evidence.replay.unitProperties.stdout,
    properties: systemdProperties(evidence.first.unitProperties.stdout),
  }).toEqual({
    exitCode: 0,
    stderr: "",
    firstCode: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
    replayCode: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
    sameMessage: true,
    sameProperties: true,
    properties: {
      StatusText: "",
      Result: "success",
      ExecMainCode: "1",
      ExecMainStatus: "137",
      ActiveState: "active",
      SubState: "exited",
    },
  })
}, 30_000)

test("rootless OCI Task Containers finish interrupted cleanup from immutable terminal evidence", async () => {
  const [exitCode, stdout, stderr] = await runProbe("terminal-evidence-recovery")
  const evidence = JSON.parse(stdout) as {
    first: { code: string; message: string; unitProperties: { stdout: string } }
    replay: { code: string; message: string; unitProperties: { stdout: string } }
    recovery: {
      evidenceBytesEqual: boolean
      unit: { code: number; stdout: string; stderr: string }
      inventory: { code: number; stdout: string; stderr: string }
    }
  }
  expect({
    exitCode,
    stderr,
    firstCode: evidence.first.code,
    replayCode: evidence.replay.code,
    sameMessage: evidence.first.message === evidence.replay.message,
    sameProperties: evidence.first.unitProperties.stdout === evidence.replay.unitProperties.stdout,
    evidenceBytesEqual: evidence.recovery.evidenceBytesEqual,
    unit: {
      code: evidence.recovery.unit.code,
      stderr: evidence.recovery.unit.stderr,
      properties: systemdProperties(evidence.recovery.unit.stdout),
    },
    inventory: {
      code: evidence.recovery.inventory.code,
      stderr: evidence.recovery.inventory.stderr,
      value: JSON.parse(evidence.recovery.inventory.stdout),
    },
  }).toEqual({
    exitCode: 0,
    stderr: "",
    firstCode: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
    replayCode: "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE",
    sameMessage: true,
    sameProperties: true,
    evidenceBytesEqual: true,
    unit: {
      code: 0,
      stderr: "",
      properties: { ActiveState: "inactive", SubState: "dead" },
    },
    inventory: { code: 0, stderr: "", value: null },
  })
}, 30_000)
