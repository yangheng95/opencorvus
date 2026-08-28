import { beforeEach, describe, expect, test } from "bun:test"
import { setAppStore } from "../src/store/app"
import { setLocaleData } from "../src/utils/i18n"
import { authorizeProvider, type AuthDialogCallbacks } from "../src/services/llm"

function callbacks(cancelled: string[]): AuthDialogCallbacks {
  return {
    nativePrompt: async () => null,
    nativeSelect: async () => null,
    nativeConfirm: async () => false,
    nativeOpen: async () => false,
    externalUrlNeedsUserGesture: false,
    showLlmNotice: () => undefined,
    onAuthCancelled: (providerID) => {
      cancelled.push(providerID)
    },
  }
}

describe("provider auth cancellation", () => {
  beforeEach(() => {
    setLocaleData("en-US", {
      common: { cancel: "Cancel", open: "Open" },
      llm: { status: { auth_required: "Authentication required" }, title: "Providers" },
    })
    setAppStore({
      providerCatalog: {
        all: [{ id: "openai-codex", name: "OpenAI Codex" }],
        connected: [],
        default: {},
      },
      providerAuth: {
        "openai-codex": [{ type: "oauth", label: "ChatGPT Pro/Plus (browser)" }],
      },
    })
  })

  test("default OAuth confirmation cancellation is reported through the callback contract", async () => {
    const cancelled: string[] = []

    const ok = await authorizeProvider("openai-codex", undefined, callbacks(cancelled))

    expect(ok).toBe(false)
    expect(cancelled).toEqual(["openai-codex"])
  })
})
