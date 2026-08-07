import "@google/model-viewer"

export function createModelViewer() {
  return document.createElement("model-viewer")
}

export function configureModelViewer(element, options) {
  element.src = options.src
  element.alt = options.alt
  element.poster = options.poster ?? ""
  element.cameraControls = true
  element.touchAction = "pan-y"
  element.exposure = options.exposure
  element.cameraOrbit = options.cameraOrbit ?? "auto auto auto"
  element.animationName = options.animation
  element.autoplay = Boolean(options.animation)
}

export function resetModelViewerCamera(element, cameraOrbit) {
  element.cameraOrbit = cameraOrbit ?? "auto auto auto"
  element.jumpCameraToGoal()
}
