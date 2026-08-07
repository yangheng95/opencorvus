import * as maplibregl from "maplibre-gl"
import type { GeoJSONSource, LngLatLike } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { For, onCleanup, onMount } from "solid-js"
import mapBasemap from "../../config/map-basemap.json"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { observeAppliedTheme } from "../../services/theme"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactVisualTheme } from "./theme-color"

type MapPayload = Extract<InteractiveArtifactPayload, { renderer: "map@1" }>
type MapFeature = MapPayload["geojson"]["features"][number]

maplibregl.setWorkerUrl(maplibreWorker)

const LINE_GEOMETRIES = new Set(["LineString", "MultiLineString", "Polygon", "MultiPolygon"])

function visitPositions(value: unknown, visit: (longitude: number, latitude: number) => void): void {
  if (!Array.isArray(value)) return
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value[0], value[1])
    return
  }
  value.forEach((entry) => visitPositions(entry, visit))
}

function featureLabel(feature: MapFeature): string | undefined {
  return Object.values(feature.properties).find((value): value is string => typeof value === "string")
}

export function MapArtifact(props: { payload: MapPayload }) {
  let host: HTMLDivElement | undefined
  let map: maplibregl.Map | undefined
  let stopThemeObserver: (() => void) | undefined
  let resizeObserver: ResizeObserver | undefined
  const markers: maplibregl.Marker[] = []
  const lineFeatures = props.payload.geojson.features.filter((feature) => LINE_GEOMETRIES.has(feature.geometry.type))

  const themedGeoJson = (palette: string[]): GeoJSON.FeatureCollection => {
    let lineIndex = 0
    return {
      type: "FeatureCollection",
      features: props.payload.geojson.features.map((feature) => {
        if (!LINE_GEOMETRIES.has(feature.geometry.type)) return feature as GeoJSON.Feature
        const color = palette[lineIndex % palette.length]
        lineIndex += 1
        return {
          ...feature,
          properties: { ...feature.properties, __opencorvusMapColor: color },
        } as GeoJSON.Feature
      }),
    }
  }

  const renderMarkers = (color: string) => {
    markers.splice(0).forEach((marker) => marker.remove())
    if (!map) return
    props.payload.geojson.features.forEach((feature) => {
      if (feature.geometry.type !== "Point") return
      const coordinates = feature.geometry.coordinates as [number, number]
      const label = featureLabel(feature)
      const marker = new maplibregl.Marker({ color }).setLngLat(coordinates).addTo(map!)
      marker.getElement().setAttribute("aria-label", typeof label === "string" ? label : "Map point")
      markers.push(marker)
    })
  }

  onMount(() => {
    if (!host) return
    const initialTheme = artifactVisualTheme(host)
    map = new maplibregl.Map({
      container: host,
      style: mapBasemap.styleUrl,
      center: [0, 0] as LngLatLike,
      zoom: 0,
      attributionControl: mapBasemap.attributionControl,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    resizeObserver = new ResizeObserver(() => map?.resize())
    resizeObserver.observe(host)
    map.on("load", () => {
      if (!map) return
      map.addSource("artifact", {
        type: "geojson",
        data: themedGeoJson(initialTheme.palette),
      })
      map.addLayer({
        id: "artifact-fill",
        type: "fill",
        source: "artifact",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": ["get", "__opencorvusMapColor"], "fill-opacity": 0.24 },
      })
      map.addLayer({
        id: "artifact-line-casing",
        type: "line",
        source: "artifact",
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: { "line-color": initialTheme.surface, "line-opacity": 0.9, "line-width": 7 },
      })
      map.addLayer({
        id: "artifact-line",
        type: "line",
        source: "artifact",
        filter: ["in", ["geometry-type"], ["literal", ["LineString", "MultiLineString", "Polygon", "MultiPolygon"]]],
        paint: { "line-color": ["get", "__opencorvusMapColor"], "line-opacity": 0.94, "line-width": 4 },
      })
      const bounds = new maplibregl.LngLatBounds()
      props.payload.geojson.features.forEach((feature) => {
        visitPositions(feature.geometry.coordinates, (longitude, latitude) => bounds.extend([longitude, latitude]))
      })
      renderMarkers(initialTheme.accent)
      stopThemeObserver = observeAppliedTheme(() => {
        if (!map || !host) return
        const theme = artifactVisualTheme(host)
        ;(map.getSource("artifact") as GeoJSONSource | undefined)?.setData(themedGeoJson(theme.palette))
        map.setPaintProperty("artifact-line-casing", "line-color", theme.surface)
        renderMarkers(theme.accent)
      })
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 36, maxZoom: 12, duration: 0 })
      map.once("idle", () => {
        if (host) host.dataset.ready = "true"
      })
    })
  })

  onCleanup(() => {
    stopThemeObserver?.()
    resizeObserver?.disconnect()
    markers.forEach((marker) => marker.remove())
    map?.remove()
    map = undefined
  })

  return (
    <ArtifactFrame title={props.payload.title} kind="Map">
      <div class="msg-artifact-map-shell">
        <div
          class="msg-artifact-map"
          ref={(element) => {
            host = element
          }}
        />
        <div class="msg-artifact-map-legend">
          <For each={lineFeatures}>
            {(feature, index) => (
              <div class="msg-artifact-map-legend-item">
                <span class="msg-artifact-map-legend-swatch" aria-hidden="true" />
                <span>{featureLabel(feature) || `Series ${index() + 1}`}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </ArtifactFrame>
  )
}
