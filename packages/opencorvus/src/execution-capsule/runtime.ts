import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Filesystem } from "@/util/filesystem"
import { executionCapsuleTreeDigest } from "./tree-digest"
import { createOciTaskExec, disposeOciTaskContainer } from "./oci-task-container"

// PID means Process Identifier. IPC means Inter-Process Communication.
// UTS means UNIX Time-sharing System and isolates the child hostname.
const SHA256 = z.string().regex(/^[a-f0-9]{64}$/)
const AbsolutePath = z.string().min(1).refine(path.isAbsolute, "Path must be absolute")

export const ExecutionCapsuleRuntimeDescriptorSchema = z
  .object({
    schema_version: z.literal(1),
    protocol: z.literal("opencorvus.task-execution-capsule.runtime.v1"),
    runtime_identity_sha256: SHA256,
    server_runtime_tree_sha256: SHA256,
    package_tool_inactivity_ms: z.number().int().positive(),
    controller_unit: z.string().regex(/^opencorvus-controller-[a-z0-9][a-z0-9-]{0,63}\.service$/),
    outer_source_root: AbsolutePath,
    outer_visible_root: AbsolutePath,
    systemd_run: z.object({ path: AbsolutePath, sha256: SHA256 }).strict(),
    systemctl: z.object({ path: AbsolutePath, sha256: SHA256 }).strict(),
    runc: z.object({ path: AbsolutePath, sha256: SHA256 }).strict(),
    node: z.object({ path: AbsolutePath, sha256: SHA256 }).strict(),
    ripgrep: z.object({ path: AbsolutePath, sha256: SHA256 }).strict(),
    toolchain: z.object({ broker_root: AbsolutePath, tree_sha256: SHA256 }).strict(),
    secret_environment_names: z
      .array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/))
      .refine((items) => new Set(items).size === items.length),
    child_environment_names: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).length(0),
    network: z.object({ default: z.literal("none") }).strict(),
    lsp: z.object({ server_ids: z.array(z.never()).length(0) }).strict(),
    resources: z
      .object({
        memory_max_bytes: z.number().int().positive(),
        tasks_max: z.number().int().positive(),
        nofile_max: z.number().int().positive(),
        tmpfs_max_bytes: z.number().int().positive(),
        cpu_quota_percent: z.number().positive().max(100),
      })
      .strict(),
  })
  .strict()

export type ExecutionCapsuleRuntimeDescriptor = z.infer<typeof ExecutionCapsuleRuntimeDescriptorSchema>

export class ExecutionCapsuleRuntimeUnavailableError extends Error {
  override readonly name = "ExecutionCapsuleRuntimeUnavailableError"
  readonly code = "EXECUTION_CAPSULE_RUNTIME_UNAVAILABLE" as const
}

export type TaskExecutionCapsuleRequest = Readonly<{
  taskID: string
  root: string
  cwd: string
  network: "none"
}>

type Command = Readonly<{
  executable: string
  args: readonly string[]
  env?: NodeJS.ProcessEnv
}>

let cached:
  | {
      descriptorPath: string
      descriptorSHA256: string
      descriptor: ExecutionCapsuleRuntimeDescriptor
    }
  | undefined

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function exactFile(resource: { path: string; sha256: string }, label: string) {
  const bytes = await readFile(resource.path)
  const actual = digest(bytes)
  if (actual !== resource.sha256) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `${label} digest mismatch: expected ${resource.sha256}, found ${actual}`,
    )
  }
}

