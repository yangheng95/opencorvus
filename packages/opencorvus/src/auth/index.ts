import path from "path"
import { Global } from "../global"
import z from "zod"
import { Filesystem } from "../util/filesystem"
import { withSharedJsonFactLock } from "../util/process-lock"
import { NamedError } from "@opencorvus-ai/util/error"

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

  const filepath = path.join(Global.Path.data, "auth.json")
  const mutationLocks = new Map<string, Promise<unknown>>()

  export async function get(providerID: string) {
    const auth = await all()
    return auth[providerID]
  }

  export async function all(): Promise<Record<string, Info>> {
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
    return Object.entries(file.data).reduce(
      (acc, [key, value]) => {
        const parsed = Info.safeParse(value)
        if (!parsed.success) {
          throw new ReadError(
            {
              operation: "read_saved_credentials",
              reason: "invalid_credential",
              message: "Saved Provider credentials do not satisfy the credential schema",
            },
            { cause: parsed.error },
          )
        }
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
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
    await mutate(async () => {
      const data = await all()
      await Filesystem.writeAtomic(filepath, JSON.stringify({ ...data, [key]: info }, null, 2), 0o600)
    })
  }

  export async function remove(key: string) {
    await mutate(async () => {
      const data = await all()
      delete data[key]
      await Filesystem.writeAtomic(filepath, JSON.stringify(data, null, 2), 0o600)
    })
  }
}
