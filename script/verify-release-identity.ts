#!/usr/bin/env bun

export type GitHubApiResult = {
  exitCode: number
  stdout: string
  stderr: string
}

export type GitHubApiRequest = (args: string[]) => Promise<GitHubApiResult>

export type ReleaseIdentityMode = "probe" | "claim" | "verify-owned"

export type ReleasePublicationMode = "claim-publication" | "verify-publication" | "settle-publication"

export type ReleaseIdentityVerification =
  | { kind: "available"; tag: string; sourceSHA: string }
  | { kind: "claimed"; tag: string; sourceSHA: string }
  | { kind: "owned"; tag: string; sourceSHA: string }

export class ReleaseIdentityError extends Error {
  constructor(
    readonly code:
      | "github_api_failure"
      | "release_tag_missing_for_tag_push"
      | "release_tag_missing_for_publication"
      | "release_tag_invalid_target"
      | "release_tag_source_mismatch"
      | "release_expected_source_missing"
      | "release_expected_source_mismatch",
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "ReleaseIdentityError"
  }
}

export class ReleasePublicationError extends Error {
  constructor(
    readonly code:
      | "release_publication_invalid"
      | "release_publication_missing"
      | "release_publication_not_draft"
      | "release_publication_prerelease_mismatch"
      | "release_publication_owner_mismatch",
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = "ReleasePublicationError"
  }
}

type ReleaseIdentityInput = {
  repository: string
  version: string
  sourceSHA: string
  eventName: string
}

type ReleasePublicationInput = {
  repository: string
  version: string
  sourceSHA: string
  runID: string
  prerelease: boolean
}

export type ReleasePublicationOwnership = {
  kind: "publication-claimed" | "publication-owned" | "publication-settled"
  tag: string
  sourceSHA: string
  runID: string
}

type ReleasePublicationRecord = ReleasePublicationOwnership & {
  releaseID: number
  draft: boolean
  prerelease: boolean
}

