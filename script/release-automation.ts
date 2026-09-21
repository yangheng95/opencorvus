import fs from "node:fs/promises"
import { enforceReleaseIdentity } from "./verify-release-identity"
import { normalizeReleaseVersion } from "./release-version"

export const RELEASE_BUDGET_MS = 30 * 60_000
export const RELEASE_RESULT_JOB = "release result"
export const WEBSITE_RESULT_JOB = "website result"

export class ReleaseAutomationError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`)
    this.name = "ReleaseAutomationError"
  }
}

export type ActionsRun = {
  id: number
  created_at: string
  head_sha: string
  path: string
  status: string
  conclusion: string | null
  html_url: string
}

export type ActionsClient = {
  request<T>(method: "GET" | "POST", route: string, body?: unknown): Promise<T>
}

export function githubActionsClient(repository: string, token: string, transport: typeof fetch = fetch): ActionsClient {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !token) {
    throw new ReleaseAutomationError("RELEASE_API_CONFIGURATION", "GitHub repository and token are required")
  }
  return {
    async request<T>(method: "GET" | "POST", route: string, body?: unknown): Promise<T> {
      const response = await transport(`https://api.github.com/repos/${repository}/${route}`, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        throw new ReleaseAutomationError("RELEASE_API_ERROR", `${method} ${route} returned HTTP ${response.status}`)
      }
      return (response.status === 204 || response.status === 202 ? undefined : await response.json()) as T
    },
  }
}

export function releaseDeadline(run: ActionsRun): number {
  const started = Date.parse(run.created_at)
  if (!Number.isFinite(started)) throw new ReleaseAutomationError("RELEASE_CREATED_AT_INVALID", "Original run creation time is required")
  return started + RELEASE_BUDGET_MS
}

export function assertReleaseBudget(deadline: number, now = Date.now()): number {
  const remaining = deadline - now
  if (remaining <= 0) {
    throw new ReleaseAutomationError("RELEASE_BUDGET_EXHAUSTED", "The original release's 30-minute budget has expired, including retries and website deployment")
  }
  return remaining
}

export async function readReleaseRun(client: ActionsClient, runID: number): Promise<ActionsRun> {
  if (!Number.isSafeInteger(runID) || runID <= 0) throw new ReleaseAutomationError("RELEASE_RUN_ID_INVALID", "A positive exact workflow run ID is required")
  const run = await client.request<ActionsRun>("GET", `actions/runs/${runID}`)
  if (run.id !== runID) throw new ReleaseAutomationError("RELEASE_RUN_ID_MISMATCH", "GitHub returned another workflow run")
  releaseDeadline(run)
  return run
}

export async function dispatchReleaseWebsite(
  client: ActionsClient,
  input: { releaseRunID: number; version: string; sourceSHA: string },
  now = Date.now(),
): Promise<number> {
  const parent = await readReleaseRun(client, input.releaseRunID)
  assertReleaseBudget(releaseDeadline(parent), now)
  if (parent.head_sha !== input.sourceSHA || parent.path.split("@")[0] !== ".github/workflows/build.yml") {
    throw new ReleaseAutomationError("RELEASE_PARENT_MISMATCH", "Website delegation must name its canonical release run and source")
  }
  // The existing website workflow owns its monotonic signing counter and the
  // main-only production environment. Its checkout separately verifies the
  // immutable release tag/source supplied below.
  const result = await client.request<{ workflow_run_id: number }>("POST", "actions/workflows/deploy-opencorvus-com.yml/dispatches", {
    ref: "main",
    inputs: {
      deployment_mode: "daily",
      release_version: input.version,
      release_source_sha: input.sourceSHA,
      release_run_id: String(input.releaseRunID),
    },
  })
  if (!Number.isSafeInteger(result?.workflow_run_id) || result.workflow_run_id <= 0) {
    throw new ReleaseAutomationError("WEBSITE_DISPATCH_ID_MISSING", "Dispatch response did not identify its workflow run; do not dispatch a duplicate")
  }
  return result.workflow_run_id
}

