import { describe, expect, test } from "bun:test"
import { resolveComposerIntentRoute, type ComposerIntent } from "../src"

describe("composer intent resolver", () => {
  const cases: Array<{
    intent: ComposerIntent
    route: ReturnType<typeof resolveComposerIntentRoute>
  }> = [
    {
      intent: { productPillar: "code", conversationTarget: "chat" },
      route: { kind: "conversation", productPillar: "code", experience: "chat" },
    },
    {
      intent: { productPillar: "work", conversationTarget: "chat" },
      route: { kind: "conversation", productPillar: "work", experience: "work" },
    },
    {
      intent: { productPillar: "code", conversationTarget: "mission" },
      route: { kind: "mission", productPillar: "code" },
    },
    {
      intent: { productPillar: "work", conversationTarget: "mission" },
      route: { kind: "mission", productPillar: "work" },
    },
  ]

  for (const item of cases) {
    test(`${item.intent.productPillar} + ${item.intent.conversationTarget}`, () => {
      expect(resolveComposerIntentRoute(item.intent, false)).toEqual(item.route)
    })
  }

  test("an explicit Mission reference preserves the selected product pillar", () => {
    expect(resolveComposerIntentRoute({ productPillar: "work", conversationTarget: "chat" }, true)).toEqual({
      kind: "mission",
      productPillar: "work",
    })
  })
})
