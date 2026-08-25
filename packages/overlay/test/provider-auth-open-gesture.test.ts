import { beforeEach, describe, expect, mock, test } from "bun:test"
import { setAppStore } from "../src/store/app"
import { setLocaleData } from "../src/utils/i18n"

// What this pins
// ----------------
// Two network round trips separate the operator's click from the moment the
// authorization page would be opened. A browser only allows `window.open`
// during transient activation, and by then it is usually gone — the tab is
// refused silently, because `window.open` cannot report a block once
// `noopener` is set.
//
// So the flow asks its host, through the callbacks that are its only host
// boundary. A desktop host opens the page itself. A host that needs a gesture
// is handed the URL as a dialog action instead, and the open happens inside
// that click — the one moment a browser will permit it.

mock.module("../src/services/api", () => ({
  apiJson: async (path: string) => {
    const route = path.split("?", 1)[0] || path
    if (route.endsWith("/auth/prompts")) return []
    if (route.endsWith("/oauth/authorize")) {
      return { url: "https://auth.example.com/authorize", method: "code", instructions: "Sign in" }
    }
    if (route.endsWith("/oauth/callback")) return true
    throw new Error(`unexpected api path ${path}`)
  },
}))

const { authorizeProvider } = await import("../src/services/llm")
type AuthDialogCallbacks = Parameters<typeof authorizeProvider>[2]

interface Recorded {
  opened: string[]
  promptLinks: Array<{ url: string; label: string } | undefined>
}

function callbacksFor(recorded: Recorded, externalUrlNeedsUserGesture: boolean): AuthDialogCallbacks {
  return {
    nativePrompt: async (_message: string, opts: { link?: { url: string; label: string } }) => {
      recorded.promptLinks.push(opts.link)
      return "authorization-code"
    },
    nativeSelect: async () => null,
    nativeConfirm: async () => true,
    nativeOpen: async (url: string) => {
      recorded.opened.push(url)
      return true
    },
    externalUrlNeedsUserGesture,
    showLlmNotice: () => undefined,
    onAuthCancelled: () => undefined,
  } as unknown as AuthDialogCallbacks
}

beforeEach(() => {
  setLocaleData("en-US", {
    common: { cancel: "Cancel", ok: "OK", submit: "Submit" },
    llm: { title: "Providers", auth_open_page: "Open authorization page" },
  })
  setAppStore({
    providerCatalog: { all: [{ id: "openai", name: "OpenAI" }], connected: [], default: {} },
  } as never)
  setAppStore("providerAuth", { openai: [{ type: "oauth", label: "Browser sign-in" }] })
})

describe("provider authorization opens the page where the host allows it", () => {
  test("a host that can open without a gesture opens the page itself", async () => {
    const recorded: Recorded = { opened: [], promptLinks: [] }

    await authorizeProvider("openai", 0, callbacksFor(recorded, false))

    expect(recorded.opened).toEqual(["https://auth.example.com/authorize"])
  })

  test("a host needing a gesture is handed the page as a dialog action", async () => {
    const recorded: Recorded = { opened: [], promptLinks: [] }

    await authorizeProvider("openai", 0, callbacksFor(recorded, true))

    expect(recorded.promptLinks).toEqual([
      { url: "https://auth.example.com/authorize", label: "Open authorization page" },
    ])
  })
})
