import { createHash } from "node:crypto"
import { Config } from "@/config/config"
import z from "zod"

export namespace PackageUpdateClient {
  export const Source = z.enum(["builtin", "server"])
  export type Source = z.infer<typeof Source>

  export const Kind = z.enum(["expert_squad", "skill"])
  export type Kind = z.infer<typeof Kind>

  const ArchiveEnvelope = z
    .object({
      kind: Kind,
      identity: z.string().min(1),
      version: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      archive_base64: z.string().min(1),
    })
    .strict()

  export interface Archive {
    version: string
    bytes: Uint8Array
  }

  function archivePath(kind: Kind, identity: string) {
    const segment = kind === "expert_squad" ? "expert-squads" : "skills"
    return `v1/${segment}/${encodeURIComponent(identity)}`
  }

  function decodeCanonicalBase64(value: string): Uint8Array {
    const bytes = Uint8Array.from(Buffer.from(value, "base64"))
    if (Buffer.from(bytes).toString("base64") !== value) {
      throw new Error("Package update server returned non-canonical base64 archive data")
    }
    return bytes
  }

  export async function fetchArchive(input: {
    kind: Kind
    identity: string
    fetcher?: typeof fetch
  }): Promise<Archive> {
    const identity = input.identity.trim()
    if (!identity) throw new Error("Package update identity is required")
    const config = await Config.get()
    const serverURL = config.package_updates?.server_url
    if (!serverURL) throw new Error("Package update server is not configured")

    const url = new URL(archivePath(input.kind, identity), serverURL.endsWith("/") ? serverURL : `${serverURL}/`)
    const response = await (input.fetcher ?? fetch)(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) {
      throw new Error(`Package update server request failed: ${response.status} ${response.statusText}`)
    }
    const envelope = ArchiveEnvelope.parse(await response.json())
    if (envelope.kind !== input.kind) {
      throw new Error(`Package update kind mismatch: expected ${input.kind}, received ${envelope.kind}`)
    }
    if (envelope.identity !== identity) {
      throw new Error(`Package update identity mismatch: expected ${identity}, received ${envelope.identity}`)
    }
    const bytes = decodeCanonicalBase64(envelope.archive_base64)
    const digest = createHash("sha256").update(bytes).digest("hex")
    if (digest !== envelope.sha256) {
      throw new Error(`Package update archive digest mismatch: expected ${envelope.sha256}, received ${digest}`)
    }
    return { version: envelope.version, bytes }
  }
}
