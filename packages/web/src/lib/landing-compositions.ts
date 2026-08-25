import { publicPath, type PublicLocale } from "../content/public-market"
import { FEATURED_COMPOSITION_ID, SELF_PAPER_COMPOSITION_ID, squadCompositions } from "../content/squad-compositions"
import {
  generatedSquadCompositions,
  type GeneratedComposition,
  type GeneratedCompositionSquad,
} from "../content/squad-compositions.generated"

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
  readonly laneId?: string
}

export type CompositionLaneView = {
  readonly id: string
  readonly tone: "research" | "compute" | "product" | "publication" | "release"
  readonly label: string
  readonly summary: string
  readonly outcome: string
  readonly roleCount: number
  readonly steps: readonly CompositionStepView[]
}

export type CompositionView = {
  readonly id: string
  readonly title: string
  readonly lead: string
  readonly prompt?: string
  readonly requirements?: readonly string[]
  readonly outputs?: readonly string[]
  readonly squadCount: number
  readonly roleCount: number
  readonly steps: readonly CompositionStepView[]
  readonly lanes?: readonly CompositionLaneView[]
  readonly expanded?: {
    readonly squadCount: number
    readonly roleCount: number
    readonly steps: readonly CompositionStepView[]
    readonly lanes?: readonly CompositionLaneView[]
  }
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

  const stepsOf = (
    steps: typeof declared.steps,
    squads: readonly GeneratedCompositionSquad[],
    boundary: "base" | "expanded",
  ) =>
    steps.map((step, index) => {
      // Paired by position, so the pairing is asserted rather than assumed: a step added to the
      // editorial file without re-running `market:data` would otherwise read `undefined.displayLabel`
      // and blame the wrong file.
      const squad = squads[index]
      if (!squad || `${squad.namespace}/${squad.id}` !== step.squadId) {
        throw new Error(
          `Squad composition ${id} ${boundary} step ${index} declares ${step.squadId} but the generated facts have ` +
            `${squad ? `${squad.namespace}/${squad.id}` : "nothing"}; run \`bun run market:data\``,
        )
      }
      return {
        stage: step.stage[locale],
        squadLabel: squad.displayLabel[locale],
        href: publicPath(locale, `/market/${squad.namespace}/${squad.id}/`),
        agentCount: squad.agentCount,
        handoff: step.handoff[locale],
        ...(step.laneId ? { laneId: step.laneId } : {}),
      }
    })

  const lanesOf = (
    lanes: typeof declared.lanes | typeof declared.expandedLanes,
    steps: readonly CompositionStepView[],
    boundary: "base" | "expanded",
  ): readonly CompositionLaneView[] | undefined => {
    if (!lanes) return undefined
    const projected = lanes.map((lane) => {
      const laneSteps = steps.filter((step) => step.laneId === lane.id)
      if (laneSteps.length === 0) {
        throw new Error(`Squad composition ${id} ${boundary} lane ${lane.id} has no declared steps`)
      }
      return {
        id: lane.id,
        tone: lane.tone,
        label: lane.label[locale],
        summary: lane.summary[locale],
        outcome: lane.outcome[locale],
        roleCount: laneSteps.reduce((sum, step) => sum + step.agentCount, 0),
        steps: laneSteps,
      }
    })
    if (projected.reduce((sum, lane) => sum + lane.steps.length, 0) !== steps.length) {
      throw new Error(`Squad composition ${id} ${boundary} lanes do not own every declared step`)
    }
    return projected
  }

  const steps = stepsOf(declared.steps, generated.squads, "base")
  const expandedSteps = declared.expandedSteps
    ? stepsOf(declared.expandedSteps, generated.expanded, "expanded")
    : undefined

  return {
    id,
    title: declared.title[locale],
    lead: declared.lead[locale],
    ...(declared.prompt ? { prompt: declared.prompt[locale] } : {}),
    ...(declared.requirements ? { requirements: declared.requirements.map((requirement) => requirement[locale]) } : {}),
    ...(declared.outputs ? { outputs: declared.outputs.map((output) => output[locale]) } : {}),
    squadCount: generated.squadCount,
    roleCount: generated.roleCount,
    steps,
    ...(declared.lanes ? { lanes: lanesOf(declared.lanes, steps, "base") } : {}),
    ...(declared.expandedSteps && expandedSteps
      ? {
          expanded: {
            squadCount: generated.expandedSquadCount,
            roleCount: generated.expandedRoleCount,
            steps: expandedSteps,
            ...(declared.expandedLanes ? { lanes: lanesOf(declared.expandedLanes, expandedSteps, "expanded") } : {}),
          },
        }
      : {}),
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

/** The second full-size case: OpenCorvus researching and writing its own systems paper. */
export function selfPaperComposition(locale: PublicLocale): CompositionView {
  return viewOf(SELF_PAPER_COMPOSITION_ID, locale)
}

/** The remaining combinations, in declaration order. */
export function otherCompositions(locale: PublicLocale): CompositionView[] {
  return squadCompositions
    .filter((composition) => composition.id !== FEATURED_COMPOSITION_ID && composition.id !== SELF_PAPER_COMPOSITION_ID)
    .map((composition) => viewOf(composition.id, locale))
}
