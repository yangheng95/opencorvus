#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

import { Script } from "@opencorvus-ai/script"
import pkg from "../package.json"
import {
  buildArtifactBrowserMcpNodeBundle,
  artifactBrowserMcpNodeRuntimeModules,
  artifactBrowserMcpNodeExecutableName,
  artifactEntrypoints,
  artifactExecutableName,
  artifactExternalModules,
  artifactHostCanProvideNodeRuntime,
  artifactPackageBaseName,
  artifactPinnedNodeRuntimeExecutable,
  artifactSourcemap,
  parseBuildFlavor,
} from "./build-artifact"
import { detectArtifactNodeRuntimeHost } from "./build-host-runtime"
import { copyRuntimeNodeModules, writePackagedRuntimePackageJson } from "./build-runtime-node-modules"
import { copyOfficeCliRuntime, copyRipgrepRuntime, WORK_ARTIFACT_RUNTIME_LOCK } from "./build-runtime-binaries"
import { normalizeArtifactExecutablePermissions } from "./runtime-executable-contract"
import { writeWorkArtifactTargetPackageManifest } from "../src/work-artifact/runtime/package-manifest"
import { cleanBuildDist } from "./build-clean"
import { writeOverlayPayloadStamp } from "./build-overlay-payload-stamp"
import { generateOpencorvusGeneratedBuildArtifacts } from "./generate-build-artifacts"
import { prepareEmbeddedOverlayUiPlugin } from "./embedded-overlay-ui-plugin"

const repoRoot = path.resolve(dir, "../..")

await generateOpencorvusGeneratedBuildArtifacts({ packageRoot: dir, repoRoot, log: console.log })

const singleFlag = process.argv.includes("--single")
const allFlag = process.argv.includes("--all")
const baselineFlag = process.argv.includes("--baseline")
const binaryOnly = process.argv.includes("--binary-only")
const onefileFlag = process.argv.includes("--onefile") || process.env.OPENCORVUS_ONEFILE === "1"
const buildFlavor = parseBuildFlavor(process.argv)

const embeddedEnv = (() => {
  const keys = (process.env.OPENCORVUS_EMBED_ENV_KEYS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const env = Object.fromEntries(
    keys.flatMap((key) => {
      const value = process.env[key]?.trim()
      if (!value) return []
      return [[key, value] as const]
    }),
  ) as Record<string, string>

  const dashscope = process.env.OPENCORVUS_EMBED_DASHSCOPE_KEY?.trim()
  if (dashscope) {
    env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY = dashscope
    env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS = process.env.OPENCORVUS_EMBED_DASHSCOPE_TTL_HOURS?.trim() || "24"
    if (!env.OPENCORVUS_CONFIG_CONTENT && !process.env.OPENCORVUS_CONFIG_CONTENT) {
      env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
        $schema: "https://opencorvus.ai/config.json",
        model: "alibaba-cn/qwen3.5-plus",
      })
    }
  }

  const model = process.env.OPENCORVUS_EMBED_MODEL?.trim()
  if (model) {
    env.OPENCORVUS_CONFIG_CONTENT = JSON.stringify({
      $schema: "https://opencorvus.ai/config.json",
      model,
    })
  }

  return env
})()

if (Object.keys(embeddedEnv).length > 0) {
  console.log(`embedding env keys: ${Object.keys(embeddedEnv).join(", ")}`)
}
const embeddedEnvDefine = Object.keys(embeddedEnv).length > 0 ? JSON.stringify(embeddedEnv) : "undefined"
if (onefileFlag) {
  console.warn("onefile mode: overlay UI will be bundled as sidecar files in dist/*/ui/")
}

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]
const runtimeDir = process.env.OPENCORVUS_BUN_RUNTIME_DIR
const runtimeName = (item: (typeof allTargets)[number]) =>
  [
    "bun",
    item.os === "win32" ? "windows" : item.os,
    item.arch === "arm64" ? "aarch64" : item.arch,
    item.abi,
    item.avx2 === false ? "baseline" : undefined,
  ]
    .filter(Boolean)
    .join("-")
type Target = (typeof allTargets)[number]

let overlayBuildDir: string | undefined

async function prepareOverlayBuild() {
  if (overlayBuildDir) return overlayBuildDir

  const overlayRoot = path.resolve(dir, "../overlay")
  const distDir = path.join(overlayRoot, "dist-vite")

  console.log("  overlay: building dist-vite")
  await $`bun run build:vite`.cwd(overlayRoot)

  overlayBuildDir = distDir
  return overlayBuildDir
}

async function installOverlay(_item: Target, name: string) {
  const overlayDir = await prepareOverlayBuild()
  const destDir = path.join(dir, "dist", name, "ui")
  const indexPath = path.join(overlayDir, "index.html")
  if (!fs.existsSync(indexPath)) {
    console.log(`  overlay: skipping (missing built UI in ${overlayDir})`)
    return
  }

  await fs.promises.rm(destDir, { recursive: true, force: true })
  await fs.promises.cp(overlayDir, destDir, { recursive: true, force: true })
  console.log(`  overlay: installed built UI from ${path.relative(dir, overlayDir)}`)
}

