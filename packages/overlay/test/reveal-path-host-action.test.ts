import { afterEach, describe, expect, test } from "bun:test"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { HOST_CAPABILITIES, type HostKind, type HostTransport, type NativeCommand } from "../src/services/host-transport"
import { pathRevealLabelKey, pathRevealNoticeKey, revealPath } from "../src/services/workspace"

// What this pins
// ----------------
// A path has to reach the user on every host. The desktop host opens the OS
// file manager through `open-path`; a browser cannot drive Explorer or Finder,
// so the browser host has that command declared false and `native()` rejects
// it. Before this contract existed the four call sites each decided for
// themselves — three hid their entry point outright and the fourth let the
// rejection surface as a raw technical error — so the browser build simply had
// no way to learn a path.
//
// `revealPath` is the single place that decision lives. It picks the *action*
// from the host's declared capability; it is not a fallback inside
// `nativeOpen`, which still rejects on hosts without the command.

function transportFor(kind: HostKind, sink: NativeCommand[]): HostTransport {
  return {
    kind,
    capabilities: HOST_CAPABILITIES[kind],
    async request() {
      throw new Error("request is not used by revealPath")
    },
    openStream() {
      throw new Error("openStream is not used by revealPath")
    },
    async native(command: NativeCommand) {
      sink.push(command)
      if (!HOST_CAPABILITIES[kind].nativeCommands[command.kind]) {
        throw new Error(`Native command "${command.kind}" is not available in host "${kind}".`)
      }
      return command.kind === "open-path" ? true : undefined
    },
  } as unknown as HostTransport
}

const PATH = "D:/opencorvus/projects/demo"

afterEach(() => __setHostTransportForTest(undefined))

describe("revealPath", () => {
  test("the desktop host opens the path in the OS file manager", async () => {
    const issued: NativeCommand[] = []
    __setHostTransportForTest(transportFor("tauri", issued))

    expect(await revealPath(PATH)).toBe("opened")
    expect(issued).toEqual([{ kind: "open-path", path: PATH }])
  })

  test("the browser host puts the path on the clipboard", async () => {
    const issued: NativeCommand[] = []
    __setHostTransportForTest(transportFor("browser", issued))

    expect(await revealPath(PATH)).toBe("copied")
    expect(issued).toEqual([{ kind: "clipboard.writeText", text: PATH }])
  })

  test("the target is trimmed before it reaches the host", async () => {
    const issued: NativeCommand[] = []
    __setHostTransportForTest(transportFor("browser", issued))

    expect(await revealPath(`  ${PATH}  `)).toBe("copied")
    expect(issued).toEqual([{ kind: "clipboard.writeText", text: PATH }])
  })

  test("a blank target raises an explicit error", async () => {
    __setHostTransportForTest(transportFor("tauri", []))

    await expect(revealPath("   ")).rejects.toThrow(/requires a non-empty path/)
  })
})

describe("path action labels", () => {
  test("each host names the action it performs", () => {
    __setHostTransportForTest(transportFor("tauri", []))
    expect(pathRevealLabelKey()).toBe("cwd.open")

    __setHostTransportForTest(transportFor("browser", []))
    expect(pathRevealLabelKey()).toBe("cwd.copy_path")
  })

  test("only a copy needs a confirmation notice", () => {
    expect(pathRevealNoticeKey("copied")).toBe("cwd.path_copied")
    expect(pathRevealNoticeKey("opened")).toBe("")
  })
})
