import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

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

/** Kept in step with tokens.css. A card that does not match the site reads as someone else's link. */
const CARD = {
  width: 1200,
  height: 630,
  page: "#f9f8f8",
  ink: "#1e232c",
  muted: "rgba(0,0,0,0.65)",
  brand: "#2946d3",
} as const

const WORDMARK = "OpenCorvus"
const TAGLINE = "Automate the workflow you repeat every day"
const KICKER = "Open source · MIT · Self-hosted"

/**
 * The hero's substrate, flattened. Text is left to the rasterizer's default sans on purpose: the
 * build host is not guaranteed to have Montserrat installed, and a card that renders in a fallback
 * face is fine where one that renders in tofu is not.
 */
function cardBackground(): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#f7f5f1"/>
      <stop offset="46%" stop-color="#f9f8f8"/>
      <stop offset="100%" stop-color="#eef0f7"/>
    </linearGradient>
    <radialGradient id="bloomA" cx="0.18" cy="0.22" r="0.55">
      <stop offset="0%" stop-color="#2946d3" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#2946d3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomB" cx="0.84" cy="0.18" r="0.5">
      <stop offset="0%" stop-color="#e04b22" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#e04b22" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bloomC" cx="0.76" cy="0.86" r="0.6">
      <stop offset="0%" stop-color="#7896ff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#7896ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#base)"/>
  <rect width="100%" height="100%" fill="url(#bloomA)"/>
  <rect width="100%" height="100%" fill="url(#bloomB)"/>
  <rect width="100%" height="100%" fill="url(#bloomC)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif">
    <text x="96" y="322" font-size="76" font-weight="700" fill="${CARD.ink}" letter-spacing="-1.5">${WORDMARK}</text>
    <text x="96" y="394" font-size="34" font-weight="400" fill="${CARD.muted}">${TAGLINE}</text>
    <text x="96" y="536" font-size="22" font-weight="500" fill="${CARD.brand}" letter-spacing="1.2">${KICKER}</text>
  </g>
  <rect x="96" y="430" width="132" height="3" rx="1.5" fill="${CARD.brand}" opacity="0.85"/>
</svg>`)
}

async function renderLogo(size: number): Promise<Buffer> {
  // density scales the SVG before rasterizing; without it a 1000x1000 viewBox renders soft.
  return sharp(canonicalBrandLogoPath, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer()
}

async function writeOpenGraphCard(): Promise<void> {
  const logo = await renderLogo(96)
  await sharp(cardBackground())
    .composite([{ input: logo, top: 96, left: 96 }])
    .png()
    .toFile(join(publicRoot, "og.png"))
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
    background_color: CARD.page,
    theme_color: CARD.page,
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
