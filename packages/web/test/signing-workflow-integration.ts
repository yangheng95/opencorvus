import { createHash, generateKeyPairSync } from "node:crypto"
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { fetchVerifiedExpertSquadBundle, resolveVerifiedExpertSquadBundle } from "../src/lib/expert-squad-publication"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = path.resolve(webRoot, "..", "..")
const workflowPath = path.join(repositoryRoot, ".github", "workflows", "deploy-opencorvus-com.yml")

function workflowRunBody(workflow: string, stepName: string, proof: string) {
  const lines = workflow.split(/\r?\n/)
  const step = lines.findIndex((line) => line.trim() === `- name: ${stepName}`)
  if (step < 0) throw new Error(`${stepName} workflow step was not found`)
  const run = lines.findIndex((line, index) => index > step && /^        run: \|$/.test(line))
  if (run < 0) throw new Error(`${stepName} workflow run body was not found`)
  const body = []
  for (let index = run + 1; index < lines.length; index += 1) {
    if (lines[index] && !lines[index].startsWith("          ")) break
    body.push(lines[index].slice(10))
  }
  if (!body.some((line) => line.includes(proof))) throw new Error(`extracted ${stepName} body is incomplete`)
  return `${body.join("\n")}\n`
}

function key(id: string) {
  const pair = generateKeyPairSync("ed25519")
  return {
    keyId: id,
    privateKeyBase64: Buffer.from(
      String(pair.privateKey.export({ type: "pkcs8", format: "pem" })),
      "utf8",
    ).toString("base64"),
    publicKeySpkiBase64: Buffer.from(pair.publicKey.export({ type: "spki", format: "der" })).toString("base64"),
  }
}

async function run(command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))))
  })
}

async function executeOnce(
  root: string,
  script: string,
  keys: ReturnType<typeof key>[],
  trustedKeys: Array<Pick<ReturnType<typeof key>, "keyId" | "publicKeySpkiBase64">> = keys,
  publication: {
    deploymentMode: "daily" | "bootstrap-stage" | "bootstrap-verify"
    runNumber?: string
    runAttempt?: string
  } = { deploymentMode: "bootstrap-stage" },
) {
  const candidate = path.join(root, "candidate")
  const runnerTemp = path.join(root, "runner-temp")
  const binaryDirectory = path.join(root, "bin")
  await Promise.all([mkdir(binaryDirectory, { recursive: true }), mkdir(runnerTemp, { recursive: true })])
  if (process.platform === "win32") {
    const pythonShim = path.join(binaryDirectory, "python3")
    await writeFile(
      pythonShim,
      "#!/usr/bin/env bash\nexport MSYS2_ARG_CONV_EXCL='*'\nexport MSYS2_ENV_CONV_EXCL='BUNDLE_PATH'\nexec python \"$@\"\n",
    )
    await chmod(pythonShim, 0o755)
  }
  await cp(path.join(webRoot, "dist"), candidate, { recursive: true })
  await writeFile(path.join(root, "sign.sh"), script)
  const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash"
  const slash = (value: string) => (process.platform === "win32" ? value.replaceAll("\\", "/") : value)
  const bashPath = (value: string) =>
    process.platform === "win32" ? slash(value).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : value
  await run(bash, ["-c", 'export PATH="$1/bin:$PATH"; exec bash "$1/sign.sh"', "bash", bashPath(root)], {
    cwd: root,
    env: {
      ...process.env,
      RUNNER_TEMP: bashPath(runnerTemp),
      SIGNING_PRIVATE_KEY_B64: keys[0].privateKeyBase64,
      SIGNING_KEY_ID: keys[0].keyId,
      SECONDARY_SIGNING_PRIVATE_KEY_B64: keys[1].privateKeyBase64,
      SECONDARY_SIGNING_KEY_ID: keys[1].keyId,
      TRUSTED_KEYS_JSON: JSON.stringify(trustedKeys),
      DEPLOYMENT_MODE: publication.deploymentMode,
      BOOTSTRAP_PUBLICATION_VERSION: "42",
      BOOTSTRAP_PUBLICATION_EXPIRES_AT: "2035-01-01T00:00:00Z",
      GITHUB_RUN_NUMBER: publication.runNumber ?? "1234",
      GITHUB_RUN_ATTEMPT: publication.runAttempt ?? "1",
    },
  })
  const pointer = JSON.parse(await readFile(path.join(candidate, "expert-squads", "catalog.json"), "utf8"))
  const envelope = JSON.parse(await readFile(path.join(candidate, ...pointer.signatures.path.split("/").filter(Boolean)), "utf8"))
  if (envelope.signatures.length !== 2) throw new Error("rotation publication did not contain two signatures")
  return {
    pointer,
    bundle: await readFile(path.join(candidate, ...pointer.bundle.path.split("/").filter(Boolean))),
    envelope: Buffer.from(JSON.stringify(envelope)),
    candidate,
  }
}

