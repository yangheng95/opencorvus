import { expect, test } from "bun:test"
import { jsonArtifactTree } from "../src/services/json-artifact"

test.each([
  ["null", "null"],
  ["false", "false"],
  ["true", "true"],
  ["0", "0"],
  ["1e400", "Infinity"],
  ["-1e400", "-Infinity"],
  ['"0"', '"0"'],
  ['"false"', '"false"'],
  ['"null"', '"null"'],
  ['""', '""'],
  ["{}", "{}"],
  ["[]", "[]"],
])("JSON root %s has its typed description", (source, description) => {
  expect(jsonArtifactTree("result.json", source)).toEqual({
    schemaVersion: "1",
    renderer: "tree@1",
    title: "result.json",
    nodes: [{ id: "json-0", label: "result.json", description }],
    defaultExpandedDepth: 2,
  })
})

test("JSON containers retain field order, array positions and parent identities", () => {
  expect(jsonArtifactTree("values.json", '{"items":[false,"false",0,"0",null,"",{},[]]}').nodes).toEqual([
    { id: "json-0", label: "values.json", description: "{…}" },
    { id: "json-1", label: "items", parentID: "json-0", description: "[…]" },
    { id: "json-2", label: "[0]", parentID: "json-1", description: "false" },
    { id: "json-3", label: "[1]", parentID: "json-1", description: '"false"' },
    { id: "json-4", label: "[2]", parentID: "json-1", description: "0" },
    { id: "json-5", label: "[3]", parentID: "json-1", description: '"0"' },
    { id: "json-6", label: "[4]", parentID: "json-1", description: "null" },
    { id: "json-7", label: "[5]", parentID: "json-1", description: '""' },
    { id: "json-8", label: "[6]", parentID: "json-1", description: "{}" },
    { id: "json-9", label: "[7]", parentID: "json-1", description: "[]" },
  ])
})

test("JSON string literals preserve visible whitespace, control escapes, quotes and Chinese", () => {
  expect(jsonArtifactTree("text.json", '"  第一行\\n第二行\\t\\"quoted\\"\\\\尾  "').nodes).toEqual([
    { id: "json-0", label: "text.json", description: '"  第一行\\n第二行\\t\\"quoted\\"\\\\尾  "' },
  ])
})
