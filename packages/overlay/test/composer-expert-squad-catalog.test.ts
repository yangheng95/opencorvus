import { describe, expect, test } from "bun:test"
import { mergeComposerExpertSquadOptions } from "../src/services/composer-expert-squad-catalog"
import type { ExpertSquadOption } from "../src/services/expert-squad"

function option(id: string): ExpertSquadOption {
  return {
    id,
    name: id,
    display_label: id,
    built_in: true,
    product_pillars: ["code"],
    source: { kind: "built_in" },
  }
}

describe("Composer Expert Squad bounded catalog", () => {
  test("keeps the exact active and selected Squads alongside each bounded search page", () => {
    const initialPage = Array.from({ length: 20 }, (_, index) => option(`page-${index}`))
    const current = [...initialPage, option("active-after-first-page"), option("selected-reference")]
    const nextPage = Array.from({ length: 20 }, (_, index) => option(`query-${index}`))

    expect(
      mergeComposerExpertSquadOptions(nextPage, current, ["active-after-first-page", "selected-reference"]).map(
        (entry) => entry.id,
      ),
    ).toEqual([...nextPage.map((entry) => entry.id), "active-after-first-page", "selected-reference"])
  })
})