async function freezeRelease(root: string, candidate: string, script: string, commitSha: string) {
  const runnerTemp = path.join(root, "freeze-runner-temp")
  const githubOutput = path.join(root, "freeze-output.txt")
  await mkdir(runnerTemp, { recursive: true })
  await writeFile(path.join(root, "freeze.sh"), script)
  const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash"
  const slash = (value: string) => (process.platform === "win32" ? value.replaceAll("\\", "/") : value)
  const bashPath = (value: string) =>
    process.platform === "win32" ? slash(value).replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : value
  await run(bash, ["-c", 'exec bash "$1/freeze.sh"', "bash", bashPath(root)], {
    cwd: root,
    env: {
      ...process.env,
      RUNNER_TEMP: bashPath(runnerTemp),
      GITHUB_OUTPUT: bashPath(githubOutput),
      GITHUB_SHA: commitSha,
    },
  })
  const output = await readFile(githubOutput, "utf8")
  const releaseId = output.match(/^id=(.+)$/m)?.[1]
  if (!releaseId) throw new Error("freeze workflow did not emit a release ID")
  const pointerDigest = createHash("sha256").update(await readFile(path.join(candidate, "expert-squads", "catalog.json"))).digest("hex")
  const expected = `${commitSha}-${pointerDigest.slice(0, 16)}`
  if (releaseId !== expected) throw new Error("release ID did not bind the final publication pointer")
  return releaseId
}