export async function cancelReleaseWebsite(client: ActionsClient, websiteRunID: number): Promise<void> {
  const run = await readReleaseRun(client, websiteRunID)
  if (run.path.split("@")[0] !== ".github/workflows/deploy-opencorvus-com.yml") {
    throw new ReleaseAutomationError("WEBSITE_RUN_MISMATCH", "Cancellation must name the dispatched website workflow")
  }
  if (run.status === "completed") return
  await client.request("POST", `actions/runs/${websiteRunID}/cancel`)
}

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export async function waitForReleaseWebsite(
  client: ActionsClient,
  input: { releaseRunID: number; websiteRunID: number },
  clock = { now: Date.now, sleep },
): Promise<ActionsRun> {
  const deadline = releaseDeadline(await readReleaseRun(client, input.releaseRunID))
  for (;;) {
    assertReleaseBudget(deadline, clock.now())
    const run = await readReleaseRun(client, input.websiteRunID)
    if (run.path.split("@")[0] !== ".github/workflows/deploy-opencorvus-com.yml") {
      throw new ReleaseAutomationError("WEBSITE_RUN_MISMATCH", "Dispatched run does not execute the website workflow")
    }
    if (run.status === "completed") {
      assertReleaseBudget(deadline, clock.now())
      if (run.conclusion !== "success") {
        throw new ReleaseAutomationError("WEBSITE_DEPLOYMENT_FAILED", `Website run ${run.id} concluded ${run.conclusion ?? "unknown"}`)
      }
      return run
    }
    await clock.sleep(Math.min(10_000, assertReleaseBudget(deadline, clock.now())))
  }
}

export async function watchReleaseDeadline(
  client: ActionsClient,
  input: { releaseRunID: number; currentRunID: number; attempt: number; resultJob: string },
  clock = { now: Date.now, sleep },
): Promise<{ releaseRunID: number; currentRunID: number; elapsedMs: number; budgetMs: number }> {
  const deadline = releaseDeadline(await readReleaseRun(client, input.releaseRunID))
  for (;;) {
    if (clock.now() >= deadline) {
      await client.request("POST", `actions/runs/${input.currentRunID}/cancel`)
      throw new ReleaseAutomationError("RELEASE_BUDGET_EXHAUSTED", `Cancelled workflow ${input.currentRunID} at the original release deadline`)
    }
    if (input.currentRunID !== input.releaseRunID) {
      const parent = await readReleaseRun(client, input.releaseRunID)
      if (parent.status === "completed" && parent.conclusion !== "success") {
        await client.request("POST", `actions/runs/${input.currentRunID}/cancel`)
        throw new ReleaseAutomationError("RELEASE_PARENT_TERMINATED", `Parent release concluded ${parent.conclusion ?? "unknown"}`)
      }
    }
    let terminal: { name: string; status: string; conclusion: string | null } | undefined
    for (let page = 1; ; page += 1) {
      const result = await client.request<{ jobs: Array<{ name: string; status: string; conclusion: string | null }> }>(
        "GET", `actions/runs/${input.currentRunID}/attempts/${input.attempt}/jobs?per_page=100&page=${page}`,
      )
      terminal = result.jobs.find((job) => job.name === input.resultJob)
      if (terminal || result.jobs.length < 100) break
    }
    if (terminal?.status === "completed") {
      assertReleaseBudget(deadline, clock.now())
      if (terminal.conclusion !== "success") {
        throw new ReleaseAutomationError("RELEASE_RESULT_FAILED", `${input.resultJob} concluded ${terminal.conclusion ?? "unknown"}`)
      }
      return { releaseRunID: input.releaseRunID, currentRunID: input.currentRunID, elapsedMs: clock.now() - (deadline - RELEASE_BUDGET_MS), budgetMs: RELEASE_BUDGET_MS }
    }
    // If the API read crossed the deadline, return to the cancellation owner
    // instead of throwing before that owner can terminate the run.
    await clock.sleep(Math.max(0, Math.min(10_000, deadline - clock.now())))
  }
}

