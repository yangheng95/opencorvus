import { expect, test } from "bun:test"
import { createArtifactTablePresentation } from "../src/services/artifact-table"

const chinese = () => createArtifactTablePresentation("zh-CN", { yes: "是", no: "否" })
const english = () => createArtifactTablePresentation("en-US", { yes: "Yes", no: "No" })

test("only native booleans use localized labels while mixed source scalars keep their values", () => {
  const format = chinese().formatCell
  expect([true, false, "false", "true", 0, 1, "", null, undefined].map((value) => format(value, "boolean"))).toEqual([
    "是",
    "否",
    "false",
    "true",
    "0",
    "1",
    "",
    "—",
    "—",
  ])
  expect([true, false].map((value) => english().formatCell(value, "boolean"))).toEqual(["Yes", "No"])
})

test("product locales format numbers and dates while string identities and invalid dates stay exact", () => {
  const zh = chinese().formatCell,
    en = english().formatCell
  expect(zh(12345.67, "number")).toBe("12,345.67")
  expect(en(12345.67, "number")).toBe("12,345.67")
  expect(zh("2026-10-27T00:00:00", "date")).toBe("2026年10月27日")
  expect(en("2026-10-27T00:00:00", "date")).toBe("Oct 27, 2026")
  expect(zh("not-a-date", "date")).toBe("not-a-date")
  expect(zh("00123.00", "number")).toBe("00123.00")
  expect(zh("2026-10-27", "string")).toBe("2026-10-27")
})

test("literal cell search finds both boolean source values and current-language labels", () => {
  const rows = [
    { id: "native-true", value: true },
    { id: "native-false", value: false },
    { id: "source-text", value: "false" },
  ]
  const select = (query: string, presentation = chinese()) =>
    rows.filter((row) => presentation.matchesCell(query, row.value, "boolean")).map((row) => row.id)
  expect(select("false")).toEqual(["native-false", "source-text"])
  expect(select("FALSE")).toEqual(["native-false", "source-text"])
  expect(select("否")).toEqual(["native-false"])
  expect(select("No", english())).toEqual(["native-false"])
  expect(select(" 是 ")).toEqual(["native-true"])
  expect(select("   ")).toEqual(["native-true", "native-false", "source-text"])
})

test("formatted numbers and localized dates are searchable alongside their original identities", () => {
  const presentation = chinese()
  expect(["12,345.67", "12345.67"].map((query) => presentation.matchesCell(query, 12345.67, "number"))).toEqual([
    true,
    true,
  ])
  expect(
    ["2026年10月27日", "2026-10-27"].map((query) => presentation.matchesCell(query, "2026-10-27T00:00:00", "date")),
  ).toEqual([true, true])
})
