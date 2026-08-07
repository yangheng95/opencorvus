import { describe, expect, test } from "bun:test"
import {
  isImplicitProjectDirectory,
  projectDirectoryKey,
  projectDirectoryLabel,
  projectDisplayName,
} from "../src/utils/project-directory"

describe("project directory helpers", () => {
  test("builds a stable key for empty and populated directories", () => {
    expect(projectDirectoryKey("")).toBe("__opencorvus_unassigned_project__")
    expect(projectDirectoryKey("/repo/app")).toBe("/repo/app")
  })

  test("derives the same compact project label used by task and mission ledgers", () => {
    expect(projectDirectoryLabel("", "Unknown")).toEqual({ name: "Unknown", parent: "" })
    expect(projectDirectoryLabel("D:\\work\\opencorvus", "Unknown")).toEqual({
      name: "opencorvus",
      parent: "D:/work",
    })
    expect(projectDirectoryLabel("/Users/alice/projects/opencorvus", "Unknown")).toEqual({
      name: "opencorvus",
      parent: ".../alice/projects",
    })
  })

  test("recognizes dated UUID task projects and gives every surface the same human label", () => {
    const directory = "C:\\Users\\alice\\.opencorvus\\projects\\2026\\07\\11\\a9033ac2-24ba-430b-b341-f886364c4536"
    expect(isImplicitProjectDirectory(directory)).toBe(true)
    expect(projectDirectoryLabel(directory, "Unknown", "Global task project")).toEqual({
      name: "Global task project",
      parent: "",
    })
    expect(isImplicitProjectDirectory("C:\\work\\2026\\7\\11\\a9033ac2-24ba-430b-b341-f886364c4536")).toBe(false)
    expect(isImplicitProjectDirectory("C:\\work\\2026\\07\\11\\not-a-uuid")).toBe(false)
  })

  test("does not classify a stable named directory as an anonymous dated project", () => {
    expect(isImplicitProjectDirectory("/Users/alice/.local/share/opencorvus/projects/temporary")).toBe(false)
    expect(isImplicitProjectDirectory("C:\\Users\\alice\\AppData\\OpenCorvus\\projects\\temporary")).toBe(false)
    expect(isImplicitProjectDirectory("/Users/alice/projects/temporary-app")).toBe(false)
  })

  test("resolves one Project name for stored custom names and directory-owned names", () => {
    expect(
      projectDisplayName({
        directory: "D:\\work\\opencorvus",
        customName: "  Custom workspace  ",
        unknownName: "Unknown",
      }),
    ).toBe("Custom workspace")
    expect(projectDisplayName({ directory: "D:\\work\\opencorvus", customName: "", unknownName: "Unknown" })).toBe(
      "opencorvus",
    )
    expect(
      projectDisplayName({ directory: "/Users/alice/projects/app", customName: "   ", unknownName: "Unknown" }),
    ).toBe("app")
    expect(projectDisplayName({ directory: "", customName: "", unknownName: "Unknown" })).toBe("Unknown")
  })
})
