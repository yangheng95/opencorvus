import { expect, test } from "bun:test"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { catalogSummaryFromPackage } from "../../src/expert-squad/catalog-profile"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

const expectedNames = new Map([
  ["base", "Base"],
  ["advanced", "Advanced"],
  ["research-studio", "Research Studio"],
  ["deep-research", "Deep Research"],
  ["equity-research", "Equity Research"],
  ["evolution-lab", "Evolution Lab"],
  ["frontend-innovate", "Frontend Innovate"],
  ["frontend-replica", "Frontend Replica"],
  ["review-debug", "Review & Debug"],
  ["squad-sdk", "Generate Agent Squads"],
])

test("every shipped Expert Squad projects its declared human-readable name", () => {
  const loaded = [...builtInPackageSources, ...payloadPackageSources].map((source) =>
    ExpertSquadRegistry.loadEmbeddedPackage(source),
  )

  expect(new Map(loaded.map((pkg) => [pkg.id, pkg.manifest.name]))).toEqual(expectedNames)
  for (const pkg of loaded) {
    expect(pkg.name).toBe(expectedNames.get(pkg.id))
    expect(catalogSummaryFromPackage({ pkg, builtIn: true }).name).toBe(expectedNames.get(pkg.id))
  }
})

test("an Expert Squad with name omitted projects its required label as the display name", () => {
  const base = builtInPackageSources.find((source) => source.id === "base")!
  const source = {
    ...base,
    files: {
      ...base.files,
      "expert-squad.jsonc": base.files["expert-squad.jsonc"].replace(/^\s*"name":\s*"[^"]+",\r?\n/m, ""),
    },
  }
  const pkg = ExpertSquadRegistry.loadEmbeddedPackage(source)

  expect(pkg.name).toBe(pkg.label)
  expect(catalogSummaryFromPackage({ pkg, builtIn: true }).name).toBe(pkg.label)
})