async function loadDescriptor() {
  const descriptorPath = process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim()
  if (!descriptorPath) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      "Task process execution requires OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR",
    )
  }
  const bytes = await readFile(descriptorPath).catch((cause) => {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Execution Capsule runtime descriptor is unreadable: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  })
  const descriptor = ExecutionCapsuleRuntimeDescriptorSchema.parse(JSON.parse(bytes.toString("utf8")))
  await Promise.all([
    exactFile(descriptor.systemd_run, "Execution Capsule systemd-run"),
    exactFile(descriptor.systemctl, "Execution Capsule systemctl"),
    exactFile(descriptor.runc, "Execution Capsule runc"),
    exactFile(descriptor.node, "Execution Capsule Node.js runtime"),
    exactFile(descriptor.ripgrep, "Execution Capsule ripgrep runtime"),
    executionCapsuleTreeDigest(descriptor.toolchain.broker_root).then((actual) => {
      if (actual !== descriptor.toolchain.tree_sha256) {
        throw new ExecutionCapsuleRuntimeUnavailableError(
          `Execution Capsule toolchain digest mismatch: expected ${descriptor.toolchain.tree_sha256}, found ${actual}`,
        )
      }
    }),
  ])
  cached = { descriptorPath, descriptorSHA256: digest(bytes), descriptor }
  return cached
}

export async function activeExecutionCapsuleRuntimeFact() {
  if (!process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim()) return undefined
  const loaded = await loadDescriptor()
  return Object.freeze({
    descriptorSHA256: loaded.descriptorSHA256,
    runtimeIdentitySHA256: loaded.descriptor.runtime_identity_sha256,
    network: loaded.descriptor.network.default,
    resources: loaded.descriptor.resources,
    outerVisibleRoot: loaded.descriptor.outer_visible_root,
    nodePath: loaded.descriptor.node.path,
    ripgrepPath: loaded.descriptor.ripgrep.path,
    browserPlaywrightRequirePath: "/opt/opencorvus-browser/node_modules/playwright/index.js",
    browserExecutablePath: "/opt/opencorvus-browser/chromium/chrome-headless-shell",
    packageToolInactivityMs: loaded.descriptor.package_tool_inactivity_ms,
    lspServerIDs: loaded.descriptor.lsp.server_ids,
  })
}

async function canonicalExistingDirectory(value: string, label: string) {
  const absolute = path.resolve(value)
  const canonical = await realpath(absolute).catch((cause) => {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `${label} is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`,
    )
  })
  return Filesystem.normalizePath(canonical)
}

function brokerEnvironment(): NodeJS.ProcessEnv {
  const required = ["XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"] as const
  const environment: NodeJS.ProcessEnv = {
    PATH: "/usr/local/bin:/usr/bin:/bin",
    LANG: process.env.LANG ?? "C.UTF-8",
  }
  for (const name of required) {
    const value = process.env[name]
    if (!value) throw new ExecutionCapsuleRuntimeUnavailableError(`Execution Capsule broker is missing ${name}`)
    environment[name] = value
  }
  return environment
}

function childEnvironment(input: NodeJS.ProcessEnv | undefined, descriptor: ExecutionCapsuleRuntimeDescriptor) {
  const forbidden = new Set([
    ...descriptor.secret_environment_names,
    "OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR",
    "DBUS_SESSION_BUS_ADDRESS",
    "XDG_RUNTIME_DIR",
    "WSL_INTEROP",
    "WSLENV",
    "DISPLAY",
    "WAYLAND_DISPLAY",
    "PULSE_SERVER",
    "SSH_AUTH_SOCK",
    "DOCKER_HOST",
  ])
  const result: string[] = []
  for (const name of descriptor.child_environment_names) {
    const value = input?.[name]
    if (value === undefined || forbidden.has(name)) continue
    result.push(`${name}=${value}`)
  }
  result.sort((left, right) => left.localeCompare(right))
  return result
}

