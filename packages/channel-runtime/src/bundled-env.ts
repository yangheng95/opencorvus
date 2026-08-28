import { randomUUID } from "node:crypto"
import { mkdir, open, readFile, rename, rm } from "node:fs/promises"
import path from "node:path"
import lockfile from "proper-lockfile"
import { channelRuntimePaths } from "./runtime-paths"

const BUNDLE_FILE_ENV = "OPENCORVUS_CHANNEL_BUNDLED_ENV_FILE"
const TTL_HOURS_ENV = "OPENCORVUS_CHANNEL_BUNDLED_TTL_HOURS"
const DEFAULT_BUNDLE_FILE = ".env.bundle"
const DEFAULT_TTL_HOURS = 24
const STATE_FILE_NAME = "bundled-env-state.json"

type State = {
  first_used_at: number
}

export type BundledEnvResult = {
  enabled: boolean
  expired: boolean
  applied: number
  skipped: number
  /** The lines a refused bundle could not parse, so the operator can fix the
   *  file instead of guessing which line was wrong. */
  invalidLines?: Array<{ line: number; text: string }>
  file: string
  stateFile: string
  firstUsedAt?: string
  expireAt?: string
  reason?: "missing_bundle" | "empty_bundle" | "expired" | "invalid_bundle"
}

function ttlMs() {
  const hours = Number(process.env[TTL_HOURS_ENV] ?? DEFAULT_TTL_HOURS)
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_TTL_HOURS * 60 * 60 * 1000
  return hours * 60 * 60 * 1000
}

function resolve(input: string) {
  if (path.isAbsolute(input)) return input
  return path.resolve(process.cwd(), input)
}

function bundleFile() {
  return resolve(process.env[BUNDLE_FILE_ENV] ?? DEFAULT_BUNDLE_FILE)
}

function stateFile() {
  return path.join(channelRuntimePaths().state, "channel-runtime", STATE_FILE_NAME)
}

function parseValue(input: string) {
  const value = input.trim()
  if (value.length < 2) return value
  const head = value[0]
  const tail = value[value.length - 1]
  if ((head === '"' && tail === '"') || (head === "'" && tail === "'")) {
    return value.slice(1, value.length - 1)
  }
  return value
}

export type ParsedBundle =
  | { valid: true; env: Record<string, string> }
  | { valid: false; invalidLines: Array<{ line: number; text: string }> }

/**
 * Parse the COMPLETE bundle before anything is claimed or applied.
 *
 * Invalid non-empty lines used to be skipped silently, so a partially
 * malformed bundle still looked usable — and because the one-shot secret
 * window is signed before the result is reported, that permanently consumed
 * the bounded TTL for a bundle the operator never got in full. A bundle is
 * either wholly parseable or refused with the exact lines that are not.
 */
export function parseBundle(raw: string): ParsedBundle {
  const env: Record<string, string> = {}
  const invalidLines: Array<{ line: number; text: string }> = []
  const lines = raw.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index]!.trim()
    if (!text || text.startsWith("#")) continue
    const body = text.startsWith("export ") ? text.slice(7).trim() : text
    const idx = body.indexOf("=")
    if (idx <= 0) {
      invalidLines.push({ line: index + 1, text })
      continue
    }
    const key = body.slice(0, idx).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      invalidLines.push({ line: index + 1, text })
      continue
    }
    env[key] = parseValue(body.slice(idx + 1))
  }
  if (invalidLines.length > 0) return { valid: false, invalidLines }
  return { valid: true, env }
}

async function readState(file: string) {
  const raw = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw new Error(`Failed to read bundled env state ${file}: ${error.message}`, { cause: error })
  })
  if (raw === undefined) return
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Invalid bundled env state JSON ${file}: ${String(error)}`, { cause: error })
  }
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length !== 1 ||
    typeof (data as Partial<State>).first_used_at !== "number" ||
    !Number.isFinite((data as State).first_used_at) ||
    (data as State).first_used_at <= 0
  ) {
    throw new Error(`Invalid bundled env state ${file}: expected one positive finite first_used_at timestamp`)
  }
  return { first_used_at: (data as State).first_used_at }
}

async function writeState(file: string, firstUsedAt: number) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporary, "wx", 0o600)
    await handle.writeFile(JSON.stringify({ first_used_at: firstUsedAt } satisfies State))
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(temporary, file)
    if (process.platform !== "win32") {
      const directory = await open(path.dirname(file), "r")
      try {
        await directory.sync()
      } finally {
        await directory.close()
      }
    }
  } finally {
    await handle?.close().catch(() => undefined)
    await rm(temporary, { force: true }).catch(() => undefined)
  }
}

async function claimFirstUsedAt(file: string, now: number) {
  await mkdir(path.dirname(file), { recursive: true })
  const owner = `${file}.owner`
  const ownerHandle = await open(owner, "a", 0o600)
  await ownerHandle.close()
  const release = await lockfile.lock(owner, {
    realpath: false,
    stale: 30_000,
    update: 5_000,
    retries: {
      retries: 200,
      factor: 1,
      minTimeout: 10,
      maxTimeout: 25,
    },
  })
  try {
    const current = await readState(file)
    if (current) return current.first_used_at
    await writeState(file, now)
    return now
  } finally {
    await release()
  }
}

export async function applyBundledEnv(now = Date.now()): Promise<BundledEnvResult> {
  const file = bundleFile()
  const state = stateFile()
  const handle = Bun.file(file)
  if (!(await handle.exists())) {
    return {
      enabled: false,
      expired: false,
      applied: 0,
      skipped: 0,
      file,
      stateFile: state,
      reason: "missing_bundle",
    }
  }

  const raw = await handle.text()
  const parsed = parseBundle(raw)
  if (!parsed.valid) {
    // Refused BEFORE the one-shot window is claimed: a bundle the operator
    // cannot receive in full must not spend their bounded secret window. The
    // offending lines travel with the refusal so the operator can fix the
    // file rather than guess at it.
    return {
      enabled: false,
      expired: false,
      applied: 0,
      skipped: parsed.invalidLines.length,
      invalidLines: parsed.invalidLines,
      file,
      stateFile: state,
      reason: "invalid_bundle",
    }
  }
  const entries = Object.entries(parsed.env)
  if (entries.length === 0) {
    // Nothing unparseable reached here — that short-circuits above — so a
    // bundle with no entries declares no variables. A comments-only file,
    // which is exactly what the shipped example is, is empty, not invalid.
    return {
      enabled: false,
      expired: false,
      applied: 0,
      skipped: 0,
      file,
      stateFile: state,
      reason: "empty_bundle",
    }
  }

  const firstUsedAt = await claimFirstUsedAt(state, now)

  const expireAtMs = firstUsedAt + ttlMs()
  const expired = now > expireAtMs
  if (expired) {
    return {
      enabled: false,
      expired: true,
      applied: 0,
      skipped: entries.length,
      file,
      stateFile: state,
      firstUsedAt: new Date(firstUsedAt).toISOString(),
      expireAt: new Date(expireAtMs).toISOString(),
      reason: "expired",
    }
  }

  let applied = 0
  let skipped = 0
  for (const [key, value] of entries) {
    if (process.env[key] !== undefined) {
      skipped += 1
      continue
    }
    process.env[key] = value
    applied += 1
  }

  return {
    enabled: true,
    expired: false,
    applied,
    skipped,
    file,
    stateFile: state,
    firstUsedAt: new Date(firstUsedAt).toISOString(),
    expireAt: new Date(expireAtMs).toISOString(),
  }
}
