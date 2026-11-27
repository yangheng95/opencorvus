import { expect, test } from "bun:test"
import { createArtifactTablePresentation } from "../src/services/artifact-table"

const columns = [
  { id: "id", dataType: "string" },
  { id: "region", dataType: "string" },
  { id: "note", dataType: "string" },
  { id: "amount", dataType: "number" },
  { id: "refund", dataType: "boolean" },
  { id: "date", dataType: "date" },
].map((column) => ({ ...column, label: column.id })) as Parameters<ReturnType<typeof createArtifactTablePresentation>["matchesRow"]>[2]
const rows = [
  { id: "A001", region: "华东", note: "普通订单", amount: 10.1, refund: false, date: "2026-11-27T12:00:00" },
  { id: "A003", region: "华东", note: "退款", amount: -2.05, refund: true, date: "2026-11-27T12:00:00" },
  { id: "A004", region: "华南", note: "免费样品", amount: 0, refund: false, date: "2026-11-27T12:00:00" },
]
const zh = createArtifactTablePresentation("zh-CN", { yes: "是", no: "否" })
const en = createArtifactTablePresentation("en-US", { yes: "Yes", no: "No" })
const select = (query: string, presentation = zh) => rows.filter((row) => presentation.matchesRow(query, row, columns)).map((row) => row.id)

test("table terms combine the order identity and other cells in the same row", () => {
  expect(select("A003 华东 退款")).toEqual(["A003"])
  expect(select("华东 普通订单")).toEqual(["A001"])
})

test("table terms accept reordered repeated words, mixed case and Unicode whitespace", () => {
  expect(select("  退款\t华东\u00a0a003  华东 ")).toEqual(["A003"])
})

test("table returns the original collection order for single and blank queries", () => {
  expect(select("华东")).toEqual(["A001", "A003"])
  expect(select(" \t\u00a0")).toEqual(["A001", "A003", "A004"])
})

test("table searches raw scalar values and current localized boolean and date text", () => {
  expect(select("a003 -2.05 true", en)).toEqual(["A003"])
  expect(select("A003 Yes", en)).toEqual(["A003"])
  expect(select("华南 否")).toEqual(["A004"])
  expect(select("A003 2026年11月27日")).toEqual(["A003"])
})

test("table searches declared values after an empty first cell at full numeric precision", () => {
  const source = { id: null, amount: 1234.567890125, region: "精确" }
  expect([source].filter((row) => en.matchesRow("精确 1,234.567890125", row, columns))).toEqual([source])
  expect(en.formatCell(source.amount, "number")).toBe("1,234.567890125")
})

test("table treats punctuation and path fragments as literal terms", () => {
  const source = [
    { id: "literal", region: "100%_lab", note: "C++ [v2] C:\\数据\\报告.csv" },
    { id: "plain", region: "1000lab", note: "C++ v2 C:\\数据\\报告.csv" },
  ]
  expect(source.filter((row) => zh.matchesRow("[v2] 100%_lab 数据\\报告.csv", row, columns)).map((row) => row.id)).toEqual(["literal"])
})

test("table uses the declared cells as its searchable fields", () => {
  const source = [{ key: "receipt-label", note: "first" }, { key: "second", note: "receipt-label" }]
  expect(source.filter((row) => zh.matchesRow("receipt-label", row, [columns[2]])).map((row) => row.key)).toEqual(["second"])
})

test("table preserves mixed scalar types when formatting boolean columns", () => {
  expect([true, false, "false", 0, null].map((value) => zh.formatCell(value, "boolean"))).toEqual(["是", "否", "false", "0", "—"])
})
