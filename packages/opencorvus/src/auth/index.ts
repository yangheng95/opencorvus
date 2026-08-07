import path from "path"
import { Global } from "../global"
import z from "zod"
import { Filesystem } from "../util/filesystem"
import { withKeyedLock } from "../util/lock"

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
  export class ReadError extends Error {
    readonly filepath?: string

    constructor(message: string, options?: ErrorOptions & { filepath?: string }) {
      super(message, options)
      this.name = "AuthReadError"
      this.filepath = options?.filepath
    }
  }

  export function findReadError(error: unknown): ReadError | undefined {
    const seen = new Set<unknown>()
    let current = error
    while (current && typeof current === "object" && !seen.has(current)) {
      if (current instanceof ReadError) return current
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
        throw new ReadError(
          `Failed to read saved Provider credentials: ${error instanceof Error ? error.message : String(error)}`,
          {
            cause: error,
            filepath,
          },
        )
      }
    }
    return Object.entries(data).reduce(
      (acc, [key, value]) => {
        const parsed = Info.safeParse(value)
        if (!parsed.success) {
          throw new ReadError(`Invalid saved Provider credential "${key}": ${parsed.error.message}`, { filepath })
        }
        acc[key] = parsed.data
        return acc
      },
      {} as Record<string, Info>,
    )
  }

  export async function set(key: string, info: Info) {
    await withKeyedLock(mutationLocks, filepath, async () => {
      const data = await all()
      await Filesystem.writeAtomic(filepath, JSON.stringify({ ...data, [key]: info }, null, 2), 0o600)
    })
  }

  export async function remove(key: string) {
    await withKeyedLock(mutationLocks, filepath, async () => {
      const data = await all()
      delete data[key]
      await Filesystem.writeAtomic(filepath, JSON.stringify(data, null, 2), 0o600)
    })
  }
}
