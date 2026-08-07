import { Identifier } from "@/id/id"
import { Global } from "@/global"
import { Config } from "@/config/config"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import * as fs from "node:fs/promises"
import path from "node:path"
import z from "zod"

const dir = path.join(Global.Path.data, "channel-attachments")
const lifetime = 1000 * 60 * 60 * 24
const loopback = new Set(["127.0.0.1", "localhost", "::1"])

function metadataSchema(id: string) {
  return z
    .object({
      filename: z.string(),
      mime: z.string(),
      file: z.string().refine((file) => path.basename(file) === file && file.startsWith(`${id}.`), {
        message: `Channel attachment metadata blob must be a file owned by ${id}`,
      }),
      expires_at: z.number().int().positive(),
    })
    .strict()
}

const AttachmentID = Identifier.schema("attachment").refine((id) => path.basename(id) === id, {
  message: "Channel attachment ID must be one path segment",
})

type CleanupResidue = {
  path: string
  exists: boolean | null
}

const RawBase64 = z
  .string()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      decodeRawBase64Payload(value, "Channel attachment input")
    } catch (cause) {
      ctx.addIssue({
        code: "custom",
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
  })

export namespace ChannelAttachment {
  export class CleanupError extends AggregateError {
    override readonly name = "ChannelAttachmentCleanupError"

    constructor(
      failures: unknown[],
      public readonly residue: CleanupResidue,
      options?: ErrorOptions,
    ) {
      super(failures, `Channel attachment cleanup failed for ${residue.path}`, options)
    }
  }

  export class PublicationError extends AggregateError {
    override readonly name = "ChannelAttachmentPublicationError"

    constructor(
      cause: unknown,
      cleanupFailure: unknown,
      public readonly residue: CleanupResidue,
      public readonly staging: string,
    ) {
      super([cause, cleanupFailure], "Channel attachment publication failed and staging cleanup also failed", {
        cause,
      })
    }
  }

  export const Input = z
    .object({
      filename: z.string().trim().min(1),
      mime: z.string().trim().min(1),
      data: RawBase64,
    })
    .strict()

  export async function create(raw: z.input<typeof Input>) {
    const input = Input.parse(raw)
    const bytes = decodeRawBase64Payload(input.data, `Channel attachment ${input.filename}`)
    const base = await publicUrl()
    if (!base) {
      throw new Error("No public URL configured. Set OPENCORVUS_PUBLIC_URL or config.server.publicUrl.")
    }
    const now = Date.now()
    await sweepExpired(now)
    const id = Identifier.ascending("attachment")
    const ext = suffix(input.filename, input.mime)
    const file = `${id}${ext}`
    const expires = now + lifetime
    const target = attachmentDirectory(id)
    const staging = path.join(dir, `.${id}.staging-${randomUUID()}`)
    try {
      await fs.mkdir(staging, { recursive: false })
      await fs.writeFile(path.join(staging, file), bytes)
      await fs.writeFile(
        path.join(staging, "metadata.json"),
        JSON.stringify({
          filename: input.filename,
          mime: input.mime,
          file,
          expires_at: expires,
        }),
      )
      await fs.rename(staging, target)
    } catch (cause) {
      try {
        await fs.rm(staging, { recursive: true, force: true })
      } catch (cleanupFailure) {
        throw new PublicationError(cause, cleanupFailure, await inspectResidue(staging), staging)
      }
      throw cause
    }
    const token = sign(id, expires)
    return {
      id,
      url: `${base}/channel/attachment/${id}?e=${expires}&s=${token}`,
      mime: input.mime,
      filename: input.filename,
      expires_at: expires,
    }
  }

  export async function get(id: string) {
    if (!AttachmentID.safeParse(id).success) return
    const meta = await readMeta(id)
    const target = attachmentDirectory(id)
    if (!meta) {
      if (await pathExists(target)) await removeCommitted(target)
      return
    }
    if (meta.expires_at <= Date.now()) {
      await removeCommitted(target)
      return
    }
    try {
      return {
        ...meta,
        bytes: await fs.readFile(path.join(target, meta.file)),
      }
    } catch (cause) {
      if (!isEnoent(cause)) throw cause
      await removeCommitted(target)
      return
    }
  }

  export async function authorize(id: string, expires: string | null, token: string | null) {
    if (!AttachmentID.safeParse(id).success) return false
    if (!secret()) return true
    const stamp = Number(expires)
    if (!token || !Number.isFinite(stamp)) return false
    const expected = sign(id, stamp)
    const left = Buffer.from(expected)
    const right = Buffer.from(token)
    if (left.length !== right.length || !timingSafeEqual(left, right)) return false
    if (stamp < Date.now()) {
      await removeExpired(id, Date.now())
      return false
    }
    return true
  }

  async function sweepExpired(now: number) {
    await fs.mkdir(dir, { recursive: true })
    const failures: unknown[] = []
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("att_")) continue
      try {
        await removeExpired(entry.name, now)
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new AggregateError(failures, "Channel attachment expired-entry sweep failed")
    }
  }

  async function removeExpired(id: string, now: number) {
    const meta = await readMeta(id)
    const target = attachmentDirectory(id)
    if (!meta) {
      if (await pathExists(target)) await removeCommitted(target)
      return false
    }
    if (meta.expires_at > now) return false
    await removeCommitted(target)
    return true
  }

  async function readMeta(id: string) {
    let raw: string
    try {
      raw = await fs.readFile(path.join(attachmentDirectory(id), "metadata.json"), "utf8")
    } catch (cause) {
      if (isEnoent(cause)) return
      throw cause
    }
    try {
      return metadataSchema(id).parse(JSON.parse(raw))
    } catch {
      await removeCommitted(attachmentDirectory(id))
      return
    }
  }

  async function removeCommitted(target: string) {
    try {
      await fs.rm(target, { recursive: true, force: true })
    } catch (cause) {
      throw new CleanupError([cause], await inspectResidue(target), { cause })
    }
  }

  async function inspectResidue(target: string): Promise<CleanupResidue> {
    try {
      await fs.lstat(target)
      return { path: target, exists: true }
    } catch (cause) {
      if (isEnoent(cause)) return { path: target, exists: false }
      return { path: target, exists: null }
    }
  }

  async function pathExists(target: string) {
    const residue = await inspectResidue(target)
    if (residue.exists === null) throw new Error(`Channel attachment path could not be inspected: ${target}`)
    return residue.exists
  }

  function attachmentDirectory(id: string) {
    return path.join(dir, id)
  }

  function isEnoent(cause: unknown): cause is NodeJS.ErrnoException {
    return (cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
  }
}

async function publicUrl() {
  const direct = text(process.env.OPENCORVUS_PUBLIC_URL)
  if (direct) return trim(direct)
  const config = await Config.get()
  const configured = text(config.server?.publicUrl)
  if (configured) return trim(configured)
  const current = text(process.env.OPENCORVUS_SERVER_URL)
  if (!current) return
  try {
    const url = new URL(current)
    if (loopback.has(url.hostname)) return
    return trim(url.origin)
  } catch {
    return
  }
}

function trim(value: string) {
  return value.replace(/\/+$/, "")
}

function secret() {
  return text(process.env.OPENCORVUS_PUBLIC_URL_SECRET, process.env.OPENCORVUS_SERVER_PASSWORD)
}

function sign(id: string, expires: number) {
  const key = secret()
  if (!key) return ""
  return createHmac("sha256", key).update(`${id}:${expires}`).digest("hex")
}

function suffix(filename: string, mime: string) {
  const ext = path.extname(filename).trim()
  if (ext) return ext
  if (mime === "image/png") return ".png"
  if (mime === "image/jpeg") return ".jpg"
  if (mime === "image/webp") return ".webp"
  return ".bin"
}

function text(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}
