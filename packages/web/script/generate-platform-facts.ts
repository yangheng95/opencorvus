import path from "node:path"
import { fileURLToPath } from "node:url"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { READY_CHANNELS, PLANNED_CHANNELS } from "../../channel-runtime/src/registry"
import { GLOBAL_TOOL_IDS, BATCH_TOOL_ID } from "../../opencorvus/src/tool/tool-id-catalog"

/**
 * Derives the platform counts the landing page states from the registries that own them.
 *
 * A marketing number with no generator is a number that drifts, and these four drifted silently
 * for as long as they were string literals in the copy. Each one below names the expression it
 * comes from, so a reviewer can re-derive it by hand.
 *
 * Deliberate choices, because each of these numbers has a defensible larger variant and shipping
 * the larger one would overstate the product:
 *
 * - Providers/models come from the bundled bootstrap catalog exactly as it sits on disk. At runtime
 *   `ModelsDev.withLocalProviders()` synthesizes one extra provider (`kilo`) with one model, so the
 *   provisioned catalog is 88/2,580. We publish the bundled figures: they are one lower, and they
 *   are reproducible from a file in the repository rather than from runtime state.
 * - Channels are `READY_CHANNELS`, the adapters actually registered. The catalog holds 27 entries,
 *   14 of them `planned` (`qqbot` among them, which is why the docs sidebar listing it is not a
 *   count of working channels).
 * - Tools are the materialized built-ins: every global tool ID except `batch`, which is
 *   experimental, off by default, and synthesized per turn rather than living in the registry array.
 *
 * @see docs/website-restyle-plan.md 数字出处标记 — every published number carries its provenance.
 */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const platformFactsMetadataPath = path.join(webRoot, "src", "content", "platform-facts.generated.ts")
const bootstrapCatalogPath = path.join(webRoot, "..", "opencorvus", "src", "provider", "models-bootstrap.json")

type BootstrapProvider = { models?: Record<string, unknown> }

/**
 * The bundled catalog is read and shape-checked here rather than imported through
 * `src/provider/models.ts`. That module pulls the runtime's `Global` paths, `Installation`, and a
 * lockfile dependency on import — none of which a build script should touch to count records.
 */
async function readBundledCatalog(): Promise<Record<string, BootstrapProvider>> {
  let parsed: unknown
  const text = await readFile(bootstrapCatalogPath, "utf8")
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(
      `Bundled model catalog is invalid JSON at ${bootstrapCatalogPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Bundled model catalog must be a provider record, received ${typeof parsed}`)
  }
  const catalog = parsed as Record<string, BootstrapProvider>
  const malformed = Object.entries(catalog)
    .filter(([, provider]) => !provider || typeof provider !== "object" || typeof provider.models !== "object")
    .map(([id]) => id)
  if (malformed.length > 0) {
    throw new Error(`Bundled model catalog providers are missing a models record: ${malformed.join(", ")}`)
  }
  return catalog
}

export type GeneratedPlatformFacts = {
  modelProviders: number
  models: number
  chatChannels: number
  plannedChatChannels: number
  builtInTools: number
}

export async function derivePlatformFacts(): Promise<GeneratedPlatformFacts> {
  const catalog = await readBundledCatalog()

  const modelProviders = Object.keys(catalog).length
  const models = Object.values(catalog).reduce((total, provider) => total + Object.keys(provider.models ?? {}).length, 0)
  const chatChannels = READY_CHANNELS.length
  const plannedChatChannels = PLANNED_CHANNELS.length
  const builtInTools = GLOBAL_TOOL_IDS.filter((toolID) => toolID !== BATCH_TOOL_ID).length

  // A count that silently reaches zero would publish "0 model providers" rather than fail the
  // build, so every derivation is asserted before it is written.
  if (modelProviders === 0) throw new Error("Bundled model catalog contains no providers")
  if (models < modelProviders) {
    throw new Error(`Model total ${models} is below the provider total ${modelProviders}; the catalog shape changed`)
  }
  if (chatChannels === 0) throw new Error("No channel adapters are registered; READY_CHANNELS is empty")
  const overlap = READY_CHANNELS.filter((id) => (PLANNED_CHANNELS as readonly string[]).includes(id))
  if (overlap.length > 0) {
    throw new Error(`Channels cannot be both ready and planned: ${overlap.join(", ")}`)
  }
  if (!GLOBAL_TOOL_IDS.includes(BATCH_TOOL_ID)) {
    throw new Error(`${BATCH_TOOL_ID} left GLOBAL_TOOL_IDS; the built-in tool derivation needs revisiting`)
  }
  if (builtInTools !== GLOBAL_TOOL_IDS.length - 1) {
    throw new Error("Exactly one global tool ID is expected to be excluded from the published built-in tool count")
  }
  const duplicateToolIDs = GLOBAL_TOOL_IDS.length - new Set<string>(GLOBAL_TOOL_IDS).size
  if (duplicateToolIDs > 0) throw new Error(`GLOBAL_TOOL_IDS contains ${duplicateToolIDs} duplicate entries`)

  return { modelProviders, models, chatChannels, plannedChatChannels, builtInTools }
}

export async function generatePlatformFacts(metadataPath = platformFactsMetadataPath) {
  const facts = await derivePlatformFacts()
  const contents = [
    "// Auto-generated by script/generate-platform-facts.ts. Do not edit by hand.",
    "//",
    "// Derivations, so a reviewer can re-check every number:",
    "//   modelProviders      Object.keys(src/provider/models-bootstrap.json).length",
    "//   models              sum of Object.keys(provider.models).length across that catalog",
    "//   chatChannels        READY_CHANNELS.length      (channel-runtime/src/registry.ts)",
    "//   plannedChatChannels PLANNED_CHANNELS.length    (same file; not advertised as working)",
    "//   builtInTools        GLOBAL_TOOL_IDS minus the experimental batch tool",
    `export const generatedPlatformFacts = ${JSON.stringify(facts, null, 2)} as const`,
    "",
  ].join("\n")
  await mkdir(path.dirname(metadataPath), { recursive: true })
  await writeFile(metadataPath, contents)
  return facts
}

if (import.meta.main) {
  console.log(JSON.stringify(await generatePlatformFacts()))
}
