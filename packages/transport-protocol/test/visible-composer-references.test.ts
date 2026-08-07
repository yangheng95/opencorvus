import { describe, expect, test } from "bun:test"
import { VisibleComposerReferences, visibleComposerReferences } from "../src/index"

describe("visible Composer references", () => {
  test("projects ordered unique Skill, Mission Skill, and Agent Squad identities", () => {
    const references = visibleComposerReferences(
      [
        '@skill("grill-me")',
        '@squad("frontend-replica")',
        '@mission("release-coordination")',
        '@squad("general")',
        '@skill("grill-me")',
      ].join(" "),
    )

    expect(references).toEqual({
      skillNames: ["grill-me"],
      missionSkillNames: ["release-coordination"],
      expertSquadIDs: ["frontend-replica", "general"],
    })
    expect(VisibleComposerReferences.parse(references)).toEqual(references)
  })
})
