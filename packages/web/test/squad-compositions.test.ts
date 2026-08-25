import { describe, expect, test } from "bun:test"
import {
  FEATURED_COMPOSITION_ID,
  SELF_PAPER_COMPOSITION_ID,
  squadCompositions,
} from "../src/content/squad-compositions"
import { generatedSquadCompositions } from "../src/content/squad-compositions.generated"

const identity = (entry: { readonly namespace: string; readonly id: string }) =>
  `${entry.namespace}/${entry.id}`

describe("generated long-Mission composition facts", () => {
  test("projects the accepted DeBERTa and self-paper stage contracts from catalog squads", () => {
    const deberta = squadCompositions.find((entry) => entry.id === FEATURED_COMPOSITION_ID)!
    const generatedDeberta = generatedSquadCompositions[FEATURED_COMPOSITION_ID]!
    const selfPaper = squadCompositions.find((entry) => entry.id === SELF_PAPER_COMPOSITION_ID)!
    const generatedSelfPaper = generatedSquadCompositions[SELF_PAPER_COMPOSITION_ID]!

    expect(generatedDeberta.squads.map(identity)).toEqual(deberta.steps.map((step) => step.squadId))
    expect(generatedDeberta.expanded.map(identity)).toEqual(
      deberta.expandedSteps!.map((step) => step.squadId),
    )
    expect({
      baseStages: generatedDeberta.squadCount,
      baseRoles: generatedDeberta.roleCount,
      expandedStages: generatedDeberta.expandedSquadCount,
      expandedRoles: generatedDeberta.expandedRoleCount,
    }).toEqual({ baseStages: 6, baseRoles: 44, expandedStages: 18, expandedRoles: 99 })

    expect(generatedSelfPaper.squads.map(identity)).toEqual(selfPaper.steps.map((step) => step.squadId))
    expect({
      stages: generatedSelfPaper.squadCount,
      roles: generatedSelfPaper.roleCount,
    }).toEqual({ stages: 9, roles: 55 })
  })
})
