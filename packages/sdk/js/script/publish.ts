#!/usr/bin/env bun

import { $ } from "bun"
import { mkdir, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "url"
import { buildPublishPackageJson, type SdkPackageJson } from "./publish-manifest"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

await $`bun run build`

const pkg = (await import("../package.json").then((m) => m.default)) as {
  exports: Record<string, string | object>
  name: string
  version: string
}
buildPublishPackageJson(pkg as SdkPackageJson)

const packageTarballPrefix = `${pkg.name.split("/").pop()}-`
for (const entry of await readdir(dir)) {
  if (entry.startsWith(packageTarballPrefix) && entry.endsWith(".tgz")) await rm(path.join(dir, entry))
}
const packDirectory = path.join(dir, ".tmp-sdk-pack")
const packFilename = `${pkg.name.replace(/^@/, "").replace(/\//g, "-")}-${pkg.version}.tgz`
const packPath = path.join(packDirectory, packFilename)
await rm(packDirectory, { recursive: true, force: true })
await mkdir(packDirectory, { recursive: true })
try {
  await $`bun pm pack --ignore-scripts --destination ${packDirectory} --filename ${packFilename}`
  await $`npm publish ${packPath} --access public`
} finally {
  await rm(packDirectory, { recursive: true, force: true })
}