async function runGitHubApi(args: string[]): Promise<GitHubApiResult> {
  const child = Bun.spawn(["gh", ...args], {
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { exitCode, stdout, stderr }
}

function httpStatus(result: GitHubApiResult): number | undefined {
  const match = `${result.stdout}\n${result.stderr}`.match(/^HTTP\/\S+\s+(\d{3})\b/m)
  return match ? Number(match[1]) : undefined
}

function apiFailure(endpoint: string, result: GitHubApiResult): ReleaseIdentityError {
  const status = httpStatus(result)
  return new ReleaseIdentityError(
    "github_api_failure",
    `GitHub API could not verify ${endpoint} (status=${status ?? "unavailable"}, exit=${result.exitCode})`,
    status,
  )
}

async function readObject(endpoint: string, request: GitHubApiRequest): Promise<{ type: string; sha: string }> {
  const result = await request(["api", endpoint, "--jq", '.object.type + " " + .object.sha'])
  if (result.exitCode !== 0) throw apiFailure(endpoint, result)
  const match = result.stdout.trim().match(/^([a-z]+) ([0-9a-f]{40,64})$/)
  if (!match) {
    throw new ReleaseIdentityError(
      "github_api_failure",
      `GitHub API returned an invalid Git object for ${endpoint}`,
      httpStatus(result),
    )
  }
  return { type: match[1]!, sha: match[2]! }
}

async function resolveOwnedIdentity(
  input: ReleaseIdentityInput,
  request: GitHubApiRequest,
  missingCode: "release_tag_missing_for_tag_push" | "release_tag_missing_for_publication" | undefined,
): Promise<ReleaseIdentityVerification> {
  const tag = `v${input.version}`
  const refEndpoint = `repos/${input.repository}/git/ref/tags/${tag}`
  const probe = await request(["api", "--include", "--silent", refEndpoint])
  const status = httpStatus(probe)

  if (probe.exitCode !== 0) {
    if (status === 404 && !missingCode) return { kind: "available", tag, sourceSHA: input.sourceSHA }
    if (status === 404) {
      const label = missingCode === "release_tag_missing_for_tag_push" ? "Tag-triggered" : "Publication"
      throw new ReleaseIdentityError(
        missingCode,
        `${label} release identity ${tag} is missing from ${input.repository}`,
        status,
      )
    }
    throw apiFailure(refEndpoint, probe)
  }
  if (status !== 200) throw apiFailure(refEndpoint, probe)

  let object = await readObject(refEndpoint, request)
  const visitedTags = new Set<string>()
  while (object.type === "tag") {
    if (visitedTags.has(object.sha)) {
      throw new ReleaseIdentityError("release_tag_invalid_target", `Release identity ${tag} contains a tag cycle`)
    }
    visitedTags.add(object.sha)
    object = await readObject(`repos/${input.repository}/git/tags/${object.sha}`, request)
  }
  if (object.type !== "commit") {
    throw new ReleaseIdentityError(
      "release_tag_invalid_target",
      `Release identity ${tag} resolves to ${object.type}, not a commit`,
    )
  }
  if (object.sha !== input.sourceSHA) {
    throw new ReleaseIdentityError(
      "release_tag_source_mismatch",
      `Release identity ${tag} resolves to ${object.sha}, but the build source is ${input.sourceSHA}`,
    )
  }
  return { kind: "owned", tag, sourceSHA: input.sourceSHA }
}

export async function enforceReleaseIdentity(
  mode: ReleaseIdentityMode,
  input: ReleaseIdentityInput,
  request: GitHubApiRequest = runGitHubApi,
): Promise<ReleaseIdentityVerification> {
  if (mode === "probe") {
    return resolveOwnedIdentity(
      input,
      request,
      input.eventName === "workflow_dispatch" ? undefined : "release_tag_missing_for_tag_push",
    )
  }

  if (mode === "verify-owned" || input.eventName !== "workflow_dispatch") {
    return resolveOwnedIdentity(
      input,
      request,
      mode === "verify-owned" ? "release_tag_missing_for_publication" : "release_tag_missing_for_tag_push",
    )
  }

  const tag = `v${input.version}`
  const endpoint = `repos/${input.repository}/git/refs`
  const claim = await request([
    "api",
    "--method",
    "POST",
    "--include",
    "--silent",
    endpoint,
    "-f",
    `ref=refs/tags/${tag}`,
    "-f",
    `sha=${input.sourceSHA}`,
  ])
  const status = httpStatus(claim)
  if (status !== 201 && status !== 409 && status !== 422) throw apiFailure(endpoint, claim)

  // A failed create can mean a concurrent run won the ref race. Only the canonical reread decides
  // whether that terminal state is safe; a validation response alone never grants ownership.
  const owned = await resolveOwnedIdentity(input, request, "release_tag_missing_for_publication")
  return status === 201 ? { ...owned, kind: "claimed" } : owned
}

export async function verifyReleaseIdentity(
  input: ReleaseIdentityInput,
  request: GitHubApiRequest = runGitHubApi,
): Promise<ReleaseIdentityVerification> {
  return enforceReleaseIdentity("probe", input, request)
}

export function verifyExpectedReleaseSource(input: {
  eventName: string
  sourceSHA: string
  expectedSourceSHA?: string
}): string {
  if (input.eventName !== "workflow_dispatch") return input.sourceSHA
  if (!input.expectedSourceSHA?.match(/^[0-9a-f]{40,64}$/)) {
    throw new ReleaseIdentityError(
      "release_expected_source_missing",
      "Manual release dispatch requires one canonical expected source SHA",
    )
  }
  if (input.expectedSourceSHA !== input.sourceSHA) {
    throw new ReleaseIdentityError(
      "release_expected_source_mismatch",
      `Manual release expected source ${input.expectedSourceSHA}, but the workflow checked out ${input.sourceSHA}`,
    )
  }
  return input.sourceSHA
}

function publicationReceipt(input: ReleasePublicationInput): string {
  return `<!-- opencorvus-release-owner-v1 run-id=${input.runID} source-sha=${input.sourceSHA} -->`
}

async function readPublicationOwner(
  input: ReleasePublicationInput,
  request: GitHubApiRequest,
): Promise<ReleasePublicationRecord> {
  const tag = `v${input.version}`
  let release: unknown
  let inventoryComplete = false
  for (let page = 1; page <= 100; page++) {
    const endpoint = `repos/${input.repository}/releases?per_page=100&page=${page}`
    const probe = await request(["api", "--include", "--silent", endpoint])
    const status = httpStatus(probe)
    if (probe.exitCode !== 0 || status !== 200) throw apiFailure(endpoint, probe)

    const read = await request(["api", endpoint])
    if (read.exitCode !== 0) throw apiFailure(endpoint, read)
    let inventory: unknown
    try {
      inventory = JSON.parse(read.stdout)
    } catch {
      throw new ReleasePublicationError(
        "release_publication_invalid",
        `Release inventory page ${page} returned invalid JSON`,
      )
    }
    if (!Array.isArray(inventory)) {
      throw new ReleasePublicationError(
        "release_publication_invalid",
        `Release inventory page ${page} returned a non-array authority record`,
      )
    }
    const matches = inventory.filter(
      (candidate) => typeof candidate === "object" && candidate !== null && candidate.tag_name === tag,
    )
    if (matches.length > 1 || (matches.length === 1 && release !== undefined)) {
      throw new ReleasePublicationError(
        "release_publication_invalid",
        `Release inventory contains more than one publication for ${tag}`,
      )
    }
    if (matches.length === 1) release = matches[0]
    if (inventory.length < 100) {
      inventoryComplete = true
      break
    }
  }
  if (!inventoryComplete) {
    throw new ReleasePublicationError(
      "release_publication_invalid",
      `Release inventory exceeded the bounded lookup for ${tag}`,
    )
  }
  if (release === undefined) {
    throw new ReleasePublicationError(
      "release_publication_missing",
      `Release publication ${tag} is missing from ${input.repository}`,
    )
  }
  if (
    typeof release !== "object" ||
    release === null ||
    !("tag_name" in release) ||
    release.tag_name !== tag ||
    !("draft" in release) ||
    typeof release.draft !== "boolean" ||
    !("id" in release) ||
    typeof release.id !== "number" ||
    !Number.isSafeInteger(release.id) ||
    !("prerelease" in release) ||
    typeof release.prerelease !== "boolean" ||
    !("body" in release) ||
    typeof release.body !== "string"
  ) {
    throw new ReleasePublicationError(
      "release_publication_invalid",
      `Release publication ${tag} returned an invalid authority record`,
    )
  }
  const receipts =
    release.body.match(/<!-- opencorvus-release-owner-v1 run-id=\d+ source-sha=[0-9a-f]{40,64} -->/g) ?? []
  const expected = publicationReceipt(input)
  if (receipts.length !== 1 || receipts[0] !== expected) {
    throw new ReleasePublicationError(
      "release_publication_owner_mismatch",
      `Release publication ${tag} is not owned by workflow run ${input.runID} at ${input.sourceSHA}`,
    )
  }
  if (release.prerelease !== input.prerelease) {
    throw new ReleasePublicationError(
      "release_publication_prerelease_mismatch",
      `Release publication ${tag} prerelease=${String(release.prerelease)}, expected ${String(input.prerelease)}`,
    )
  }
  return {
    kind: "publication-owned",
    tag,
    sourceSHA: input.sourceSHA,
    runID: input.runID,
    releaseID: release.id,
    draft: release.draft,
    prerelease: release.prerelease,
  }
}

async function verifyDraftPublicationOwner(
  input: ReleasePublicationInput,
  request: GitHubApiRequest,
): Promise<ReleasePublicationOwnership> {
  const record = await readPublicationOwner(input, request)
  if (!record.draft) {
    throw new ReleasePublicationError(
      "release_publication_not_draft",
      `Release publication ${record.tag} is already public and cannot accept asset writes`,
    )
  }
  const { releaseID: _, draft: __, prerelease: ___, ...owned } = record
  return owned
}

export async function enforceReleasePublication(
  mode: ReleasePublicationMode,
  input: ReleasePublicationInput,
  request: GitHubApiRequest = runGitHubApi,
): Promise<ReleasePublicationOwnership> {
  if (mode === "verify-publication") return verifyDraftPublicationOwner(input, request)

  if (mode === "settle-publication") {
    const existing = await readPublicationOwner(input, request)
    if (!existing.draft) {
      return {
        kind: "publication-settled",
        tag: existing.tag,
        sourceSHA: existing.sourceSHA,
        runID: existing.runID,
      }
    }

    const endpoint = `repos/${input.repository}/releases/${existing.releaseID}`
    const transition = await request([
      "api",
      "--method",
      "PATCH",
      "--include",
      "--silent",
      endpoint,
      "-F",
      "draft=false",
      "-F",
      `prerelease=${String(input.prerelease)}`,
    ])
    const settled = await readPublicationOwner(input, request)
    if (!settled.draft) {
      return {
        kind: "publication-settled",
        tag: settled.tag,
        sourceSHA: settled.sourceSHA,
        runID: settled.runID,
      }
    }
    if (transition.exitCode !== 0 || httpStatus(transition) !== 200) throw apiFailure(endpoint, transition)
    throw new ReleasePublicationError(
      "release_publication_invalid",
      `Release publication ${settled.tag} remained a draft after a successful public transition`,
    )
  }

  const tag = `v${input.version}`
  const endpoint = `repos/${input.repository}/releases`
  const create = await request([
    "api",
    "--method",
    "POST",
    "--include",
    "--silent",
    endpoint,
    "-f",
    `tag_name=${tag}`,
    "-f",
    `name=${tag}`,
    "-f",
    `body=${publicationReceipt(input)}`,
    "-F",
    "draft=true",
    "-F",
    `prerelease=${String(input.prerelease)}`,
    "-F",
    "generate_release_notes=true",
  ])
  const status = httpStatus(create)
  if (!((status === 201 && create.exitCode === 0) || status === 422)) throw apiFailure(endpoint, create)

  // 422 can mean an existing Release or an unrelated validation/rate failure. Only an exact,
  // still-draft owner receipt can turn that response into a safe same-run rerun.
  const owned = await verifyDraftPublicationOwner(input, request)
  return status === 201 ? { ...owned, kind: "publication-claimed" } : owned
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable ${name}`)
  return value
}

function requiredMode(): ReleaseIdentityMode | ReleasePublicationMode {
  const value = requiredEnvironment("IDENTITY_MODE")
  if (
    value === "probe" ||
    value === "claim" ||
    value === "verify-owned" ||
    value === "claim-publication" ||
    value === "verify-publication" ||
    value === "settle-publication"
  )
    return value
  throw new Error(`Invalid IDENTITY_MODE ${value}`)
}

function requiredBoolean(name: string): boolean {
  const value = requiredEnvironment(name)
  if (value === "true") return true
  if (value === "false") return false
  throw new Error(`Invalid boolean environment variable ${name}`)
}

if (import.meta.main) {
  try {
    const mode = requiredMode()
    const repository = requiredEnvironment("GITHUB_REPOSITORY")
    const version = requiredEnvironment("VERSION")
    const sourceSHA = requiredEnvironment("SOURCE_SHA")
    const eventName = requiredEnvironment("EVENT_NAME")
    verifyExpectedReleaseSource({
      eventName,
      sourceSHA,
      expectedSourceSHA: process.env.EXPECTED_SOURCE_SHA?.trim(),
    })
    const result =
      mode === "claim-publication" || mode === "verify-publication" || mode === "settle-publication"
        ? await enforceReleasePublication(mode, {
            repository,
            version,
            sourceSHA,
            runID: requiredEnvironment("RELEASE_RUN_ID"),
            prerelease: requiredBoolean("PRERELEASE"),
          })
        : await enforceReleaseIdentity(mode, {
            repository,
            version,
            sourceSHA,
            eventName,
          })
    const verb =
      result.kind === "publication-claimed"
        ? "publication was claimed by"
        : result.kind === "publication-settled"
          ? "publication was settled by"
          : result.kind === "publication-owned"
            ? "publication is owned by"
            : result.kind === "available"
              ? "is available for"
              : result.kind === "claimed"
                ? "was claimed by"
                : "is owned by"
    console.log(
      `Release identity ${result.tag} ${verb} ${"runID" in result ? `run ${result.runID} at ` : ""}${result.sourceSHA}`,
    )
  } catch (error) {
    if (error instanceof ReleaseIdentityError || error instanceof ReleasePublicationError)
      console.error(`${error.code}: ${error.message}`)
    else console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
