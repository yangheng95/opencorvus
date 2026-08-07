import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { currentOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-directories"
import {
  artifactHostCanProvideNodeRuntime,
  artifactOfficeCliExecutableName,
  artifactRipgrepExecutableName,
  type ArtifactNodeRuntimeHost,
  type ArtifactNodeRuntimeTarget,
} from "./build-artifact"
import {
  OFFICECLI_RUNTIME_LOCK,
  OFFICECLI_RUNTIME_LOCK_PATH,
  OFFICECLI_RUNTIME_VERSION,
  officeCliLicenseUrl,
  officeCliReleaseAssetUrl,
  officeCliRuntimeAsset,
} from "./officecli-runtime-lock"

export { OFFICECLI_RUNTIME_VERSION, officeCliRuntimeAsset } from "./officecli-runtime-lock"

async function sha256File(filename: string): Promise<string> {
  const hash = createHash("sha256")
  const file = await fs.promises.open(filename, "r")
  try {
    for await (const chunk of file.readableWebStream()) hash.update(chunk)
  } finally {
    await file.close()
  }
  return hash.digest("hex")
}

async function acquirePinnedDownload(input: {
  cacheDir: string
  filename: string
  maxBytes: number
  sha256: string
  url: string
  fetcher: typeof fetch
}): Promise<string> {
  await fs.promises.mkdir(input.cacheDir, { recursive: true })
  const cached = path.join(input.cacheDir, input.filename)
  if ((await sha256File(cached).catch(() => undefined)) === input.sha256) return cached
  await fs.promises.rm(cached, { force: true })

  const response = await input.fetcher(input.url, { signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`Failed to download ${input.url}: HTTP ${response.status}`)
  const declaredBytes = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredBytes) && declaredBytes > input.maxBytes) {
    throw new Error(`${input.filename} declares ${declaredBytes} bytes, above the ${input.maxBytes} byte limit`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength > input.maxBytes) {
    throw new Error(`${input.filename} contains ${bytes.byteLength} bytes, above the ${input.maxBytes} byte limit`)
  }
  const actual = createHash("sha256").update(bytes).digest("hex")
  if (actual !== input.sha256) {
    throw new Error(`SHA-256 mismatch for ${input.filename}: expected ${input.sha256}, received ${actual}`)
  }
  const temporary = path.join(input.cacheDir, `.${input.filename}.${randomUUID()}.tmp`)
  await fs.promises.writeFile(temporary, bytes, { flag: "wx" })
  await fs.promises.rename(temporary, cached)
  return cached
}

export async function copyOfficeCliRuntime(input: {
  cacheDir?: string
  fetcher?: typeof fetch
  outdir: string
  target: ArtifactNodeRuntimeTarget
}): Promise<{ executable: string; license: string; lock: string }> {
  const asset = officeCliRuntimeAsset(input.target)
  const fetcher = input.fetcher ?? fetch
  const cacheDir =
    input.cacheDir ??
    path.join(currentOpenCorvusRuntimePaths().cache, "build-runtime", `officecli-v${OFFICECLI_RUNTIME_VERSION}`)
  const source = await acquirePinnedDownload({
    cacheDir,
    filename: asset.name,
    maxBytes: 64 * 1024 * 1024,
    sha256: asset.sha256,
    url: officeCliReleaseAssetUrl(asset),
    fetcher,
  })
  const licenseSource = await acquirePinnedDownload({
    cacheDir,
    filename: "OfficeCLI-LICENSE",
    maxBytes: 1024 * 1024,
    sha256: OFFICECLI_RUNTIME_LOCK.source.license_sha256,
    url: officeCliLicenseUrl(),
    fetcher,
  })
  const executable = path.join(input.outdir, "bin", artifactOfficeCliExecutableName(input.target.os))
  const license = path.join(input.outdir, "licenses", "OfficeCLI-LICENSE")
  const lock = path.join(input.outdir, "licenses", "OfficeCLI-RUNTIME-LOCK.json")
  await Promise.all([
    fs.promises.mkdir(path.dirname(executable), { recursive: true }),
    fs.promises.mkdir(path.dirname(license), { recursive: true }),
  ])
  await Promise.all([
    fs.promises.copyFile(source, executable),
    fs.promises.copyFile(licenseSource, license),
    fs.promises.copyFile(OFFICECLI_RUNTIME_LOCK_PATH, lock),
  ])
  if (input.target.os !== "win32") await fs.promises.chmod(executable, 0o755)
  return { executable, license, lock }
}

export function findExecutableOnPath(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
): string | undefined {
  const paths = (env.PATH ?? env.Path ?? "").split(path.delimiter).filter(Boolean)
  const extensions = platform === "win32" ? (env.PATHEXT ?? env.PathExt ?? ".EXE;.CMD;.BAT").split(";") : [""]
  for (const dir of paths) {
    for (const ext of extensions) {
      const hasExtension = ext.length > 0 && name.toLowerCase().endsWith(ext.toLowerCase())
      const candidate = path.join(dir, hasExtension ? name : `${name}${ext}`)
      if (fs.existsSync(candidate)) return candidate
    }
  }
}

export function resolveHostRipgrepBuildPath(input: {
  env?: NodeJS.ProcessEnv
  host: ArtifactNodeRuntimeHost
  target: ArtifactNodeRuntimeTarget
}): string {
  if (!artifactHostCanProvideNodeRuntime(input.target, input.host)) {
    throw new Error(
      `Cannot copy ripgrep for target ${targetName(input.target)} from host ${hostName(input.host)}. ` +
        "Build on the target platform so the packaged rg binary matches the runtime artifact.",
    )
  }

  const source = findExecutableOnPath("rg", input.env, input.host.platform)
  if (!source) {
    throw new Error(`Missing ripgrep executable on build host PATH for target ${targetName(input.target)}.`)
  }
  return source
}

export async function copyRipgrepRuntime(input: {
  env?: NodeJS.ProcessEnv
  host: ArtifactNodeRuntimeHost
  outdir: string
  target: ArtifactNodeRuntimeTarget
}): Promise<string> {
  const source = resolveHostRipgrepBuildPath(input)
  const destination = path.join(input.outdir, "bin", artifactRipgrepExecutableName(input.target.os))
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.copyFile(source, destination)
  if (input.target.os !== "win32") {
    await fs.promises.chmod(destination, 0o755)
  }
  return destination
}

function targetName(target: ArtifactNodeRuntimeTarget): string {
  return `${target.os}-${target.arch}${target.abi ? `-${target.abi}` : ""}`
}

function hostName(host: ArtifactNodeRuntimeHost): string {
  return `${host.platform}-${host.arch}${host.linuxLibc ? `-${host.linuxLibc}` : ""}`
}
