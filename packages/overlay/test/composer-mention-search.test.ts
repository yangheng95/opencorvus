import { describe, expect, test } from "bun:test"
import {
  applyComposerMentionOption,
  composerMentionOptions,
  findComposerMentionQuery,
  resolveComposerMentionDirectives,
  type ComposerMentionCatalog,
} from "../src/services/composer-mention"

function catalog(): ComposerMentionCatalog {
  return {
    categories: [],
    skills: [{ kind: "skill", id: "read-source", label: "Read source", description: "Read the original source" }],
    missionSkills: [],
    squads: [
      { kind: "squad", id: "advanced", label: "Advanced" },
      { kind: "squad", id: "research-studio", label: "Research Studio" },
      { kind: "squad", id: "selected-reference", label: "Selected reference" },
    ],
    squadSearch: { query: "事实核查", status: "ready", matchingIDs: ["research-studio", "advanced"] },
  }
}

describe("Composer producer-qualified Squad references", () => {
  test("uses producer membership and order for a canonical localized query", () => {
    const current = catalog()
    const text = "@squad 事实核查"
    const query = findComposerMentionQuery(text, text.length)!
    const options = composerMentionOptions(query, current)
    expect(options.map((option) => ({ id: option.id, label: option.label }))).toEqual([
      { id: "research-studio", label: "Research Studio" },
      { id: "advanced", label: "Advanced" },
    ])
    const selected = applyComposerMentionOption(text, query, options[0]!)
    expect(selected).toEqual({ text: '@squad("research-studio") ', caret: 26 })
    expect(resolveComposerMentionDirectives(selected.text, current)).toEqual({
      skillNames: [],
      missionSkillNames: [],
      squadIDs: ["research-studio"],
    })
  })

  test("an accepted empty query keeps the actual bounded producer order", () => {
    const current = catalog()
    current.squadSearch = { query: "", status: "ready", matchingIDs: ["advanced", "research-studio"] }
    expect(composerMentionOptions(findComposerMentionQuery("@squad", 6)!, current).map((option) => option.id)).toEqual([
      "advanced",
      "research-studio",
    ])
  })

  test("ordinary skills keep local ranking and brand categories use their producer identity", () => {
    const current = catalog()
    expect(
      composerMentionOptions(findComposerMentionQuery("@skill Read", 11)!, current).map((option) => option.id),
    ).toEqual(["read-source"])
    current.squadSearch = { query: "advanced", status: "ready", matchingIDs: ["advanced"] }
    expect(
      composerMentionOptions(findComposerMentionQuery("@Advanced", 9)!, current).map((option) => option.id),
    ).toEqual(["advanced"])
  })

  test("direct Unicode names resolve to the same canonical Squad directive", () => {
    const current = catalog()
    const text = "@事实核查"
    const query = findComposerMentionQuery(text, text.length)!
    expect(query).toEqual({ start: 0, end: text.length, stage: "category", query: "事实核查" })
    const options = composerMentionOptions(query, current)
    expect(options.map((option) => option.id)).toEqual(["research-studio", "advanced"])
    expect(applyComposerMentionOption(text, query, options[0]!).text).toBe('@squad("research-studio") ')
  })
})

test("Mission Skill display and source descriptions resolve to the same exact directive", () => {
  const current = catalog()
  current.missionSkills = [{
    kind: "mission-skill",
    id: "general",
    label: "general",
    description: "使用固定配置协调多步任务",
    sourceDescription: "Coordinate with fixed-profile Tasks",
  }]

  for (const phrase of ["固定配置", "fixed-profile"]) {
    const text = `@mission ${phrase}`
    const query = findComposerMentionQuery(text, text.length)!
    const options = composerMentionOptions(query, current)
    expect(options.map(({ id, description }) => ({ id, description }))).toEqual([
      { id: "general", description: "使用固定配置协调多步任务" },
    ])
    const selected = applyComposerMentionOption(text, query, options[0]!)
    expect(selected.text).toBe('@mission("general") ')
    expect(resolveComposerMentionDirectives(selected.text, current).missionSkillNames).toEqual(["general"])
  }
})
