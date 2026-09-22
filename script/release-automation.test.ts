import { describe, expect, test } from "bun:test"
import {
  RELEASE_BUDGET_MS, RELEASE_RESULT_JOB, WEBSITE_RESULT_JOB,
  assertReleaseBudget, cancelReleaseWebsite, dispatchReleaseWebsite,
  githubActionsClient, readReleaseRun, releaseDeadline, waitForReleaseWebsite,
  watchReleaseDeadline, type ActionsRun,
} from "./release-automation"

const started = Date.parse("2026-09-21T10:00:00Z")
const source = "a".repeat(40)
const parent: ActionsRun = {
  id: 41, created_at: new Date(started).toISOString(), head_sha: source,
  path: ".github/workflows/build.yml", status: "in_progress", conclusion: null,
  html_url: "https://github.com/owner/repo/actions/runs/41",
}
const website: ActionsRun = {
  ...parent, id: 72, path: ".github/workflows/deploy-opencorvus-com.yml",
  html_url: "https://github.com/owner/repo/actions/runs/72",
}

async function withAPI(
  handle: (request: Request, route: string) => Response | Promise<Response>,
  run: (client: ReturnType<typeof githubActionsClient>) => Promise<void>,
) {
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      return handle(request, url.pathname.replace("/repos/owner/repo/", "") + url.search)
    },
  })
  const transport = ((url, options) => {
    const target = new URL(String(url))
    return fetch(new URL(target.pathname + target.search, server.url), options)
  }) as typeof fetch
  try { await run(githubActionsClient("owner/repo", "fixture-token", transport)) }
  finally { server.stop(true) }
}

