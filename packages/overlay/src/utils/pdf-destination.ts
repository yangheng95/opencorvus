export const PDF_MIN_ZOOM = 0.5
export const PDF_MAX_ZOOM = 2.5

export interface PdfDestinationViewport {
  width: number
  height: number
  viewBox: readonly number[]
  convertToViewportRectangle(rect: number[]): number[]
}

export interface PdfDestinationInput {
  destination: readonly unknown[]
  /** The target page's viewport at scale 1, including its rotation and user unit. */
  viewport: PdfDestinationViewport
  /** Usable viewport dimensions after the reader's padding. */
  availableWidth: number
  availableHeight: number
  fitScale: number
  currentZoom: number
  /** The current reading point in original PDF coordinates. */
  currentPoint?: readonly [number, number]
}

export interface PdfDestinationView {
  zoom: number
  /** Original PDF coordinates, to transform using the final display viewport. */
  rect?: [number, number, number, number]
}

export class PdfDestinationError extends Error {
  override readonly name = "PdfDestinationError"
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PdfDestinationError(`${label} must be a finite number`)
  }
  return value
}

function positiveNumber(value: unknown, label: string): number {
  const number = finiteNumber(value, label)
  if (number <= 0) throw new PdfDestinationError(`${label} must be positive`)
  return number
}

function boundedZoom(value: number): number {
  return Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, positiveNumber(value, "Destination zoom")))
}

/** Map PDFLinkService's resolved destination into the single-page reader's view. */
export function pdfDestinationView(input: PdfDestinationInput): PdfDestinationView {
  const { destination, viewport, currentPoint } = input
  const width = positiveNumber(viewport.width, "Page viewport width")
  const height = positiveNumber(viewport.height, "Page viewport height")
  const availableWidth = positiveNumber(input.availableWidth, "Available width")
  const availableHeight = positiveNumber(input.availableHeight, "Available height")
  const fitScale = positiveNumber(input.fitScale, "Fit scale")
  const currentZoom = positiveNumber(input.currentZoom, "Current zoom")
  if (viewport.viewBox.length !== 4) throw new PdfDestinationError("Page viewBox must contain four coordinates")
  const [left, bottom, right, top] = viewport.viewBox.map((value) => finiteNumber(value, "Page viewBox coordinate"))
  if (right <= left || top <= bottom) throw new PdfDestinationError("Page viewBox must have positive width and height")
  if (currentPoint) {
    finiteNumber(currentPoint[0], "Current point x")
    finiteNumber(currentPoint[1], "Current point y")
  }
  const kind = destination[1]
  if (!kind || typeof kind !== "object" || !("name" in kind) || typeof kind.name !== "string") {
    throw new PdfDestinationError("PDF destination must declare a named view type")
  }
  const name = kind.name
  const argumentCount = (expected: number) => {
    if (destination.length !== expected) {
      throw new PdfDestinationError(`${name} destination must contain ${expected} entries`)
    }
  }
  const coordinate = (index: number, defaultValue: number): number =>
    destination[index] === null ? defaultValue : finiteNumber(destination[index], `${name} coordinate ${index}`)
  const point = (zoom: number, x: number, y: number): PdfDestinationView => ({
    zoom: boundedZoom(zoom), rect: [x, y, x, y],
  })

  // These view types follow PDFViewer.scrollPageIntoView. PDFLinkService retains
  // ownership of destination names/references and the target page number.
  switch (name) {
    case "XYZ": {
      argumentCount(5)
      const x = coordinate(2, left), y = coordinate(3, top)
      const scale = destination[4] === null ? 0 : finiteNumber(destination[4], "XYZ zoom")
      if (scale < 0) throw new PdfDestinationError("XYZ zoom must be zero or positive")
      return point(scale === 0 ? currentZoom : (scale * (96 / 72)) / fitScale, x, y)
    }
    case "Fit":
    case "FitB":
      argumentCount(2)
      return { zoom: boundedZoom(Math.min(availableWidth / width, availableHeight / height) / fitScale) }
    case "FitH":
    case "FitBH": {
      argumentCount(3)
      const x = destination[2] === null && currentPoint ? currentPoint[0] : left
      const y = coordinate(2, currentPoint?.[1] ?? top)
      return point(availableWidth / width / fitScale, x, y)
    }
    case "FitV":
    case "FitBV": {
      argumentCount(3)
      const x = coordinate(2, left)
      const end = finiteNumber(x + (right - left), `${name} rectangle right`)
      return { zoom: boundedZoom(availableHeight / height / fitScale), rect: [x, bottom, end, top] }
    }
    case "FitR": {
      argumentCount(6)
      const rect = destination.slice(2).map((value) => finiteNumber(value, "FitR coordinate")) as [number, number, number, number]
      const transformed = viewport.convertToViewportRectangle(rect)
      if (transformed.length !== 4) throw new PdfDestinationError("Transformed FitR rectangle must contain four coordinates")
      transformed.forEach((value) => finiteNumber(value, "Transformed FitR coordinate"))
      const rectWidth = positiveNumber(Math.abs(transformed[2] - transformed[0]), "FitR width")
      const rectHeight = positiveNumber(Math.abs(transformed[3] - transformed[1]), "FitR height")
      return { zoom: boundedZoom(Math.min(availableWidth / rectWidth, availableHeight / rectHeight) / fitScale), rect }
    }
    default:
      throw new PdfDestinationError(`Unsupported PDF destination view: ${name}`)
  }
}
