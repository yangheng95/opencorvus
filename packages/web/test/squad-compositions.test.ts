import { describe, expect, test } from "bun:test"
import {
  FEATURED_COMPOSITION_ID,
  SELF_PAPER_COMPOSITION_ID,
  squadCompositions,
} from "../src/content/squad-compositions"
import { generatedSquadCompositions } from "../src/content/squad-compositions.generated"

const identity = (entry: { readonly namespace: string; readonly id: string }) => `${entry.namespace}/${entry.id}`

describe("generated long-Mission composition facts", () => {
  test("projects the accepted DeBERTa and self-paper stage contracts from catalog squads", () => {
    const deberta = squadCompositions.find((entry) => entry.id === FEATURED_COMPOSITION_ID)!
    const generatedDeberta = generatedSquadCompositions[FEATURED_COMPOSITION_ID]!
    const selfPaper = squadCompositions.find((entry) => entry.id === SELF_PAPER_COMPOSITION_ID)!
    const generatedSelfPaper = generatedSquadCompositions[SELF_PAPER_COMPOSITION_ID]!

    expect(generatedDeberta.squads.map(identity)).toEqual(deberta.steps.map((step) => step.squadId))
    expect(generatedDeberta.expanded.map(identity)).toEqual(deberta.expandedSteps!.map((step) => step.squadId))
    expect({
      baseStages: generatedDeberta.squadCount,
      baseRoles: generatedDeberta.roleCount,
      expandedStages: generatedDeberta.expandedSquadCount,
      expandedRoles: generatedDeberta.expandedRoleCount,
    }).toEqual({ baseStages: 6, baseRoles: 44, expandedStages: 18, expandedRoles: 99 })
    expect(
      deberta.expandedLanes!.map((lane) => ({
        id: lane.id,
        stages: deberta.expandedSteps!.filter((step) => step.laneId === lane.id).length,
      })),
    ).toEqual([
      { id: "evidence", stages: 3 },
      { id: "compute", stages: 4 },
      { id: "product", stages: 2 },
      { id: "publication", stages: 6 },
      { id: "release", stages: 3 },
    ])
    expect({ requirements: deberta.requirements!.length, outputs: deberta.outputs!.length }).toEqual({
      requirements: 6,
      outputs: 7,
    })
    expect(deberta.artifacts).toEqual([
      {
        label: {
          root: "View the audited CUDA experiment artifact on GitHub",
          "zh-cn": "查看经审计的 CUDA 实验 GitHub 产物",
        },
        href: "https://github.com/yangheng95/deberta-v3-absa-public-evidence",
      },
    ])

    expect(generatedSelfPaper.squads.map(identity)).toEqual(selfPaper.steps.map((step) => step.squadId))
    expect({
      stages: generatedSelfPaper.squadCount,
      roles: generatedSelfPaper.roleCount,
    }).toEqual({ stages: 9, roles: 55 })
    expect(
      selfPaper.lanes!.map((lane) => ({
        id: lane.id,
        stages: selfPaper.steps.filter((step) => step.laneId === lane.id).length,
      })),
    ).toEqual([
      { id: "foundation", stages: 3 },
      { id: "evaluation", stages: 2 },
      { id: "publication", stages: 3 },
      { id: "review", stages: 1 },
    ])
    expect({ requirements: selfPaper.requirements!.length, outputs: selfPaper.outputs!.length }).toEqual({
      requirements: 6,
      outputs: 6,
    })
  })
})
