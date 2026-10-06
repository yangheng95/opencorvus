import { describe, expect, test } from "bun:test"
import {
  composerReferenceCatalogError,
  createComposerReferenceCatalogSnapshotFromSettled,
  createGlobalComposerReferenceCatalogSnapshot,
  emptyComposerExpertSquadCatalog,
  failedComposerReferenceCatalogSnapshot,
  mergeComposerExpertSquadOptions,
  updateComposerExpertSquadSearch,
} from "../src/services/composer-expert-squad-catalog"
import type { ExpertSquadCatalogPage, ExpertSquadOption } from "../src/services/expert-squad"
import type { GlobalComposerReferencesResponse } from "../src/services/global-composer-references"

function option(id: string): ExpertSquadOption {
  return {
    id,
    name: id,
    display_label: id,
    built_in: true,
    product_pillars: ["code"],
    source: { kind: "built_in" },
  }
}

function page(...ids: string[]): ExpertSquadCatalogPage {
  return {
    catalog_revision: "owned-catalog-revision",
    entries: ids.map(option),
    next_cursor: null,
    total_count: ids.length,
  }
}

function globalCatalog(withIssues: boolean): GlobalComposerReferencesResponse {
  return {
    expert_squads: { page: page("base", "selected-reference") },
    skills: {
      skills: [{ name: "read-source", description: "Read the selected source" }],
      issues: withIssues
        ? [{ kind: "skill_source_failed", path: "owned/skills/source", message: "Skill source unavailable" }]
        : [],
    },
    mission_skills: {
      mission_skills: [{ name: "review", description: "Review the result", required_tools: [] }],
      issues: withIssues
        ? [
            {
              kind: "invalid_mission_skill",
              source: "global",
              path: "owned/mission-skills/input",
              message: "Mission definition invalid",
            },
          ]
        : [],
    },
  }
}

describe("Composer reference catalog source-qualified feedback", () => {
  test("global typed issues remain current after a successful bounded Squad search", () => {
    const snapshot = createGlobalComposerReferenceCatalogSnapshot("global:one", globalCatalog(true))
    const next = updateComposerExpertSquadSearch(
      snapshot,
      "global:one",
      { status: "fulfilled", value: page("query-result") },
      ["selected-reference"],
    )
    expect(next.problems).toEqual([
      { source: "skills", kind: "catalog-issue", message: "Skill source unavailable" },
      { source: "mission-skills", kind: "catalog-issue", message: "Mission definition invalid" },
    ])
    expect(next.squads.map((entry) => entry.id)).toEqual(["query-result", "selected-reference"])
    expect(next.skills).toEqual([{ name: "read-source", description: "Read the selected source" }])
    expect(next.missionSkills).toEqual([{ name: "review", description: "Review the result" }])
    expect(composerReferenceCatalogError(next)).toBe(composerReferenceCatalogError(snapshot))
  })

  test("failed then successful search settles its own source while retaining full-load issues", () => {
    const initial = createGlobalComposerReferenceCatalogSnapshot("global:one", globalCatalog(true))
    const failed = updateComposerExpertSquadSearch(initial, "global:one", {
      status: "rejected",
      reason: new Error("Search unavailable"),
    })
    expect(failed.problems).toEqual([
      ...initial.problems,
      { source: "squad-search", kind: "request-failed", message: "Search unavailable" },
    ])
    expect(failed.squads).toEqual(initial.squads)
    const recovered = updateComposerExpertSquadSearch(failed, "global:one", {
      status: "fulfilled",
      value: page("recovered"),
    })
    expect(recovered.problems).toEqual(initial.problems)
    expect(recovered.squads.map((entry) => entry.id)).toEqual(["recovered"])
  })

  test("a complete healthy global replacement publishes actual available items and healthy feedback", () => {
    const failed = failedComposerReferenceCatalogSnapshot("global:one", "Full load unavailable")
    expect(failed.problems).toEqual([{ source: "load", kind: "request-failed", message: "Full load unavailable" }])
    expect(failed.requestKey).toBe("global:one")
    const healthy = createGlobalComposerReferenceCatalogSnapshot(failed.requestKey, globalCatalog(false))
    expect(healthy.problems).toEqual([])
    expect(composerReferenceCatalogError(healthy)).toBe("")
    expect(healthy.squads.map((entry) => entry.id)).toEqual(["base", "selected-reference"])
    expect(healthy.chatSkills).toEqual([{ name: "read-source", description: "Read the selected source" }])
    expect(healthy.missionSkills).toEqual([{ name: "review", description: "Review the result" }])
  })

  test("settled Project sources publish actual Mission issues and explicit request failures", () => {
    const next = createComposerReferenceCatalogSnapshotFromSettled("project:one", emptyComposerExpertSquadCatalog(), {
      catalog: { status: "rejected", reason: new Error("Project catalog unavailable") },
      squads: { status: "fulfilled", value: page("base") },
      activeInspection: { status: "rejected", reason: new Error("Dependent inspection unavailable") },
      missionSkills: { status: "fulfilled", value: globalCatalog(true).mission_skills },
      chatCapability: { status: "rejected", reason: new Error("Chat capability unavailable") },
    })
    expect(next.problems).toEqual([
      { source: "expert-squads", kind: "request-failed", message: "Project catalog unavailable" },
      { source: "mission-skills", kind: "catalog-issue", message: "Mission definition invalid" },
      { source: "chat-skills", kind: "request-failed", message: "Chat capability unavailable" },
    ])
    expect(next.requestKey).toBe("project:one")
    expect(next.missionSkills).toEqual([{ name: "review", description: "Review the result" }])
    expect(next.squads).toEqual([])
    expect(next.activeID).toBe("")
  })

  test("a result for an older request returns the current snapshot facts", () => {
    const current = createGlobalComposerReferenceCatalogSnapshot("global:current", globalCatalog(true))
    const oldSuccess = updateComposerExpertSquadSearch(current, "global:old", {
      status: "fulfilled",
      value: page("old-result"),
    })
    const oldFailure = updateComposerExpertSquadSearch(current, "global:old", {
      status: "rejected",
      reason: new Error("Old request failed"),
    })
    expect(oldSuccess).toBe(current)
    expect(oldFailure).toBe(current)
    expect(oldSuccess.problems).toEqual(current.problems)
    expect(oldFailure.squads.map((entry) => entry.id)).toEqual(["base", "selected-reference"])
  })
})

describe("Composer Expert Squad bounded catalog", () => {
  test("keeps the exact active and selected Squads alongside each bounded search page", () => {
    const initialPage = Array.from({ length: 20 }, (_, index) => option(`page-${index}`))
    const current = [...initialPage, option("active-after-first-page"), option("selected-reference")]
    const nextPage = Array.from({ length: 20 }, (_, index) => option(`query-${index}`))

    expect(
      mergeComposerExpertSquadOptions(nextPage, current, ["active-after-first-page", "selected-reference"]).map(
        (entry) => entry.id,
      ),
    ).toEqual([...nextPage.map((entry) => entry.id), "active-after-first-page", "selected-reference"])
  })
})
