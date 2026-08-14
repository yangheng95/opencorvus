import { readFileSync, rmSync, writeFileSync } from "node:fs"
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
export const DESKTOP_ICON_SIZE = 1024
export async function renderTransparentDesktopIcon(sourcePath: string, outputPath: string): Promise<void> {
  await sharp(sourcePath, { density: 192 })
    .resize(DESKTOP_ICON_SIZE, DESKTOP_ICON_SIZE, { fit: "contain" })
    .ensureAlpha()
    .png()
    .toFile(outputPath)
}

export function canonicalizeIcnsContainer(path: string): void {
  const container = readFileSync(path)
  if (container.subarray(0, 4).toString("ascii") !== "icns") throw new Error("Invalid ICNS container signature")
  if (container.readUInt32BE(4) !== container.length) throw new Error("Invalid ICNS container length")

  const chunks: Buffer[] = []
  let offset = 8
  while (offset < container.length) {
    const chunkSize = container.readUInt32BE(offset + 4)
    if (chunkSize < 8 || offset + chunkSize > container.length) throw new Error("Invalid ICNS chunk length")
    chunks.push(container.subarray(offset, offset + chunkSize))
    offset += chunkSize
  }
  chunks.sort((left, right) => left.subarray(0, 4).compare(right.subarray(0, 4)))

  const header = Buffer.alloc(8)
  header.write("icns", 0, "ascii")
  header.writeUInt32BE(container.length, 4)
  writeFileSync(path, Buffer.concat([header, ...chunks], container.length))
}

async function generateDesktopIconFamily(): Promise<void> {
  const temporaryRoot = createOpenCorvusTemporaryDirectorySync("app-icons-")
  const sourceIconPath = join(temporaryRoot, "opencorvus-app-icon.png")

  try {
    // PNG means Portable Network Graphics. Preserve the original filled,
    // multicolor bird and remove only its outside background through alpha.
    await renderTransparentDesktopIcon(brandLogoPath, sourceIconPath)

    const generated = spawnSync(process.execPath, ["run", "tauri", "icon", sourceIconPath, "--output", outputRoot], {
      cwd: overlayRoot,
      stdio: "inherit",
    })
    if (generated.error) throw generated.error
    if (generated.status !== 0)
      throw new Error(`Tauri icon generation exited with status ${generated.status ?? "unknown"}`)
    canonicalizeIcnsContainer(join(outputRoot, "icon.icns"))

    // The Overlay ships desktop bundles only. Tauri also emits Android and iOS
    // (iPhone Operating System) assets by default, so keep the generated family
    // scoped to the configured macOS, Windows, and Linux package surfaces.
    rmSync(join(outputRoot, "android"), { recursive: true })
    rmSync(join(outputRoot, "ios"), { recursive: true })
  } finally {
    removeManagedDirectoryTreeSync(temporaryRoot)
  }
}

if (import.meta.main) await generateDesktopIconFamily()
