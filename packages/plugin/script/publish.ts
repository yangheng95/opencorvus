#!/usr/bin/env bun
import { Script } from "@opencorvus-ai/script"
import { $ } from "bun"
import { mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "url"
import { stagePluginPackage } from "./publish-package"

const dir = fileURLToPath(new URL("..", import.meta.url))
const workspaceDirectory = path.resolve(dir, "../..")

const workspacePackagesDirectory = path.dirname(dir)
const scratchRoot = await mkdtemp(path.join(workspacePackagesDirectory, "plugin-publish-stage-"))
try {
  const staged = await stagePluginPackage({
    sourceDirectory: dir,
    stagingDirectory: path.join(scratchRoot, "package"),
    workspaceDirectory,
  })
  const filename = `${staged.packageJson.name.replace(/^@/, "").replaceAll("/", "-")}-${staged.packageJson.version}.tgz`
  const tarball = path.join(scratchRoot, filename)
  await $`bun pm pack --ignore-scripts --filename ${tarball}`.cwd(staged.directory)
  await $`npm publish ${tarball} --tag ${Script.channel} --access public`
} finally {
  await rm(scratchRoot, { recursive: true, force: true })
}
