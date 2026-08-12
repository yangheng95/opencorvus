import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { currentOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-directories"
import {
  artifactHostCanProvideNodeRuntime,
  artifactRipgrepExecutableName,
  type ArtifactNodeRuntimeHost,
  type ArtifactNodeRuntimeTarget,
} from "./build-artifact"
import {
  WORK_ARTIFACT_RUNTIME_LOCK,
  WORK_ARTIFACT_RUNTIME_LOCK_PATH,
  OFFICECLI_RUNTIME_VERSION,
  officeCliReleaseAssetUrl,
  officeCliSourceDataAssetUrl,
  officeCliRuntimeAsset,
} from "./work-artifact-runtime-lock"
import { officeCliRuntime } from "../src/work-artifact/runtime/runtime-lock"

export { OFFICECLI_RUNTIME_VERSION, officeCliRuntimeAsset } from "./work-artifact-runtime-lock"
export { WORK_ARTIFACT_RUNTIME_LOCK } from "./work-artifact-runtime-lock"

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

export async function acquirePinnedRuntimeDownload(input: {
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
  if (!response.body) throw new Error(`Failed to download ${input.url}: response body is unavailable`)
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  const hash = createHash("sha256")
  let receivedBytes = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      receivedBytes += item.value.byteLength
      if (receivedBytes > input.maxBytes) {
        await reader.cancel(`download exceeded ${input.maxBytes} bytes`).catch(() => undefined)
        throw new Error(`${input.filename} contains more than ${input.maxBytes} bytes`)
      }
      const chunk = Buffer.from(item.value)
      chunks.push(chunk)
      hash.update(chunk)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks, receivedBytes)
  const actual = hash.digest("hex")
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
}): Promise<{ executable: string; data: string[]; lock: string }> {
  const asset = officeCliRuntimeAsset(input.target)
  const runtime = officeCliRuntime(WORK_ARTIFACT_RUNTIME_LOCK)
  const fetcher = input.fetcher ?? fetch
  const cacheDir =
    input.cacheDir ??
    path.join(currentOpenCorvusRuntimePaths().cache, "build-runtime", `officecli-v${OFFICECLI_RUNTIME_VERSION}`)
  const source = await acquirePinnedRuntimeDownload({
    cacheDir,
    filename: asset.name,
    maxBytes: asset.max_download_bytes,
    sha256: asset.sha256,
    url: officeCliReleaseAssetUrl(asset),
    fetcher,
  })
  const dataSources = await Promise.all(runtime.source.data_assets.map(async (data) => ({
    data,
    source: await acquirePinnedRuntimeDownload({
      cacheDir,
      filename: `OfficeCLI-${data.source_file}`,
      maxBytes: data.max_download_bytes,
      sha256: data.sha256,
      url: officeCliSourceDataAssetUrl(data),
      fetcher,
    }),
  })))
  const executable = path.join(input.outdir, ...asset.package_path.split("/"))
  const data = dataSources.map((item) => path.join(input.outdir, ...item.data.package_path.split("/")))
  const lock = path.join(input.outdir, ...WORK_ARTIFACT_RUNTIME_LOCK.packaged_lock_path.split("/"))
  await Promise.all([executable, ...data].map((filename) => fs.promises.mkdir(path.dirname(filename), { recursive: true })))
  await Promise.all([
    fs.promises.copyFile(source, executable),
    ...dataSources.map((item, index) => fs.promises.copyFile(item.source, data[index]!)),
    fs.promises.copyFile(WORK_ARTIFACT_RUNTIME_LOCK_PATH, lock),
  ])
  if (input.target.os !== "win32") {
    await Promise.all([
      fs.promises.chmod(executable, 0o755),
      ...data.map((filename) => fs.promises.chmod(filename, 0o644)),
      fs.promises.chmod(lock, 0o644),
    ])
  }
  return { executable, data, lock }
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
