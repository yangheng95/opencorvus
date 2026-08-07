import { rmSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  createOpenCorvusTemporaryDirectorySync,
  removeManagedDirectoryTreeSync,
} from "@opencorvus-ai/util/runtime-directories"
import sharp from "sharp"

const overlayRoot = join(import.meta.dir, "..")
const brandLogoPath = join(overlayRoot, "src", "opencorvus-logo-light.svg")
const outputRoot = join(overlayRoot, "src-tauri", "icons")
const temporaryRoot = createOpenCorvusTemporaryDirectorySync("app-icons-")
const sourceIconPath = join(temporaryRoot, "opencorvus-app-icon.png")

try {
  // PNG means Portable Network Graphics. This high-resolution white-backed
  // source is handed to Tauri so PNG, Apple ICNS (Icon Image), and Microsoft
  // ICO (Icon) containers all derive from the same pixels.
  await sharp(brandLogoPath, { density: 192 })
    .flatten({ background: "#ffffff" })
    .resize(1024, 1024)
    .png()
    .toFile(sourceIconPath)

  const generated = spawnSync(process.execPath, ["run", "tauri", "icon", sourceIconPath, "--output", outputRoot], {
    cwd: overlayRoot,
    stdio: "inherit",
  })
  if (generated.error) throw generated.error
  if (generated.status !== 0)
    throw new Error(`Tauri icon generation exited with status ${generated.status ?? "unknown"}`)

  // The Overlay ships desktop bundles only. Tauri also emits Android and iOS
  // (iPhone Operating System) assets by default, so keep the generated family
  // scoped to the configured macOS, Windows, and Linux package surfaces.
  rmSync(join(outputRoot, "android"), { recursive: true })
  rmSync(join(outputRoot, "ios"), { recursive: true })
} finally {
  removeManagedDirectoryTreeSync(temporaryRoot)
}
