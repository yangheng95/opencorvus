import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest } from "../src/services/host-transport"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
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

afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
})
for (const failure of ["cancel-code", "browser-blocked"] as const) {
  test(`${failure} releases the exact pending OAuth occurrence through the service`, async () => {
    setLocaleData("en-US", {
      common: { submit: "Submit", cancel: "Cancel" },
      llm: { title: "Providers", auth_open_failed: "Could not open authorization" },
    })
    const requests: TransportRequest[] = []
    configure({ directory: "" })
    __setHostTransportForTest({
      kind: "browser",
      async request(request) {
        requests.push(request)
        return {
          status: 200,
          ok: true,
          headers: {},
          body: request.path.endsWith("authorize")
            ? {
                url: "https://auth.example.test",
                method: "code",
                instructions: "Enter code",
                flowID: "exact-occurrence",
              }
            : { ok: true },
        }
      },
      openStream() {
        return { close() {} }
      },
      async native() {
        throw new Error("unused")
      },
    } as HostTransport)
    setAppStore({ providerAuth: { "cancel-provider": [{ type: "oauth", label: "Browser" }] } })
    const cancelled: string[] = []
    const dialogs = { ...callbacks(cancelled), nativeOpen: async () => failure === "cancel-code" }
    if (failure === "cancel-code") {
      expect(await authorizeProvider("cancel-provider", 0, dialogs)).toBe(false)
      expect(cancelled).toEqual(["cancel-provider"])
    } else {
      await expect(authorizeProvider("cancel-provider", 0, dialogs)).rejects.toThrow()
    }
    expect(requests.map(({ path, body }) => ({ path, body }))).toEqual([
      {
        path: "global/providers/cancel-provider/auth/prompts",
        body: { kind: "json", value: { method: 0, inputs: {} } },
      },
      {
        path: "global/providers/cancel-provider/oauth/authorize",
        body: { kind: "json", value: { method: 0, inputs: {} } },
      },
      {
        path: "global/providers/cancel-provider/oauth/cancel",
        body: { kind: "json", value: { method: 0, flowID: "exact-occurrence" } },
      },
    ])
  })
}