// Dev and CI builds only need a native binary; full matrix is for release packaging.
const single = singleFlag || (!allFlag && !Script.release)
const targets = single
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false
      }

      // When building for the current platform, prefer a single native binary by default.
      // Baseline binaries require additional Bun artifacts and can be flaky to download.
      if (item.avx2 === false) {
        return baselineFlag
      }

      // also skip abi-specific builds for the same reason
      if (item.abi !== undefined) {
        return false
      }

      return true
    })
  : allTargets

await cleanBuildDist(path.join(dir, "dist"))

const binaries: Record<string, string> = {}
let windowsSupervisorHelper: string | undefined
const DEFAULT_PACKAGED_PLUGIN_MODULES: Array<{ name: string }> = []
const DEFAULT_PACKAGED_PLUGIN_MANIFESTS: Array<{ source: string; destination: string }> = []

type PackagedPluginManifest = {
  resources?: Array<{
    id?: unknown
    path?: unknown
    paths?: Partial<Record<"win32" | "linux" | "darwin", unknown>>
  }>
}

type PackagedPluginTargetOS = "win32" | "linux" | "darwin"

async function buildWindowsSupervisorHelper() {
  if (windowsSupervisorHelper) return windowsSupervisorHelper
  if (process.platform !== "win32") {
    throw new Error("Windows process supervisor helper must be built on Windows")
  }
  const manifest = path.join(dir, "native", "process-supervisor", "Cargo.toml")
  await $`cargo build --manifest-path ${manifest} --release`
  windowsSupervisorHelper = path.join(
    dir,
    "native",
    "process-supervisor",
    "target",
    "release",
    "opencorvus-process-supervisor.exe",
  )
  if (!fs.existsSync(windowsSupervisorHelper)) {
    throw new Error(`Missing Windows process supervisor helper at ${windowsSupervisorHelper}`)
  }
  return windowsSupervisorHelper
}

async function buildBrowserMcpNodeBundle(outdir: string) {
  await fs.promises.mkdir(outdir, { recursive: true })
  const result = await buildArtifactBrowserMcpNodeBundle({
    entrypoint: "./src/mcp/browser/entry.ts",
    outdir,
  })
  if (!result.success) {
    const detail = result.logs.map((item) => item.message).join("; ")
    throw new Error(`Failed to build Browser MCP node bundle: ${detail}`)
  }
  await fs.promises.rename(path.join(outdir, "entry.js"), path.join(outdir, "browser.mjs"))
}

async function copyBrowserMcpNodeRuntime(item: Target, outdir: string) {
  const nodeName = artifactBrowserMcpNodeExecutableName(item.os)
  const explicit = process.env.OPENCORVUS_BROWSER_MCP_NODE_BUILD_PATH?.trim()
  const host = explicit ? undefined : await detectArtifactNodeRuntimeHost()
  const source =
    explicit ||
    (host && artifactHostCanProvideNodeRuntime(item, host)
      ? artifactPinnedNodeRuntimeExecutable(path.join(repoRoot, "packages", "channel-runtime"), item)
      : undefined)
  if (!source) {
    throw new Error(
      `Missing Browser MCP Node runtime for target ${runtimeName(item)}. ` +
        `Build on the target platform or set OPENCORVUS_BROWSER_MCP_NODE_BUILD_PATH to a ${nodeName} executable.`,
    )
  }
  const destination = path.join(outdir, nodeName)
  await fs.promises.copyFile(source, destination)
  if (item.os !== "win32") {
    await fs.promises.chmod(destination, 0o755)
  }
}

function pluginResourcePath(
  resource: NonNullable<PackagedPluginManifest["resources"]>[number],
  targetOS: PackagedPluginTargetOS,
) {
  const selected = resource.paths?.[targetOS] ?? resource.path
  return typeof selected === "string" ? selected : ""
}

async function stageDefaultPluginManifests(outdir: string, targetOS: PackagedPluginTargetOS) {
  for (const manifest of DEFAULT_PACKAGED_PLUGIN_MANIFESTS) {
    if (!fs.existsSync(manifest.source)) {
      throw new Error(`Missing default plugin manifest at ${manifest.source}`)
    }
    const raw = await fs.promises.readFile(manifest.source, "utf8")
    const parsed = JSON.parse(raw) as PackagedPluginManifest
    const destination = path.join(outdir, manifest.destination)
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
    await fs.promises.writeFile(destination, raw)
    const missing = (parsed.resources ?? [])
      .map((resource) => pluginResourcePath(resource, targetOS))
      .filter((resourcePath) => resourcePath.length === 0 || !fs.existsSync(path.join(outdir, resourcePath)))
    if (missing.length > 0) {
      throw new Error(`Packaged plugin manifest ${manifest.source} references missing resources: ${missing.join(", ")}`)
    }
  }
}

