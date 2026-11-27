import { expect, test } from "bun:test"
import { artifactNetworkElements, type ArtifactNetworkPayload } from "../src/services/artifact-network"
import { artifactExports } from "../src/services/artifact-export"

function published(): ArtifactNetworkPayload {
  return {
    schemaVersion: "1", renderer: "network@1", title: "来源关系", layout: "breadthfirst",
    nodes: [
      { id: "all", label: "全量 35.60", metadata: { count: 5, amount: "35.60" } },
      { id: "east", label: "华东 28.25", metadata: { region: "华东", amount: "28.25" } },
    ],
    edges: [{ id: "all-east", source: "all", target: "east", directed: true }],
  }
}

test("graph elements preserve original node data and provide native edge values", () => {
  expect(artifactNetworkElements(published()).map((element) => element.data)).toEqual([
    { id: "all", label: "全量 35.60", metadata: { count: 5, amount: "35.60" } },
    { id: "east", label: "华东 28.25", metadata: { region: "华东", amount: "28.25" } },
    { id: "all-east", source: "all", target: "east", directed: true, weight: 1 },
  ])
})

test("published export retains exact source values while graph data changes", () => {
  const payload = published()
  const graph = artifactNetworkElements(payload)
  Object.assign(graph[0]!.data, { themeColor: "#ffffff", themeSize: 46 })
  graph[0]!.data.metadata.amount = "99.99"
  graph[2]!.data.weight = 3
  graph[2]!.data.directed = false
  expect(graph[0]!.data.metadata.amount).toBe("99.99")
  expect(graph[2]!.data).toEqual({ id: "all-east", source: "all", target: "east", directed: false, weight: 3 })
  const file = artifactExports(payload)[0]!
  expect(file.mime).toBe("application/json")
  if (!("text" in file)) throw new Error("Network export must provide JSON text")
  expect(JSON.parse(file.text)).toEqual({
    nodes: [
      { id: "all", label: "全量 35.60", metadata: { count: 5, amount: "35.60" } },
      { id: "east", label: "华东 28.25", metadata: { region: "华东", amount: "28.25" } },
    ],
    edges: [{ id: "all-east", source: "all", target: "east", directed: true }],
  })
})
