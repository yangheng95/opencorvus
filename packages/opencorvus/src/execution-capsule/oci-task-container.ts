import { createHash, randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { z } from "zod"
import { Filesystem } from "../util/filesystem"

export type OciTaskContainerDescriptor = Readonly<{
  controllerUnit: string
  outerSourceRoot: string
  outerVisibleRoot: string
  runc: string
  systemctl: string
  systemdRun: string
  toolchainRoot: string
  resources: Readonly<{
    memoryMaxBytes: number
    tasksMax: number
    nofileMax: number
    tmpfsMaxBytes: number
    cpuQuotaPercent: number
  }>
}>

export type OciTaskContainerCommand = Readonly<{
  executable: string
  args: readonly string[]
  environment: readonly string[]
  cwd: string
}>

export type OciTaskContainerControlResult = Readonly<{ code: number | null; stdout: string; stderr: string }>

export type OciTaskContainerDiagnostics = Readonly<{
  unitProperties: OciTaskContainerControlResult
  unitStatus: OciTaskContainerControlResult
  unitStop?: OciTaskContainerControlResult
  unitReset?: OciTaskContainerControlResult
}>

const ControlResultSchema = z.object({
  code: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
})

const TerminalEvidenceSchema = z.object({
  schema_version: z.literal(1),
  container_id: z.string().min(1),
  unit_name: z.string().min(1),
  observation: z.string(),
  unit_properties: ControlResultSchema,
  unit_status: ControlResultSchema,
})

type TerminalEvidence = z.infer<typeof TerminalEvidenceSchema>

export class OciTaskContainerUnavailableError extends Error {
  override readonly name = "OciTaskContainerUnavailableError"
  readonly code = "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE" as const

  constructor(
    message: string,
    readonly diagnostics?: OciTaskContainerDiagnostics,
  ) {
    super(message)
  }
}

export function taskContainerRuntimeStateError(input: {
  containerID: string
  lastState: string
  diagnostics: OciTaskContainerDiagnostics
}) {
  return new OciTaskContainerUnavailableError(
    [
      `Task Container ${input.containerID} produced no trusted runtime-state activity after ${input.lastState}`,
      `Unit properties:\n${input.diagnostics.unitProperties.stdout || input.diagnostics.unitProperties.stderr}`,
      `Unit status:\n${input.diagnostics.unitStatus.stdout || input.diagnostics.unitStatus.stderr}`,
    ].join("\n"),
    input.diagnostics,
  )
}

async function controlCommand(input: {
  executable: string
  args: string[]
  cwd: string
  env: NodeJS.ProcessEnv
}): Promise<OciTaskContainerControlResult> {
  const child = spawn(input.executable, input.args, {
    cwd: input.cwd,
    env: input.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk) => (stdout += String(chunk)))
  child.stderr.on("data", (chunk) => (stderr += String(chunk)))
  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code, signal) => resolve({ code, signal }))
  })
  if (result.signal) {
    throw new OciTaskContainerUnavailableError(
      `Execution Capsule control command ${input.executable} exited by ${result.signal}: ${stderr.trim()}`,
    )
  }
  return { code: result.code, stdout: stdout.trim(), stderr: stderr.trim() }
}

export async function captureFailedUnitDiagnostics(input: {
  systemctl: string
  cwd: string
  unitName: string
  environment: NodeJS.ProcessEnv
  runControl?: typeof controlCommand
  onTerminalFacts?: (facts: {
    unitProperties: OciTaskContainerControlResult
    unitStatus: OciTaskContainerControlResult
  }) => Promise<void>
}) {
  const runControl = input.runControl ?? controlCommand
  const unitProperties = await runControl({
    executable: input.systemctl,
    args: [
      "--user",
      "show",
      input.unitName,
      "--all",
      "--property=ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,StatusText",
    ],
    cwd: input.cwd,
    env: input.environment,
  })
  const unitStatus = await runControl({
    executable: input.systemctl,
    args: ["--user", "status", input.unitName, "--no-pager", "--full", "--lines=80"],
    cwd: input.cwd,
    env: input.environment,
  })
  await input.onTerminalFacts?.({ unitProperties, unitStatus })
  const { unitStop, unitReset } = await cleanupFailedUnit({
    systemctl: input.systemctl,
    cwd: input.cwd,
    unitName: input.unitName,
    environment: input.environment,
    runControl,
  })
  return { unitProperties, unitStatus, unitStop, unitReset }
}

