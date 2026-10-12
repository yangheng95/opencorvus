import { describe, expect, test } from "bun:test"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { allCapabilityGrants } from "./capability-grant-fixture"

describe("shipped Expert Squad Skill completeness", () => {
  test("loads every declared package Skill from the unique shipped packages", async () => {
    const sources = [...builtInPackageSources, ...payloadPackageSources]
    expect(new Set(sources.map((source) => `${source.namespace}/${source.id}`)).size).toBe(sources.length)

    for (const source of sources) {
      const snapshot = await ExpertSquadRegistry.materializeEmbeddedPackageSnapshot(source)
      const loaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(snapshot.digest)
      const packageSkillRefs = new Set(allCapabilityGrants(loaded.manifest).flatMap((grant) => grant.packageSkillRefs))
      expect([...loaded.packageSkills.keys()].sort()).toEqual([...packageSkillRefs].sort())
      for (const skill of loaded.packageSkills.values()) {
        expect(skill.definition.name).toEqual(expect.any(String))
        expect(skill.snapshot.files.map((file) => file.path)).toContain("SKILL.md")
      }
    }
  }, 60_000)
})
