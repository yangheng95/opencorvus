import type { InteractiveArtifactPayload } from "./interactive-artifact"

type MapFeatures = Extract<InteractiveArtifactPayload, { renderer: "map@1" }>["geojson"]["features"]

export function artifactMapPoints(features: MapFeatures): Array<{ feature: MapFeatures[number]; coordinates: [number, number] }> {
  return features.flatMap((feature) => {
    const { geometry } = feature
    const positions = geometry.type === "Point"
      ? [geometry.coordinates]
      : geometry.type === "MultiPoint" ? geometry.coordinates : []
    return positions.map((position) => ({ feature, coordinates: [position[0]!, position[1]!] }))
  })
}
