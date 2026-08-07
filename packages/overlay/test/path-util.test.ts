import { describe, expect, test } from "bun:test"

import { relativePathFrom } from "../src/utils/path"

describe("relativePathFrom", () => {
  test("returns sub-path when target lives under base (posix separators)", () => {
    expect(relativePathFrom("/home/me/proj", "/home/me/proj/.opencorvus/worktrees/goal-a")).toBe(
      ".opencorvus/worktrees/goal-a",
    )
  })

  test("returns sub-path when target lives under base (windows separators)", () => {
    expect(relativePathFrom("D:\\dev\\proj", "D:\\dev\\proj\\.opencorvus\\worktrees\\goal-a")).toBe(
      ".opencorvus\\worktrees\\goal-a",
    )
  })

  test("returns sub-path when separators are mixed", () => {
    expect(relativePathFrom("D:/dev/proj", "D:\\dev\\proj\\.opencorvus\\worktrees\\goal-a")).toBe(
      ".opencorvus\\worktrees\\goal-a",
    )
  })

  test("is case-insensitive on the base prefix (Windows reality)", () => {
    expect(relativePathFrom("D:/Dev/Proj", "d:/dev/proj/sub/a")).toBe("sub/a")
  })

  test("tolerates a trailing slash on base", () => {
    expect(relativePathFrom("/home/me/proj/", "/home/me/proj/sub/a")).toBe("sub/a")
  })

  test("returns empty when target is not under base", () => {
    expect(relativePathFrom("/home/me/proj", "/var/log/other")).toBe("")
  })

  test("returns empty when target equals base (no sub-path)", () => {
    expect(relativePathFrom("/home/me/proj", "/home/me/proj")).toBe("")
  })

  test("returns empty when base is empty (hydration not complete)", () => {
    expect(relativePathFrom("", "/home/me/proj/sub")).toBe("")
  })

  test("returns empty when target is empty", () => {
    expect(relativePathFrom("/home/me/proj", "")).toBe("")
  })

  test("does not fall back to shortPath / absolute when relative fails (rule 7)", () => {
    // Caller is expected to <Show when={relativePathFrom(...)}> the row; the
    // helper must NOT invent a partial display for unresolvable input.
    expect(relativePathFrom("/a/b", "/c/d/e/f/g")).toBe("")
  })
})
