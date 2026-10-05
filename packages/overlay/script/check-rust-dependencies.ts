#!/usr/bin/env bun
/** Qualify Rust dependency data contracts using one canonical Overlay build's actual library artifacts. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createWriteStream } from "node:fs"
import path from "node:path"
import { finished } from "node:stream/promises"
import { fileURLToPath } from "node:url"

type Profile = {
  opt_level: string
  debuginfo: unknown
  debug_assertions: boolean
  overflow_checks: boolean
  test: boolean
}
type Artifact = {
  reason: "compiler-artifact"
  package_id: string
  manifest_path: string
  target: { name: string; kind: string[]; crate_types: string[] }
  profile: Profile
  features: string[]
  filenames: string[]
  fresh: boolean
}
type Metadata = {
  packages: Array<{ id: string; name: string; version: string }>
  resolve: { nodes: Array<{ id: string; features: string[]; deps: Array<{ name: string; pkg: string }> }> }
  target_directory: string
}
type CargoMessage =
  | Artifact
  | { reason: "build-finished"; success: boolean }
  | { reason: "build-script-executed"; package_id: string; linked_paths: string[] }

const overlay = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tauri = path.join(overlay, "src-tauri")
const outputIndex = process.argv.indexOf("--output")
assert(
  outputIndex >= 0 && process.argv[outputIndex + 1],
  "Usage: check-rust-dependencies.ts --output <new-owned-directory>",
)
const output = path.resolve(process.argv[outputIndex + 1]!)
await fs.mkdir(path.dirname(output), { recursive: true })
await fs.mkdir(output) // Exclusive run directory preserves every earlier result/failure.
const commands: Array<{ label: string; executable: string; args: string[]; cwd: string; exitCode?: number | null }> = []
const receipt: Record<string, unknown> = {
  status: "running",
  output,
  startedAt: new Date().toISOString(),
  commands,
  qualification:
    "Current Windows native Tauri serializer/PHF consumers plus separately labelled repaired KeyValueMap API; no GUI or model execution.",
}

async function run(
  label: string,
  executable: string,
  args: string[],
  options?: { cwd?: string; onLine?: (line: string) => void },
) {
  // Match the production build's rust-toolchain.toml resolution for metadata and rustc.
  const cwd = options?.cwd ?? tauri
  const command = { label, executable, args, cwd, exitCode: undefined as number | null | undefined }
  commands.push(command)
  console.log(`[rust-dependencies] ${label}`)
  const stdoutFile = createWriteStream(path.join(output, `${label}.stdout.log`), { flags: "wx" })
  const stderrFile = createWriteStream(path.join(output, `${label}.stderr.log`), { flags: "wx" })
  let fileFailure: unknown
  const filesFinished = Promise.all([finished(stdoutFile), finished(stderrFile)]).catch((error) => {
    fileFailure = error
  })
  const child = spawn(executable, args, { cwd, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
  let stdout = ""
  let buffered = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    stdoutFile.write(chunk)
    stdout += chunk
    buffered += chunk
    const lines = buffered.split(/\r?\n/)
    buffered = lines.pop() ?? ""
    for (const line of lines) options?.onLine?.(line)
  })
  child.stderr.on("data", (chunk: string) => {
    stderrFile.write(chunk)
    process.stderr.write(chunk)
  })
  try {
    command.exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject)
      child.once("close", resolve)
    })
    if (buffered) options?.onLine?.(buffered)
  } finally {
    stdoutFile.end()
    stderrFile.end()
    await filesFinished
    if (fileFailure) throw fileFailure
  }
  assert.equal(command.exitCode, 0, `${label} failed; exact stdout/stderr retained in ${output}`)
  return stdout
}

const profileKey = (profile: Profile) =>
  JSON.stringify([
    profile.opt_level,
    profile.debuginfo,
    profile.debug_assertions,
    profile.overflow_checks,
    profile.test,
  ])
const featureKey = (features: string[]) => [...features].sort().join(",")

try {
  const compiler = await run("rustc-version", "rustc", ["-vV"])
  const host = /^host: (.+)$/m.exec(compiler)?.[1]?.trim()
  assert.equal(host, "x86_64-pc-windows-msvc", "This qualification targets the current native Windows production build")
  const cargoVersion = await run("cargo-version", "cargo", ["--version"])
  const metadata = JSON.parse(
    await run("metadata", "cargo", [
      "metadata",
      "--manifest-path",
      path.join(overlay, "src-tauri/Cargo.toml"),
      "--locked",
      "--format-version",
      "1",
      "--filter-platform",
      host,
    ]),
  ) as Metadata
  receipt.compiler = compiler.trim()
  receipt.cargo = cargoVersion.trim()
  receipt.host = host
  receipt.targetDirectory = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : metadata.target_directory
  const packageID = (name: string, version: string) => {
    const matches = metadata.packages.filter((entry) => entry.name === name && entry.version === version)
    assert.equal(matches.length, 1, `Expected exact Cargo package ${name}@${version}`)
    return matches[0]!.id
  }
  const patched = {
    serde: packageID("serde_with", "3.21.0"),
    macros: packageID("serde_with_macros", "3.21.0"),
    rand: packageID("rand", "0.8.6"),
    darling: packageID("darling", "0.23.0"),
    darlingCore: packageID("darling_core", "0.23.0"),
    darlingMacro: packageID("darling_macro", "0.23.0"),
  }
  for (const version of ["0.10.0", "0.11.3"]) {
    const generatorID = packageID("phf_generator", version)
    const generator = metadata.resolve.nodes.find((node) => node.id === generatorID)
    assert.equal(generator?.deps.find((dep) => dep.name === "rand")?.pkg, patched.rand)
  }
  receipt.selectedGraph = metadata.resolve.nodes.filter((node) => Object.values(patched).includes(node.id))
  // Cargo's filtered package set omits Linux-only glib. The cross-target lock,
  // rather than Windows compiler metadata, owns the unresolved version facts.
  const lock = Bun.TOML.parse(await fs.readFile(path.join(tauri, "Cargo.lock"), "utf8")) as {
    package: Array<{ name: string; version: string; source?: string }>
  }
  receipt.residuals = [
    { name: "rand", version: "0.7.3" },
    { name: "glib", version: "0.18.5" },
  ].map((expected) => {
    const locked = lock.package.filter((entry) => entry.name === expected.name && entry.version === expected.version)
    assert.equal(locked.length, 1, `Expected retained lock finding ${expected.name}@${expected.version}`)
    return {
      ...expected,
      source: locked[0]!.source,
      windowsResolved: metadata.packages.some(
        (entry) => entry.name === expected.name && entry.version === expected.version,
      ),
    }
  })

  const artifacts: Artifact[] = []
  const buildScripts: Array<Extract<CargoMessage, { reason: "build-script-executed" }>> = []
  const completions: Array<Extract<CargoMessage, { reason: "build-finished" }>> = []
  await run("canonical-build", process.execPath, ["run", "build:overlay", "--cargo-message-format-json"], {
    cwd: overlay,
    onLine(line) {
      if (!line.startsWith("{")) {
        if (line.trim()) console.log(line)
        return
      }
      let message: CargoMessage
      try {
        message = JSON.parse(line)
      } catch {
        return
      }
      if (message.reason === "compiler-artifact") artifacts.push(message)
      if (message.reason === "build-script-executed") buildScripts.push(message)
      if (message.reason === "build-finished") completions.push(message)
    },
  })
  assert.deepEqual(completions, [{ reason: "build-finished", success: true }])
  await fs.writeFile(
    path.join(output, "compiler-artifacts.json"),
    JSON.stringify({ artifacts, buildScripts, completions }, null, 2),
  )
  const application = metadata.packages.find((entry) => entry.name === "opencorvus-overlay")
  assert(application)
  const uniqueUnit = (name: string, candidates: Artifact[]) => {
    const unique = [
      ...new Map(candidates.map((candidate) => [JSON.stringify(candidate.filenames), candidate])).values(),
    ]
    assert.equal(unique.length, 1, `${name}: ambiguous/missing current compiler unit: ${JSON.stringify(unique)}`)
    return unique[0]!
  }
  const applicationUnit = uniqueUnit(
    "application",
    artifacts.filter((artifact) => artifact.package_id === application.id && artifact.target.kind.includes("bin")),
  )
  const hostUnit = uniqueUnit(
    "build-script",
    artifacts.filter(
      (artifact) => artifact.package_id === application.id && artifact.target.kind.includes("custom-build"),
    ),
  )
  receipt.profiles = { runtime: applicationUnit.profile, host: hostUnit.profile }
  const specs = [
    {
      alias: "tauri_utils",
      name: "tauri-utils",
      version: "2.9.1",
      role: "runtime",
      features: ["brotli", "compression", "resources", "walkdir"],
    },
    {
      alias: "serde",
      name: "serde",
      version: "1.0.228",
      role: "runtime",
      features: ["alloc", "default", "derive", "rc", "serde_derive", "std"],
    },
    {
      alias: "serde_json",
      name: "serde_json",
      version: "1.0.149",
      role: "runtime",
      features: ["alloc", "default", "raw_value", "std"],
    },
    {
      alias: "serde_with",
      name: "serde_with",
      version: "3.21.0",
      role: "runtime",
      features: ["alloc", "default", "macros", "std"],
    },
    { alias: "phf_generator_010", name: "phf_generator", version: "0.10.0", role: "host", features: [] },
    { alias: "phf_shared_010", name: "phf_shared", version: "0.10.0", role: "host", features: ["std"] },
    { alias: "phf_generator_011", name: "phf_generator", version: "0.11.3", role: "host", features: [] },
    { alias: "phf_shared_011", name: "phf_shared", version: "0.11.3", role: "host", features: ["default", "std"] },
  ] as const
  const bindings = specs.map((spec) => {
    const id = packageID(spec.name, spec.version)
    const profile = spec.role === "runtime" ? applicationUnit.profile : hostUnit.profile
    const candidates = artifacts.filter(
      (artifact) =>
        artifact.package_id === id &&
        artifact.target.kind.includes("lib") &&
        artifact.target.name === spec.name.replaceAll("-", "_") &&
        profileKey(artifact.profile) === profileKey(profile) &&
        featureKey(artifact.features) === featureKey([...spec.features]),
    )
    const selected = uniqueUnit(spec.alias, candidates)
    const libraries = selected.filenames.filter((file) => file.endsWith(".rlib"))
    assert.equal(libraries.length, 1, `One actual rlib is required for ${spec.alias}`)
    return { ...spec, artifact: selected, library: libraries[0]! }
  })
  const macro = uniqueUnit(
    "serde_with_macros",
    artifacts.filter(
      (artifact) => artifact.package_id === patched.macros && artifact.target.kind.includes("proc-macro"),
    ),
  )
  receipt.bindings = bindings
  receipt.macro = macro
  const directories = [
    ...new Set(artifacts.flatMap((artifact) => artifact.filenames.map((file) => path.dirname(file)))),
  ]
  const dependencyNodes = new Map(metadata.resolve.nodes.map((node) => [node.id, node]))
  const libraryClosure = new Set<string>()
  const pending = [...bindings.map((binding) => binding.artifact.package_id), macro.package_id]
  while (pending.length) {
    const id = pending.pop()!
    if (libraryClosure.has(id)) continue
    libraryClosure.add(id)
    const node = dependencyNodes.get(id)
    assert(node, `Missing dependency graph node for selected library ${id}`)
    pending.push(...node.deps.map((dependency) => dependency.pkg))
  }
  // Native search paths belong to their emitting package. In particular, the
  // application build script's CRT shim is not a dependency of these libraries.
  const libraryBuildScripts = buildScripts.filter((script) => libraryClosure.has(script.package_id))
  const nativePaths = [...new Set(libraryBuildScripts.flatMap((script) => script.linked_paths))]
  receipt.libraryClosure = [...libraryClosure].sort()
  receipt.nativeSearchOwners = libraryBuildScripts.filter((script) => script.linked_paths.length)
  const binary = path.join(output, "rust-dependency-contract.exe")
  const rustcArgs = [
    "--test",
    "--edition=2021",
    path.join(overlay, "script/fixture/rust-dependency-contract.rs"),
    ...bindings.flatMap((binding) => ["--extern", `${binding.alias}=${binding.library}`]),
    ...directories.flatMap((directory) => ["-L", `dependency=${directory}`]),
    ...nativePaths.flatMap((nativePath) => ["-L", nativePath]),
    "-o",
    binary,
  ]
  await run("compile-contract", "rustc", rustcArgs)
  const tests = await run("native-contracts", binary, ["--test-threads=1", "--nocapture"])
  assert.match(tests, /test result: ok\. 6 passed; 0 failed;/)
  receipt.nativeContracts = {
    passed: 6,
    qualification:
      "One actual Tauri config contract, three repaired KeyValueMap API cases, two actual PHF generator/lookup contracts",
  }
  receipt.status = "passed"
} catch (error) {
  receipt.status = "failed"
  receipt.error = { name: error instanceof Error ? error.name : "Error", message: String(error) }
  process.exitCode = 1
} finally {
  receipt.completedAt = new Date().toISOString()
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" })
}
console.log(`[rust-dependencies] ${receipt.status}: ${path.join(output, "result.json")}`)
