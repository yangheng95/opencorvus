import path from "path"
import { Global } from "../global"
import z from "zod"
import { Filesystem } from "../util/filesystem"
import { withSharedJsonFactLock } from "../util/process-lock"
import { NamedError } from "@opencorvus-ai/util/error"
import crypto from "node:crypto"

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code?: unknown }).code) === "ENOENT"
  )
}

export const OAUTH_DUMMY_KEY = "opencorvus-oauth-dummy-key"

export namespace Auth {
  export const ReadError = NamedError.create(
    "AuthReadError",
    z
      .object({
        operation: z.literal("read_saved_credentials"),
        reason: z.enum(["io", "malformed_json", "invalid_credential"]),
        message: z.string(),
      })
      .strict(),
  )
  export type ReadError = InstanceType<typeof ReadError>

  export function findReadError(error: unknown): ReadError | undefined {
    const seen = new Set<unknown>()
    let current = error
    while (current && typeof current === "object" && !seen.has(current)) {
      if (ReadError.isInstance(current)) return current
      seen.add(current)
      current = "cause" in current ? (current as { cause?: unknown }).cause : undefined
    }
    return undefined
  }

  export const Oauth = z
    .object({
      type: z.literal("oauth"),
      refresh: z.string(),
      access: z.string(),
      expires: z.number(),
      accountId: z.string().optional(),
      enterpriseUrl: z.string().optional(),
    })
    .meta({ ref: "OAuth" })

  export const Api = z
    .object({
      type: z.literal("api"),
      key: z.string(),
      metadata: z.record(z.string(), z.string()).optional(),
    })
    .meta({ ref: "ApiAuth" })

  export const WellKnown = z
    .object({
      type: z.literal("wellknown"),
      key: z.string(),
      token: z.string(),
    })
    .meta({ ref: "WellKnownAuth" })

  export const Info = z.discriminatedUnion("type", [Oauth, Api, WellKnown]).meta({ ref: "Auth" })
  export type Info = z.infer<typeof Info>

  const File = z.record(z.string(), z.unknown())
  const Entry = z.object({ generation: z.string().uuid(), info: Info.optional() })
  type Entry = z.infer<typeof Entry>
  export type Observation = { generation: string; info?: Info }

  const filepath = path.join(Global.Path.data, "auth.json")
  const mutationLocks = new Map<string, Promise<unknown>>()

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  async function readEntries(): Promise<{ entries: Record<string, Entry>; legacyKeys: Set<string> }> {
    let data: Record<string, unknown>
    try {
      data = await Filesystem.readJson<Record<string, unknown>>(filepath)
    } catch (error) {
      if (isEnoent(error)) data = {}
      else {
        const malformed = error instanceof SyntaxError
        throw new ReadError(
          {
            operation: "read_saved_credentials",
            reason: malformed ? "malformed_json" : "io",
            message: malformed
              ? "Saved Provider credentials contain malformed JSON"
              : "Saved Provider credentials could not be read",
          },
          { cause: error },
        )
      }
    }
    const file = File.safeParse(data)
    if (!file.success) {
      throw new ReadError(
        {
          operation: "read_saved_credentials",
          reason: "invalid_credential",
          message: "Saved Provider credentials do not satisfy the credential schema",
        },
        { cause: file.error },
      )
    }
    const legacyKeys = new Set<string>()
    const entries = Object.entries(file.data).reduce(
      (acc, [key, value]) => {
        const entry = Entry.safeParse(value)
        if (entry.success) {
          acc[key] = entry.data
          return acc
        }
        const legacy = Info.safeParse(value)
        if (!legacy.success) {
          throw new ReadError(
            {
              operation: "read_saved_credentials",
              reason: "invalid_credential",
              message: "Saved Provider credentials do not satisfy the credential schema",
            },
            { cause: entry.error },
          )
        }
        legacyKeys.add(key)
        acc[key] = { generation: crypto.randomUUID(), info: legacy.data }
        return acc
      },
      {} as Record<string, Entry>,
    )
    return { entries, legacyKeys }
  }

  async function writeEntries(entries: Record<string, Entry>): Promise<void> {
    await Filesystem.writeAtomic(filepath, JSON.stringify(entries, null, 2), 0o600)
  }

  export async function all(): Promise<Record<string, Info>> {
    const { entries } = await readEntries()
    return Object.fromEntries(
      Object.entries(entries).flatMap(([key, entry]) => (entry.info ? [[key, entry.info] as const] : [])),
    )
  }

  /**
   * Read, change and replace the credential store under one cross-process
   * lock. Two backends over the same data root otherwise read the same
   * snapshot, set different providers, and the later replacement drops the
   * earlier credential entirely.
   */
  function mutate<T>(run: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({ locks: mutationLocks, filepath, empty: "{}", mode: 0o600, run })
  }

  export async function set(key: string, info: Info) {
    await setWithGeneration(key, info, crypto.randomUUID())
  }

  export async function setWithGeneration(key: string, info: Info, generation: string): Promise<void> {
    await mutate(async () => {
      const { entries } = await readEntries()
      entries[key] = Entry.parse({ generation, info })
      await writeEntries(entries)
    })
  }

  /**
   * Establish a durable generation before starting an external credential
   * exchange. Missing credentials become generation-bearing tombstones so an
   * absent -> value -> absent ABA cannot make a stale exchange look current.
   */
  export async function observe(key: string): Promise<Observation> {
    return mutate(async () => {
      const { entries, legacyKeys } = await readEntries()
      let entry = entries[key]
      if (!entry) {
        entry = { generation: crypto.randomUUID() }
        entries[key] = entry
      }
      if (legacyKeys.size > 0 || !entry.info) await writeEntries(entries)
      return { generation: entry.generation, info: entry.info }
    })
  }

  /** Read the current durable generation without creating or migrating one. */
  export async function inspect(key: string): Promise<Observation | undefined> {
    const { entries, legacyKeys } = await readEntries()
    if (legacyKeys.has(key)) return undefined
    const entry = entries[key]
    return entry ? { generation: entry.generation, info: entry.info } : undefined
  }

  /** Commit only while the exact observed credential generation is current. */
  export async function setIfGeneration(
    key: string,
    expectedGeneration: string,
    info: Info,
    generation: string,
  ): Promise<boolean> {
    return mutate(async () => {
      const { entries } = await readEntries()
      if (entries[key]?.generation !== expectedGeneration) return false
      entries[key] = Entry.parse({ generation, info })
      await writeEntries(entries)
      return true
    })
  }

  /**
   * Replace only the metadata of the exact API credential a caller observed.
   * A concurrent credential replacement wins; stale metadata must never
   * restore its old key or overwrite a newly authorized OAuth credential.
   */
  export async function updateApiMetadata(
    key: string,
    current: Extract<Info, { type: "api" }>,
    metadata: Record<string, string>,
  ): Promise<void> {
    await mutate(async () => {
      const { entries } = await readEntries()
      const latest = entries[key]?.info
      if (latest?.type !== "api" || latest.key !== current.key) return
      const updated: Extract<Info, { type: "api" }> = {
        type: "api",
        key: latest.key,
        metadata: { ...(latest.metadata ?? {}), ...metadata },
      }
      entries[key] = { generation: crypto.randomUUID(), info: updated }
      await writeEntries(entries)
    })
  }

  export async function remove(key: string) {
    await mutate(async () => {
      const { entries } = await readEntries()
      entries[key] = { generation: crypto.randomUUID() }
      await writeEntries(entries)
    })
  }
}
