import { publicPath, type PublicLocale } from "../content/public-market"
import { FEATURED_COMPOSITION_ID, squadCompositions } from "../content/squad-compositions"
import { generatedSquadCompositions, type GeneratedComposition } from "../content/squad-compositions.generated"

/**
 * Render-ready view of the published Expert Squad combinations.
 *
 * Joins the editorial declaration (`squad-compositions.ts` — which squads, stage names, handoffs)
 * with the counts generated from the shipped catalog. The landing page and the composition doc both
 * read this, so a chain shown in one place cannot disagree with the other.
 *
 * Static by construction, like `landing-featured-squads.ts`: the landing page is prerendered and
 * cannot import the bun:sqlite registry.
 */

export type CompositionStepView = {
  readonly stage: string
  readonly squadLabel: string
  readonly href: string
  readonly agentCount: number
  readonly handoff: string
}

export type CompositionView = {
  readonly id: string
  readonly title: string
  readonly lead: string
  readonly squadCount: number
  readonly roleCount: number
  readonly steps: readonly CompositionStepView[]
  /** Present only where the chain declares optional extensions. Counts include the base chain. */
  readonly extras?: {
    readonly lead: string
    readonly labels: readonly string[]
    readonly squadCount: number
    readonly roleCount: number
  }
}

function generatedFor(id: string): GeneratedComposition {
  const generated: GeneratedComposition | undefined = generatedSquadCompositions[id]
  // The generator throws on an unknown squad, but a composition added to the editorial file without
  // re-running `market:data` would otherwise render as an empty chain. Fail where it is readable.
  if (!generated) throw new Error(`Squad composition ${id} has no generated facts; run \`bun run market:data\``)
  return generated
}

function viewOf(id: string, locale: PublicLocale): CompositionView {
  const declared = squadCompositions.find((composition) => composition.id === id)
  if (!declared) throw new Error(`Squad composition ${id} is not declared`)
  const generated = generatedFor(id)

  return {
    id,
    title: declared.title[locale],
    lead: declared.lead[locale],
    squadCount: generated.squadCount,
    roleCount: generated.roleCount,
    steps: declared.steps.map((step, index) => {
      // Paired by position, so the pairing is asserted rather than assumed: a step added to the
      // editorial file without re-running `market:data` would otherwise read `undefined.displayLabel`
      // and blame the wrong file.
      const squad = generated.squads[index]
      if (!squad || `${squad.namespace}/${squad.id}` !== step.squadId) {
        throw new Error(
          `Squad composition ${id} step ${index} declares ${step.squadId} but the generated facts have ` +
            `${squad ? `${squad.namespace}/${squad.id}` : "nothing"}; run \`bun run market:data\``,
        )
      }
      return {
        stage: step.stage[locale],
        squadLabel: squad.displayLabel[locale],
        href: publicPath(locale, `/market/${squad.namespace}/${squad.id}/`),
        agentCount: squad.agentCount,
        handoff: step.handoff[locale],
      }
    }),
    ...(declared.extras
      ? {
          extras: {
            lead: declared.extras.lead[locale],
            labels: generated.extras.map((squad) => squad.displayLabel[locale]),
            squadCount: generated.withExtrasSquadCount,
            roleCount: generated.withExtrasRoleCount,
          },
        }
      : {}),
  }
}

/** The case study, rendered in full. */
export function featuredComposition(locale: PublicLocale): CompositionView {
  return viewOf(FEATURED_COMPOSITION_ID, locale)
}

/** The remaining combinations, in declaration order. */
export function otherCompositions(locale: PublicLocale): CompositionView[] {
  return squadCompositions
    .filter((composition) => composition.id !== FEATURED_COMPOSITION_ID)
    .map((composition) => viewOf(composition.id, locale))
}