async function cleanupFailedUnit(input: {
  systemctl: string
  cwd: string
  unitName: string
  environment: NodeJS.ProcessEnv
  runControl?: typeof controlCommand
}) {
  const runControl = input.runControl ?? controlCommand
  const unitStop = await cleanupControlResult(runControl, {
    executable: input.systemctl,
    args: ["--user", "stop", input.unitName],
    cwd: input.cwd,
    env: input.environment,
  })
  const unitReset = await cleanupControlResult(runControl, {
    executable: input.systemctl,
    args: ["--user", "reset-failed", input.unitName],
    cwd: input.cwd,
    env: input.environment,
  })
  return { unitStop, unitReset }
}

async function cleanupControlResult(
  runControl: typeof controlCommand,
  input: Parameters<typeof controlCommand>[0],
): Promise<OciTaskContainerControlResult> {
  try {
    return await runControl(input)
  } catch (error) {
    return { code: null, stdout: "", stderr: error instanceof Error ? error.message : String(error) }
  }
}

function taskIdentity(taskID: string) {
  return createHash("sha256").update(taskID).digest("hex").slice(0, 32)
}

function physicalIdentity(controllerUnit: string, taskID: string) {
  const identity = taskIdentity(`${controllerUnit}\0${taskID}`)
  return {
    containerID: `opencorvus-${identity}`,
    unitName: `opencorvus-task-container-${identity}.service`,
    sliceName: `opencorvus-task-${identity}.slice`,
    identity,
  }
}

function containerPaths(descriptor: OciTaskContainerDescriptor, taskID: string) {
  const physical = physicalIdentity(descriptor.controllerUnit, taskID)
  const root = path.join(descriptor.outerSourceRoot, "control", "task-containers", physical.identity)
  return {
    ...physical,
    root,
    bundle: path.join(root, "bundle"),
    rootfs: path.join(root, "bundle", "rootfs"),
    config: path.join(root, "bundle", "config.json"),
    processes: path.join(root, "bundle", "processes"),
    terminalEvidence: path.join(root, "terminal-evidence.json"),
    stateRoot: path.join(descriptor.outerSourceRoot, "control", "runc-state"),
  }
}

type OciTaskContainerPaths = ReturnType<typeof containerPaths>

