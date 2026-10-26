#!/usr/bin/env bun
import fs from "node:fs/promises"
import path from "node:path"
import { overlayBundleArchitecture, selectOverlayReleaseAssets } from "./release-asset-contract"

export async function overlayTransferPaths(input: { root: string; platform: string; canonical: boolean }) {
  overlayBundleArchitecture(input.platform)
  const directory = `packages/overlay/dist-artifacts/${input.platform}`
  if (!input.canonical) return [directory]
  const manifest = JSON.parse(await fs.readFile(path.join(input.root, "packages/opencorvus/package.json"), "utf8"))
  if (typeof manifest.version !== "string" || !manifest.version) throw new Error("Release manifest version is required")
  const entries = await fs.readdir(path.join(input.root, directory), { withFileTypes: true })
  return selectOverlayReleaseAssets(
    input.platform,
    manifest.version,
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    `native output ${input.platform}`,
  ).map((filename) => `${directory}/${filename}`)
}

if (import.meta.main) {
  const paths = await overlayTransferPaths({
    root: process.cwd(),
    platform: process.env.OVERLAY_TRANSFER_PLATFORM ?? "",
    canonical: Boolean(process.env.RELEASE_RUN_ID),
  })
  console.log(["paths<<OPENCORVUS_OVERLAY_TRANSFER_PATHS", ...paths, "OPENCORVUS_OVERLAY_TRANSFER_PATHS"].join("\n"))
}
