import { describe, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"

describe("compact Task identifiers", () => {
  test("remain canonical, ordered, unique, and timestamp-readable across the complete sequence window", () => {
    const timestamp = 2_000_000_000_000
    const taskIDs = Array.from({ length: 3_844 }, () => Identifier.create("task", false, timestamp))

    expect(taskIDs.every((taskID) => taskID.length === 24 && Identifier.isCanonical("task", taskID))).toBe(true)
    expect(new Set(taskIDs).size).toBe(taskIDs.length)
    expect(taskIDs.toSorted()).toEqual(taskIDs)
    expect(Identifier.timestamp(taskIDs[0]!)).toBe(timestamp)
    expect(Identifier.timestamp(taskIDs.at(-1)!)).toBe(timestamp)
  })

  test("preserve descending creation order in the same compact format", () => {
    const timestamp = 2_000_000_000_100
    const taskIDs = Array.from({ length: 100 }, () => Identifier.create("task", true, timestamp))

    expect(taskIDs.every((taskID) => taskID.length === 24 && Identifier.isCanonical("task", taskID))).toBe(true)
    expect(taskIDs.toSorted().reverse()).toEqual(taskIDs)
  })
})
