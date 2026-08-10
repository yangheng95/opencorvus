import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = path.resolve(webRoot, "..", "..")
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "deploy-opencorvus-com.yml")
const releaseID = `${"a".repeat(40)}-${"b".repeat(16)}`

function deployRunBody(workflow: string) {
  const lines = workflow.split(/\r?\n/)
  const step = lines.findIndex((line) => line.trim() === "- name: Deploy immutable release and atomically switch current")
  if (step < 0) throw new Error("deploy workflow step was not found")
  const run = lines.findIndex((line, index) => index > step && /^        run: \|$/.test(line))
  if (run < 0) throw new Error("deploy workflow run body was not found")
  const body = []
  for (let index = run + 1; index < lines.length; index += 1) {
    if (lines[index] && !lines[index].startsWith("          ")) break
    body.push(lines[index].slice(10))
  }
  if (!body.some((line) => line.includes("probe_public_release()"))) throw new Error("deploy probe is not step-local")
  return `${body.join("\n")}\n`
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function writeBoundJSON(root: string, section: string, value: unknown) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`)
  const digest = sha256(bytes)
  const relative = `expert-squads/${section}/${digest}.json`
  await mkdir(path.join(root, "expert-squads", section), { recursive: true })
  await writeFile(path.join(root, relative), bytes)
  return { path: `/${relative}`, sha256: digest, bytes: bytes.byteLength }
}

async function createCandidate(root: string) {
  const candidate = path.join(root, "candidate")
  const resources = { total: 3, embeddedAlreadyAvailable: 1, bundledMarketImportable: 2 }
  await mkdir(path.join(candidate, "expert-squads", "bundles"), { recursive: true })
  await writeFile(path.join(candidate, "index.html"), "<!doctype html><title>deploy workflow fixture</title>\n")
  const catalog = await writeBoundJSON(candidate, "catalogs", {
    protocol: "opencorvus/expert-squad-static-catalog@1",
    resources,
    packages: Array.from({ length: resources.total }, (_, index) => ({
      id: `squad-${index}`,
      disposition: index === 0 ? "embedded_already_available" : "bundled_market_importable",
    })),
  })
  const bundleBytes = Buffer.from("bundle fixture\n")
  const bundleDigest = sha256(bundleBytes)
  const bundle = {
    path: `/expert-squads/bundles/${bundleDigest}/all-expert-squads.zip`,
    sha256: bundleDigest,
    bytes: bundleBytes.byteLength,
  }
  const bundlePath = path.join(candidate, ...bundle.path.slice(1).split("/"))
  await mkdir(path.dirname(bundlePath), { recursive: true })
  await writeFile(bundlePath, bundleBytes)
  const publicationVersion = 7
  const expiresAt = "2035-01-01T00:00:00Z"
  const signatures = await writeBoundJSON(candidate, "signatures", {
    protocol: "opencorvus/expert-squad-catalog-signatures@1",
    threshold: 1,
    catalog,
    bundle,
    publicationVersion,
    expiresAt,
    signatures: [{ algorithm: "Ed25519", keyId: "fixture", signatureBase64: "AA==" }],
  })
  await writeFile(
    path.join(candidate, "expert-squads", "catalog.json"),
    `${JSON.stringify({
      protocol: "opencorvus/expert-squad-publication@1",
      publicationVersion,
      expiresAt,
      resources,
      catalog,
      signatures,
      bundle,
    })}\n`,
  )
}

async function writeExecutable(target: string, contents: string) {
  await writeFile(target, contents)
  await chmod(target, 0o755)
}

async function runBash(script: string, root: string, mode: string, failOnce = false) {
  const runnerTemp = path.join(root, "runner-temp")
  const bin = path.join(root, "bin")
  await Promise.all([mkdir(runnerTemp, { recursive: true }), mkdir(bin, { recursive: true }), createCandidate(root)])
  await Promise.all([
    writeFile(path.join(runnerTemp, `${releaseID}.tar.gz`), "archive"),
    writeFile(path.join(runnerTemp, `${releaseID}.tar.gz.sha256`), "archive checksum"),
    writeFile(path.join(runnerTemp, "DEPLOY_SHA256SUMS"), "deploy checksums"),
    writeFile(path.join(root, "deploy.sh"), script),
  ])
  await writeExecutable(
    path.join(bin, "ssh"),
    '#!/usr/bin/env bash\nprintf "%s\\n" "ssh $*" >> "$DEPLOY_TEST_LOG"\ncase "${!#}" in *"--rollback"*) printf "%s\\n" "releases/previous" ;; esac\n',
  )
  await writeExecutable(path.join(bin, "scp"), '#!/usr/bin/env bash\nprintf "%s\\n" "scp $*" >> "$DEPLOY_TEST_LOG"\n')
  await writeExecutable(
    path.join(bin, "curl"),
    '#!/usr/bin/env bash\nset -euo pipefail\nurl=${!#}\nif [ "${DEPLOY_TEST_FAIL_ONCE:-0}" = 1 ] && [ ! -e "$DEPLOY_TEST_FAIL_MARKER" ]; then touch "$DEPLOY_TEST_FAIL_MARKER"; exit 22; fi\npath=${url#https://opencorvus.com}\nif [ -z "$path" ] || [ "$path" = / ]; then path=/index.html; fi\ncat "$DEPLOY_TEST_CANDIDATE$path"\n',
  )
  if (process.platform === "win32") {
    await writeExecutable(
      path.join(bin, "python3"),
      '#!/usr/bin/env bash\nset -euo pipefail\nargs=()\nfor arg in "$@"; do\n  if [[ "$arg" == /* && -e "$arg" ]]; then args+=("$(cygpath -w "$arg")"); else args+=("$arg"); fi\ndone\nexport MSYS2_ARG_CONV_EXCL="*"\nexec python "${args[@]}"\n',
    )
  }
  const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash"
  const bashPath = (value: string) =>
    process.platform === "win32" ? value.replaceAll("\\", "/").replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : value
  const environment = {
    ...process.env,
    RUNNER_TEMP: bashPath(runnerTemp),
    CLOUDCONE_HOST: "fixture.invalid",
    CLOUDCONE_PORT: "22",
    CLOUDCONE_USER: "deploy",
    CLOUDCONE_SSH_PRIVATE_KEY: "test-only-key",
    CLOUDCONE_KNOWN_HOSTS: "fixture.invalid ssh-ed25519 AAAAfixture",
    RELEASE_ID: releaseID,
    DEPLOYMENT_MODE: mode,
    DEPLOY_TEST_LOG: bashPath(path.join(root, "deploy.log")),
    DEPLOY_TEST_CANDIDATE: bashPath(path.join(root, "candidate")),
    DEPLOY_TEST_FAIL_ONCE: failOnce ? "1" : "0",
    DEPLOY_TEST_FAIL_MARKER: bashPath(path.join(root, "failed-once")),
  }
  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(bash, ["-c", 'export PATH="$1/bin:$PATH"; exec bash "$1/deploy.sh"', "bash", bashPath(root)], {
      cwd: root,
      env: environment,
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) => resolve(code ?? 1))
  })
  const log = await readFile(path.join(root, "deploy.log"), "utf8").catch(() => "")
  const privateKeyWasRemoved = await readFile(path.join(runnerTemp, "cloudcone-deploy-key")).then(
    () => false,
    () => true,
  )
  return { exitCode, log, privateKeyWasRemoved }
}

const temporary = await mkdtemp(
  process.platform === "win32" ? path.join(path.parse(repositoryRoot).root, "ocdw-") : path.join(os.tmpdir(), "ocdw-"),
)
try {
  const script = deployRunBody(await readFile(workflowPath, "utf8"))
  const success = await runBash(script, path.join(temporary, "success"), "daily")
  if (success.exitCode !== 0 || !success.log.includes("opencorvus-activate-release") || !success.privateKeyWasRemoved) {
    throw new Error("daily deploy step did not activate, probe, and clean credentials")
  }
  const rollback = await runBash(script, path.join(temporary, "rollback"), "daily", true)
  if (rollback.exitCode === 0 || !rollback.log.includes("--rollback") || !rollback.privateKeyWasRemoved) {
    throw new Error("failed public probe did not roll back and clean credentials")
  }
  const bootstrap = await runBash(script, path.join(temporary, "bootstrap-stage"), "bootstrap-stage")
  if (bootstrap.exitCode !== 0 || !bootstrap.log.includes("opencorvus-activate-release")) {
    throw new Error("bootstrap stage did not activate the pre-DNS release")
  }
  const verify = await runBash(script, path.join(temporary, "bootstrap-verify"), "bootstrap-verify")
  if (verify.exitCode !== 0 || verify.log.length !== 0) {
    throw new Error("bootstrap verification performed SSH mutation or failed public verification")
  }
  console.log("deploy workflow integration passed: daily, rollback, bootstrap-stage, bootstrap-verify")
} finally {
  await rm(temporary, { recursive: true, force: true })
}
