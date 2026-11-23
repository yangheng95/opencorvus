import { expect, test } from "bun:test"
import { shellCommandOutput, shellResultOutput } from "../src/shell-result"

test("reads original command output and whitespace before a confirmed nonzero exit", () => {
  const output = "first line\n  second line\n"
  const result = shellResultOutput(output, 7)
  expect(result).toBe("first line\n  second line\n\n\n<bash_metadata>\nexit code: 7\n</bash_metadata>")
  expect(shellCommandOutput(result, 7)).toBe(output)
})

test("a silent successful receipt represents empty command output", () => {
  const result = shellResultOutput("", 0)
  expect(result).toBe("<bash_metadata>\nexit code: 0\n</bash_metadata>")
  expect(shellCommandOutput(result, 0)).toBe("")
})

test("literal receipt-shaped command output retains its original text", () => {
  const output = "<bash_metadata>\nexit code: 0\n</bash_metadata>\n"
  expect(shellCommandOutput(shellResultOutput(output, 0), 0)).toBe(output)
})

test("a receipt with additional process details remains fully readable", () => {
  const result = shellResultOutput("Starting\n", 0, ["background process exited before readiness window"])
  expect(shellCommandOutput(result, 0)).toBe(
    "Starting\n\n\n<bash_metadata>\nexit code: 0\nbackground process exited before readiness window\n</bash_metadata>",
  )
})
