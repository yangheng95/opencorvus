import type { Argv, InferredOptionTypes } from "yargs"
import path from "path"
import z from "zod"
import { createOpenCorvusClient, type OpenCorvusClient } from "@opencorvus-ai/sdk"
import { NamedError } from "@opencorvus-ai/util/error"
import { DEFAULT_SERVER_URL } from "../../server/defaults"
import { Flag } from "../../flag/flag"

/**
 * A failure reaching or being answered by a running server. Typed so the CLI
 * renders the operation and the server's own detail, instead of the generic
 * "check the log file" fallback an Agent Skills host would relay verbatim.
 */
export const AttachError = NamedError.create(
  "CliAttachError",
  z.object({
    operation: z.string(),
    baseUrl: z.string(),
    status: z.number().int().optional(),
    detail: z.string().optional(),
  }),
)

/**
 * Shared options for command-line surfaces that drive an ALREADY RUNNING
 * `opencorvus serve` process over HTTP.
 *
 * These commands deliberately do not bootstrap an in-process runtime: the
 * durable interaction state they operate on (pending questions, pending
 * permission requests, Mission sessions) lives inside the serving process, and
 * opening a second writer against the same database would contend with it.
 */
const options = {
  url: {
    type: "string" as const,
    describe: "base URL of a running opencorvus server (default: OPENCORVUS_URL or the configured local address)",
  },
  dir: {
    type: "string" as const,
    describe: "project directory on the server for project-scoped routes (default: current directory)",
  },
  format: {
    type: "string" as const,
    choices: ["table", "json"] as const,
    default: "table" as const,
    describe: "output format",
  },
} satisfies Record<string, unknown>

export type AttachOptions = InferredOptionTypes<typeof options>

export function withAttachOptions<T>(yargs: Argv<T>) {
  return yargs.options(options)
}

export function attachBaseUrl(explicit?: string): string {
  const candidate = explicit?.trim() || process.env["OPENCORVUS_URL"]?.trim()
  if (!candidate) return DEFAULT_SERVER_URL
  // A bare `host:port` is a common operator shorthand; the fetch client needs a
  // scheme, and silently defaulting to https would break the localhost default.
  if (!/^https?:\/\//i.test(candidate)) return `http://${candidate}`
  return candidate.replace(/\/+$/, "")
}

export function attachDirectory(explicit?: string): string {
  const candidate = explicit?.trim()
  return candidate ? path.resolve(candidate) : process.cwd()
}

export type AttachSession = {
  client: OpenCorvusClient
  baseUrl: string
  directory: string
  /**
   * Unwrap an SDK response, converting a transport or HTTP failure into a
   * typed error that names the operation and the server it was sent to. An
   * Agent Skills host relays whatever we print, so the failing surface has to
   * be legible without reading the server log.
   */
  result<T>(operation: string, call: Promise<SdkResult<T>>): Promise<T>
}

type SdkResult<T> = { data?: T; error?: unknown; response?: Response }

/**
 * Bind to a running server. Basic credentials are read from the process
 * environment only — never from a command-line argument, so a password cannot
 * leak into shell history or a process listing.
 */
export function attach(args: Partial<AttachOptions>): AttachSession {
  const baseUrl = attachBaseUrl(args.url)
  const directory = attachDirectory(args.dir)
  const client = createOpenCorvusClient({
    baseUrl,
    directory,
    username: Flag.OPENCORVUS_SERVER_USERNAME,
    password: Flag.OPENCORVUS_SERVER_PASSWORD,
  })
  return {
    client,
    baseUrl,
    directory,
    async result<T>(operation: string, call: Promise<SdkResult<T>>): Promise<T> {
      const settled = await call.catch((cause: unknown) => {
        throw new AttachError({
          operation,
          baseUrl,
          detail: cause instanceof Error ? cause.message : String(cause),
        })
      })
      if (settled.error !== undefined || settled.data === undefined) {
        throw new AttachError({
          operation,
          baseUrl,
          status: settled.response?.status,
          detail: errorDetail(settled.error),
        })
      }
      return settled.data
    },
  }
}

function errorDetail(error: unknown): string | undefined {
  if (error === undefined || error === null) return undefined
  if (typeof error === "string") return error
  if (typeof error === "object") {
    const record = error as Record<string, unknown>
    for (const key of ["message", "detail", "error"]) {
      const value = record[key]
      if (typeof value === "string" && value.trim()) return value
    }
    const data = record["data"]
    if (data && typeof data === "object") {
      const message = (data as Record<string, unknown>)["message"]
      if (typeof message === "string" && message.trim()) return message
    }
    try {
      const encoded = JSON.stringify(error)
      // An empty body carries no information; returning "{}" would only add
      // noise to the rendered failure.
      return encoded === "{}" || encoded === "[]" ? undefined : encoded
    } catch {
      return undefined
    }
  }
  return String(error)
}
