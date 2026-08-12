import fsPromises from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

const OWNER_ROOT = "OPENCORVUS_TEST_OWNER_ROOT"
const OWNER_PID = "OPENCORVUS_TEST_OWNER_PID"
const OS_TEMP_ROOT = "OPENCORVUS_TEST_OS_TEMP_ROOT"
const OWNER_NONCE = "OPENCORVUS_TEST_OWNER_NONCE"
const OWNER_MARKER = ".opencorvus-test-owner.json"
const USER_CONFIGURATION_ENVIRONMENT_KEYS = [
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_CONFIG_CONTENT",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_PACKAGED_PLUGIN_DIR",
  "OPENCORVUS_AGENT_TRACE_DIR",
  "OPENCORVUS_PROCESS_OCCURRENCE_ID",
  "OPENCORVUS_PROCESS_OCCURRENCE_PATH",
  "OPENCORVUS_PREDECESSOR_PROCESS_OCCURRENCE_PATH",
  "OPENCORVUS_PROCESS_SHUTDOWN_REQUEST_PATH",
  "OPENCORVUS_SHARED_SESSION_FILE",
  "OPENCORVUS_PROJECT_DIR",
  "OPENCORVUS_ORIGINAL_CWD",
  "OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR",
  "OPENCORVUS_TASK_PROCESS_MODE",
  "OPENCORVUS_SHARED_SESSION_MODE",
  "OPENCORVUS_RESTART_HANDOFF",
] as const
const MANAGED_CONFIG_DIRECTORY = "OPENCORVUS_TEST_MANAGED_CONFIG_DIR"

export type IsolatedTestRuntime = {
  ownerRoot: string
  processRoot: string
  runtimeRoot: string
  temporaryRoot: string
  ownsOwnerRoot: boolean
}

export function isolatedTestChildEnvironment(
  runtime: IsolatedTestRuntime,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const homeRoot = path.join(runtime.processRoot, "home")
  const child: NodeJS.ProcessEnv = {
    ...base,
    HOME: homeRoot,
    USERPROFILE: homeRoot,
    CARGO_HOME: path.join(runtime.processRoot, "toolchain", "cargo-home"),
    RUSTUP_HOME: path.join(runtime.processRoot, "toolchain", "rustup-home"),
    RUSTUP_TOOLCHAIN: base.RUSTUP_TOOLCHAIN ?? "stable",
    RUSTUP_SKIP_UPDATE_CHECK: "1",
    [MANAGED_CONFIG_DIRECTORY]: path.join(runtime.processRoot, "managed-config"),
  }
  for (const key of USER_CONFIGURATION_ENVIRONMENT_KEYS) delete child[key]
  if (process.platform === "win32") {
    const parsedHome = path.parse(homeRoot)
    child.HOMEDRIVE = parsedHome.root.replace(/[\\/]$/, "")
    child.HOMEPATH = homeRoot.slice(parsedHome.root.length - 1)
    child.APPDATA = path.join(runtime.processRoot, "appdata", "roaming")
    child.LOCALAPPDATA = path.join(runtime.processRoot, "appdata", "local")
  }
  return child
}

export function applyIsolatedTestUserEnvironment(runtime: IsolatedTestRuntime): void {
  Object.assign(process.env, isolatedTestChildEnvironment(runtime))
}

const cleanupAuthorities = new WeakMap<IsolatedTestRuntime, { osTempRoot: string; target: string }>()

function isStrictDescendant(parent: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate))
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)
}

async function inheritedOwnerRoot(): Promise<string | undefined> {
  const ownerRoot = process.env[OWNER_ROOT]?.trim()
  const osTempRoot = process.env[OS_TEMP_ROOT]?.trim()
  const nonce = process.env[OWNER_NONCE]?.trim()
  const ownerPID = Number(process.env[OWNER_PID])
  if (
    !ownerRoot ||
    !osTempRoot ||
    !path.isAbsolute(ownerRoot) ||
    !path.isAbsolute(osTempRoot) ||
    !nonce ||
    !Number.isSafeInteger(ownerPID) ||
    ownerPID <= 0
  )
    return undefined
  const actualOsTempRoot = path.resolve(osTempRoot)
  const resolved = path.resolve(ownerRoot)
  if (!isStrictDescendant(actualOsTempRoot, resolved)) return undefined
  try {
    const marker = JSON.parse(await fsPromises.readFile(path.join(resolved, OWNER_MARKER), "utf8")) as unknown
    const markerKeys =
      marker && typeof marker === "object" && !Array.isArray(marker) ? Object.keys(marker).sort() : []
    if (
      !marker ||
      typeof marker !== "object" ||
      Array.isArray(marker) ||
      markerKeys.join(",") !== "nonce,os_temp_root,owner_pid,schema_version" ||
      (marker as Record<string, unknown>).schema_version !== 1 ||
      (marker as Record<string, unknown>).nonce !== nonce ||
      path.resolve(String((marker as Record<string, unknown>).os_temp_root ?? "")) !== actualOsTempRoot ||
      (marker as Record<string, unknown>).owner_pid !== ownerPID
    )
      return undefined
  } catch {
    return undefined
  }
  return resolved
}

