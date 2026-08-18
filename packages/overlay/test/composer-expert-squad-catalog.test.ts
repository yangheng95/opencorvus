import { describe, expect, test } from "bun:test"
import { mergeComposerExpertSquadOptions } from "../src/services/composer-expert-squad-catalog"
import {
  expertSquadMarketIndexFromDetail,
  reconcileExpertSquadMarketCatalog,
} from "../src/services/expert-squad-market-catalog"
import type { ExpertSquadMarketIndexItem, ExpertSquadMarketItem, ExpertSquadOption } from "../src/services/expert-squad"

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

function marketIndex(id: string): ExpertSquadMarketIndexItem {
  return {
    namespace: "builtin",
    id,
    name: id,
    label: id,
    version: "1.0.0",
    product_pillars: ["code"],
    installation_scopes: [],
  }
}

function marketDetail(id: string, installationScopes: Array<"project" | "global"> = []): ExpertSquadMarketItem {
  return {
    ...marketIndex(id),
    package_digest: "a".repeat(64),
    selector_summary: `${id} selector`,
    agents: [],
    skill_count: 0,
    tool_count: 0,
    mcp_count: 0,
    installations: installationScopes.map((installation_scope) => ({
      installation_scope,
      installed_version: "1.0.0",
      installed_package_digest: "b".repeat(64),
      update_available: false,
    })),
  }
}

describe("Expert Squad market index projection", () => {
  test("carries the product pillars an exact detail declares", () => {
    const projected = expertSquadMarketIndexFromDetail({
      ...marketDetail("commercial-legal", ["project"]),
      product_pillars: ["work"],
    })

    expect(projected.product_pillars).toEqual(["work"])
    expect(projected.installation_scopes).toEqual(["project"])
  })
})

describe("Composer Expert Squad bounded catalog", () => {
  test("keeps the exact active and selected Squads alongside each bounded search page", () => {
    const initialPage = Array.from({ length: 20 }, (_, index) => option(`page-${index}`))
    const current = [...initialPage, option("active-after-first-page"), option("selected-reference")]
    const nextPage = Array.from({ length: 20 }, (_, index) => option(`query-${index}`))

    expect(
      mergeComposerExpertSquadOptions(nextPage, current, ["active-after-first-page", "selected-reference"]).map(
        (entry) => entry.id,
      ),
    ).toEqual([
      ...nextPage.map((entry) => entry.id),
      "active-after-first-page",
      "selected-reference",
    ])
  })

  test("keeps exact active and selected Market entries beside a filtered bounded page", () => {
    const page = Array.from({ length: 20 }, (_, index) => marketIndex(`page-${index}`))
    const active = marketDetail("active-after-first-page", ["global"])
    const selected = marketDetail("selected-outside-filter")
    const projection = reconcileExpertSquadMarketCatalog({
      page,
      current: [],
      exact: [active, selected],
      preservedIDs: [active.id, selected.id],
      requestedSelectedID: selected.id,
    })

    expect(projection.index.map((entry) => entry.id)).toEqual([
      ...page.map((entry) => entry.id),
      active.id,
      selected.id,
    ])
    expect(projection.items.map((entry) => entry.id)).toEqual([active.id, selected.id])
    expect(projection.selectedID).toBe(selected.id)
    expect(projection.index.find((entry) => entry.id === active.id)?.installation_scopes).toEqual(["global"])
  })
})
