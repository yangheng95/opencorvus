import path from "node:path"
import { fileURLToPath } from "node:url"
import { writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { ExpertSquadPackageManager } from "../../opencorvus/src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../opencorvus/src/expert-squad/registry"
import { EMBEDDED_EXPERT_SQUAD_IDS } from "../../opencorvus/src/expert-squad/builtin/ids"
import { payloadPackageSources } from "../../opencorvus/generated/expert-squad-payload"
import { projectExpertSquadFacts } from "../src/lib/expert-squad-facts"
import { projectPublicSquadRecord } from "../src/content/public-market"
import { squadCompositions } from "../src/content/squad-compositions"
import { canonicalWebsiteRegistryJSON } from "../src/lib/website-registry-contract"
import { generateExpertSquadDistribution } from "./generate-expert-squad-distribution"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")

function indexedPackageSource(id: string): ExpertSquadRegistry.EmbeddedPackageSource {
  const root = id === "squad-sdk" ? `expert-squads/builtin/${id}` : `packages/opencorvus/src/expert-squad/builtin/${id}`
  const listed = Bun.spawnSync({
    cmd: ["git", "ls-files", "--cached", "-z", "--", root],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (listed.exitCode !== 0) {
    throw new Error(`Could not read indexed embedded package ${id}: ${new TextDecoder().decode(listed.stderr)}`)
  }
  const trackedPaths = new TextDecoder().decode(listed.stdout).split("\0").filter(Boolean).sort()
  const files: Record<string, string> = {}
  for (const trackedPath of trackedPaths) {
    const shown = Bun.spawnSync({
      cmd: ["git", "show", `:${trackedPath}`],
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    })
    if (shown.exitCode !== 0) {
      throw new Error(
        `Could not read indexed embedded package file ${trackedPath}: ${new TextDecoder().decode(shown.stderr)}`,
      )
    }
    files[trackedPath.slice(root.length + 1)] = new TextDecoder("utf-8", { fatal: true }).decode(shown.stdout)
  }
  return { namespace: "builtin", id, files }
}

const market = await ExpertSquadPackageManager.payloadMarket({ projectDirectory: process.cwd() })
const marketByIdentity = new Map(market.map((item) => [`${item.namespace}/${item.id}`, item]))
const embeddedSources = EMBEDDED_EXPERT_SQUAD_IDS.map(indexedPackageSource)
const embeddedIDs = new Set(embeddedSources.map((source) => `${source.namespace}/${source.id}`))
const shippedSources = [...embeddedSources, ...payloadPackageSources]
const shippedIdentities = shippedSources.map((source) => `${source.namespace}/${source.id}`)
if (new Set(shippedIdentities).size !== shippedIdentities.length) {
  throw new Error("Shipped Expert Squad sources must have unique namespace/id identities.")
}

const shippedPackages = shippedSources.map((source) => ({
  source,
  loaded: ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source),
}))
for (const { loaded } of shippedPackages) {
  const identity = `${loaded.namespace}/${loaded.id}`
  if (embeddedIDs.has(identity)) continue
  const item = marketByIdentity.get(identity)
  if (!item || item.packageDigest !== loaded.packageDigest) {
    throw new Error(`Payload market and indexed declaration disagree for ${identity}`)
  }
}

const facts = shippedPackages
  .map(({ loaded }) => projectExpertSquadFacts(loaded))
  .sort((left, right) => {
    const leftIdentity = `${left.identity.namespace}/${left.identity.id}`
    const rightIdentity = `${right.identity.namespace}/${right.identity.id}`
    return leftIdentity.localeCompare(rightIdentity)
  })

const distribution = await generateExpertSquadDistribution(
  undefined,
  undefined,
  undefined,
  { sources: shippedSources, embeddedIdentities: embeddedIDs },
)
const archivesByIdentity = new Map<string, (typeof distribution.catalog.packages)[number]>(
  distribution.catalog.packages.map((entry) => [`${entry.namespace}/${entry.id}`, entry] as const),
)
const packages = facts.map((entry) => {
  const identity = `${entry.identity.namespace}/${entry.identity.id}`
  const archive = archivesByIdentity.get(identity)
  if (!archive || archive.packageDigest !== entry.identity.digest || archive.version !== entry.identity.version) {
    throw new Error(`Registry seed archive disagrees with canonical Market facts for ${identity}`)
  }
  const publicRecord = projectPublicSquadRecord(entry)
  const normalized = {
    ...entry,
    agents: publicRecord.agents,
    workflows: publicRecord.workflows,
    disposition: archive.disposition,
    archive: archive.archive,
    locales: [
      {
        locale: "en",
        label: publicRecord.displayLabel.root,
        description: publicRecord.description.root,
        selectorSummary: publicRecord.selectorSummary.root,
      },
      {
        locale: "zh-CN",
        label: publicRecord.displayLabel["zh-cn"],
        description: publicRecord.description["zh-cn"],
        selectorSummary: publicRecord.selectorSummary["zh-cn"],
      },
    ],
  }
  return {
    ...normalized,
    factsSha256: createHash("sha256").update(canonicalWebsiteRegistryJSON(normalized)).digest("hex"),
  }
})
const registrySeed = {
  protocol: "opencorvus/website-registry-seed@1",
  schemaVersion: 1,
  catalog: {
    path: distribution.catalogPath,
    sha256: distribution.catalogSha256,
    bytes: Buffer.byteLength(`${JSON.stringify(distribution.catalog, null, 2)}\n`),
  },
  resources: distribution.catalog.resources,
  packages,
}
await writeFile(
  new URL("../.generated/website-registry-seed.json", import.meta.url),
  `${JSON.stringify(registrySeed, null, 2)}\n`,
)

/*
 * Featured squads for the landing page.
 *
 * The landing page is statically prerendered, so it cannot read the SQLite registry: that module
 * imports bun:sqlite, and prerendering runs under Vite's Node-flavoured SSR loader where the bun:
 * scheme does not resolve. Emitting a plain module here keeps the landing page static and keeps one
 * source of truth — this script already owns squad facts for the whole site.
 *
 * Ranking: most declared surface first. A card with roles and workflows to show reads as a real
 * capability package, which is the entire job of the teaser row.
 */
const FEATURED_SQUAD_COUNT = 6
const featured = facts
  .map((entry) => projectPublicSquadRecord(entry))
  .sort(
    (left, right) =>
      right.agents.length + right.workflows.length - (left.agents.length + left.workflows.length) ||
      `${left.identity.namespace}/${left.identity.id}`.localeCompare(
        `${right.identity.namespace}/${right.identity.id}`,
      ),
  )
  .slice(0, FEATURED_SQUAD_COUNT)
  .map((record) => ({
    identity: record.identity,
    displayLabel: record.displayLabel,
    description: record.description,
    pillars: record.pillars,
    agentCount: record.agents.length,
    workflowCount: record.workflows.length,
  }))

await writeFile(
  new URL("../src/content/featured-squads.generated.ts", import.meta.url),
  [
    "// Auto-generated by script/generate-public-market.ts. Do not edit.",
    "// Consumed by the statically prerendered landing page, which cannot import the bun:sqlite registry.",
    "",
    "export const generatedFeaturedSquads = " + JSON.stringify(featured, null, 2) + " as const",
    "",
  ].join("\n"),
)

/*
 * Expert Squad composition facts.
 *
 * `src/content/squad-compositions.ts` declares which squads make up each published combination and
 * what each stage is called. It deliberately declares no counts: "six squads, thirty-three roles"
 * is exactly the claim that survives a year past the squad that gained a role. The counts are
 * resolved here, from the same records the market pages are built from, and an unknown squad id is
 * a hard failure rather than a silently shorter chain.
 */
const publicRecordsByIdentity = new Map<string, ReturnType<typeof projectPublicSquadRecord>>(
  facts.map((entry) => {
    const record = projectPublicSquadRecord(entry)
    return [`${record.identity.namespace}/${record.identity.id}`, record] as const
  }),
)

function resolveCompositionSquad(squadId: string, compositionID: string) {
  const record = publicRecordsByIdentity.get(squadId)
  if (!record) {
    throw new Error(
      `Squad composition ${compositionID} names ${squadId}, which is not in the shipped Expert Squad catalog`,
    )
  }
  return {
    namespace: record.identity.namespace,
    id: record.identity.id,
    displayLabel: record.displayLabel,
    agentCount: record.agents.length,
    workflowCount: record.workflows.length,
  }
}

const compositions = Object.fromEntries(
  squadCompositions.map((composition) => {
    const squads = composition.steps.map((step) => resolveCompositionSquad(step.squadId, composition.id))
    const extras = (composition.extras?.squadIds ?? []).map((id) => resolveCompositionSquad(id, composition.id))
    const roleCount = squads.reduce((sum, squad) => sum + squad.agentCount, 0)
    const extraRoleCount = extras.reduce((sum, squad) => sum + squad.agentCount, 0)
    return [
      composition.id,
      {
        squads,
        extras,
        squadCount: squads.length,
        roleCount,
        withExtrasSquadCount: squads.length + extras.length,
        withExtrasRoleCount: roleCount + extraRoleCount,
      },
    ] as const
  }),
)

await writeFile(
  new URL("../src/content/squad-compositions.generated.ts", import.meta.url),
  [
    "// Auto-generated by script/generate-public-market.ts. Do not edit.",
    "// Squad and role counts for every combination declared in src/content/squad-compositions.ts,",
    "// resolved from the shipped catalog so published totals cannot drift from the packages.",
    "//",
    "// Typed rather than `as const`: these are counts a consumer does arithmetic over, and literal",
    "// types would make `roleCount === sum(agentCount)` a type error instead of an assertion.",
    "",
    "export type GeneratedCompositionSquad = {",
    "  readonly namespace: string",
    "  readonly id: string",
    "  readonly displayLabel: { readonly root: string; readonly \"zh-cn\": string }",
    "  readonly agentCount: number",
    "  readonly workflowCount: number",
    "}",
    "",
    "export type GeneratedComposition = {",
    "  readonly squads: readonly GeneratedCompositionSquad[]",
    "  readonly extras: readonly GeneratedCompositionSquad[]",
    "  readonly squadCount: number",
    "  readonly roleCount: number",
    "  readonly withExtrasSquadCount: number",
    "  readonly withExtrasRoleCount: number",
    "}",
    "",
    "export const generatedSquadCompositions: Readonly<Record<string, GeneratedComposition>> =",
    JSON.stringify(compositions, null, 2),
    "",
  ].join("\n"),
)