async function main() {
  const client = githubActionsClient(process.env.GITHUB_REPOSITORY ?? "", process.env.GH_TOKEN ?? "")
  const releaseRunID = Number(process.env.RELEASE_RUN_ID || process.env.GITHUB_RUN_ID)
  const command = process.argv[2]
  if (command === "check") {
    const run = await readReleaseRun(client, releaseRunID)
    const remaining = assertReleaseBudget(releaseDeadline(run))
    console.log(`Release ${releaseRunID}: ${Math.ceil(remaining / 1000)} seconds remain in the original 30-minute budget`)
  } else if (command === "dispatch-website") {
    if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required for the exact website run receipt")
    const runID = await dispatchReleaseWebsite(client, { releaseRunID, version: process.env.VERSION ?? "", sourceSHA: process.env.SOURCE_SHA ?? "" })
    await fs.appendFile(process.env.GITHUB_OUTPUT, `run-id=${runID}\n`)
    const url = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${runID}`
    console.log(`Website workflow: ${url}`)
    if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `Website deployment: [run ${runID}](${url})\n`)
  } else if (command === "wait-website") {
    const run = await waitForReleaseWebsite(client, { releaseRunID, websiteRunID: Number(process.env.WEBSITE_RUN_ID) })
    console.log(`Website run ${run.id} completed successfully within the release budget`)
  } else if (command === "cancel-website") {
    await cancelReleaseWebsite(client, Number(process.env.WEBSITE_RUN_ID))
  } else if (command === "website-source") {
    const version = process.env.VERSION ?? ""
    const requestedSource = process.env.SOURCE_SHA ?? ""
    const parentID = process.env.RELEASE_RUN_ID ?? ""
    let source = process.env.EVENT_SHA ?? ""
    if (version || requestedSource || parentID) {
      if (!version || !requestedSource || !parentID || normalizeReleaseVersion(version) !== version) {
        throw new ReleaseAutomationError("WEBSITE_RELEASE_INPUT_INVALID", "Release version, source and parent run must be supplied together in canonical form")
      }
      const parent = await readReleaseRun(client, Number(parentID))
      assertReleaseBudget(releaseDeadline(parent))
      if (parent.head_sha !== requestedSource || parent.path.split("@")[0] !== ".github/workflows/build.yml") {
        throw new ReleaseAutomationError("RELEASE_PARENT_MISMATCH", "Website release source differs from its canonical parent run")
      }
      await enforceReleaseIdentity("verify-owned", { repository: process.env.GITHUB_REPOSITORY!, version, sourceSHA: requestedSource, eventName: "workflow_dispatch" })
      source = requestedSource
    }
    if (!/^[a-f0-9]{40}$/.test(source) || !process.env.GITHUB_OUTPUT) {
      throw new ReleaseAutomationError("WEBSITE_SOURCE_INVALID", "An exact source SHA and GitHub output file are required")
    }
    await fs.appendFile(process.env.GITHUB_OUTPUT, `source-sha=${source}\n`)
    console.log(`Resolved immutable website source ${source}`)
  } else if (command === "watch-release" || command === "watch-website") {
    const timing = await watchReleaseDeadline(client, {
      releaseRunID,
      currentRunID: Number(process.env.GITHUB_RUN_ID),
      attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      resultJob: command === "watch-release" ? RELEASE_RESULT_JOB : WEBSITE_RESULT_JOB,
    })
    console.log(JSON.stringify(timing))
    if (process.env.GITHUB_STEP_SUMMARY) {
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `Completed in ${(timing.elapsedMs / 60_000).toFixed(2)} minutes of the original 30-minute release budget (run ${timing.releaseRunID}).\n`)
    }
  } else {
    throw new Error("Expected check, website-source, dispatch-website, wait-website, cancel-website, watch-release, or watch-website")
  }
}

if (import.meta.main) await main()
