import { expect, test } from "bun:test"
import { parseComposerCommand } from "../src/utils/composer-command"

test("goal command opens an empty objective", () => {
  expect(parseComposerCommand(" /goal \n")).toEqual({ kind: "goal", text: "" })
})

test("goal command supplies its complete multiline objective", () => {
  expect(parseComposerCommand("/goal  完成报告\n验收：给出三项结论\n "))
    .toEqual({ kind: "goal", text: "完成报告\n验收：给出三项结论" })
})

test("side command retains the existing optional prompt grammar", () => {
  expect(parseComposerCommand("/side")).toEqual({ kind: "side", text: "" })
  expect(parseComposerCommand(" /side  Explain this\nwith an example "))
    .toEqual({ kind: "side", text: "Explain this\nwith an example" })
})

test("ordinary messages preserve command-like names and quoted commands as message content", () => {
  for (const text of ["/goalpost report", "/goals", "Explain /goal", "`/goal`", "/sidecar", "A normal message"]) {
    expect(parseComposerCommand(text)).toEqual({ kind: "message", text })
  }
})
