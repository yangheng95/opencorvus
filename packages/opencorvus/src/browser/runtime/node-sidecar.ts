import { createRequire } from "node:module"
import path from "node:path"
import {
  isBunExecutable,
  nodeExecutableName,
  packagedNodeRuntimePaths,
  pathExists,
} from "@opencorvus-ai/util/node-runtime"

export { isBunExecutable }

export interface BrowserNodeSidecarRuntime {
  nodeExecutable: string
  playwrightRequirePath: string
  packaged: boolean
}

export function packagedBrowserNodeRuntimePaths(
  input: {
    execPath?: string
    platform?: NodeJS.Platform
  } = {},
) {
  const platform = input.platform ?? process.platform
  const packaged = packagedNodeRuntimePaths(input)
  const dir = packaged.directory
  return {
    nodeExecutable: packaged.nodeExecutable,
    playwrightRequirePath: path.join(dir, "node_modules", "playwright", "index.js"),
    mcpBundle: path.join(dir, "browser.mjs"),
  }
}

export async function resolveBrowserNodeSidecarRuntime(
  input: {
    execPath?: string
    platform?: NodeJS.Platform
  } = {},
): Promise<BrowserNodeSidecarRuntime> {
  const platform = input.platform ?? process.platform
  const packaged = packagedBrowserNodeRuntimePaths(input)
  if ((await pathExists(packaged.nodeExecutable)) && (await pathExists(packaged.playwrightRequirePath))) {
    return {
      nodeExecutable: packaged.nodeExecutable,
      playwrightRequirePath: packaged.playwrightRequirePath,
      packaged: true,
    }
  }

  if (isBunExecutable(input.execPath ?? process.execPath)) {
    return {
      nodeExecutable: process.env.OPENCORVUS_BROWSER_MCP_NODE ?? browserNodeExecutableName(platform),
      playwrightRequirePath: createRequire(import.meta.url).resolve("playwright"),
      packaged: false,
    }
  }

  throw new Error(
    `Browser Node sidecar runtime is missing. Expected ${packaged.nodeExecutable} and ${packaged.playwrightRequirePath} beside the opencorvus executable.`,
  )
}

export function browserNodeExecutableName(platform: NodeJS.Platform) {
  return nodeExecutableName(platform)
}
