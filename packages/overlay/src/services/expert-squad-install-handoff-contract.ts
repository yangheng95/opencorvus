
import { EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS } from "@opencorvus-ai/sdk/expert-squad-package-contract"

export interface ExpertSquadInstallHandoff {
  namespace: string
  id: string
  version: string
  packageDigest: string
  archiveSha256: string
  archiveBytes: number
  archiveUrl: string
}

const identitySegment = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/
const packageVersion = /^[A-Za-z0-9](?:[A-Za-z0-9._+-]{0,126}[A-Za-z0-9])?$/
const sha256 = /^[a-f0-9]{64}$/
const requiredParameters = [
  "namespace",
  "id",
  "version",
  "packageDigest",
  "archiveSha256",
  "archiveBytes",
  "archiveUrl",
] as const

const archiveDownloadTimeoutMilliseconds = 30_000

function exactArchiveURL(raw: string): URL {
  const archive = new URL(raw)
  const loopback = archive.hostname === "127.0.0.1" || archive.hostname === "localhost" || archive.hostname === "[::1]"
  if (archive.protocol !== "https:" && !(archive.protocol === "http:" && loopback)) {
    throw new Error("Install handoff archive URL must use HTTPS or loopback HTTP")
  }
  if (archive.username || archive.password || archive.hash) {
    throw new Error("Install archive URL must not contain credentials or a fragment")
  }
  return archive
}

function oneParameter(url: URL, name: (typeof requiredParameters)[number]): string {
  const values = url.searchParams.getAll(name)
  if (values.length !== 1 || !values[0]) throw new Error(`Install handoff parameter ${name} must appear once`)
  return values[0]
}

export function parseExpertSquadInstallHandoff(raw: string): ExpertSquadInstallHandoff {
  if (raw.length > 4096) throw new Error("Expert Squad install handoff is too long")
  const url = new URL(raw)
  if (url.protocol !== "opencorvus:" || url.hostname !== "expert-squad" || url.pathname !== "/install") {
    throw new Error("Unsupported OpenCorvus install handoff route")
  }
  if (url.username || url.password || url.hash) throw new Error("Install handoff must not contain credentials or a fragment")
  for (const name of url.searchParams.keys()) {
    if (!requiredParameters.includes(name as (typeof requiredParameters)[number])) {
      throw new Error(`Unsupported install handoff parameter ${name}`)
    }
  }

  const namespace = oneParameter(url, "namespace")
  const id = oneParameter(url, "id")
  const version = oneParameter(url, "version")
  const packageDigest = oneParameter(url, "packageDigest")
  const archiveSha256 = oneParameter(url, "archiveSha256")
  const archiveBytes = Number(oneParameter(url, "archiveBytes"))
  const archiveUrl = oneParameter(url, "archiveUrl")
  if (!identitySegment.test(namespace) || !identitySegment.test(id)) throw new Error("Install handoff identity is invalid")
  if (!packageVersion.test(version)) throw new Error("Install handoff version is invalid")
  if (!sha256.test(packageDigest) || !sha256.test(archiveSha256)) throw new Error("Install handoff digest is invalid")
  if (
    !Number.isSafeInteger(archiveBytes) ||
    archiveBytes <= 0 ||
    archiveBytes > EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS.archiveBytes
  ) {
    throw new Error("Install handoff archive byte length is invalid")
  }

  const archive = exactArchiveURL(archiveUrl)

  return { namespace, id, version, packageDigest, archiveSha256, archiveBytes, archiveUrl: archive.href }
}

export function sameExpertSquadInstallHandoff(
  left: ExpertSquadInstallHandoff,
  right: ExpertSquadInstallHandoff,
): boolean {
  return (
    left.namespace === right.namespace &&
    left.id === right.id &&
    left.version === right.version &&
    left.packageDigest === right.packageDigest &&
    left.archiveSha256 === right.archiveSha256 &&
    left.archiveBytes === right.archiveBytes &&
    left.archiveUrl === right.archiveUrl
  )
}

export async function downloadExpertSquadInstallArchive(
  handoff: ExpertSquadInstallHandoff,
  fetcher: typeof fetch = fetch,
): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), archiveDownloadTimeoutMilliseconds)
  try {
    const response = await fetcher(handoff.archiveUrl, {
      headers: { Accept: "application/zip" },
      redirect: "error",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Hosted Expert Squad download failed with HTTP ${response.status}`)

    const finalURL = exactArchiveURL(response.url)
    if (finalURL.href !== handoff.archiveUrl) {
      throw new Error("Hosted Expert Squad download resolved to a different archive URL")
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase()
    if (contentType !== "application/zip") throw new Error("Hosted Expert Squad download is not a ZIP response")

    const contentLengthRaw = response.headers.get("content-length")
    if (!contentLengthRaw || !/^\d+$/.test(contentLengthRaw)) {
      throw new Error("Hosted Expert Squad download is missing an exact Content-Length")
    }
    const contentLength = Number(contentLengthRaw)
    if (contentLength !== handoff.archiveBytes || contentLength > EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS.archiveBytes) {
      throw new Error(
        `Hosted Expert Squad archive length mismatch: expected ${handoff.archiveBytes}, received ${contentLength}`,
      )
    }
    if (!response.body) throw new Error("Hosted Expert Squad download response has no body")

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > handoff.archiveBytes || received > EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS.archiveBytes) {
        await reader.cancel("Hosted Expert Squad archive exceeds its exact byte bound")
        throw new Error(`Hosted Expert Squad archive exceeds its exact byte bound: ${received}`)
      }
      chunks.push(value)
    }
    if (received !== handoff.archiveBytes) {
      throw new Error(
        `Hosted Expert Squad archive length mismatch: expected ${handoff.archiveBytes}, received ${received}`,
      )
    }

    const bytes = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes.buffer
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Hosted Expert Squad download timed out", { cause: error })
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