describe("automatic release lifecycle", () => {
  test("dispatches the exact website run after minute 30 and joins its successful completion", async () => {
    const requests: Array<{ method: string; route: string; body?: unknown }> = []
    let reads = 0
    let now = started + 30 * 60_000
    await withAPI(async (request, route) => {
      const body = request.method === "POST" ? await request.json() : undefined
      requests.push({ method: request.method, route, ...(body === undefined ? {} : { body }) })
      expect(request.headers.get("X-GitHub-Api-Version")).toBe("2026-03-10")
      if (route === "actions/runs/41") return Response.json(parent)
      if (route.endsWith("/dispatches")) return Response.json({ workflow_run_id: 72 })
      reads += 1
      return Response.json(reads === 1 ? website : { ...website, status: "completed", conclusion: "success" })
    }, async (client) => {
      const runID = await dispatchReleaseWebsite(client, { releaseRunID: 41, sourceSHA: source, version: "0.1.10" }, now)
      expect(runID).toBe(72)
      const completed = await waitForReleaseWebsite(client, { releaseRunID: 41, websiteRunID: runID }, {
        now: () => now, sleep: async (milliseconds) => { now += milliseconds },
      })
      expect({ id: completed.id, conclusion: completed.conclusion, elapsed: now - started }).toEqual({
        id: 72, conclusion: "success", elapsed: 30 * 60_000 + 10_000,
      })
    })
    expect(requests).toEqual([
      { method: "GET", route: "actions/runs/41" },
      { method: "POST", route: "actions/workflows/deploy-opencorvus-com.yml/dispatches", body: {
        ref: "main", inputs: { deployment_mode: "daily", release_version: "0.1.10", release_source_sha: source, release_run_id: "41" },
      } },
      { method: "GET", route: "actions/runs/41" },
      { method: "GET", route: "actions/runs/72" },
      { method: "GET", route: "actions/runs/72" },
    ])
  })

  test("a rerun retains the original creation deadline and expires with an explicit error", () => {
    const deadline = releaseDeadline({ ...parent, run_attempt: 3, run_started_at: new Date(started + 25 * 60_000).toISOString() } as ActionsRun)
    expect(deadline).toBe(started + 40 * 60_000)
    expect(assertReleaseBudget(deadline, started + 30 * 60_000)).toBe(10 * 60_000)
    expect(assertReleaseBudget(deadline, started + 39 * 60_000)).toBe(60_000)
    expect(() => assertReleaseBudget(deadline, started + 40 * 60_000)).toThrow("The original release's 40-minute budget has expired")
  })

  test("a failed website conclusion becomes the parent release error", async () => {
    await withAPI((_request, route) => Response.json(route === "actions/runs/41" ? parent : {
      ...website, status: "completed", conclusion: "failure",
    }), async (client) => {
      await expect(waitForReleaseWebsite(client, { releaseRunID: 41, websiteRunID: 72 }, {
        now: () => started + 60_000, sleep: async () => {},
      })).rejects.toMatchObject({ code: "WEBSITE_DEPLOYMENT_FAILED" })
    })
  })

  test("a missing dispatch receipt produces an explicit ambiguous-outcome error", async () => {
    await withAPI((_request, route) => Response.json(route === "actions/runs/41" ? parent : {}), async (client) => {
      await expect(dispatchReleaseWebsite(client, { releaseRunID: 41, sourceSHA: source, version: "0.1.10" }, started))
        .rejects.toMatchObject({ code: "WEBSITE_DISPATCH_ID_MISSING" })
    })
  })

  test("the deadline owner cancels its current run when a job read crosses the shared limit", async () => {
    const requests: string[] = []
    let now = started + RELEASE_BUDGET_MS - 1
    await withAPI((request, route) => {
      requests.push(`${request.method} ${route}`)
      if (route === "actions/runs/41") return Response.json(parent)
      if (request.method === "POST") return new Response(null, { status: 202 })
      now += 2
      return Response.json({ jobs: [{ name: WEBSITE_RESULT_JOB, status: "queued", conclusion: null }] })
    }, async (client) => {
      await expect(watchReleaseDeadline(client, { releaseRunID: 41, currentRunID: 72, attempt: 2, resultJob: WEBSITE_RESULT_JOB }, {
        now: () => now, sleep: async (milliseconds) => { now += milliseconds },
      })).rejects.toMatchObject({ code: "RELEASE_BUDGET_EXHAUSTED" })
    })
    expect(requests).toEqual([
      "GET actions/runs/41", "GET actions/runs/41", "GET actions/runs/72/attempts/2/jobs?per_page=100&page=1", "POST actions/runs/72/cancel",
    ])
  })

  test("a delegated website observes cancellation of its exact parent", async () => {
    const writes: string[] = []
    await withAPI((request, route) => {
      if (request.method === "GET") return Response.json({ ...parent, status: "completed", conclusion: "cancelled" })
      writes.push(route)
      return new Response(null, { status: 202 })
    }, async (client) => {
      await expect(watchReleaseDeadline(client, { releaseRunID: 41, currentRunID: 72, attempt: 1, resultJob: WEBSITE_RESULT_JOB }, {
        now: () => started, sleep: async () => {},
      })).rejects.toMatchObject({ code: "RELEASE_PARENT_TERMINATED" })
    })
    expect(writes).toEqual(["actions/runs/72/cancel"])
  })

  test("the terminal result closes the deadline watcher as soon as the release settles", async () => {
    await withAPI((_request, route) => Response.json(route === "actions/runs/41" ? parent : {
      jobs: [{ name: RELEASE_RESULT_JOB, status: "completed", conclusion: "success" }],
    }), async (client) => {
      let now = started + 15 * 60_000
      await watchReleaseDeadline(client, { releaseRunID: 41, currentRunID: 41, attempt: 1, resultJob: RELEASE_RESULT_JOB }, {
        now: () => now, sleep: async (milliseconds) => { now += milliseconds },
      })
      expect({ state: "settled", elapsed: now - started }).toEqual({ state: "settled", elapsed: 15 * 60_000 })
    })
  })

  test("a failed terminal job fails the deadline owner so failed-job reruns include it", async () => {
    await withAPI((_request, route) => Response.json(route === "actions/runs/41" ? parent : {
      jobs: [{ name: RELEASE_RESULT_JOB, status: "completed", conclusion: "failure" }],
    }), async (client) => {
      await expect(watchReleaseDeadline(client, { releaseRunID: 41, currentRunID: 41, attempt: 1, resultJob: RELEASE_RESULT_JOB }, {
        now: () => started, sleep: async () => {},
      })).rejects.toMatchObject({ code: "RELEASE_RESULT_FAILED" })
    })
  })

  test("both deadline owners settle queued aggregate jobs after minute 30", async () => {
    for (const [currentRunID, resultJob] of [[41, RELEASE_RESULT_JOB], [72, WEBSITE_RESULT_JOB]] as const) {
      let now = started + 32 * 60_000
      let reads = 0
      await withAPI((_request, route) => {
        if (route === "actions/runs/41") return Response.json(parent)
        reads += 1
        return Response.json({ jobs: [{
          name: resultJob,
          status: reads === 1 ? "queued" : "completed",
          conclusion: reads === 1 ? null : "success",
        }] })
      }, async (client) => {
        const result = await watchReleaseDeadline(client, { releaseRunID: 41, currentRunID, attempt: 1, resultJob }, {
          now: () => now, sleep: async (milliseconds) => { now += milliseconds },
        })
        expect(result).toEqual({
          releaseRunID: 41, currentRunID, elapsedMs: 32 * 60_000 + 10_000, budgetMs: 40 * 60_000,
        })
      })
    }
  })

  test("release cancellation terminates the recorded website run", async () => {
    const writes: string[] = []
    await withAPI((request, route) => {
      if (request.method === "GET") return Response.json(website)
      writes.push(route)
      return new Response(null, { status: 202 })
    }, async (client) => { await cancelReleaseWebsite(client, 72) })
    expect(writes).toEqual(["actions/runs/72/cancel"])
  })

  test("API and run identity failures retain their typed error contracts", async () => {
    await withAPI((_request, route) => route.endsWith("/41") ? Response.json(website) : new Response(null, { status: 503 }), async (client) => {
      await expect(readReleaseRun(client, 41)).rejects.toMatchObject({ code: "RELEASE_RUN_ID_MISMATCH" })
      await expect(readReleaseRun(client, 99)).rejects.toMatchObject({ code: "RELEASE_API_ERROR" })
    })
  })
})
