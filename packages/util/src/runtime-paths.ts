import path from "node:path"

const APPLICATION_DIRECTORY_NAME = "opencorvus"

export class OpenCorvusRuntimeRootError extends Error {
  readonly code = "INVALID_OPENCORVUS_HOME"

  constructor(message: string) {
    super(message)
    this.name = "OpenCorvusRuntimeRootError"
  }
}

export type OpenCorvusRuntimePathInput = {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  home: string
  root?: string
}

export type OpenCorvusRuntimePaths = {
  root: string
  bin: string
  cache: string
  config: string
  data: string
  log: string
  state: string
  temporary: string
  overlay: string
  overlayEmbedded: string
  overlayWebview: string
}

function platformPath(platform: NodeJS.Platform) {
  return platform === "win32" ? path.win32 : path.posix
}

function explicitRoot(input: OpenCorvusRuntimePathInput) {
  const raw = input.root ?? input.env.OPENCORVUS_HOME
  if (raw === undefined) return
  const root = raw.trim()
  if (!root) throw new OpenCorvusRuntimeRootError("OPENCORVUS_HOME must not be blank")
  const paths = platformPath(input.platform)
  if (!paths.isAbsolute(root)) {
    throw new OpenCorvusRuntimeRootError(`OPENCORVUS_HOME must be an absolute path: ${root}`)
  }
  return paths.normalize(root)
}

function defaultRoot(input: OpenCorvusRuntimePathInput) {
  const paths = platformPath(input.platform)
  if (!paths.isAbsolute(input.home)) {
    throw new OpenCorvusRuntimeRootError(`OpenCorvus user home must be an absolute path: ${input.home}`)
  }
  if (input.platform === "win32") {
    const localApplicationData = input.env.LOCALAPPDATA?.trim() || paths.join(input.home, "AppData", "Local")
    if (!paths.isAbsolute(localApplicationData)) {
      throw new OpenCorvusRuntimeRootError(`LOCALAPPDATA must be an absolute path: ${localApplicationData}`)
    }
    return paths.join(localApplicationData, APPLICATION_DIRECTORY_NAME)
  }
  if (input.platform === "darwin") {
    return paths.join(input.home, "Library", "Application Support", APPLICATION_DIRECTORY_NAME)
  }
  const crossDesktopGroupData = input.env.XDG_DATA_HOME?.trim() || paths.join(input.home, ".local", "share")
  if (!paths.isAbsolute(crossDesktopGroupData)) {
    throw new OpenCorvusRuntimeRootError(`XDG_DATA_HOME must be an absolute path: ${crossDesktopGroupData}`)
  }
  return paths.join(crossDesktopGroupData, APPLICATION_DIRECTORY_NAME)
}

export function resolveOpenCorvusRuntimePaths(input: OpenCorvusRuntimePathInput): OpenCorvusRuntimePaths {
  const paths = platformPath(input.platform)
  const root = explicitRoot(input) ?? defaultRoot(input)
  const overlay = paths.join(root, "overlay")
  return {
    root,
    bin: paths.join(root, "bin"),
    cache: paths.join(root, "cache"),
    config: paths.join(root, "config"),
    data: paths.join(root, "data"),
    log: paths.join(root, "log"),
    state: paths.join(root, "state"),
    temporary: paths.join(root, "tmp"),
    overlay,
    overlayEmbedded: paths.join(overlay, "embedded"),
    overlayWebview: paths.join(overlay, "webview"),
  }
}
