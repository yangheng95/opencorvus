#!/usr/bin/env bun
/** Qualify Rust dependency data contracts using one canonical Overlay build's actual library artifacts. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import { createWriteStream } from "node:fs"
import path from "node:path"
import { finished } from "node:stream/promises"
import { fileURLToPath } from "node:url"
import { X509Certificate } from "node:crypto"

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
    "Canonical Windows Tauri/PHF/serde/TLS13/Anyhow data contracts plus separately recorded event-listener library-only contracts; no GUI, model or Linux D-Bus execution.",
}

async function run(
  label: string,
  executable: string,
  args: string[],
  options?: { cwd?: string; onLine?: (line: string) => void; env?: NodeJS.ProcessEnv },
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
  const child = spawn(executable, args, {
    cwd,
    env: { ...process.env, ...options?.env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  })
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

function cargoOutput() {
  const artifacts: Artifact[] = []
  const buildScripts: Array<Extract<CargoMessage, { reason: "build-script-executed" }>> = []
  const completions: Array<Extract<CargoMessage, { reason: "build-finished" }>> = []
  return {
    artifacts,
    buildScripts,
    completions,
    onLine(line: string) {
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
  }
}

async function publicTestPki() {
  const directory = path.resolve(overlay, "../../.tmp-product-iteration/data-integrity/rustls-public-test-pki/v0.23.45")
  await fs.mkdir(directory, { recursive: true })
  const sources = await Promise.all(
    ["end.fullchain", "end.key", "ca.cert"].map(async (name) => {
      const url = `https://raw.githubusercontent.com/rustls/rustls/v/0.23.45/test-ca/rsa-2048/${name}`
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
      assert.equal(response.status, 200, `Public Rustls test input download failed: ${url}`)
      const bytes = Buffer.from(await response.arrayBuffer())
      await fs.writeFile(path.join(directory, name), bytes)
      return { name, url, size: bytes.length, httpStatus: response.status }
    }),
  )
  const certificates = await Promise.all(
    ["end.fullchain", "ca.cert"].map(async (name) => {
      const certificate = new X509Certificate(await fs.readFile(path.join(directory, name)))
      return {
        name,
        validFrom: certificate.validFrom,
        validTo: certificate.validTo,
        subjectAltName: certificate.subjectAltName,
      }
    }),
  )
  receipt.publicTestPki = {
    directory,
    license: "Apache-2.0 OR ISC OR MIT",
    provenance: "Rustls v/0.23.45 public test-ca/rsa-2048 inputs, not user credentials; key bytes omitted",
    sources,
    certificates,
  }
  return directory
}

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
    rustls: packageID("rustls", "0.23.45"),
    webpki: packageID("rustls-webpki", "0.103.14"),
    anyhow: packageID("anyhow", "1.0.103"),
    plist: packageID("plist", "1.10.0"),
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

  const production = cargoOutput()
  const { artifacts, buildScripts, completions } = production
  await run("canonical-build", process.execPath, ["run", "build:overlay", "--cargo-message-format-json"], {
    cwd: overlay,
    onLine: production.onLine,
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
      target: "tauri_utils",
      version: "2.9.1",
      role: "runtime",
      features: ["brotli", "compression", "resources", "walkdir"],
    },
    {
      alias: "serde",
      name: "serde",
      target: "serde",
      version: "1.0.228",
      role: "runtime",
      features: ["alloc", "default", "derive", "rc", "serde_derive", "std"],
    },
    {
      alias: "serde_json",
      name: "serde_json",
      target: "serde_json",
      version: "1.0.149",
      role: "runtime",
      features: ["alloc", "default", "raw_value", "std"],
    },
    {
      alias: "serde_with",
      name: "serde_with",
      target: "serde_with",
      version: "3.21.0",
      role: "runtime",
      features: ["alloc", "default", "macros", "std"],
    },
    {
      alias: "phf_generator_010",
      name: "phf_generator",
      target: "phf_generator",
      version: "0.10.0",
      role: "host",
      features: [],
    },
    {
      alias: "phf_shared_010",
      name: "phf_shared",
      target: "phf_shared",
      version: "0.10.0",
      role: "host",
      features: ["std"],
    },
    {
      alias: "phf_generator_011",
      name: "phf_generator",
      target: "phf_generator",
      version: "0.11.3",
      role: "host",
      features: [],
    },
    {
      alias: "phf_shared_011",
      name: "phf_shared",
      target: "phf_shared",
      version: "0.11.3",
      role: "host",
      features: ["default", "std"],
    },
    {
      alias: "rustls",
      name: "rustls",
      target: "rustls",
      version: "0.23.45",
      role: "runtime",
      features: ["ring", "std", "tls12"],
    },
    {
      alias: "webpki",
      name: "rustls-webpki",
      target: "webpki",
      version: "0.103.14",
      role: "runtime",
      features: ["alloc", "ring", "std"],
    },
    {
      alias: "rustls_pki_types",
      name: "rustls-pki-types",
      target: "rustls_pki_types",
      version: "1.15.1",
      role: "runtime",
      features: ["alloc", "default", "std"],
    },
    {
      alias: "anyhow",
      name: "anyhow",
      target: "anyhow",
      version: "1.0.103",
      role: "runtime",
      features: ["default", "std"],
    },
    {
      alias: "plist",
      name: "plist",
      target: "plist",
      version: "1.10.0",
      role: "runtime",
      features: ["default", "serde"],
    },
  ] as const
  const bindings = specs.map((spec) => {
    const id = packageID(spec.name, spec.version)
    const profile = spec.role === "runtime" ? applicationUnit.profile : hostUnit.profile
    const candidates = artifacts.filter(
      (artifact) =>
        artifact.package_id === id &&
        artifact.target.kind.includes("lib") &&
        artifact.target.name === spec.target &&
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
  const pkiDirectory = await publicTestPki()
  const tests = await run("native-contracts", binary, ["--test-threads=1", "--nocapture"], {
    env: { OPENCORVUS_RUSTLS_TEST_PKI_DIR: pkiDirectory },
  })
  const nativeSummary = tests.match(/test result: ok\. (\d+) passed; 0 failed;/)
  assert(nativeSummary, "Actual production native fixture must report successful settlement")
  const actualNativePassed = Number(nativeSummary[1])
  assert.equal(actualNativePassed, 12, "Current production native fixture has twelve qualified contracts")
  const plistContractNames = [
    "actual_plist_xml_and_binary_return_complete_values",
    "actual_plist_serde_returns_typed_values_and_explicit_type_error",
    "actual_tauri_association_plist_retains_dictionary_contract",
  ]
  const completedNativeNames = [...tests.matchAll(/^test production::([^\s]+) \.\.\. ok\r?$/gm)].map((match) => match[1]!)
  assert.equal(completedNativeNames.length, actualNativePassed)
  const actualPlistNames = completedNativeNames.filter((name) => plistContractNames.includes(name))
  assert.deepEqual(actualPlistNames.slice().sort(), plistContractNames.slice().sort())
  receipt.nativeContracts = {
    passed: actualNativePassed,
    scopes: {
      originalProduction: { passed: completedNativeNames.length - actualPlistNames.length },
      plistProduction: { passed: actualPlistNames.length, names: actualPlistNames },
      eventLibrary: "separately recorded below after its actual fixture",
    },
    qualification:
      "Original six Tauri/KeyValueMap/PHF cases plus real authenticated TLS13 data, typed key-boundary error/alert, typed anyhow mutation and actual plist XML/binary/serde/Tauri association contracts",
  }

  // This invocation qualifies a library from the same lock on Windows. Its
  // artifacts are deliberately separate from the production build above.
  const event = cargoOutput()
  await run(
    "event-library-build",
    "cargo",
    [
      "build",
      "--manifest-path",
      path.join(tauri, "Cargo.toml"),
      "--locked",
      "-p",
      "event-listener@5.4.2",
      "--lib",
      "--release",
      "--target",
      "x86_64-pc-windows-msvc",
      "--target",
      "x86_64-unknown-linux-gnu",
      "--message-format=json-render-diagnostics",
    ],
    { onLine: event.onLine },
  )
  assert.deepEqual(event.completions, [{ reason: "build-finished", success: true }])
  await fs.writeFile(path.join(output, "event-library-artifacts.json"), JSON.stringify(event, null, 2))
  const eventLocked = lock.package.filter((entry) => entry.name === "event-listener" && entry.version === "5.4.2")
  assert.equal(eventLocked.length, 1)
  assert.equal(typeof eventLocked[0]!.source, "string")
  const eventID = `${eventLocked[0]!.source}#event-listener@5.4.2`
  const eventTargetDirectory = path.resolve(tauri, process.env.CARGO_TARGET_DIR ?? metadata.target_directory)
  const eventWindowsRoot = path.join(eventTargetDirectory, "x86_64-pc-windows-msvc")
  const eventLinuxRoot = path.join(eventTargetDirectory, "x86_64-unknown-linux-gnu")
  const within = (root: string, file: string) => {
    const relative = path.relative(root, file)
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  }
  const eventWindowsArtifacts = event.artifacts.filter((artifact) =>
    artifact.filenames.every((file) => within(eventWindowsRoot, file)),
  )
  const eventUnit = uniqueUnit(
    "event-listener library-only",
    eventWindowsArtifacts.filter(
      (artifact) =>
        artifact.package_id === eventID &&
        artifact.target.name === "event_listener" &&
        artifact.target.kind.includes("lib") &&
        featureKey(artifact.features) === "default,parking,std" &&
        profileKey(artifact.profile) === profileKey(applicationUnit.profile),
    ),
  )
  const eventLibraries = eventUnit.filenames.filter((file) => file.endsWith(".rlib"))
  assert.equal(eventLibraries.length, 1)
  const eventDirectories = [
    ...new Set(eventWindowsArtifacts.flatMap((artifact) => artifact.filenames.map((file) => path.dirname(file)))),
  ]
  const eventNativePaths = [...new Set(event.buildScripts.flatMap((script) => script.linked_paths))].filter((entry) => {
    const file = entry.includes("=") ? entry.slice(entry.indexOf("=") + 1) : entry
    if (within(eventWindowsRoot, file)) return true
    assert(within(eventLinuxRoot, file), `Unowned event-library native search path: ${entry}`)
    return false
  })
  const eventBinary = path.join(output, "event-listener-contract.exe")
  await run("compile-event-contract", "rustc", [
    "--test",
    "--edition=2021",
    "--cfg",
    "event_listener_contract",
    path.join(overlay, "script/fixture/rust-dependency-contract.rs"),
    "--extern",
    `event_listener=${eventLibraries[0]!}`,
    ...eventDirectories.flatMap((directory) => ["-L", `dependency=${directory}`]),
    ...eventNativePaths.flatMap((nativePath) => ["-L", nativePath]),
    "-o",
    eventBinary,
  ])
  const eventTests = await run("event-library-contracts", eventBinary, ["--test-threads=1", "--nocapture"])
  assert.match(eventTests, /test result: ok\. 2 passed; 0 failed;/)
  receipt.eventLibraryContracts = {
    passed: 2,
    artifact: eventUnit,
    target: "x86_64-pc-windows-msvc",
    targetDirectory: eventWindowsRoot,
    dependencyDirectories: eventDirectories,
    nativeSearchPaths: eventNativePaths,
    qualification:
      "Separate Windows library-only Send-tag/cancel-forward/reuse contracts; Linux cross-compiled units only activate the real dependency branch and are not linked or executed here; no application or Linux D-Bus execution claim",
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
