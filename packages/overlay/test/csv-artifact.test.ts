import { expect, test } from "bun:test"
import { csvArtifactTable, csvCellComparator } from "../src/services/csv-artifact"

const table = (source: string) => csvArtifactTable("summary.csv", source, (position) => `Column ${position}`)

test("decimal comparison orders exact amounts, signs, exponents and large integers with original strings", () => {
  const compare = csvCellComparator("en-US")
  expect(["150.00", "50.00", "100.00"].sort(compare)).toEqual(["50.00", "100.00", "150.00"])
  expect(["9.2", "9.11", "-2", "-10", "1e2", "001", ".05"].sort(compare)).toEqual([
    "-10",
    "-2",
    ".05",
    "001",
    "9.11",
    "9.2",
    "1e2",
  ])
  expect(["9007199254740993", "9007199254740992"].sort(compare)).toEqual(["9007199254740992", "9007199254740993"])
})

test("mixed CSV values form ordered empty, decimal and localized text groups", () => {
  expect(["row10", "2", "", "row2", "-1", "row1"].sort(csvCellComparator("en-US"))).toEqual([
    "",
    "-1",
    "2",
    "row1",
    "row2",
    "row10",
  ])
})

test("canonical order delivery keeps its headers, region order and decimal strings", () => {
  expect(table("region,paid_count,paid_amount\n华东,2,150.00\n华北,2,50.00\n华南,2,100.00\n")).toEqual({
    schemaVersion: "1",
    renderer: "table@1",
    title: "summary.csv",
    columns: [
      { id: "column-0", label: "region", dataType: "string" },
      { id: "column-1", label: "paid_count", dataType: "string" },
      { id: "column-2", label: "paid_amount", dataType: "string" },
    ],
    rows: [
      { "column-0": "华东", "column-1": "2", "column-2": "150.00" },
      { "column-0": "华北", "column-1": "2", "column-2": "50.00" },
      { "column-0": "华南", "column-1": "2", "column-2": "100.00" },
    ],
  })
})

test("quoted commas, escaped quotes, multiline cells and literals retain their actual values", () => {
  expect(table('name,note,id,value\r\n"a,b","say ""hello""\r\nline 2",001,=SUM(A1)\r\n').rows).toEqual([
    { "column-0": "a,b", "column-1": 'say "hello"\r\nline 2', "column-2": "001", "column-3": "=SUM(A1)" },
  ])
})

test("duplicate and unnamed headers preserve positional cells and wider records", () => {
  const result = table("name,name,\na,b,c,extra\nshort\n")
  expect(result.columns.map(({ id, label }) => [id, label])).toEqual([
    ["column-0", "name"],
    ["column-1", "name"],
    ["column-2", "Column 3"],
    ["column-3", "Column 4"],
  ])
  expect(result.rows).toEqual([
    { "column-0": "a", "column-1": "b", "column-2": "c", "column-3": "extra" },
    { "column-0": "short", "column-1": "", "column-2": "", "column-3": "" },
  ])
})

test("CSV signature, header-only and empty documents have explicit table output", () => {
  expect(table("\uFEFFname\n\uFEFFliteral\n").rows).toEqual([{ "column-0": "\uFEFFliteral" }])
  expect(table("name").rows).toEqual([])
  expect(table("")).toEqual({
    schemaVersion: "1",
    renderer: "table@1",
    title: "summary.csv",
    columns: [{ id: "column-0", label: "Column 1", dataType: "string" }],
    rows: [],
  })
})
