import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const webRoot = join(import.meta.dir, "..")
export const canonicalBrandLogoPath = join(webRoot, "..", "overlay", "src", "opencorvus-logo-light.svg")
export const websiteFaviconPath = join(webRoot, "public", "favicon.svg")

export function generateWebsiteBrandAssets(): void {
  const canonicalLogo = readFileSync(canonicalBrandLogoPath)
  if (!canonicalLogo.subarray(0, 4).equals(Buffer.from("<svg"))) {
    throw new Error("Canonical OpenCorvus brand logo is not an SVG document")
  }
  writeFileSync(websiteFaviconPath, canonicalLogo)
}

if (import.meta.main) generateWebsiteBrandAssets()
