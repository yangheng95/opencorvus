import { describe, expect, test } from "bun:test"
import { generatedShippedSquadFacts } from "../src/content/public-market-facts.generated"
import { expertSquadRoadmapCandidates } from "../src/content/workbuddy-expert-squad-candidates"
import {
  createDefaultChecklistDraft,
  exportParallelWorkDeclaration,
  moveChecklistID,
  parseChecklistDraft,
  reorderChecklistIDs,
} from "../src/lib/expert-squad-checklist-state"

describe("Expert Squad expansion checklist model", () => {
  test("projects one Skill-complete fact for every uniquely shipped Expert Squad", () => {
    expect(generatedShippedSquadFacts).toHaveLength(29)
    expect(new Set(generatedShippedSquadFacts.map((squad) => squad.identity)).size).toBe(29)
    for (const squad of generatedShippedSquadFacts) {
      expect(squad.packageSkillPaths.length).toBeGreaterThan(0)
      expect(squad.packageSkillRefs.length).toBeGreaterThan(0)
      expect(squad.packageDigest).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  test("keeps every candidate bound to explicit Skill evidence and an implementation status", () => {
    expect(new Set(expertSquadRoadmapCandidates.map((candidate) => candidate.id)).size).toBe(
      expertSquadRoadmapCandidates.length,
    )
    for (const candidate of expertSquadRoadmapCandidates) {
      expect(candidate.skillSources.length).toBeGreaterThan(0)
      for (const source of candidate.skillSources) {
        expect(source.url).toMatch(/^https:\/\//)
        expect(source.license.length).toBeGreaterThan(0)
        expect(source.targetPath.startsWith(`expert-squads/builtin/${candidate.id}/skills/`)).toBe(true)
        expect(source.targetPath.endsWith("/SKILL.md")).toBe(true)
        if (source.repository !== "OpenCorvus authored") {
          expect(source.revision).toMatch(/^[a-f0-9]{40}$/)
        }
      }
      if (candidate.status === "source_review") {
        expect(candidate.skillSources.every((source) => source.review === "ready_for_source_review")).toBe(true)
      }
      if (candidate.status === "license_review") {
        expect(candidate.skillSources.every((source) => source.review === "license_review")).toBe(true)
      }
    }
    expect(
      expertSquadRoadmapCandidates.every((candidate) =>
        generatedShippedSquadFacts.some((squad) => squad.id === candidate.id),
      ),
    ).toBe(true)
  })

  test("restores a versioned draft as one exact candidate permutation", () => {
    const ids = expertSquadRoadmapCandidates.map((candidate) => candidate.id)
    const parsed = parseChecklistDraft(
      {
        version: 1,
        orderedIds: [ids[2], ids[0], "unknown", ids[2]],
        selectedIds: [ids[2], ids[1], "unknown"],
        parallelIds: [ids[1], "unknown"],
        note: "parallel package ownership",
      },
      ids,
    )
    expect(parsed.orderedIds).toEqual([ids[2], ids[0], ...ids.slice(1).filter((id) => id !== ids[2])])
    expect(parsed.selectedIds).toEqual([ids[2], ids[1]])
    expect(parsed.parallelIds).toEqual([ids[1]])
    expect(parsed.note).toBe("parallel package ownership")
  })

  test("reorders and exports explicit package ownership without changing the candidate set", () => {
    const ids = expertSquadRoadmapCandidates.map((candidate) => candidate.id)
    const dragged = reorderChecklistIDs(ids, ids[2], ids[0])
    expect(dragged).toEqual([ids[2], ids[0], ids[1], ...ids.slice(3)])
    const movedOnce = moveChecklistID(dragged, ids[2], 1)
    expect(movedOnce).toEqual([ids[0], ids[2], ids[1], ...ids.slice(3)])
    expect(moveChecklistID(movedOnce, ids[2], 1)).toEqual(ids)

    const draft = createDefaultChecklistDraft(ids)
    draft.orderedIds = dragged
    draft.selectedIds = [ids[2], ids[0]]
    draft.parallelIds = [ids[0]]
    draft.note = "Keep generated facts serialized."
    const declaration = exportParallelWorkDeclaration(draft, expertSquadRoadmapCandidates, "root")
    expect(declaration).toContain(`expert-squads/builtin/${ids[0]}/**`)
    expect(declaration).toContain("Serialized convergence boundary")
    expect(declaration).toContain("Keep generated facts serialized.")
  })
})
