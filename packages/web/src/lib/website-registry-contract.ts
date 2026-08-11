import { z } from "zod"

export function canonicalWebsiteRegistryJSON(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize)
    if (!input || typeof input !== "object") return input
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .sort(([left], [right]) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")))
        .map(([key, item]) => [key, normalize(item)]),
    )
  }
  return JSON.stringify(normalize(value))
}

const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const identifier = z.string().min(1).max(128)

const workflowNodeSchema = z.object({
  id: identifier,
  agentID: identifier,
  description: z.string(),
  dependsOn: z.array(identifier),
  localizedDescription: z.object({ root: z.string(), "zh-cn": z.string() }),
})

const websiteRegistryPackageSchema = z.object({
  identity: z.object({
    namespace: identifier,
    id: identifier,
    version: z.string().min(1).max(128),
    digest: sha256,
  }),
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  selectorSummary: z.string(),
  pillars: z.array(z.enum(["code", "work"])).min(1),
  agents: z.array(
    z.object({
      id: identifier,
      label: z.string().min(1),
      description: z.string().optional(),
      baseRole: identifier,
      displayLabel: z.object({ root: z.string().min(1), "zh-cn": z.string().min(1) }),
      localizedDescription: z.object({ root: z.string().optional(), "zh-cn": z.string().optional() }),
    }),
  ),
  workflows: z.array(
    z.object({
      id: identifier,
      label: z.string().min(1),
      description: z.string(),
      displayLabel: z.object({ root: z.string().min(1), "zh-cn": z.string().min(1) }),
      localizedDescription: z.object({ root: z.string(), "zh-cn": z.string() }),
      nodes: z.array(workflowNodeSchema),
    }),
  ),
  projectedCapabilities: z.object({ skills: z.number().int().nonnegative(), tools: z.number().int().nonnegative(), mcp: z.number().int().nonnegative() }),
  packageOwnedCapabilities: z.object({ skills: z.number().int().nonnegative(), tools: z.number().int().nonnegative(), mcp: z.number().int().nonnegative() }),
  configuration: z.object({ fields: z.number().int().nonnegative(), required: z.number().int().nonnegative() }),
  disposition: z.enum(["embedded_already_available", "bundled_market_importable"]),
  archive: z.object({
    path: z.string().startsWith("/expert-squads/archives/"),
    sha256,
    bytes: z.number().int().positive(),
    files: z.number().int().positive(),
  }),
  locales: z.array(
    z.object({
      locale: z.enum(["en", "zh-CN"]),
      label: z.string().min(1),
      description: z.string(),
      selectorSummary: z.string(),
    }),
  ).length(2),
  factsSha256: sha256,
})

export const websiteRegistrySeedSchema = z.object({
  protocol: z.literal("opencorvus/website-registry-seed@1"),
  schemaVersion: z.literal(1),
  catalog: z.object({
    path: z.string().startsWith("/expert-squads/catalogs/"),
    sha256,
    bytes: z.number().int().positive(),
  }),
  resources: z.object({
    total: z.number().int().positive(),
    embeddedAlreadyAvailable: z.number().int().nonnegative(),
    bundledMarketImportable: z.number().int().nonnegative(),
  }),
  packages: z.array(websiteRegistryPackageSchema).min(1),
})

export type WebsiteRegistrySeed = z.infer<typeof websiteRegistrySeedSchema>
export type WebsiteRegistrySeedPackage = WebsiteRegistrySeed["packages"][number]
export type ValidatedWebsiteRegistrySeed = {
  catalogBytes: Uint8Array
  packages: Array<{ entry: WebsiteRegistrySeedPackage; archiveBytes: Uint8Array }>
}

export type WebsitePublicationSummary = {
  id: number
  catalogSha256: string
  total: number
  embeddedAlreadyAvailable: number
  bundledMarketImportable: number
  activatedAt: string
}

export type WebsiteArchiveDescriptor = {
  revisionID: number
  sha256: string
  bytes: number
  relativePath: string
  filename: string
}

export class WebsiteRegistryConflictError extends Error {
  override readonly name = "WebsiteRegistryConflictError"
}

export class WebsiteRegistryIntegrityError extends Error {
  override readonly name = "WebsiteRegistryIntegrityError"
}
