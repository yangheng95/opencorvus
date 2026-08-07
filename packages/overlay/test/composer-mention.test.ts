import { describe, expect, test } from "bun:test"

import { findComposerMentionQuery } from "../src/services/composer-mention"

describe("Composer mention query parsing", () => {
  test("keeps direct ASCII identifier search at a token boundary", () => {
    expect(findComposerMentionQuery("@gri", 4)).toEqual({
      start: 0,
      end: 4,
      stage: "category",
      query: "gri",
    })
  })

  test("keeps Unicode entity search after an explicit category", () => {
    expect(findComposerMentionQuery("@skill 时", 8)).toEqual({
      start: 0,
      end: 8,
      stage: "entity",
      kind: "skill",
      query: "时",
    })
  })
})
