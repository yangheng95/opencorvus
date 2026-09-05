import { generatedExpertSquadDistribution } from "./expert-squad-distribution.generated"
import { generatedPlatformFacts } from "./platform-facts.generated"

/**
 * Every number the public landing page states about the product, in one place, each carrying where
 * it came from.
 *
 * The point of the `source` field is that a marketing number with no generator is a number that
 * drifts. Every fact below is now derived: squad counts from the signed catalog, the platform counts
 * from the registries that own them (`script/generate-platform-facts.ts`). The `"manual"` variant is
 * kept so that a future hand-maintained number has to declare itself in code rather than hide in a
 * template string. Generator data contracts are checked against their owning registries;
 * the presentation is verified on the actual page.
 *
 * Presentation rule that follows from this: lead with generated facts. A "manual" number may
 * support a claim but should not be the largest thing on the page.
 */

type FactSource =
  /** Derived from a registry or catalog by a script under packages/web/script. Safe to feature. */
  | "generated"
  /** Hand-maintained. No generator, no test. Do not feature; see the tracked follow-up. */
  | "manual"

export type PlatformFact = {
  readonly value: string
  readonly source: FactSource
}

/**
 * Grouped thousands, written out rather than delegated to `toLocaleString`, which varies with the
 * build host's ICU data and would make the rendered page depend on where it was built.
 */
function grouped(value: number): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

const generated = (value: string | number): PlatformFact => ({ value: String(value), source: "generated" })

export const platformFacts = {
  /** Total expert squads in the signed public catalog. */
  squadTotal: generated(generatedExpertSquadDistribution.total),
  /** Squads usable with no import step. */
  squadEmbedded: generated(generatedExpertSquadDistribution.embeddedAlreadyAvailable),
  /** Squads importable from the public catalog. */
  squadImportable: generated(generatedExpertSquadDistribution.bundledMarketImportable),

  /** Providers in the bundled model catalog. One lower than runtime, which synthesizes `kilo`. */
  modelProviders: generated(generatedPlatformFacts.modelProviders),
  /** Models across that same bundled catalog. */
  models: generated(grouped(generatedPlatformFacts.models)),
  /** Chat channels with a registered adapter. Excludes the 14 `planned` catalog entries. */
  chatChannels: generated(generatedPlatformFacts.chatChannels),
  /** Global built-in tool IDs declared by the current catalog. */
  builtInTools: generated(generatedPlatformFacts.builtInTools),
} as const satisfies Record<string, PlatformFact>

/** True when a fact is safe to render as a headline figure. */
export function isFeaturable(fact: PlatformFact): boolean {
  return fact.source === "generated"
}
