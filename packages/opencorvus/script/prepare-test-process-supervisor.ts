import { spawnSync } from "node:child_process"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"
import { expectedTestProcessSupervisor } from "./test-process-supervisor"

/** Publish a completed executable without replacing one already in use. */
export function publishTestProcessSupervisor(source: string, helper: string): string {
  const destination = path.dirname(helper)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const staging = fs.mkdtempSync(path.join(path.dirname(destination), ".supervisor-publication-"))
  const stagedHelper = path.join(staging, path.basename(helper))
  try {
    fs.copyFileSync(source, stagedHelper, fs.constants.COPYFILE_EXCL)
    try {
      fs.renameSync(staging, destination)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "EEXIST" && code !== "ENOTEMPTY" && code !== "EPERM") throw error
      if (fs.statSync(helper).size === 0) throw error
    }
    return helper
  } finally {
    for (const remove of [() => fs.unlinkSync(stagedHelper), () => fs.rmdirSync(staging)]) {
      try {
        remove()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
    }
  }
}

function resolveInstalledRustTool(name: "cargo" | "rustc", environment: NodeJS.ProcessEnv): string {
  const result = spawnSync("rustup", ["which", name], {
    encoding: "utf8",
    windowsHide: true,
    env: environment,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`rustup could not resolve installed ${name}: ${result.stderr.trim()}`)
  const resolved = result.stdout.trim()
  if (!path.isAbsolute(resolved)) throw new Error(`rustup returned a non-absolute ${name} path: ${resolved}`)
  return resolved
}

export function prepareTestProcessSupervisor(): string | undefined {
  const helper = expectedTestProcessSupervisor()
  if (!helper) return undefined
  try {
    if (fs.statSync(helper).size > 0) return helper
  } catch {}
  const manifest = path.resolve(import.meta.dir, "../native/process-supervisor/Cargo.toml")
  const targetDirectory = path.resolve(helper, "..", "..", "build")
  const buildRoot = path.join(os.tmpdir(), "opencorvus-native-build")
  const cargoHome = path.join(buildRoot, "cargo-home")
  const temporary = path.join(buildRoot, "tmp")
  const userHome = path.join(buildRoot, "home")
  const appData = path.join(userHome, "appdata")
  const localAppData = path.join(userHome, "local-appdata")
  const xdgCache = path.join(userHome, "xdg-cache")
  const xdgConfig = path.join(userHome, "xdg-config")
  const xdgData = path.join(userHome, "xdg-data")
  fs.mkdirSync(cargoHome, { recursive: true })
  fs.mkdirSync(temporary, { recursive: true })
  for (const directory of [userHome, appData, localAppData, xdgCache, xdgConfig, xdgData]) {
    fs.mkdirSync(directory, { recursive: true })
  }
  const toolEnvironment = {
    ...process.env,
    RUSTUP_NO_UPDATE_CHECK: "1",
    RUSTUP_SKIP_UPDATE_CHECK: "1",
  }
  const cargo = resolveInstalledRustTool("cargo", toolEnvironment)
  const rustc = resolveInstalledRustTool("rustc", toolEnvironment)
  const result = spawnSync(cargo, ["build", "--locked", "--manifest-path", manifest, "--target-dir", targetDirectory], {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      HOME: userHome,
      USERPROFILE: userHome,
      APPDATA: appData,
      LOCALAPPDATA: localAppData,
      XDG_CACHE_HOME: xdgCache,
      XDG_CONFIG_HOME: xdgConfig,
      XDG_DATA_HOME: xdgData,
      CARGO_HOME: cargoHome,
      TEMP: temporary,
      TMP: temporary,
      TMPDIR: temporary,
      RUSTC: rustc,
      RUSTUP_NO_UPDATE_CHECK: "1",
      RUSTUP_SKIP_UPDATE_CHECK: "1",
    },
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Native test process supervisor build failed with exit ${result.status}`)
  return publishTestProcessSupervisor(path.join(targetDirectory, "debug", path.basename(helper)), helper)
}

if (import.meta.main) {
  const helper = prepareTestProcessSupervisor()
  if (helper) process.stdout.write(`${helper}\n`)
}
