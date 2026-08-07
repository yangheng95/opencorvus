import { createHash, randomUUID } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createOciTaskExec, type OciTaskContainerDescriptor } from "../../src/execution-capsule/oci-task-container"

const controllerUnit = `opencorvus-controller-oci-exit-${randomUUID()}.service`
const taskID = `task-${randomUUID()}`
const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-oci-controller-exit-"))
const workspace = path.join(root, "workspace")
await mkdir(workspace)

const descriptor: OciTaskContainerDescriptor = {
  controllerUnit,
  outerSourceRoot: root,
  outerVisibleRoot: root,
  runc: "/usr/sbin/runc",
  systemctl: "/usr/bin/systemctl",
  systemdRun: "/usr/bin/systemd-run",
  toolchainRoot: "/",
  resources: {
    memoryMaxBytes: 536_870_912,
    tasksMax: 128,
    nofileMax: 1024,
    tmpfsMaxBytes: 134_217_728,
    cpuQuotaPercent: 100,
  },
}
const brokerEnvironment = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  LANG: "C.UTF-8",
  XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
  DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
}

async function systemctl(...args: string[]) {
  const child = Bun.spawn([descriptor.systemctl, "--user", ...args], {
    env: brokerEnvironment,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) throw new Error(`systemctl ${args.join(" ")} failed: ${stderr}`)
  return stdout.trim()
}

async function waitForObservedState(label: string, observe: () => Promise<string>, expected: string) {
  let lastValue = ""
  let lastActivity = Date.now()
  for (;;) {
    const value = await observe()
    if (value === expected) return value
    if (value !== lastValue) {
      lastValue = value
      lastActivity = Date.now()
    }
    if (Date.now() - lastActivity >= 10_000) {
      throw new Error(`${label} produced no state activity after ${JSON.stringify(lastValue)}`)
    }
    await Bun.sleep(50)
  }
}

const controller = Bun.spawn(
  [
    descriptor.systemdRun,
    "--user",
    "--wait",
    "--pipe",
    "--service-type=exec",
    "--property=KillMode=control-group",
    "--property=CollectMode=inactive-or-failed",
    `--unit=${controllerUnit}`,
    "/usr/bin/sleep",
    "120",
  ],
  { env: brokerEnvironment, stdout: "pipe", stderr: "pipe" },
)

try {
  await waitForObservedState(
    "controller startup",
    () => systemctl("show", controllerUnit, "--property=ActiveState", "--value"),
    "active",
  )
  const wrapped = await createOciTaskExec({
    descriptor,
    taskID,
    sourceRoot: workspace,
    command: {
      executable: "/usr/bin/bash",
      args: ["-lc", "printf ready > /workspace/child-ready && exec /usr/bin/sleep 120"],
      environment: [],
      cwd: "/workspace",
    },
    brokerEnvironment,
  })
  const child = Bun.spawn([wrapped.executable, ...wrapped.args], {
    cwd: wrapped.cwd,
    env: wrapped.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  await waitForObservedState(
    "Task child readiness",
    () => readFile(path.join(workspace, "child-ready"), "utf8").catch(() => ""),
    "ready",
  )
  const controllerMainPID = Number(await systemctl("show", controllerUnit, "--property=MainPID", "--value"))
  if (!Number.isInteger(controllerMainPID) || controllerMainPID <= 0) throw new Error("Controller service has no live MainPID")
  await systemctl("kill", "--kill-whom=main", "--signal=KILL", controllerUnit)
  const identity = createHash("sha256").update(`${controllerUnit}\0${taskID}`).digest("hex").slice(0, 32)
  const taskUnit = `opencorvus-task-container-${identity}.service`
  await waitForObservedState(
    "Task container terminal state",
    () => systemctl("show", taskUnit, "--property=ActiveState", "--value"),
    "inactive",
  )
  await child.exited
  const runc = Bun.spawn([descriptor.runc, "--root", path.join(root, "control", "runc-state"), "list", "--format", "json"], {
    env: brokerEnvironment,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [runcExitCode, runcStdout, runcStderr] = await Promise.all([
    runc.exited,
    new Response(runc.stdout).text(),
    new Response(runc.stderr).text(),
  ])
  if (runcExitCode !== 0) throw new Error(`runc list failed: ${runcStderr}`)
  const containers = JSON.parse(runcStdout) as Array<{ id: string }> | null
  if (containers !== null && !Array.isArray(containers)) throw new Error("runc list returned an invalid inventory")
  process.stdout.write(
    JSON.stringify({
      controller: await systemctl("show", controllerUnit, "--property=ActiveState", "--value"),
      controllerMainPID,
      controllerTerminalMainPID: Number(await systemctl("show", controllerUnit, "--property=MainPID", "--value")),
      task: await systemctl("show", taskUnit, "--property=ActiveState", "--value"),
      childExited: child.exitCode !== null,
      containerCount: containers?.length ?? 0,
    }),
  )
} finally {
  await systemctl("stop", controllerUnit).catch(() => undefined)
  await controller.exited
  await systemctl("reset-failed", controllerUnit).catch(() => undefined)
  await rm(root, { recursive: true, force: true })
}
