import { describe, expect, test } from "bun:test"
import { parseCommandTemplate } from "../src/stt/providers/local-cli"

describe("configured CLI commands are parsed as command lines", () => {
  test("a quoted executable path with spaces stays one argument", () => {
    expect(parseCommandTemplate('"C:\\Program Files\\whisper\\whisper.exe" --model base')).toEqual([
      "C:\\Program Files\\whisper\\whisper.exe",
      "--model",
      "base",
    ])
  })

  test("a substituted media path containing spaces stays one argument", () => {
    // The audited failure: the template was substituted first and split on
    // whitespace after, so a temporary directory — which on Windows always
    // contains spaces — was torn into several arguments.
    const argv = parseCommandTemplate("whisper {{MediaPath}} --output_dir {{OutputDir}}").map((argument) =>
      argument
        .replaceAll("{{MediaPath}}", "C:\\Users\\a b\\AppData\\Local\\Temp\\stt-1\\input.ogg")
        .replaceAll("{{OutputDir}}", "C:\\Users\\a b\\AppData\\Local\\Temp\\stt-1"),
    )
    expect(argv).toEqual([
      "whisper",
      "C:\\Users\\a b\\AppData\\Local\\Temp\\stt-1\\input.ogg",
      "--output_dir",
      "C:\\Users\\a b\\AppData\\Local\\Temp\\stt-1",
    ])
  })

  test("single quotes group and suppress escapes, double quotes group and honour them", () => {
    expect(parseCommandTemplate(`cli 'a  b' "c\\"d"`)).toEqual(["cli", "a  b", 'c"d'])
  })

  test("repeated whitespace between arguments is not an argument", () => {
    expect(parseCommandTemplate("  cli   --flag\tvalue ")).toEqual(["cli", "--flag", "value"])
  })

  test("an empty quoted argument is preserved as an empty argument", () => {
    expect(parseCommandTemplate('cli "" x')).toEqual(["cli", "", "x"])
  })

  test("an unterminated quote is refused instead of silently reinterpreted", () => {
    expect(() => parseCommandTemplate('cli "unterminated')).toThrow("unterminated")
  })
})
