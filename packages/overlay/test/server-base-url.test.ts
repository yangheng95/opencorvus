import { afterEach, expect, test } from "bun:test"
import { ServerBaseUrlError } from "@opencorvus-ai/transport-protocol"
import { apiUrl, configure, getServerUrl } from "../src/services/api-state"
import { resolveResourceUrl } from "../src/services/api"
import { mergeBrowserOverlaySettings } from "../src/services/overlay-settings-storage"
import { bootstrapOverlaySettings, DEFAULT_SETTINGS } from "../src/store/settings"

const originalUrl = getServerUrl()
afterEach(() => {
  configure({ serverUrl: originalUrl, directory: "" })
})

test("preserves the selected base authority, prefix and API-owned directory query", () => {
  configure({ serverUrl: "https://EXAMPLE.invalid:443/a%2Fb/", directory: "C:/owned project" })
  expect(apiUrl("global/health")).toBe("https://example.invalid/a%2Fb/global/health")
  expect(apiUrl("file/content?path=hello.txt")).toBe(
    "https://example.invalid/a%2Fb/file/content?path=hello.txt&directory=C%3A%2Fowned+project",
  )
  expect(apiUrl("file/content?path=hello.txt&directory=C%3A%2Fexplicit")).toBe(
    "https://example.invalid/a%2Fb/file/content?path=hello.txt&directory=C%3A%2Fexplicit",
  )
  expect(apiUrl("http://other.invalid/path")).toBe(
    "https://example.invalid/a%2Fb/http://other.invalid/path?directory=C%3A%2Fowned+project",
  )
})

test("retains the old applied invalid identity and returns a typed local projection error", () => {
  configure({ serverUrl: "http://" })
  expect(getServerUrl()).toBe("http://")
  for (const resolve of [() => apiUrl("global/health"), () => resolveResourceUrl("/file/content?path=fixture")]) {
    let failure: unknown
    try {
      resolve()
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(ServerBaseUrlError)
    expect({
      name: (failure as Error).name,
      reason: (failure as ServerBaseUrlError).reason,
      message: (failure as Error).message,
    }).toEqual({ name: "ServerBaseUrlError", reason: "malformed", message: "Server URL is not a valid absolute URL." })
  }
})

test("projects host resources with their own query and preserves independent absolute and bare resources", () => {
  configure({ serverUrl: "http://[::1]:17944/prefix", directory: "C:/unrelated" })
  expect(resolveResourceUrl("/attachment/owned?variant=thumb&name=a%2Fb#piece")).toBe(
    "http://[::1]:17944/prefix/attachment/owned?variant=thumb&name=a%2Fb#piece",
  )
  for (const raw of [
    "https://elsewhere.invalid/image?q=1",
    "http://elsewhere.invalid/file",
    "data:text/plain,DUMMY",
    "blob:https://example.invalid/owned",
    "file:///D:/owned.txt",
    "bare-name.txt",
    "",
  ])
    expect(resolveResourceUrl(raw)).toBe(raw)
})

test("browser settings can correct a previously saved invalid base and preserve its other fields", () => {
  const saved = bootstrapOverlaySettings({
    ...DEFAULT_SETTINGS,
    serverUrl: "not a url",
    username: "",
    password: "",
    theme: "sage",
    projectComposerIntents: [
      { serverUrl: "old bad address", directory: "C:/owned", productPillar: "work", conversationTarget: "mission" },
    ],
  })
  let failure: unknown
  try {
    mergeBrowserOverlaySettings(saved, saved, ["serverUrl"])
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(ServerBaseUrlError)
  expect({ reason: (failure as ServerBaseUrlError).reason, message: (failure as Error).message }).toEqual({
    reason: "malformed",
    message: "Server URL is not a valid absolute URL.",
  })
  const corrected = { ...saved, serverUrl: "  https://EXAMPLE.invalid:443/prefix/  " }
  expect(mergeBrowserOverlaySettings(saved, corrected, ["serverUrl"])).toEqual(corrected)
})
