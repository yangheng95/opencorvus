import { afterEach, describe, expect, spyOn, test } from "bun:test"
import {
  clearExpertSquadInstallHandoff,
  expertSquadInstallHandoff,
  installExpertSquadInstallHandoffBridge,
} from "../src/services/expert-squad-install-handoff"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"

const originalWindow = globalThis.window

function pendingHandoffURL(id = "startup-review"): string {
  const pending = new URL("opencorvus://expert-squad/install")
  pending.searchParams.set("namespace", "openai")
  pending.searchParams.set("id", id)
  pending.searchParams.set("version", "1.0.0")
  pending.searchParams.set("packageDigest", "a".repeat(64))
  pending.searchParams.set("archiveSha256", "b".repeat(64))
  pending.searchParams.set("archiveBytes", "1024")
  pending.searchParams.set("archiveUrl", `https://example.com/${id}.zip`)
  return pending.href
}

afterEach(() => {
  const handoff = expertSquadInstallHandoff()
  if (handoff) clearExpertSquadInstallHandoff(handoff)
  __setHostTransportForTest(undefined)
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window
  } else {
    globalThis.window = originalWindow
  }
})

describe("Expert Squad install handoff bridge", () => {
  test("browser hosts receive an immediate inert cleanup handle", () => {
    __setHostTransportForTest(createTauriTransport("browser"))

    const cleanup = installExpertSquadInstallHandoffBridge()

    expect(cleanup).toBeTypeOf("function")
    expect(cleanup()).toBeUndefined()
  })

  test("Tauri hosts reconcile and acknowledge the exact pending handoff after listener registration", async () => {
    const pending = pendingHandoffURL()

    const commands: string[] = []
    let resolveListener: ((unlisten: () => void) => void) | undefined
    let unlistenCount = 0
    globalThis.window = {
      __TAURI__: {
        core: {
          invoke: async (command: string, args?: { raw?: string }) => {
            commands.push(command)
            if (command === "overlay_expert_squad_install_handoff_current") return pending
            if (command === "overlay_expert_squad_install_handoff_acknowledge") {
              expect(args?.raw).toBe(pending)
              expect(expertSquadInstallHandoff()?.id).toBe("startup-review")
              return true
            }
            throw new Error(`Unexpected native command ${command}`)
          },
        },
        event: {
          listen: () =>
            new Promise<() => void>((resolve) => {
              resolveListener = resolve
            }),
        },
      },
    } as unknown as Window & typeof globalThis
    __setHostTransportForTest(createTauriTransport())

    const cleanup = installExpertSquadInstallHandoffBridge()
    expect(cleanup).toBeTypeOf("function")

    resolveListener?.(() => {
      unlistenCount += 1
    })
    await Bun.sleep(0)
    await Bun.sleep(0)

    expect(commands).toEqual([
      "overlay_expert_squad_install_handoff_current",
      "overlay_expert_squad_install_handoff_acknowledge",
    ])
    expect(expertSquadInstallHandoff()?.namespace).toBe("openai")

    cleanup()
    expect(unlistenCount).toBe(1)
  })

  test("Tauri hosts dispose a listener that finishes registration after teardown", async () => {
    let resolveListener: ((unlisten: () => void) => void) | undefined
    let unlistenCount = 0
    globalThis.window = {
      __TAURI__: {
        event: {
          listen: () =>
            new Promise<() => void>((resolve) => {
              resolveListener = resolve
            }),
        },
      },
    } as unknown as Window & typeof globalThis
    __setHostTransportForTest(createTauriTransport())

    const cleanup = installExpertSquadInstallHandoffBridge()
    cleanup()
    resolveListener?.(() => {
      unlistenCount += 1
    })
    await Bun.sleep(0)

    expect(unlistenCount).toBe(1)
  })

  test("Tauri hosts converge on the latest pending handoff after a stale acknowledgement", async () => {
    const firstPending = pendingHandoffURL("superseded-receipt")
    const latestPending = pendingHandoffURL("latest-receipt")
    const commands: string[] = []
    const presentedHandoffs: string[] = []
    let currentReadCount = 0
    let completionObserved: (() => void) | undefined
    const completed = new Promise<void>((resolve) => {
      completionObserved = resolve
    })
    globalThis.window = {
      __TAURI__: {
        core: {
          invoke: async (command: string, args?: { raw?: string }) => {
            commands.push(command)
            if (command === "overlay_expert_squad_install_handoff_current") {
              currentReadCount += 1
              return currentReadCount === 1 ? firstPending : latestPending
            }
            if (command === "overlay_expert_squad_install_handoff_acknowledge") {
              const acknowledged = args?.raw === latestPending
              if (acknowledged) completionObserved?.()
              return acknowledged
            }
            throw new Error(`Unexpected native command ${command}`)
          },
        },
        event: {
          listen: async () => () => undefined,
        },
        window: {
          getCurrentWindow: () => ({
            show: async () => {
              presentedHandoffs.push(expertSquadInstallHandoff()?.id ?? "missing")
            },
            setFocus: async () => undefined,
          }),
        },
      },
    } as unknown as Window & typeof globalThis
    __setHostTransportForTest(createTauriTransport())

    const cleanup = installExpertSquadInstallHandoffBridge()
    await completed

    expect(commands).toEqual([
      "overlay_expert_squad_install_handoff_current",
      "overlay_expert_squad_install_handoff_acknowledge",
      "overlay_expert_squad_install_handoff_current",
      "overlay_expert_squad_install_handoff_acknowledge",
    ])
    expect(presentedHandoffs).toEqual(["superseded-receipt", "latest-receipt"])
    expect(expertSquadInstallHandoff()?.id).toBe("latest-receipt")

    cleanup()
  })

  test("Tauri hosts complete a retained pending receipt on the next wake after a surface failure", async () => {
    const pending = pendingHandoffURL("retained-receipt")
    const commands: string[] = []
    let eventHandler: (() => void) | undefined
    let failWindowShow = true
    let windowShowCount = 0
    let firstAttemptObserved: (() => void) | undefined
    let completionObserved: (() => void) | undefined
    const firstAttempt = new Promise<void>((resolve) => {
      firstAttemptObserved = resolve
    })
    const completed = new Promise<void>((resolve) => {
      completionObserved = resolve
    })
    const reportedError = spyOn(console, "error").mockImplementation(() => undefined)
    globalThis.window = {
      __TAURI__: {
        core: {
          invoke: async (command: string) => {
            commands.push(command)
            if (command === "overlay_expert_squad_install_handoff_current") return pending
            if (command === "overlay_expert_squad_install_handoff_acknowledge") {
              completionObserved?.()
              return true
            }
            throw new Error(`Unexpected native command ${command}`)
          },
        },
        event: {
          listen: async (_event: string, handler: () => void) => {
            eventHandler = handler
            return () => undefined
          },
        },
        window: {
          getCurrentWindow: () => ({
            show: async () => {
              windowShowCount += 1
              if (!failWindowShow) return
              firstAttemptObserved?.()
              throw new Error("controlled first surface failure")
            },
            setFocus: async () => undefined,
          }),
        },
      },
    } as unknown as Window & typeof globalThis
    __setHostTransportForTest(createTauriTransport())

    const cleanup = installExpertSquadInstallHandoffBridge()
    await firstAttempt
    failWindowShow = false
    eventHandler?.()
    await completed

    expect(commands).toEqual([
      "overlay_expert_squad_install_handoff_current",
      "overlay_expert_squad_install_handoff_current",
      "overlay_expert_squad_install_handoff_acknowledge",
    ])
    expect(expertSquadInstallHandoff()?.id).toBe("retained-receipt")
    expect(windowShowCount).toBe(2)
    expect(reportedError).toHaveBeenCalledWith(
      "[expert-squad-install-handoff] rejected",
      expect.objectContaining({ message: "controlled first surface failure" }),
    )

    cleanup()
    reportedError.mockRestore()
  })
})