export async function wrapTaskCapsuleCommand(input: {
  capsule: TaskExecutionCapsuleRequest
  command: Command
}) {
  if (process.platform !== "linux") {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task Execution Capsule requires Linux; current platform is ${process.platform}`,
    )
  }
  const loaded = await loadDescriptor()
  const descriptor = loaded.descriptor
  const [root, cwd, visibleOuterRoot] = await Promise.all([
    canonicalExistingDirectory(input.capsule.root, "Task Capsule root"),
    canonicalExistingDirectory(input.capsule.cwd, "Task Capsule working directory"),
    canonicalExistingDirectory(descriptor.outer_visible_root, "Outer Capsule visible root"),
  ])
  const sourceOuterRoot = Filesystem.normalizePath(path.resolve(descriptor.outer_source_root))
  if (!Filesystem.contains(root, cwd)) {
    throw new ExecutionCapsuleRuntimeUnavailableError(`Task Capsule cwd ${cwd} is outside exact root ${root}`)
  }
  if (!Filesystem.contains(visibleOuterRoot, root)) {
    throw new ExecutionCapsuleRuntimeUnavailableError(
      `Task Capsule root ${root} is outside outer visible root ${visibleOuterRoot}`,
    )
  }
  const relativeRoot = path.relative(visibleOuterRoot, root)
  const sourceRoot = Filesystem.normalizePath(path.resolve(sourceOuterRoot, relativeRoot))
  if (!Filesystem.contains(sourceOuterRoot, sourceRoot)) {
    throw new ExecutionCapsuleRuntimeUnavailableError("Task Capsule source mapping escaped the outer source root")
  }

  const env = brokerEnvironment()
  const containerCwd = path.posix.join("/workspace", path.relative(root, cwd).split(path.sep).join("/"))
  let executable = input.command.executable
  if (path.isAbsolute(executable)) {
    const normalized = Filesystem.normalizePath(path.resolve(executable))
    if (Filesystem.contains(root, normalized)) {
      executable = path.posix.join("/workspace", path.relative(root, normalized).split(path.sep).join("/"))
    } else if (!normalized.startsWith("/usr/") && !normalized.startsWith("/bin/") && !normalized.startsWith("/sbin/")) {
      throw new ExecutionCapsuleRuntimeUnavailableError(
        `Task Capsule executable ${normalized} is outside its workspace and frozen toolchain`,
      )
    }
  }
  const wrapped = await createOciTaskExec({
    descriptor: {
      controllerUnit: descriptor.controller_unit,
      outerSourceRoot: sourceOuterRoot,
      outerVisibleRoot: descriptor.outer_visible_root,
      runc: descriptor.runc.path,
      systemctl: descriptor.systemctl.path,
      systemdRun: descriptor.systemd_run.path,
      toolchainRoot: descriptor.toolchain.broker_root,
      resources: {
        memoryMaxBytes: descriptor.resources.memory_max_bytes,
        tasksMax: descriptor.resources.tasks_max,
        nofileMax: descriptor.resources.nofile_max,
        tmpfsMaxBytes: descriptor.resources.tmpfs_max_bytes,
        cpuQuotaPercent: descriptor.resources.cpu_quota_percent,
      },
    },
    taskID: input.capsule.taskID,
    sourceRoot,
    command: {
      executable,
      args: input.command.args,
      environment: childEnvironment(input.command.env, descriptor),
      cwd: containerCwd,
    },
    brokerEnvironment: env,
  })
  return Object.freeze({
    ...wrapped,
    descriptorSHA256: loaded.descriptorSHA256,
    sourceRoot,
    unitName: undefined,
    systemctl: undefined,
  })
}

export async function disposeTaskExecutionCapsule(taskID: string): Promise<void> {
  if (!process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR?.trim()) return
  const loaded = await loadDescriptor()
  await disposeOciTaskContainer({
    descriptor: {
      controllerUnit: loaded.descriptor.controller_unit,
      outerSourceRoot: loaded.descriptor.outer_source_root,
      outerVisibleRoot: loaded.descriptor.outer_visible_root,
      runc: loaded.descriptor.runc.path,
      systemctl: loaded.descriptor.systemctl.path,
      systemdRun: loaded.descriptor.systemd_run.path,
      toolchainRoot: loaded.descriptor.toolchain.broker_root,
      resources: {
        memoryMaxBytes: loaded.descriptor.resources.memory_max_bytes,
        tasksMax: loaded.descriptor.resources.tasks_max,
        nofileMax: loaded.descriptor.resources.nofile_max,
        tmpfsMaxBytes: loaded.descriptor.resources.tmpfs_max_bytes,
        cpuQuotaPercent: loaded.descriptor.resources.cpu_quota_percent,
      },
    },
    taskID,
    brokerEnvironment: brokerEnvironment(),
  })
}

export function resetExecutionCapsuleRuntimeForTest() {
  cached = undefined
}
