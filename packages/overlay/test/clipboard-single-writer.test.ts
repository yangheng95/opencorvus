import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { copyText, copyTextReporting } from "../src/services/clipboard"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport } from "../src/services/host-transport"
import { setLocaleData } from "../src/utils/i18n"

// What this pins
// ----------------
// Writing text to the clipboard is one capability, so it has one implementation.
// Eight components once called `navigator.clipboard.writeText` themselves: they
// produced four different explanations for the same failure, two of them said
// nothing at all, and the desktop host never got its native clipboard because
// the WebView's was used instead. Routing every writer through the declared
// host command is what keeps those from drifting apart again.

interface Recorded {
  commands: Array<{ kind: string; text?: string }>
}

function transportWith(recorded: Recorded, failure?: Error): HostTransport {
  return {
    native: async (command: { kind: string; text?: string }) => {
      recorded.commands.push({ kind: command.kind, text: command.text })
      if (failure) throw failure
      return true
    },
  } as unknown as HostTransport
}

beforeEach(() => {
  setLocaleData("en-US", { "common.error": "Error" })
})

afterEach(() => {
  __setHostTransportForTest(undefined)
})

describe("clipboard writes go through the host", () => {
  test("hands the exact text to the declared host command", async () => {
    const recorded: Recorded = { commands: [] }
    __setHostTransportForTest(transportWith(recorded))

    await copyText("  spacing preserved  ")

    expect(recorded.commands).toEqual([{ kind: "clipboard.writeText", text: "  spacing preserved  " }])
  })

  test("surfaces the host's reason to the caller", async () => {
    const recorded: Recorded = { commands: [] }
    __setHostTransportForTest(
      transportWith(recorded, new Error("The clipboard needs a secure context: open OpenCorvus over HTTPS")),
    )

    await expect(copyText("x")).rejects.toThrow(/needs a secure context/)
  })

  test("a reporting copy still reaches the host with the same text", async () => {
    const recorded: Recorded = { commands: [] }
    __setHostTransportForTest(transportWith(recorded))

    await copyTextReporting("reported", "artifact-code")

    expect(recorded.commands).toEqual([{ kind: "clipboard.writeText", text: "reported" }])
  })

  test("a reporting copy absorbs the failure so a bare onClick cannot reject", async () => {
    const recorded: Recorded = { commands: [] }
    __setHostTransportForTest(transportWith(recorded, new Error("no clipboard here")))

    // Resolving is the contract: these call sites have nowhere to put a
    // rejection, so the failure has to become a visible report instead.
    await expect(copyTextReporting("x", "artifact-terminal")).resolves.toBeUndefined()
    expect(recorded.commands).toEqual([{ kind: "clipboard.writeText", text: "x" }])
  })
})
