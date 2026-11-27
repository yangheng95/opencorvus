import { expect, test } from "bun:test"
import { createArtifactTreeSearch, normalizeArtifactTreeQuery } from "../src/services/artifact-tree"
import { jsonArtifactTree } from "../src/services/json-artifact"

const nodes = [
  { id: "packages", label: "packages" },
  { id: "components", label: "components", parentID: "packages" },
  { id: "app", label: "App.tsx", parentID: "components", description: "index: 1; bytes: 50553; kib: 49.3681640625" },
  { id: "inline", label: "InlineToolPart.tsx", parentID: "components", description: "index: 53; bytes: 27225; kib: 26.5869140625" },
  { id: "other", label: "other root", description: "index: 54" },
]
const search = createArtifactTreeSearch(nodes)

test("tree blank query returns the complete published node order and forest", () => {
  expect([...search(" \t ")]).toEqual(["packages", "components", "app", "inline", "other"])
})

test("tree search normalizes casing and outside whitespace while retaining the actual ancestor path", () => {
  expect(normalizeArtifactTreeQuery("  InlineToolPart\t")).toBe("inlinetoolpart")
  expect(search("  inLINETOOLpart\t")).toEqual(new Set(["inline", "components", "packages"]))
})

test("tree searches complete numeric descriptions at original precision", () => {
  expect(search("26.5869140625")).toEqual(new Set(["inline", "components", "packages"]))
  expect(search("49.3681640625")).toEqual(new Set(["app", "components", "packages"]))
})

test("tree literal phrase can span the same node label and description", () => {
  expect(search("Part.tsx index: 53")).toEqual(new Set(["inline", "components", "packages"]))
})

test("tree shared matches preserve one real ancestor path and independent roots", () => {
  expect(search("index:")).toEqual(new Set(["app", "inline", "components", "packages", "other"]))
  expect(search("components")).toEqual(new Set(["components", "packages"]))
})

test("JSON source values search through the same declared typed nodes and real parents", () => {
  const payload = jsonArtifactTree("summary.json", '{"order_count":5,"total_amount":"35.60","by_region":{"华东":{"order_count":3,"total_amount":"28.25"},"华南":{"order_count":2,"total_amount":"7.35"}}}')
  const find = createArtifactTreeSearch(payload.nodes)
  expect(find("28.25")).toEqual(new Set(["json-6", "json-4", "json-3", "json-0"]))
  expect(find("7.35")).toEqual(new Set(["json-9", "json-7", "json-3", "json-0"]))
})
