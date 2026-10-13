import { expect, test } from "bun:test"
import {
  PDF_MAX_ZOOM,
  PDF_MIN_ZOOM,
  PdfDestinationError,
  pdfDestinationView,
  type PdfDestinationInput,
  type PdfDestinationViewport,
} from "../src/utils/pdf-destination"

const page: PdfDestinationViewport = {
  width: 600,
  height: 800,
  viewBox: [0, 0, 600, 800],
  convertToViewportRectangle: ([left, bottom, right, top]) => [left, 800 - bottom, right, 800 - top],
}

const input = (destination: readonly unknown[], options: Partial<PdfDestinationInput> = {}): PdfDestinationInput => ({
  destination,
  viewport: page,
  availableWidth: 600,
  availableHeight: 400,
  fitScale: 1,
  currentZoom: 1.25,
  ...options,
})

test("381 document's XYZ target retains its current zoom and exact PDF reading point", () => {
  expect(pdfDestinationView(input([{ num: 8, gen: 0 }, { name: "XYZ" }, 48, 610, 0]))).toEqual({
    zoom: 1.25, rect: [48, 610, 48, 610],
  })
})

test.each(["Fit", "FitB"])("%s fits the full page in both available dimensions", (name) => {
  expect(pdfDestinationView(input([{ num: 6, gen: 0 }, { name }]))).toEqual({ zoom: 0.5 })
  expect(pdfDestinationView(input([0, { name }], { availableWidth: 480, availableHeight: 1000, fitScale: 0.8 }))).toEqual({ zoom: 1 })
})

test("explicit XYZ zoom converts PDF scale into the reader's fit-width multiplier", () => {
  expect(pdfDestinationView(input([1, { name: "XYZ" }, 20, 30, 0.75], { fitScale: 0.8 }))).toEqual({
    zoom: 1.25, rect: [20, 30, 20, 30],
  })
})

test("null XYZ values use the target CropBox origin and top while retaining zoom", () => {
  const viewport = { ...page, width: 560, height: 720, viewBox: [20, 40, 580, 760] }
  expect(pdfDestinationView(input([0, { name: "XYZ" }, null, null, null], { viewport }))).toEqual({
    zoom: 1.25, rect: [20, 760, 20, 760],
  })
})

test.each(["FitH", "FitBH"])("%s fits width and retains an explicit top", (name) => {
  expect(pdfDestinationView(input([0, { name }, 610], { fitScale: 0.8 }))).toEqual({
    zoom: 1.25, rect: [0, 610, 0, 610],
  })
  expect(pdfDestinationView(input([0, { name }, null], { currentPoint: [48, 610] }))).toEqual({
    zoom: 1, rect: [48, 610, 48, 610],
  })
  expect(pdfDestinationView(input([0, { name }, null]))).toEqual({ zoom: 1, rect: [0, 800, 0, 800] })
})

test.each(["FitV", "FitBV"])("%s fits height and retains the horizontal PDF region", (name) => {
  expect(pdfDestinationView(input([0, { name }, 40]))).toEqual({
    zoom: 0.5, rect: [40, 0, 640, 800],
  })
  const viewport = { ...page, width: 560, height: 720, viewBox: [20, 40, 580, 760] }
  expect(pdfDestinationView(input([0, { name }, null], { viewport, availableHeight: 720 }))).toEqual({
    zoom: 1, rect: [20, 40, 580, 760],
  })
})

test("FitR fits the requested area and returns its original PDF coordinates", () => {
  expect(pdfDestinationView(input([0, { name: "FitR" }, 50, 100, 350, 500]))).toEqual({
    zoom: 1, rect: [50, 100, 350, 500],
  })
  expect(pdfDestinationView(input([0, { name: "FitR" }, 350, 500, 50, 100]))).toEqual({
    zoom: 1, rect: [350, 500, 50, 100],
  })
})

test("FitR uses natural viewport rotation and user-unit geometry for fitting", () => {
  const rotated: PdfDestinationViewport = {
    width: 1600,
    height: 1200,
    viewBox: page.viewBox,
    convertToViewportRectangle: ([left, bottom, right, top]) => [bottom * 2, left * 2, top * 2, right * 2],
  }
  expect(pdfDestinationView(input([0, { name: "FitR" }, 50, 100, 350, 500], {
    viewport: rotated, fitScale: 0.5, availableWidth: 800, availableHeight: 400,
  }))).toEqual({ zoom: 4 / 3, rect: [50, 100, 350, 500] })
})

test("destination zoom shares the reader's minimum and maximum", () => {
  expect(pdfDestinationView(input([0, { name: "XYZ" }, 0, 800, 100]))).toEqual({
    zoom: PDF_MAX_ZOOM, rect: [0, 800, 0, 800],
  })
  expect(pdfDestinationView(input([0, { name: "XYZ" }, 0, 800, 0.01]))).toEqual({
    zoom: PDF_MIN_ZOOM, rect: [0, 800, 0, 800],
  })
  expect(pdfDestinationView(input([0, { name: "FitR" }, 0, 0, 1, 1]))).toEqual({
    zoom: PDF_MAX_ZOOM, rect: [0, 0, 1, 1],
  })
  expect(pdfDestinationView(input([0, { name: "Fit" }], { availableHeight: 10 }))).toEqual({ zoom: PDF_MIN_ZOOM })
})

test.each([
  { destination: [0, {}], message: "PDF destination must declare a named view type" },
  { destination: [0, { name: "Other" }], message: "Unsupported PDF destination view: Other" },
  { destination: [0, { name: "XYZ" }, 48, 610], message: "XYZ destination must contain 5 entries" },
  { destination: [0, { name: "XYZ" }, 48, 610, -1], message: "XYZ zoom must be zero or positive" },
  { destination: [0, { name: "XYZ" }, 48, Infinity, 0], message: "XYZ coordinate 3 must be a finite number" },
  { destination: [0, { name: "FitH" }, "610"], message: "FitH coordinate 2 must be a finite number" },
  { destination: [0, { name: "FitR" }, 50, 100, 50, 500], message: "FitR width must be positive" },
  { destination: [0, { name: "FitR" }, 50, 100, 350, 100], message: "FitR height must be positive" },
])("invalid destination reports its exact contract: $message", ({ destination, message }) => {
  expect(() => pdfDestinationView(input(destination))).toThrow(PdfDestinationError)
  expect(() => pdfDestinationView(input(destination))).toThrow(message)
})

test.each([
  { options: { fitScale: 0 }, message: "Fit scale must be positive" },
  { options: { availableHeight: 0 }, message: "Available height must be positive" },
  { options: { currentZoom: NaN }, message: "Current zoom must be a finite number" },
  { options: { viewport: { ...page, viewBox: [0, 0, 0, 800] } }, message: "Page viewBox must have positive width and height" },
])("invalid view geometry reports its exact contract: $message", ({ options, message }) => {
  expect(() => pdfDestinationView(input([0, { name: "Fit" }], options))).toThrow(PdfDestinationError)
  expect(() => pdfDestinationView(input([0, { name: "Fit" }], options))).toThrow(message)
})
