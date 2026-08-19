/**
 * Move the captured artifact frames into the site's asset tree and record where they came from.
 *
 * Two things the landing page's inventory tests care about: every image under assets/lander must be
 * referenced by name from a component (OcArtifactCarousel imports each one explicitly), and every
 * image must declare its provenance in captured.json. This script writes the second half so the
 * capture version and date are a fact rather than a memory.
 *
 * The frames arrive at 2x device pixel ratio, which is right for the capture and wrong for the
 * repository — they get resized down to a sane source width here; Astro's image pipeline handles
 * the responsive variants from there.
 *
 *   node packages/web/qa/artifact-gallery/publish-assets.mjs [--from <dir>] [--version 0.0.47-beta]
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import sharp from "sharp"

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(here, "../..")
const repoRoot = path.resolve(webRoot, "../..")

const TARGET_DIR = path.join(webRoot, "src/assets/lander/artifact-gallery")
const MANIFEST = path.join(webRoot, "src/assets/lander/captured.json")
/** Wide enough that a dense table or spreadsheet stays readable, small enough to live in git. */
const MAX_WIDTH = 1600

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

async function main() {
  const from = path.resolve(argument("from", path.join(repoRoot, "tmp/gallery-shots")))
  const version = argument("version", JSON.parse(await fs.readFile(path.join(repoRoot, "packages/opencorvus/package.json"), "utf8")).version)
  const capturedOn = argument("on", new Date().toISOString().slice(0, 10))

  const index = JSON.parse(await fs.readFile(path.join(from, "index.json"), "utf8"))
  await fs.mkdir(TARGET_DIR, { recursive: true })

  const manifest = JSON.parse(await fs.readFile(MANIFEST, "utf8"))
  const others = manifest.assets.filter((entry) => !entry.file.startsWith("artifact-gallery/"))

  const written = []
  for (const entry of index) {
    const target = path.join(TARGET_DIR, `${entry.id}.png`)
    const image = sharp(entry.file)
    const meta = await image.metadata()
    await image
      .resize({ width: Math.min(meta.width ?? MAX_WIDTH, MAX_WIDTH), withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true })
      .toFile(target)
    const { size } = await fs.stat(target)
    written.push({
      file: `artifact-gallery/${entry.id}.png`,
      capturedAppVersion: version,
      capturedOn,
      knownIssues: [],
      renderer: entry.renderer,
      sourceMission: entry.missionTitle,
      bytes: size,
    })
    console.log(`${entry.id.padEnd(14)} ${meta.width}x${meta.height} -> ${(size / 1024).toFixed(0)} KiB`)
  }

  manifest.assets = [...others, ...written]
  manifest.refresh = {
    ...manifest.refresh,
    artifactGallery:
      "qa/artifact-gallery/run-missions.mjs dispatches one Mission per renderer against a running server, " +
      "capture.mjs screenshots each artifact frame in the real Overlay, and this script resizes them into " +
      "src/assets/lander/artifact-gallery. Every frame is a real run over live data — re-run all three together.",
  }
  await fs.writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\n${written.length} frames published; captured.json updated`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
