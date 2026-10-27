import { describe, expect, test } from "bun:test"
import { VisibleComposerReferences, visibleComposerReferences, visibleMentionDirectiveRanges } from "../src/index"

describe("visible Composer references", () => {
  test.each([String.raw`\q`, String.raw`\u12`, "line\nbreak", "control\u0000character"])(
    "projects later valid references after an unfinished string: %j",
    (unfinished) => {
      const text = `@squad("${unfinished}") @skill("review") @squad("base")`
      expect(visibleMentionDirectiveRanges(text)).toEqual([
        {
          kind: "skill",
          value: "review",
          start: text.indexOf('@skill("review")'),
          end: text.indexOf('@skill("review")') + 16,
        },
        { kind: "squad", value: "base", start: text.lastIndexOf('@squad("base")'), end: text.length },
      ])
      expect(visibleComposerReferences(text)).toEqual({
        skillNames: ["review"],
        missionSkillNames: [],
        expertSquadIDs: ["base"],
      })
    },
  )

  test("decodes valid string escapes and paired typographic references in original order", () => {
    expect(
      visibleComposerReferences(
        String.raw`@skill("review\\path\"quoted") @squad("\u0062ase")` + " @mission(“research-stage”)",
      ),
    ).toEqual({
      skillNames: ['review\\path"quoted'],
      missionSkillNames: ["research-stage"],
      expertSquadIDs: ["base"],
    })
  })

  test("recognizes a valid suffix after mismatched quotation candidates", () => {
    expect(visibleComposerReferences('@squad("wrong”) @skill(“wrong") @squad(“base”)')).toEqual({
      skillNames: [],
      missionSkillNames: [],
      expertSquadIDs: ["base"],
    })
  })

  test("projects ordered unique Skill, Mission Skill, and Expert Squad identities", () => {
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