export async function bootstrapIsolatedTestRuntime(role: "runner" | "test"): Promise<IsolatedTestRuntime> {
  const inherited = role === "test" ? await inheritedOwnerRoot() : undefined
  const osTempRoot = inherited ? path.resolve(process.env[OS_TEMP_ROOT]!) : path.resolve(os.tmpdir())
  const ownerRoot = inherited ?? (await fsPromises.mkdtemp(path.join(osTempRoot, "opencorvus-test-run-")))
  const ownsOwnerRoot = inherited === undefined
  const ownerNonce = inherited ? process.env[OWNER_NONCE]! : randomUUID()
  const ownerPID = inherited ? Number(process.env[OWNER_PID]) : process.pid
  if (ownsOwnerRoot) {
    await fsPromises.writeFile(
      path.join(ownerRoot, OWNER_MARKER),
      `${JSON.stringify({ schema_version: 1, nonce: ownerNonce, owner_pid: ownerPID, os_temp_root: osTempRoot })}\n`,
      { encoding: "utf8", flag: "wx" },
    )
  }
  const processRoot = await fsPromises.mkdtemp(path.join(ownerRoot, `${role}-${process.pid}-`))
  const runtimeRoot = path.join(processRoot, "runtime-root")
  const temporaryRoot = path.join(runtimeRoot, "tmp")
  const homeRoot = path.join(processRoot, "home")
  await Promise.all([fsPromises.mkdir(temporaryRoot, { recursive: true }), fsPromises.mkdir(homeRoot, { recursive: true })])

  process.env[OWNER_ROOT] = ownerRoot
  process.env[OWNER_PID] = String(ownerPID)
  process.env[OS_TEMP_ROOT] = osTempRoot
  process.env[OWNER_NONCE] = ownerNonce
  process.env.OPENCORVUS_HOME = runtimeRoot
  process.env.OPENCORVUS_TEST_PROCESS_ROOT = processRoot
  process.env.OPENCORVUS_TEST_HOME = homeRoot
  process.env.TEMP = temporaryRoot
  process.env.TMP = temporaryRoot
  process.env.TMPDIR = temporaryRoot
  process.env.XDG_DATA_HOME = path.join(processRoot, "cross-desktop-group-data")
  process.env.XDG_CACHE_HOME = path.join(processRoot, "cross-desktop-group-cache")
  process.env.XDG_CONFIG_HOME = path.join(processRoot, "cross-desktop-group-config")
  process.env.XDG_STATE_HOME = path.join(processRoot, "cross-desktop-group-state")
  process.env[MANAGED_CONFIG_DIRECTORY] = path.join(processRoot, "managed-config")
  for (const key of USER_CONFIGURATION_ENVIRONMENT_KEYS) delete process.env[key]
  if (role === "test") {
    Object.assign(process.env, isolatedTestChildEnvironment({
      ownerRoot,
      processRoot,
      runtimeRoot,
      temporaryRoot,
      ownsOwnerRoot,
    }))
  }
  const runtime = Object.freeze({ ownerRoot, processRoot, runtimeRoot, temporaryRoot, ownsOwnerRoot })
  cleanupAuthorities.set(runtime, { osTempRoot, target: ownsOwnerRoot ? ownerRoot : processRoot })
  return runtime
}

export async function removeIsolatedTestRuntime(runtime: IsolatedTestRuntime): Promise<void> {
  const authority = cleanupAuthorities.get(runtime)
  if (!authority || !isStrictDescendant(authority.osTempRoot, authority.target)) {
    throw new Error("Isolated test runtime cleanup target has no current OS-temporary-directory authority")
  }
  await fsPromises.rm(authority.target, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 25,
  })
  cleanupAuthorities.delete(runtime)
}