async function readTerminalEvidence(paths: OciTaskContainerPaths): Promise<TerminalEvidence | undefined> {
  try {
    const evidence = TerminalEvidenceSchema.parse(JSON.parse(await readFile(paths.terminalEvidence, "utf8")))
    if (evidence.container_id !== paths.containerID || evidence.unit_name !== paths.unitName) {
      throw new OciTaskContainerUnavailableError(
        `Task Container ${paths.containerID} terminal evidence identity does not match its physical container path`,
      )
    }
    return evidence
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    if (error instanceof OciTaskContainerUnavailableError) throw error
    throw new OciTaskContainerUnavailableError(
      `Task Container ${paths.containerID} terminal evidence is invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

async function persistTerminalEvidence(
  paths: OciTaskContainerPaths,
  input: {
    observation: string
    unitProperties: OciTaskContainerControlResult
    unitStatus: OciTaskContainerControlResult
  },
): Promise<TerminalEvidence> {
  const evidence = TerminalEvidenceSchema.parse({
    schema_version: 1,
    container_id: paths.containerID,
    unit_name: paths.unitName,
    observation: input.observation,
    unit_properties: input.unitProperties,
    unit_status: input.unitStatus,
  })
  const created = await Filesystem.writeAtomicIfAbsent(
    paths.terminalEvidence,
    `${JSON.stringify(evidence, null, 2)}\n`,
    0o600,
  )
  if (created) return evidence
  const existing = await readTerminalEvidence(paths)
  if (!existing) throw new OciTaskContainerUnavailableError(`Task Container ${paths.containerID} lost terminal evidence`)
  return existing
}

async function replayTerminalEvidenceFailure(input: {
  descriptor: OciTaskContainerDescriptor
  paths: OciTaskContainerPaths
  brokerEnvironment: NodeJS.ProcessEnv
  evidence: TerminalEvidence
}) {
  const cleanup = await cleanupFailedUnit({
    systemctl: input.descriptor.systemctl,
    cwd: input.descriptor.outerVisibleRoot,
    unitName: input.paths.unitName,
    environment: input.brokerEnvironment,
  })
  return taskContainerRuntimeStateError({
    containerID: input.evidence.container_id,
    lastState: input.evidence.observation,
    diagnostics: {
      unitProperties: input.evidence.unit_properties,
      unitStatus: input.evidence.unit_status,
      ...cleanup,
    },
  })
}

async function captureAndPersistTerminalFailure(input: {
  descriptor: OciTaskContainerDescriptor
  paths: OciTaskContainerPaths
  brokerEnvironment: NodeJS.ProcessEnv
  observation: string
}) {
  let evidence: TerminalEvidence | undefined
  const diagnostics = await captureFailedUnitDiagnostics({
    systemctl: input.descriptor.systemctl,
    cwd: input.descriptor.outerVisibleRoot,
    unitName: input.paths.unitName,
    environment: input.brokerEnvironment,
    async onTerminalFacts(facts) {
      evidence = await persistTerminalEvidence(input.paths, { observation: input.observation, ...facts })
    },
  })
  return taskContainerRuntimeStateError({
    containerID: evidence?.container_id ?? input.paths.containerID,
    lastState: evidence?.observation ?? input.observation,
    diagnostics: evidence
      ? {
          ...diagnostics,
          unitProperties: evidence.unit_properties,
          unitStatus: evidence.unit_status,
        }
      : diagnostics,
  })
}

const UNIT_RUNTIME_PROPERTIES =
  "LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,MainPID" as const

type UnitRuntime = Readonly<{
  loadState: string
  activeState: string
  subState: string
  result: string
  execMainCode: string
  execMainStatus: string
  mainPID: number
}>

function unitProperty(stdout: string, name: string): string {
  const prefix = `${name}=`
  const line = stdout.split("\n").find((item) => item.startsWith(prefix))
  if (!line) throw new OciTaskContainerUnavailableError(`Task Container unit inspection omitted ${name}`)
  return line.slice(prefix.length)
}

async function inspectUnitRuntime(input: {
  descriptor: OciTaskContainerDescriptor
  paths: OciTaskContainerPaths
  brokerEnvironment: NodeJS.ProcessEnv
}): Promise<{ result: OciTaskContainerControlResult; runtime?: UnitRuntime }> {
  const result = await controlCommand({
    executable: input.descriptor.systemctl,
    args: ["--user", "show", input.paths.unitName, `--property=${UNIT_RUNTIME_PROPERTIES}`],
    cwd: input.descriptor.outerVisibleRoot,
    env: input.brokerEnvironment,
  })
  if (result.code !== 0) return { result }
  return {
    result,
    runtime: {
      loadState: unitProperty(result.stdout, "LoadState"),
      activeState: unitProperty(result.stdout, "ActiveState"),
      subState: unitProperty(result.stdout, "SubState"),
      result: unitProperty(result.stdout, "Result"),
      execMainCode: unitProperty(result.stdout, "ExecMainCode"),
      execMainStatus: unitProperty(result.stdout, "ExecMainStatus"),
      mainPID: Number(unitProperty(result.stdout, "MainPID")),
    },
  }
}

function isTrustedRunningUnit(runtime: UnitRuntime) {
  return runtime.activeState === "active" && runtime.subState === "running" && Number.isInteger(runtime.mainPID) && runtime.mainPID > 0
}

function ociConfig(input: {
  descriptor: OciTaskContainerDescriptor
  sourceRoot: string
}) {
  const uid = process.getuid?.()
  const gid = process.getgid?.()
  if (uid === undefined || gid === undefined) {
    throw new OciTaskContainerUnavailableError("Rootless OCI Task Container requires a POSIX user identity")
  }
  const resources = input.descriptor.resources
  return {
    ociVersion: "1.2.1",
    process: {
      terminal: false,
      user: { uid: 0, gid: 0 },
      args: [
        "/usr/bin/bash",
        "-lc",
        "/usr/sbin/ip link set lo up && exec /usr/bin/sleep infinity",
      ],
      env: ["PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/home", "LANG=C.UTF-8"],
      cwd: "/workspace",
      capabilities: {
        bounding: ["CAP_NET_ADMIN"],
        effective: ["CAP_NET_ADMIN"],
        permitted: ["CAP_NET_ADMIN"],
        inheritable: [],
        ambient: [],
      },
      rlimits: [{ type: "RLIMIT_NOFILE", hard: resources.nofileMax, soft: resources.nofileMax }],
      noNewPrivileges: true,
    },
    root: { path: "rootfs", readonly: true },
    hostname: `opencorvus-${taskIdentity(input.sourceRoot).slice(0, 12)}`,
    mounts: [
      { destination: "/proc", type: "proc", source: "proc", options: ["nosuid", "noexec", "nodev"] },
      {
        destination: "/dev",
        type: "tmpfs",
        source: "tmpfs",
        options: ["nosuid", "strictatime", "mode=755", "size=65536k"],
      },
      {
        destination: "/dev/pts",
        type: "devpts",
        source: "devpts",
        options: ["nosuid", "noexec", "newinstance", "ptmxmode=0666", "mode=0620"],
      },
      {
        destination: "/dev/shm",
        type: "tmpfs",
        source: "shm",
        options: ["nosuid", "noexec", "nodev", "mode=1777", "size=65536k"],
      },
      {
        destination: "/usr",
        type: "none",
        source: path.join(input.descriptor.toolchainRoot, "usr"),
        options: ["rbind", "ro", "nosuid", "nodev"],
      },
      {
        destination: "/etc",
        type: "none",
        source: path.join(input.descriptor.toolchainRoot, "etc"),
        options: ["rbind", "ro", "nosuid", "nodev", "noexec"],
      },
      {
        destination: "/opt",
        type: "none",
        source: path.join(input.descriptor.toolchainRoot, "opt"),
        options: ["rbind", "ro", "nosuid", "nodev"],
      },
      {
        destination: "/workspace",
        type: "none",
        source: input.sourceRoot,
        options: ["rbind", "rw", "nosuid", "nodev"],
      },
      {
        destination: "/tmp",
        type: "tmpfs",
        source: "tmpfs",
        options: ["rw", "nosuid", "nodev", `size=${resources.tmpfsMaxBytes}`, "mode=1777"],
      },
      {
        destination: "/home",
        type: "tmpfs",
        source: "tmpfs",
        options: ["rw", "nosuid", "nodev", "mode=700", `size=${resources.tmpfsMaxBytes}`],
      },
    ],
    linux: {
      uidMappings: [{ containerID: 0, hostID: uid, size: 1 }],
      gidMappings: [{ containerID: 0, hostID: gid, size: 1 }],
      namespaces: ["pid", "ipc", "uts", "mount", "network", "cgroup", "user"].map((type) => ({ type })),
      maskedPaths: [
        "/proc/acpi",
        "/proc/asound",
        "/proc/kcore",
        "/proc/keys",
        "/proc/latency_stats",
        "/proc/timer_list",
        "/proc/timer_stats",
        "/proc/sched_debug",
        "/proc/scsi",
      ],
      readonlyPaths: ["/proc/bus", "/proc/fs", "/proc/irq", "/proc/sys", "/proc/sysrq-trigger"],
    },
  }
}

async function initializeBundle(input: {
  descriptor: OciTaskContainerDescriptor
  taskID: string
  sourceRoot: string
}) {
  const paths = containerPaths(input.descriptor, input.taskID)
  const config = `${JSON.stringify(ociConfig(input), null, 2)}\n`
  let existing: string | undefined
  try {
    existing = await readFile(paths.config, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  if (existing !== undefined) {
    if (existing !== config) {
      throw new OciTaskContainerUnavailableError(`Task ${input.taskID} OCI bundle does not match its immutable binding`)
    }
    return paths
  }
  await mkdir(paths.rootfs, { recursive: true })
  await mkdir(paths.processes, { recursive: true })
  await mkdir(paths.stateRoot, { recursive: true })
  await Promise.all([
    symlink("usr/bin", path.join(paths.rootfs, "bin")),
    symlink("usr/sbin", path.join(paths.rootfs, "sbin")),
    symlink("usr/lib", path.join(paths.rootfs, "lib")),
    symlink("usr/lib64", path.join(paths.rootfs, "lib64")),
  ])
  await writeFile(paths.config, config, { flag: "wx" })
  return paths
}

const starts = new Map<string, Promise<ReturnType<typeof containerPaths>>>()

export async function ensureOciTaskContainer(input: {
  descriptor: OciTaskContainerDescriptor
  taskID: string
  sourceRoot: string
  brokerEnvironment: NodeJS.ProcessEnv
}) {
  const existing = starts.get(input.taskID)
  if (existing) return existing
  const operation = (async () => {
    const paths = await initializeBundle(input)
    const terminalEvidence = await readTerminalEvidence(paths)
    if (terminalEvidence) {
      throw await replayTerminalEvidenceFailure({
        descriptor: input.descriptor,
        paths,
        brokerEnvironment: input.brokerEnvironment,
        evidence: terminalEvidence,
      })
    }
    const controller = await controlCommand({
      executable: input.descriptor.systemctl,
      args: ["--user", "show", input.descriptor.controllerUnit, "--property=ActiveState", "--value"],
      cwd: input.descriptor.outerVisibleRoot,
      env: input.brokerEnvironment,
    })
    if (controller.code !== 0 || controller.stdout !== "active") {
      throw new OciTaskContainerUnavailableError(
        `Execution Capsule controller ${input.descriptor.controllerUnit} is ${controller.stdout || "unavailable"}`,
      )
    }
    const unit = await inspectUnitRuntime({ descriptor: input.descriptor, paths, brokerEnvironment: input.brokerEnvironment })
    if (unit.result.code !== 0) {
      throw await captureAndPersistTerminalFailure({
        descriptor: input.descriptor,
        paths,
        brokerEnvironment: input.brokerEnvironment,
        observation: `inspect:${unit.result.code}:${unit.result.stdout}:${unit.result.stderr}`,
      })
    }
    if (unit.runtime?.activeState === "inactive") {
      const slice = await controlCommand({
        executable: input.descriptor.systemctl,
        args: [
          "--user",
          "set-property",
          "--runtime",
          paths.sliceName,
          `MemoryMax=${input.descriptor.resources.memoryMaxBytes}`,
          `TasksMax=${input.descriptor.resources.tasksMax}`,
          `CPUQuota=${input.descriptor.resources.cpuQuotaPercent}%`,
        ],
        cwd: input.descriptor.outerVisibleRoot,
        env: input.brokerEnvironment,
      })
      if (slice.code !== 0) throw new OciTaskContainerUnavailableError(`Task slice creation failed: ${slice.stderr}`)
      const started = await controlCommand({
        executable: input.descriptor.systemdRun,
        args: [
          "--user",
          "--quiet",
          `--unit=${paths.unitName}`,
          `--slice=${paths.sliceName}`,
          "--property=KillMode=control-group",
          "--property=RemainAfterExit=yes",
          "--property=SuccessExitStatus=137",
          "--property=TimeoutStopSec=10s",
          `--property=ExecStop=${input.descriptor.runc} --root ${paths.stateRoot} kill --all ${paths.containerID} KILL`,
          `--property=ExecStopPost=${input.descriptor.runc} --root ${paths.stateRoot} delete --force ${paths.containerID}`,
          `--property=BindsTo=${input.descriptor.controllerUnit}`,
          `--property=After=${input.descriptor.controllerUnit}`,
          input.descriptor.runc,
          "--root",
          paths.stateRoot,
          "run",
          "--bundle",
          paths.bundle,
          "--keep",
          paths.containerID,
        ],
        cwd: input.descriptor.outerSourceRoot,
        env: input.brokerEnvironment,
      })
      if (started.code !== 0) {
        throw await captureAndPersistTerminalFailure({
          descriptor: input.descriptor,
          paths,
          brokerEnvironment: input.brokerEnvironment,
          observation: `start:${started.code}:${started.stdout}:${started.stderr}`,
        })
      }
    } else if (!unit.runtime || !isTrustedRunningUnit(unit.runtime)) {
      throw await captureAndPersistTerminalFailure({
        descriptor: input.descriptor,
        paths,
        brokerEnvironment: input.brokerEnvironment,
        observation: `existing:${unit.result.stdout}`,
      })
    }
    let lastState = ""
    let lastActivity = Date.now()
    while (Date.now() - lastActivity <= 15_000) {
      const [container, service] = await Promise.all([
        controlCommand({
          executable: input.descriptor.runc,
          args: ["--root", paths.stateRoot, "state", paths.containerID],
          cwd: input.descriptor.outerSourceRoot,
          env: input.brokerEnvironment,
        }),
        inspectUnitRuntime({ descriptor: input.descriptor, paths, brokerEnvironment: input.brokerEnvironment }),
      ])
      const observation = `${service.result.code}:${service.result.stdout}|${container.code}:${container.stdout}`
      if (observation !== lastState) {
        lastState = observation
        lastActivity = Date.now()
      }
      if (service.runtime && isTrustedRunningUnit(service.runtime) && container.code === 0) {
        const state = JSON.parse(container.stdout) as { id?: unknown; status?: unknown; pid?: unknown }
        if (state.id === paths.containerID && state.status === "running" && Number.isInteger(state.pid) && Number(state.pid) > 0) {
          return paths
        }
      }
      if (!service.runtime || !isTrustedRunningUnit(service.runtime)) {
        throw await captureAndPersistTerminalFailure({
          descriptor: input.descriptor,
          paths,
          brokerEnvironment: input.brokerEnvironment,
          observation: lastState,
        })
      }
      await Bun.sleep(50)
    }
    throw await captureAndPersistTerminalFailure({
      descriptor: input.descriptor,
      paths,
      brokerEnvironment: input.brokerEnvironment,
      observation: lastState,
    })
  })()
  starts.set(input.taskID, operation)
  try {
    return await operation
  } finally {
    starts.delete(input.taskID)
  }
}

export async function createOciTaskExec(input: {
  descriptor: OciTaskContainerDescriptor
  taskID: string
  sourceRoot: string
  command: OciTaskContainerCommand
  brokerEnvironment: NodeJS.ProcessEnv
}) {
  const paths = await ensureOciTaskContainer(input)
  const commandID = randomUUID()
  const processFile = path.join(paths.processes, `${commandID}.json`)
  const processSpec = {
    terminal: false,
    user: { uid: 0, gid: 0 },
    args: [input.command.executable, ...input.command.args],
    env: ["PATH=/usr/local/bin:/usr/bin:/bin", "HOME=/home", "LANG=C.UTF-8", ...input.command.environment],
    cwd: input.command.cwd,
    capabilities: { bounding: [], effective: [], permitted: [], inheritable: [], ambient: [] },
    rlimits: [
      {
        type: "RLIMIT_NOFILE",
        hard: input.descriptor.resources.nofileMax,
        soft: input.descriptor.resources.nofileMax,
      },
    ],
    noNewPrivileges: true,
  }
  await writeFile(processFile, `${JSON.stringify(processSpec, null, 2)}\n`, { flag: "wx" })
  return {
    executable: input.descriptor.runc,
    args: ["--root", paths.stateRoot, "exec", "--process", processFile, paths.containerID],
    cwd: input.descriptor.outerSourceRoot,
    env: input.brokerEnvironment,
    processFile,
    containerUnit: paths.unitName,
  }
}

export async function disposeOciTaskContainer(input: {
  descriptor: OciTaskContainerDescriptor
  taskID: string
  brokerEnvironment: NodeJS.ProcessEnv
}) {
  const pending = starts.get(input.taskID)
  if (pending) await pending
  const paths = containerPaths(input.descriptor, input.taskID)
  const terminalEvidence = await readTerminalEvidence(paths)
  if (terminalEvidence) {
    throw await replayTerminalEvidenceFailure({
      descriptor: input.descriptor,
      paths,
      brokerEnvironment: input.brokerEnvironment,
      evidence: terminalEvidence,
    })
  }
  const state = await inspectUnitRuntime({ descriptor: input.descriptor, paths, brokerEnvironment: input.brokerEnvironment })
  if (state.result.code !== 0) {
    throw await captureAndPersistTerminalFailure({
      descriptor: input.descriptor,
      paths,
      brokerEnvironment: input.brokerEnvironment,
      observation: `dispose-inspect:${state.result.code}:${state.result.stdout}:${state.result.stderr}`,
    })
  }
  if (state.runtime && isTrustedRunningUnit(state.runtime)) {
    const stopped = await controlCommand({
      executable: input.descriptor.systemctl,
      args: ["--user", "stop", paths.unitName],
      cwd: input.descriptor.outerVisibleRoot,
      env: input.brokerEnvironment,
    })
    if (stopped.code !== 0) {
      throw await captureAndPersistTerminalFailure({
        descriptor: input.descriptor,
        paths,
        brokerEnvironment: input.brokerEnvironment,
        observation: `dispose-stop:${stopped.code}:${stopped.stdout}:${stopped.stderr}`,
      })
    }
  } else if (state.runtime?.activeState !== "inactive") {
    throw await captureAndPersistTerminalFailure({
      descriptor: input.descriptor,
      paths,
      brokerEnvironment: input.brokerEnvironment,
      observation: `dispose-existing:${state.result.stdout}`,
    })
  }
  const terminal = await inspectUnitRuntime({ descriptor: input.descriptor, paths, brokerEnvironment: input.brokerEnvironment })
  if (terminal.result.code !== 0 || terminal.runtime?.activeState !== "inactive") {
    throw await captureAndPersistTerminalFailure({
      descriptor: input.descriptor,
      paths,
      brokerEnvironment: input.brokerEnvironment,
      observation: `dispose:${terminal.result.code}:${terminal.result.stdout}:${terminal.result.stderr}`,
    })
  }
}
