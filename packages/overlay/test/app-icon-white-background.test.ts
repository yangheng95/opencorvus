import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const OVERLAY_ROOT = join(import.meta.dir, "..")
const ICON_ROOT = join(OVERLAY_ROOT, "src-tauri", "icons")
const PACKAGE = JSON.parse(readFileSync(join(OVERLAY_ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>
}
const TAURI_CONFIG = JSON.parse(readFileSync(join(OVERLAY_ROOT, "src-tauri", "tauri.conf.json"), "utf8")) as {
  bundle: { icon: string[] }
}

const pngIcons = [
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "Square30x30Logo.png",
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square89x89Logo.png",
  "Square107x107Logo.png",
  "Square142x142Logo.png",
  "Square150x150Logo.png",
  "Square284x284Logo.png",
  "Square310x310Logo.png",
  "StoreLogo.png",
] as const

test("desktop package icons have one reproducible white-background generator", () => {
  expect(PACKAGE.scripts["icons:generate"]).toBe("bun run script/generate-app-icons.ts")
  const generator = readFileSync(join(OVERLAY_ROOT, "script", "generate-app-icons.ts"), "utf8")
  expect(generator).toContain('join(overlayRoot, "src", "opencorvus-logo-light.svg")')
  expect(generator).toContain('background: "#ffffff"')
  expect(generator).toContain('"tauri", "icon"')
  expect(generator).toContain('join(overlayRoot, "src-tauri", "icons")')
})

test("configured macOS and Windows icon containers come from the generated family", () => {
  expect(TAURI_CONFIG.bundle.icon).toEqual([
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico",
  ])
  expect(existsSync(join(ICON_ROOT, "icon.icns"))).toBe(true)
  expect(existsSync(join(ICON_ROOT, "icon.ico"))).toBe(true)
})

test("every generated desktop PNG has opaque pure-white corners", async () => {
  for (const file of pngIcons) {
    const { data, info } = await sharp(join(ICON_ROOT, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const corners = [
      0,
      (info.width - 1) * info.channels,
      (info.height - 1) * info.width * info.channels,
      (info.width * info.height - 1) * info.channels,
    ]
    for (const offset of corners) {
      expect(Array.from(data.subarray(offset, offset + 4)), `${file} corner at byte ${offset}`).toEqual([
        255, 255, 255, 255,
      ])
    }
  }
})
