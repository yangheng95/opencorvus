import type { BunPlugin } from "bun"
import { realpathSync } from "node:fs"
import path from "node:path"
import {
  discoverOverlayUiSourceFiles,
  renderEmbeddedOverlayUiModule,
  resolveEmbeddedOverlayUiModulePath,
  type EmbeddedOverlayUiSourceFile,
} from "../../../script/package-linux-binary"

export function createEmbeddedOverlayUiPlugin(
  modulePath: string,
  files: readonly EmbeddedOverlayUiSourceFile[],
): BunPlugin {
  const resolvedModulePath = realpathSync(modulePath)
  const contents = renderEmbeddedOverlayUiModule(resolvedModulePath, files)

  return {
    name: "opencorvus-embedded-overlay-ui",
    setup(build) {
      build.onLoad({ filter: /overlay-ui-embedded\.generated\.ts$/ }, (args) => {
        if (realpathSync(args.path) !== resolvedModulePath) return undefined
        return { contents, loader: "ts" }
      })
    },
  }
}

export async function prepareEmbeddedOverlayUiPlugin(repoRoot: string): Promise<{
  plugin: BunPlugin
  fileCount: number
}> {
  const modulePath = resolveEmbeddedOverlayUiModulePath(repoRoot)
  const files = await discoverOverlayUiSourceFiles(repoRoot)
  return {
    plugin: createEmbeddedOverlayUiPlugin(modulePath, files),
    fileCount: files.length,
  }
}
