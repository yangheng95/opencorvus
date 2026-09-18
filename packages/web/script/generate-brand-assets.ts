import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { coordinationDiagram, socialCard } from "./coordination-artwork"

/**
 * Website brand assets, derived from the one canonical logo.
 *
 * Everything here used to be checked in by hand, and most of it had rotted: `og.png` was never
 * committed at all (so every page advertised a 404 to every link unfurler), and social-share.png,
 * web-app-manifest-*.png and site.webmanifest were 43-to-56 byte ASCII files holding a relative
 * path — Windows checkouts of symlinks whose target, packages/ui/, no longer exists in the repo.
 * A social card nobody can see is invisible until someone pastes a link in Slack, so these are
 * generated from source on every build instead of maintained by hand.
 */

const webRoot = join(import.meta.dir, "..")
export const canonicalBrandLogoPath = join(webRoot, "..", "overlay", "src", "opencorvus-logo-light.svg")
export const websiteFaviconPath = join(webRoot, "public", "favicon.svg")
const publicRoot = join(webRoot, "public")

const MANIFEST_PAGE_COLOR = "#f9f8f8"

const TAGLINE = "Orchestration for long-running, complex AI work"

async function renderLogo(size: number): Promise<Buffer> {
  // density scales the SVG before rasterizing; without it a 1000x1000 viewBox renders soft.
  return sharp(canonicalBrandLogoPath, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer()
}

async function writeOpenGraphCard(): Promise<void> {
  await sharp(socialCard()).png().toFile(join(publicRoot, "og.png"))
  writeFileSync(join(publicRoot, "media", "task-coordination-en.svg"), coordinationDiagram("root"))
  writeFileSync(join(publicRoot, "media", "task-coordination-zh.svg"), coordinationDiagram("zh-cn"))
}

async function writeManifestIcons(): Promise<void> {
  for (const size of [192, 512]) {
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 249, g: 248, b: 248, alpha: 1 },
      },
    })
      .composite([{ input: await renderLogo(Math.round(size * 0.72)), gravity: "centre" }])
      .png()
      .toFile(join(publicRoot, `web-app-manifest-${size}x${size}.png`))
  }
}

function writeWebManifest(): void {
  const manifest = {
    name: "OpenCorvus",
    short_name: "OpenCorvus",
    description: TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: MANIFEST_PAGE_COLOR,
    theme_color: MANIFEST_PAGE_COLOR,
    icons: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  }
  writeFileSync(join(publicRoot, "site.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`)
}

export async function generateWebsiteBrandAssets(): Promise<void> {
  const canonicalLogo = readFileSync(canonicalBrandLogoPath)
  if (!canonicalLogo.subarray(0, 4).equals(Buffer.from("<svg"))) {
    throw new Error("Canonical OpenCorvus brand logo is not an SVG document")
  }
  writeFileSync(websiteFaviconPath, canonicalLogo)
  await writeOpenGraphCard()
  await writeManifestIcons()
  writeWebManifest()
}

if (import.meta.main) await generateWebsiteBrandAssets()
