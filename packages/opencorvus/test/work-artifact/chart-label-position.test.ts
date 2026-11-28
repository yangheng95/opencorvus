import { expect, test } from "bun:test"
import { PresentationElement } from "../../src/work-artifact/presentation"

function chart(chart_type: "bar" | "column" | "pie", data_label_position: string, data_labels = "value") {
  return {
    kind: "chart", x: 2, y: 3, width: 20, height: 12, chart_type,
    title: "Signed settlement amounts", categories: ["Orders", "Refunds", "Samples"],
    series: [{ name: "Amount", values: [23.65, -6, 0] }], colors: ["#A8DADC"],
    data_labels, data_label_position, data_label_number_format: "0.00",
  }
}

for (const type of ["bar", "column"] as const) {
  for (const position of ["outsideEnd", "insideEnd", "insideBase", "center"] as const) {
    test(`${type} authoring retains the explicit native ${position} label placement`, () => {
      const parsed = PresentationElement.parse(chart(type, position))
      expect(parsed).toMatchObject({ kind: "chart", chart_type: type, data_label_position: position,
        data_label_number_format: "0.00", series: [{ name: "Amount", values: [23.65, -6, 0] }] })
    })
  }
}

test("a label position on another chart type returns the declared field error", () => {
  const parsed = PresentationElement.safeParse(chart("pie", "center"))
  expect(parsed.error?.issues.map(({ code, path, message }) => ({ code, path, message }))).toEqual([
    { code: "custom", path: ["data_label_position"], message: "data_label_position is supported for bar and column charts" },
  ])
})

test("a label position with disabled labels returns the declared field error", () => {
  const parsed = PresentationElement.safeParse(chart("column", "insideEnd", "none"))
  expect(parsed.error?.issues.map(({ code, path, message }) => ({ code, path, message }))).toEqual([
    { code: "custom", path: ["data_label_position"], message: "data_label_position requires enabled data_labels" },
  ])
})