async function prepareLocalEmbeddedOverlayUi() {
  await prepareOverlayBuild()
  return prepareEmbeddedOverlayUiPlugin(repoRoot)
}

const embeddedOverlayUi = buildFlavor === "overlay-server" ? await prepareLocalEmbeddedOverlayUi() : undefined
if (embeddedOverlayUi) {
  console.log(`Embedded overlay UI files: ${embeddedOverlayUi.fileCount}`)
}

for (const item of targets) {
  const compileTarget = [
    "bun",
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  const name = [
    artifactPackageBaseName(pkg.name, buildFlavor),
    // changing to win32 flags npm for some reason
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}`

  const executablePath = runtimeDir
    ? path.resolve(runtimeDir, runtimeName(item), item.os === "win32" ? "bun.exe" : "bun")
    : undefined
  if (runtimeDir && executablePath && !fs.existsSync(executablePath)) {
    throw new Error(`Missing Bun runtime for target '${runtimeName(item)}' at '${executablePath}'`)
  }

  const compile: Record<string, unknown> = {
    autoloadBunfig: false,
    autoloadDotenv: false,
    autoloadTsconfig: true,
    autoloadPackageJson: true,
    target: compileTarget,
    outfile: `dist/${name}/${artifactExecutableName(item.os)}`,
    execArgv: [`--user-agent=opencorvus/${Script.version}`, "--use-system-ca", "--"],
    windows: {},
  }
  if (executablePath) compile.executablePath = executablePath

  await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    sourcemap: artifactSourcemap(),
    external: artifactExternalModules(),
    compile: compile as any,
    entrypoints: artifactEntrypoints(buildFlavor),
    plugins: embeddedOverlayUi ? [embeddedOverlayUi.plugin] : [],
    define: {
      OPENCORVUS_VERSION: `'${Script.version}'`,
      OPENCORVUS_CHANNEL: `'${Script.channel}'`,
      OPENCORVUS_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
      OPENCORVUS_EMBEDDED_ENV: embeddedEnvDefine,
    },
  })
  const browserMcpRuntimeDir = path.join(dir, "dist", name, "browser-mcp-node")
  await buildBrowserMcpNodeBundle(browserMcpRuntimeDir)
  await copyRuntimeNodeModules(item, path.join(dir, "dist", name), dir)
  if (buildFlavor === "overlay-server") {
    await copyRuntimeNodeModules(item, path.join(dir, "dist", name), dir, DEFAULT_PACKAGED_PLUGIN_MODULES)
    await stageDefaultPluginManifests(path.join(dir, "dist", name), item.os as PackagedPluginTargetOS)
  }
  await copyRuntimeNodeModules(item, browserMcpRuntimeDir, dir, artifactBrowserMcpNodeRuntimeModules())
  await copyBrowserMcpNodeRuntime(item, browserMcpRuntimeDir)
  await writePackagedRuntimePackageJson({
    name: `${name}-browser-mcp-node`,
    outdir: browserMcpRuntimeDir,
    target: item,
    version: Script.version,
  })
  await copyRipgrepRuntime({
    target: item,
    host: await detectArtifactNodeRuntimeHost(),
    outdir: path.join(dir, "dist", name),
    env: process.env,
  })
  await copyOfficeCliRuntime({
    target: item,
    outdir: path.join(dir, "dist", name),
  })

  if (item.os === "win32") {
    const helper = await buildWindowsSupervisorHelper()
    await fs.promises.copyFile(helper, path.join(dir, "dist", name, "opencorvus-process-supervisor.exe"))
  }
  await normalizeArtifactExecutablePermissions({ root: path.join(dir, "dist", name), os: item.os })
  await writeWorkArtifactTargetPackageManifest({
    root: path.join(dir, "dist", name),
    target: { os: item.os as "darwin" | "linux" | "win32", arch: item.arch as "arm64" | "x64", ...(item.abi ? { abi: item.abi } : {}) },
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
    phase: "staging",
  })

  await installOverlay(item, name)
  if (binaryOnly) {
    const files = await fs.promises.readdir(path.join(dir, "dist", name))
    await Promise.all(
      files
        .filter((x) => x.endsWith(".map"))
        .map((x) => fs.promises.rm(path.join(dir, "dist", name, x), { force: true })),
    )
  }
  await writePackagedRuntimePackageJson({
    name,
    outdir: path.join(dir, "dist", name),
    target: item,
    version: Script.version,
  })
  if (buildFlavor === "overlay-server") {
    await writeOverlayPayloadStamp(path.join(dir, "dist", name))
  }
  binaries[name] = Script.version
}

if (Script.release) {
  throw new Error("build.local.ts does not publish releases; use the repository package:* release pipeline")
}

export { binaries }
