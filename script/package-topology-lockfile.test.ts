import { expect, test } from "bun:test"
import path from "node:path"
import { inspectPackageTopology } from "../packages/opencorvus/script/check/package-topology"

test("the canonical package graph and Bun lockfile inputs form one aligned topology", async () => {
  const repositoryRoot = path.resolve(import.meta.dir, "..")
  const inspection = await inspectPackageTopology(repositoryRoot)
  expect({
    workspaceCount: inspection.workspaceCount,
    dependencyGraph: inspection.dependencyCycles.length === 0 ? "acyclic" : "invalid",
    generationOrder: inspection.generationOrderProblems.length === 0 ? "sdk-independent" : "invalid",
    lockfileInputs: inspection.lockfileInputDrift.length === 0 ? "aligned" : "invalid",
  }).toEqual({
    workspaceCount: 10,
    dependencyGraph: "acyclic",
    generationOrder: "sdk-independent",
    lockfileInputs: "aligned",
  })

  const transportManifest = await Bun.file(
    path.join(repositoryRoot, "packages", "transport-protocol", "package.json"),
  ).json()
  const lock = Bun.JSONC.parse(await Bun.file(path.join(repositoryRoot, "bun.lock")).text())
  const canonicalTransportDependencies = {
    "@opencorvus-ai/util": "workspace:*",
    zod: "catalog:",
  }
  expect(transportManifest.dependencies).toEqual(canonicalTransportDependencies)
  expect(lock.workspaces["packages/transport-protocol"].dependencies).toEqual(canonicalTransportDependencies)
})
