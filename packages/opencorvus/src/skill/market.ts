import { createHash } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export namespace SkillMarket {
  export const ID = "skills-sh" as const
  export const ORIGIN = "https://skills.sh" as const
  const REQUEST_TIMEOUT_MS = 20_000
  const MAX_FILES = 200
  const MAX_FILE_BYTES = 2 * 1024 * 1024
  const MAX_BUNDLE_BYTES = 10 * 1024 * 1024
  const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

  export const UpstreamError = NamedError.create(
    "SkillMarketUpstreamError",
    z
      .object({
        operation: z.enum(["search", "download"]),
        endpoint: z.string().url(),
        message: z.string(),
        status: z.number().int().optional(),
      })
      .strict(),
  )

  export const Provider = z
    .object({
      id: z.literal(ID),
      name: z.literal("skills.sh"),
      provider: z.literal("skills.sh"),
      description: z.string(),
      homepage: z.literal(ORIGIN),
      api_origin: z.literal(ORIGIN),
      searchable: z.literal(true),
      exact_install: z.literal(true),
      trust: z.literal("curated"),
      recommended_policy: z.literal("deny"),
    })
    .strict()

  export const SearchInput = z
    .object({
      query: z.string().trim().min(2).max(120),
      limit: z.coerce.number().int().min(1).max(20).default(10),
    })
    .strict()

  export const Identity = z
    .string()
    .trim()
    .regex(/^[a-z0-9_.-]+\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/i)
    .refine((value) => value.split("/").every(portableIdentitySegment), {
      message: "Skill Market identity segments must be portable directory names",
    })

  export const Candidate = z
    .object({
      id: z.string(),
      skill_id: z.string(),
      name: z.string(),
      source: z.string(),
      installs: z.number().int().nonnegative(),
      homepage: z.string().url(),
      repository: z.string().url(),
    })
    .strict()

  export const BundleFile = z
    .object({
      path: z.string(),
      content: z.string(),
    })
    .strict()

  export const Bundle = z
    .object({
      id: z.string(),
      source: z.string(),
      skill_id: z.string(),
      upstream_hash: z.string().optional(),
      hash: z.string().regex(/^[a-f0-9]{64}$/),
      files: BundleFile.array(),
    })
    .strict()

  const SearchResponse = z.object({
    skills: z
      .object({
        id: z.string().optional(),
        skillId: z.string().min(1),
        name: z.string().min(1),
        installs: z.number().int().nonnegative().default(0),
        source: z.string().min(1),
      })
      .array(),
  })

  const DownloadResponse = z.object({
    files: z
      .object({
        path: z.string().min(1),
        contents: z.string(),
      })
      .array()
      .max(MAX_FILES),
    hash: z.string().min(1).optional(),
  })

  export function provider() {
    return Provider.parse({
      id: ID,
      name: "skills.sh",
      provider: "skills.sh",
      description: "Searchable Agent Skills directory with exact, content-hashed Skill bundle downloads.",
      homepage: ORIGIN,
      api_origin: ORIGIN,
      searchable: true,
      exact_install: true,
      trust: "curated",
      recommended_policy: "deny",
    })
  }

  export function identity(raw: string) {
    const id = raw.trim()
    const match = /^([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)$/i.exec(id)
    if (!match) throw new Error(`Invalid Skill Market identity: ${raw}`)
    const segments = match.slice(1).map((segment) => segment!.toLowerCase())
    if (segments.some((segment) => !portableIdentitySegment(segment))) {
      throw new Error(`Invalid Skill Market identity: ${raw}`)
    }
    const [owner, repository, skillID] = segments as [string, string, string]
    return {
      id: `${owner}/${repository}/${skillID}`,
      source: `${owner}/${repository}`,
      owner,
      repository,
      skillID,
    }
  }

  export async function search(raw: z.input<typeof SearchInput>) {
    const input = SearchInput.parse(raw)
    const url = new URL("/api/search", ORIGIN)
    url.searchParams.set("q", input.query)
    url.searchParams.set("limit", String(input.limit))
    try {
      const response = SearchResponse.parse(await requestJson(url, "search"))
      return Candidate.array().parse(
        response.skills.map((item) => {
          const parsed = identity(item.id ?? `${item.source}/${item.skillId}`)
          if (parsed.source !== item.source.toLowerCase() || parsed.skillID !== item.skillId.toLowerCase()) {
            throw new Error(`Skill Market search identity mismatch: ${parsed.id}`)
          }
          return {
            id: parsed.id,
            skill_id: parsed.skillID,
            name: item.name,
            source: parsed.source,
            installs: item.installs,
            homepage: `${ORIGIN}/${parsed.id}`,
            repository: `https://github.com/${parsed.source}`,
          }
        }),
      )
    } catch (error) {
      throw asUpstreamError("search", url, error)
    }
  }

  export async function download(rawID: string) {
    const parsed = identity(rawID)
    const url = new URL(
      `/api/download/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/${encodeURIComponent(parsed.skillID)}`,
      ORIGIN,
    )
    try {
      const response = DownloadResponse.parse(await requestJson(url, "download"))
      if (response.files.length === 0) throw new Error(`Skill Market bundle is empty: ${parsed.id}`)

      const seen = new Set<string>()
      let totalBytes = 0
      const files = response.files.map((file) => {
        const filePath = safeBundlePath(file.path)
        const key = filePath.normalize("NFC").toLowerCase()
        if (seen.has(key)) throw new Error(`Skill Market bundle contains a duplicate path: ${filePath}`)
        seen.add(key)
        const bytes = Buffer.byteLength(file.contents, "utf8")
        if (bytes > MAX_FILE_BYTES) throw new Error(`Skill Market bundle file is too large: ${filePath}`)
        totalBytes += bytes
        if (totalBytes > MAX_BUNDLE_BYTES) {
          throw new Error(`Skill Market bundle is larger than ${MAX_BUNDLE_BYTES} bytes`)
        }
        return { path: filePath, content: file.contents }
      })
      const skillFiles = files.filter((file) => file.path.toLowerCase() === "skill.md")
      if (skillFiles.length !== 1) {
        throw new Error(`Skill Market bundle must contain exactly one root SKILL.md: ${parsed.id}`)
      }

      return Bundle.parse({
        id: parsed.id,
        source: parsed.source,
        skill_id: parsed.skillID,
        upstream_hash: response.hash,
        hash: digest(files),
        files,
      })
    } catch (error) {
      throw asUpstreamError("download", url, error)
    }
  }

  export function invalidBundleError(rawID: string, cause: unknown) {
    const parsed = identity(rawID)
    const endpoint = new URL(
      `/api/download/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/${encodeURIComponent(parsed.skillID)}`,
      ORIGIN,
    )
    return new UpstreamError(
      {
        operation: "download",
        endpoint: publicEndpoint(endpoint),
        message: "Skill Market download returned an invalid Skill bundle.",
      },
      { cause },
    )
  }

  function portableIdentitySegment(segment: string) {
    return segment !== "." && segment !== ".." && !/[. ]$/.test(segment) && !WINDOWS_RESERVED_NAME.test(segment)
  }

  function safeBundlePath(raw: string) {
    if (raw.includes("\\") || raw.startsWith("/") || /^[a-z]:/i.test(raw) || raw.includes("\0")) {
      throw new Error(`Skill Market bundle contains an unsafe path: ${raw}`)
    }
    const segments = raw.split("/")
    if (
      segments.length === 0 ||
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          /[<>:"|?*\u0000-\u001f]/.test(segment) ||
          /[. ]$/.test(segment) ||
          WINDOWS_RESERVED_NAME.test(segment),
      )
    ) {
      throw new Error(`Skill Market bundle contains an unsafe path: ${raw}`)
    }
    return segments.join("/")
  }

  function digest(files: readonly z.infer<typeof BundleFile>[]) {
    const hash = createHash("sha256")
    for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
      hash.update(file.path)
      hash.update("\0")
      hash.update(file.content)
      hash.update("\0")
    }
    return hash.digest("hex")
  }

  async function requestJson(url: URL, operation: "search" | "download") {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "OpenCorvus Skill Market" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (error) {
      throw new UpstreamError(
        {
          operation,
          endpoint: publicEndpoint(url),
          message: `Skill Market ${operation} request failed.`,
        },
        { cause: error },
      )
    }
    if (!response.ok) {
      throw new UpstreamError({
        operation,
        endpoint: publicEndpoint(url),
        message: `Skill Market ${operation} request returned HTTP ${response.status}.`,
        status: response.status,
      })
    }
    try {
      return await response.json()
    } catch (error) {
      throw new UpstreamError(
        {
          operation,
          endpoint: publicEndpoint(url),
          message: `Skill Market ${operation} returned invalid JSON.`,
        },
        { cause: error },
      )
    }
  }

  function publicEndpoint(url: URL) {
    return `${url.origin}${url.pathname}`
  }

  function asUpstreamError(operation: "search" | "download", url: URL, error: unknown) {
    if (UpstreamError.isInstance(error)) return error
    return new UpstreamError(
      {
        operation,
        endpoint: publicEndpoint(url),
        message: `Skill Market ${operation} returned an invalid response.`,
      },
      { cause: error },
    )
  }
}
