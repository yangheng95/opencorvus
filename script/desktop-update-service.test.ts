import { expect, test } from "bun:test"
import { __setHostTransportForTest } from "../packages/overlay/src/services/host-transport-runtime"
import {
  checkDesktopUpdate,
  desktopUpdateDownloading,
  desktopUpdateError,
  desktopUpdateInfo,
  startDesktopUpdateMonitor,
  stopDesktopUpdateMonitor,
} from "../packages/overlay/src/services/desktop-update"

test("startup monitor checks and downloads an announced update and a later check retains its verified size", async () => {
  const savedWindow = (globalThis as any).window
  ;(globalThis as any).window = { __TAURI__: { event: { listen: async () => () => undefined } } }
  const calls: string[] = []
  let failNextCheck = false
  let finishDownload!: () => void
  const downloaded = new Promise<void>((resolve) => (finishDownload = resolve))
  __setHostTransportForTest({
    kind: "tauri",
    capabilities: { nativeCommands: { "desktopUpdate.check": true } },
    native: async (command: { kind: string }) => {
      calls.push(command.kind)
      if (command.kind === "desktopUpdate.check") {
        if (failNextCheck) throw { code: "DESKTOP_UPDATE_CHECK_FAILED", message: "Channel unreachable" }
        return {
          currentVersion: "0.1.12",
          available: true,
          version: "0.1.13",
          downloadedBytes: calls.length > 1 ? 256 : undefined,
        }
      }
      finishDownload()
      return { currentVersion: "0.1.12", available: true, version: "0.1.13", downloadedBytes: 256 }
    },
  } as any)
  try {
    startDesktopUpdateMonitor()
    await downloaded
    for (let attempt = 0; desktopUpdateDownloading() && attempt < 20; attempt++) await Bun.sleep(1)
    expect(desktopUpdateDownloading()).toBe(false)
    await checkDesktopUpdate()
    expect({ calls, info: desktopUpdateInfo() }).toEqual({
      calls: ["desktopUpdate.check", "desktopUpdate.download", "desktopUpdate.check"],
      info: {
        currentVersion: "0.1.12",
        available: true,
        version: "0.1.13",
        notes: undefined,
        publicationDate: undefined,
        downloadedBytes: 256,
      },
    })
    failNextCheck = true
    await checkDesktopUpdate({ background: true })
    expect({ error: desktopUpdateError(), downloadedBytes: desktopUpdateInfo()?.downloadedBytes }).toEqual({
      error: "DESKTOP_UPDATE_CHECK_FAILED: Channel unreachable",
      downloadedBytes: 256,
    })
  } finally {
    stopDesktopUpdateMonitor()
    __setHostTransportForTest(undefined)
    ;(globalThis as any).window = savedWindow
  }
})
