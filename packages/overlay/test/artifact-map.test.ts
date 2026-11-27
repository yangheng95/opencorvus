import { expect, test } from "bun:test"
import { artifactMapPoints } from "../src/services/artifact-map"

test("map point projection retains single and multi-point coordinates with their source features", () => {
  const point = { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [121.46, 31.23, 8] }, properties: { name: "Single" } }
  const multi = { type: "Feature" as const, geometry: { type: "MultiPoint" as const, coordinates: [[121.48, 31.25], [121.50, 31.23, 10, 20]] }, properties: { name: "Multiple" } }
  const line = { type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: [[121.46, 31.23], [121.48, 31.25]] }, properties: { name: "Connection" } }
  const points = artifactMapPoints([point, multi, line])
  expect(points).toStrictEqual([
    { feature: point, coordinates: [121.46, 31.23] },
    { feature: multi, coordinates: [121.48, 31.25] },
    { feature: multi, coordinates: [121.50, 31.23] },
  ])
  expect(points.map((entry) => entry.feature === multi ? "multiple" : "single")).toEqual(["single", "multiple", "multiple"])
})
