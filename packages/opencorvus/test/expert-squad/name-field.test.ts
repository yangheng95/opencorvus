import { expect, test } from "bun:test"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { catalogSummaryFromPackage } from "../../src/expert-squad/catalog-profile"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

test("every shipped Expert Squad projects its declared human-readable name", () => {
  const sources = [...builtInPackageSources, ...payloadPackageSources]
  const expectedNames = new Map(
    sources.map((source) => [source.id, ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source).manifest.name]),
  )
  const loaded = sources.map((source) => ExpertSquadRegistry.loadEmbeddedPackage(source))

  expect(expectedNames.size).toBe(sources.length)
  for (const pkg of loaded) {
    expect(pkg.manifest.name).toBe(expectedNames.get(pkg.id))
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
