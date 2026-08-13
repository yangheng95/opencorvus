import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Identifier } from "../src/id/id"
import { Project } from "../src/project/project"

describe("compact OpenCorvus identifiers", () => {
  test("keeps every generated identity family within 24 characters and ordered across its sequence window", () => {
    for (const [index, kind] of Identifier.kinds.entries()) {
      const timestamp = 2_000_000_000_000 + index
      const ids = Array.from({ length: 3_844 }, () => Identifier.create(kind, false, timestamp))

      expect(ids.every((id) => id.length <= Identifier.MAX_LENGTH && Identifier.isCanonical(kind, id))).toBe(true)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.toSorted()).toEqual(ids)
      expect(Identifier.timestamp(ids[0]!)).toBe(timestamp)
      expect(Identifier.timestamp(ids.at(-1)!)).toBe(timestamp)
    }
  })

  test("preserves descending creation order for every identity family", () => {
    for (const [index, kind] of Identifier.kinds.entries()) {
      const timestamp = 2_000_000_100_000 + index
      const ids = Array.from({ length: 100 }, () => Identifier.create(kind, true, timestamp))

      expect(ids.every((id) => id.length <= Identifier.MAX_LENGTH && Identifier.isCanonical(kind, id))).toBe(true)
      expect(ids.toSorted().reverse()).toEqual(ids)
    }
  })

  test("derives stable compact identities from Host-owned integrity material", () => {
    for (const kind of Identifier.kinds) {
      const first = Identifier.deterministic(kind, "same full integrity material")
      const replay = Identifier.deterministic(kind, "same full integrity material")
      const other = Identifier.deterministic(kind, "different full integrity material")

      expect(first.length).toBeLessThanOrEqual(Identifier.MAX_LENGTH)
      expect(Identifier.isCanonical(kind, first)).toBe(true)
      expect(replay).toBe(first)
      expect(other).not.toBe(first)
    }
  })

  test("derives one compact Project identity from the complete normalized repository path", () => {
    const root = path.resolve("identifier-project-fixture")
    const first = Project.directoryProjectID(root)
    const replay = Project.directoryProjectID(root)
    const equivalent = Project.directoryProjectID(path.join(root, "."))
    const other = Project.directoryProjectID(path.resolve("identifier-other-project-fixture"))

    expect(first).toHaveLength(Identifier.MAX_LENGTH)
    expect(Identifier.isCanonical("project", first)).toBe(true)
    expect(replay).toBe(first)
    expect(equivalent).toBe(first)
    if (process.platform === "win32") expect(Project.directoryProjectID(root.toUpperCase())).toBe(first)
    expect(other).not.toBe(first)
  })
})
