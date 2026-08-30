import { describe, expect, test } from "bun:test"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { allCapabilityGrants } from "./capability-grant-fixture"

describe("shipped Expert Squad Skill completeness", () => {
  test("loads all unique shipped packages with a saved and selected package Skill", () => {
    const sources = [...builtInPackageSources, ...payloadPackageSources]
    expect(new Set(sources.map((source) => `${source.namespace}/${source.id}`)).size).toBe(sources.length)

    for (const source of sources) {
      const loaded = ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source)
      const skillPaths = Object.keys(source.files).filter((path) => /^skills\/[^/]+\/SKILL\.md$/.test(path))
      const packageSkillRefs = new Set(allCapabilityGrants(loaded.manifest).flatMap((grant) => grant.packageSkillRefs))
      expect(skillPaths.length).toBeGreaterThan(0)
      expect(packageSkillRefs.size).toBeGreaterThan(0)
    }
  })
})
