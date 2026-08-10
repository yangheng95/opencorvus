import { describe, expect, test } from "bun:test"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

describe("shipped Expert Squad Skill completeness", () => {
  test("loads all unique shipped packages with a saved and selected package Skill", () => {
    const sources = [...builtInPackageSources, ...payloadPackageSources]
    expect(sources).toHaveLength(29)
    expect(new Set(sources.map((source) => `${source.namespace}/${source.id}`)).size).toBe(29)

    for (const source of sources) {
      const loaded = ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source)
      const skillPaths = Object.keys(source.files).filter((path) => /^skills\/[^/]+\/SKILL\.md$/.test(path))
      const projections = [
        loaded.manifest.capability_projection.scheduler,
        ...Object.values(loaded.manifest.capability_projection.agents),
      ]
      const packageSkillRefs = new Set(projections.flatMap((projection) => projection.package_skill_refs))
      expect(skillPaths.length).toBeGreaterThan(0)
      expect(packageSkillRefs.size).toBeGreaterThan(0)
    }
  })
})
