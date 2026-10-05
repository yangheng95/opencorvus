import { describe, expect, test } from "bun:test"
import cases from "../../../specs/artifacts/2026-10-05-server-base-url-contract/operational-base-cases.json"
import {
  isNativeCommand,
  isOverlayPersistedSettings,
  joinServerBaseUrl,
  parseServerBaseUrl,
  ServerBaseUrlError,
} from "../src"

describe("operational server base contract", () => {
  test.each(cases.cases)("projects the shared authored $id case", ({ input, expected }) => {
    if (expected.url !== undefined) {
      expect(parseServerBaseUrl(input).href).toBe(expected.url)
      return
    }
    let failure: unknown
    try {
      parseServerBaseUrl(input)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(ServerBaseUrlError)
    const error = failure as ServerBaseUrlError
    const publicError: { name: string; reason: string; message: string } = {
      name: error.name,
      reason: error.reason,
      message: error.message,
    }
    expect(publicError).toEqual({
      name: "ServerBaseUrlError",
      ...expected,
    })
    expect(JSON.parse(JSON.stringify(error))).toEqual({ name: "ServerBaseUrlError", reason: expected.reason })
  })

  test.each([
    ["global/health", "https://example.invalid/prefix/global/health"],
    ["/task/owned?directory=C%3A%2Fowned", "https://example.invalid/prefix/task/owned?directory=C%3A%2Fowned"],
    ["http://other.invalid/path?x=1", "https://example.invalid/prefix/http://other.invalid/path?x=1"],
    ["//other.invalid/path", "https://example.invalid/prefix/other.invalid/path"],
    ["\\\\other.invalid/path", "https://example.invalid/prefix///other.invalid/path"],
    ["a%2Fb?value=%23#part", "https://example.invalid/prefix/a%2Fb?value=%23#part"],
  ])("joins %s under the base authority", (target, expected) => {
    expect(joinServerBaseUrl("https://example.invalid/prefix/", target).href).toBe(expected)
  })

  test("preserves encoded and IPv6 base paths when joining", () => {
    expect(joinServerBaseUrl("http://[::1]:17944/a%2Fb/%E4%B8%AD", "/global/health").href).toBe(
      "http://[::1]:17944/a%2Fb/%E4%B8%AD/global/health",
    )
  })

  test("distinguishes readable saved documents from operational save commands", () => {
    const saved = {
      serverUrl: "not a url",
      autoServer: false,
      username: "",
      password: "",
      projectEditor: "vscode",
      initGit: false,
      sidebarCollapsed: false,
      workLedgerOrganization: "by-project",
      workLedgerSort: "updated",
      zoom: 1,
      theme: "light",
      locale: "en-US",
      preferredProjectEditor: "vscode",
      desktopNotifications: true,
      projectComposerIntents: [
        {
          serverUrl: "historical invalid address",
          directory: "C:/owned",
          productPillar: "code",
          conversationTarget: "chat",
        },
      ],
    }
    expect(isOverlayPersistedSettings(saved)).toBe(true)
    const corrected = { ...saved, serverUrl: "http://offline.example.invalid:17999" }
    expect(isNativeCommand({ kind: "settings.save", payload: corrected })).toBe(true)
    expect(corrected.projectComposerIntents).toEqual(saved.projectComposerIntents)
  })
})
