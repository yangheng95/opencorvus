import { describe, expect, test } from "bun:test"
import { access, readdir, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { ensureOverlayDist, overlayDist } from "./overlay-dist"

const bareTauriImportPatterns = [
  /\bfrom\s*["']@tauri-apps\//,
  /\bimport\s*["']@tauri-apps\//,
  /\bimport\s*\(\s*["']@tauri-apps\//,
]

describe("overlay dist browser bootstrap", () => {
  test("Vite bundle does not ship bare @tauri-apps imports", async () => {
    await ensureOverlayDist()
    expect(fileURLToPath(overlayDist)).not.toBe(fileURLToPath(new URL("../dist-vite/", import.meta.url)))
    await access(new URL("index.html", overlayDist))

    const assetsDir = new URL("assets/", overlayDist)
    const assetNames = await readdir(assetsDir)
    const scripts = assetNames.filter((name) => name.endsWith(".js"))
    expect(scripts.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const script of scripts) {
      const file = new URL(script, assetsDir)
      const text = await readFile(file, "utf8")
      if (bareTauriImportPatterns.some((pattern) => pattern.test(text))) {
        offenders.push(fileURLToPath(file))
      }
    }

    expect(offenders).toEqual([])
  })
})