const temporary = await mkdtemp(
  process.platform === "win32" ? path.join(path.parse(repositoryRoot).root, "ocsw-") : path.join(os.tmpdir(), "ocsw-"),
)
try {
  const workflow = await readFile(workflowPath, "utf8")
  const script = workflowRunBody(workflow, "Sign catalog and assemble content-addressed bundle", "openssl pkeyutl -sign")
  const freezeScript = workflowRunBody(workflow, "Freeze deploy archive and checksums", "sha256sum candidate/expert-squads/catalog.json")
  const keys = process.env.OPENCORVUS_TEST_SIGNING_KEYS_JSON
    ? (JSON.parse(process.env.OPENCORVUS_TEST_SIGNING_KEYS_JSON) as ReturnType<typeof key>[])
    : [key("release-old"), key("release-new")]
  if (keys.length !== 2) throw new Error("signing integration requires exactly two rotation keys")
  const first = await executeOnce(path.join(temporary, "first"), script, keys)
  const second = await executeOnce(path.join(temporary, "second"), script, keys, keys, {
    deploymentMode: "bootstrap-verify",
  })
  if (!first.bundle.equals(second.bundle)) throw new Error("repeated bundle assembly was not byte-identical")
  if (!first.envelope.equals(second.envelope)) throw new Error("repeated Ed25519 envelope was not byte-identical")
  if (first.pointer.bundle.sha256 !== second.pointer.bundle.sha256) throw new Error("bundle digest changed between runs")
  if (JSON.stringify(first.pointer) !== JSON.stringify(second.pointer)) {
    throw new Error("bootstrap-stage and bootstrap-verify did not produce the same publication pointer")
  }
  const firstCandidate = path.join(temporary, "first", "candidate")
  const fetchCandidate = async (input: RequestInfo | URL) => {
    const target = path.join(firstCandidate, ...String(input).replace(/^\//, "").split("/"))
    return new Response(await readFile(target))
  }
  const verified = await resolveVerifiedExpertSquadBundle({
    pointerUrl: "/expert-squads/catalog.json",
    expectedCatalog: first.pointer.catalog,
    expectedResources: first.pointer.resources,
    trustedKeys: keys.map(({ keyId, publicKeySpkiBase64 }) => ({ keyId, publicKeySpkiBase64 })),
    fetchImpl: fetchCandidate,
    now: Date.parse("2029-01-01T00:00:00Z"),
  })
  const verifiedBundle = await fetchVerifiedExpertSquadBundle(verified, fetchCandidate)
  if (!Buffer.from(await verifiedBundle.arrayBuffer()).equals(first.bundle)) {
    throw new Error("browser verifier did not receive the exact workflow bundle")
  }
  const automaticStartedAt = Date.now()
  const automatic = await executeOnce(path.join(temporary, "automatic"), script, keys, keys, {
    deploymentMode: "daily",
    runNumber: "1234",
    runAttempt: "7",
  })
  if (automatic.pointer.publicationVersion !== 1234007) {
    throw new Error("daily publication did not derive its monotonic version from the GitHub run metadata")
  }
  const automaticExpiry = Date.parse(automatic.pointer.expiresAt)
  const expectedValidity = 90 * 24 * 60 * 60 * 1000
  if (automaticExpiry < automaticStartedAt + expectedValidity - 60_000 || automaticExpiry > Date.now() + expectedValidity + 60_000) {
    throw new Error("daily publication did not derive a 90-day expiry")
  }
  const commitSha = "0123456789abcdef0123456789abcdef01234567"
  const firstReleaseId = await freezeRelease(path.join(temporary, "first"), first.candidate, freezeScript, commitSha)
  const secondReleaseId = await freezeRelease(path.join(temporary, "second"), second.candidate, freezeScript, commitSha)
  const automaticReleaseId = await freezeRelease(path.join(temporary, "automatic"), automatic.candidate, freezeScript, commitSha)
  if (firstReleaseId !== secondReleaseId) throw new Error("the byte-identical bootstrap pair produced different release IDs")
  if (automaticReleaseId === firstReleaseId) throw new Error("daily renewal collided with the prior immutable release ID")
  let mismatchRejected = false
  try {
    await executeOnce(path.join(temporary, "mismatched-key"), script, keys, [
      { keyId: keys[0].keyId, publicKeySpkiBase64: keys[1].publicKeySpkiBase64 },
      { keyId: keys[1].keyId, publicKeySpkiBase64: keys[1].publicKeySpkiBase64 },
    ])
  } catch {
    mismatchRejected = true
  }
  if (!mismatchRejected) throw new Error("signer key ID accepted a private key that did not match the trusted SPKI")
  if (process.env.OPENCORVUS_SIGNED_CANDIDATE_OUTPUT) {
    await rm(process.env.OPENCORVUS_SIGNED_CANDIDATE_OUTPUT, { recursive: true, force: true })
    await cp(path.join(temporary, "first", "candidate"), process.env.OPENCORVUS_SIGNED_CANDIDATE_OUTPUT, { recursive: true })
  }
  console.log(`signing workflow integration passed: ${first.pointer.bundle.sha256}`)
} finally {
  if (process.env.OPENCORVUS_KEEP_SIGNING_TEMP === "1") console.error(`kept signing integration root: ${temporary}`)
  else await rm(temporary, { recursive: true, force: true })
}
