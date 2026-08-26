import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Hono } from "hono"
import { Config } from "@/config/config"
import { SkillManager } from "@/skill/manager"
import { SkillRoutes } from "@/server/routes/skill"
import { GlobalRoutes } from "@/server/routes/global"
import { Instance } from "@/project/instance"
import { SkillMarket } from "@/skill/market"
import { serverErrorResponse } from "@/server/error-handler"

const originalFetch = globalThis.fetch
const temporaryProjectDirectories: string[] = []

afterAll(async () => {
  await Instance.disposeAll()
  for (const directory of temporaryProjectDirectories) {
    await rm(directory, { recursive: true, force: true })
  }
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  await Instance.disposeAll()
})

function marketFixture(input: {
  id: string
  name: string
  downloadFiles?: (download: number, skill: string) => Array<{ path: string; contents: string }>
}) {
  const [owner, repository, skillID] = input.id.split("/")
  const skill = [
    "---",
    `name: ${input.name}`,
    "description: Exact Skill Market installation fixture",
    "---",
    "",
    `# ${input.name}`,
    "",
    "Read references/guide.md before acting.",
  ].join("\n")
  let downloads = 0
  globalThis.fetch = (async (request) => {
    const url = new URL(typeof request === "string" ? request : request.toString())
    if (url.pathname === "/api/search") {
      return Response.json({
        query: url.searchParams.get("q"),
        skills: [
          {
            id: input.id,
            skillId: skillID,
            name: input.name,
            installs: 42,
            source: `${owner}/${repository}`,
          },
        ],
      })
    }
    if (url.pathname === `/api/download/${owner}/${repository}/${skillID}`) {
      downloads += 1
      return Response.json({
        hash: "upstream-fixture-hash",
        files: input.downloadFiles?.(downloads, skill) ?? [
          { path: "SKILL.md", contents: skill },
          { path: "references/guide.md", contents: "# Reviewed guide\n\nUse exact evidence.\n" },
        ],
      })
    }
    return new Response("not found", { status: 404 })
  }) as typeof fetch
  return { downloads: () => downloads }
}

describe.serial("Skill Market authority", () => {
  test("searches, inspects, hash-pins, installs, and projects one exact skills.sh candidate through public routes", async () => {
    const id = `opencorvus-tests/market-fixtures/exact-${crypto.randomUUID()}`
    const name = `market-exact-${crypto.randomUUID()}`
    marketFixture({ id, name })
    const before = await Config.getGlobal()
    let installedPath = ""
    const projectDirectory = await mkdtemp(path.join(tmpdir(), "opencorvus-skill-market-test-"))
    temporaryProjectDirectories.push(projectDirectory)
    try {
      const providers = await SkillManager.market()
      expect(providers).toEqual([
        {
          id: "skills-sh",
          name: "skills.sh",
          provider: "skills.sh",
          description: expect.stringContaining("content-hashed"),
          homepage: "https://skills.sh",
          api_origin: "https://skills.sh",
          searchable: true,
          exact_install: true,
          trust: "curated",
          recommended_policy: "deny",
        },
      ])

      const app = new Hono().route("/skill", SkillRoutes()).route("/global", GlobalRoutes())
      const [projectProviderResponse, globalProviderResponse, searchResponse] = await Promise.all([
        app.request("/skill/market"),
        app.request("/global/skill/market"),
        app.request("/global/skill/market/search?query=exact&limit=5"),
      ])
      expect(projectProviderResponse.status).toBe(200)
      expect(globalProviderResponse.status).toBe(200)
      expect(await projectProviderResponse.json()).toEqual(providers)
      expect(await globalProviderResponse.json()).toEqual(providers)
      expect(await searchResponse.json()).toEqual([
        {
          id,
          skill_id: id.split("/")[2],
          name,
          source: "opencorvus-tests/market-fixtures",
          installs: 42,
          homepage: `https://skills.sh/${id}`,
          repository: "https://github.com/opencorvus-tests/market-fixtures",
          installed: false,
        },
      ])

      const detailResponse = await app.request(`/skill/market/detail?id=${encodeURIComponent(id)}`)
      expect(detailResponse.status).toBe(200)
      const detail = (await detailResponse.json()) as { hash: string; risk: { level: string }; files: unknown[] }
      const inspectedHash = detail.hash
      expect(detail).toMatchObject({
        id,
        name,
        description: "Exact Skill Market installation fixture",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        upstream_hash: "upstream-fixture-hash",
        trust: "unknown",
        risk: { level: "medium", has_references: true },
        recommended_policy: "deny",
        installed: false,
      })
      expect(detail.files).toHaveLength(2)

      const installResponse = await app.request("/global/skill/market/install", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, expected_hash: inspectedHash, policy: "allow" }),
      })
      if (installResponse.status !== 200) {
        throw new Error(
          `Skill Market install route returned ${installResponse.status}: ${await installResponse.text()}`,
        )
      }
      const installed = (await installResponse.json()) as { path: string }
      installedPath = installed.path
      expect(installed).toMatchObject({
        id,
        name,
        source: "https://github.com/opencorvus-tests/market-fixtures",
        hash: inspectedHash,
        policy: "allow",
        available: "next_turn",
      })

      const inventory = await Instance.provide({
        directory: projectDirectory,
        fn: async () => (await SkillManager.installed()).find((item) => item.name === name),
      })
      expect(inventory).toMatchObject({
        name,
        source_type: "managed_market",
        source: id,
        market_id: id,
        market_hash: inspectedHash,
        trust: "unknown",
        policy: "allow",
        managed: true,
      })
      expect(
        JSON.parse(await readFile(path.join(installedPath, ".opencorvus-skill-source.json"), "utf8")),
      ).toMatchObject({
        kind: "market",
        market_id: id,
        hash: inspectedHash,
        source: "https://github.com/opencorvus-tests/market-fixtures",
      })

      const installedSearch = await app.request("/skill/market/search?query=exact")
      expect(await installedSearch.json()).toEqual([expect.objectContaining({ id, installed: true })])
      await SkillManager.remove({ source: id, kind: "market" })
      installedPath = ""
    } finally {
      await Config.writeGlobal(before)
      await SkillManager.refreshDiscoveryState()
      if (installedPath) await rm(installedPath, { recursive: true, force: true })
      await Instance.disposeAll()
    }
  })

  test("reports the first and newly downloaded digests when a candidate changes before install", async () => {
    const id = `opencorvus-tests/market-fixtures/changed-${crypto.randomUUID()}`
    const name = `market-changed-${crypto.randomUUID()}`
    const before = await Config.getGlobal()
    const fixture = marketFixture({
      id,
      name,
      downloadFiles: (download, skill) => [
        { path: "SKILL.md", contents: skill },
        {
          path: "references/guide.md",
          contents: download === 1 ? "# First inspected content\n" : "# Changed before install\n",
        },
      ],
    })
    try {
      const inspected = await SkillManager.inspectMarket({ id })
      let installError: Error | undefined
      try {
        await SkillManager.installMarket({ id, expected_hash: inspected.hash })
      } catch (error) {
        installError = error instanceof Error ? error : new Error(String(error))
      }
      const current = await SkillManager.inspectMarket({ id })
      expect({
        downloads: fixture.downloads(),
        inspectedHash: inspected.hash,
        currentHash: current.hash,
        contentChanged: inspected.hash !== current.hash,
        message: installError?.message,
        globalConfig: await Config.getGlobal(),
      }).toEqual({
        downloads: 3,
        inspectedHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        currentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        contentChanged: true,
        message: `Skill Market bundle changed after inspection: expected ${inspected.hash}, received ${current.hash}`,
        globalConfig: before,
      })
    } finally {
      await Config.writeGlobal(before)
      await SkillManager.refreshDiscoveryState()
    }
  })

  test("keeps colliding legacy slugs as distinct canonical identities and guards target ownership", async () => {
    const suffix = crypto.randomUUID()
    const firstID = `collision/a-b/skill-${suffix}`
    const secondID = `collision-a/b/skill-${suffix}`
    const firstName = `collision-first-${suffix}`
    const secondName = `collision-second-${suffix}`
    const before = await Config.getGlobal()
    const installed: Array<{ id: string; path: string }> = []
    try {
      for (const [id, name] of [
        [firstID, firstName],
        [secondID, secondName],
      ] as const) {
        marketFixture({ id, name })
        const detail = await SkillManager.inspectMarket({ id })
        installed.push(await SkillManager.installMarket({ id, expected_hash: detail.hash, policy: "deny" }))
      }
      const projectDirectory = await mkdtemp(path.join(tmpdir(), "opencorvus-skill-market-collision-"))
      temporaryProjectDirectories.push(projectDirectory)
      try {
        const inventory = await Instance.provide({
          directory: projectDirectory,
          fn: async () =>
            (await SkillManager.installed())
              .filter((item) => item.market_id === firstID || item.market_id === secondID)
              .map((item) => ({ id: item.market_id, name: item.name }))
              .sort((left, right) => left.id!.localeCompare(right.id!)),
        })
        expect({
          canonical: SkillMarket.identity("COLLISION/A-B/SKILL").id,
          distinctPaths: installed[0]!.path !== installed[1]!.path,
          inventory,
        }).toEqual({
          canonical: "collision/a-b/skill",
          distinctPaths: true,
          inventory: [
            { id: firstID, name: firstName },
            { id: secondID, name: secondName },
          ].sort((left, right) => left.id.localeCompare(right.id)),
        })

        const manifestPath = path.join(installed[0]!.path, ".opencorvus-skill-source.json")
        const originalManifest = await readFile(manifestPath, "utf8")
        await writeFile(
          manifestPath,
          `${JSON.stringify({ ...JSON.parse(originalManifest), market_id: secondID }, null, 2)}\n`,
        )
        await expect(SkillManager.remove({ source: firstID, kind: "market" })).rejects.toThrow(
          `Skill Market target ownership mismatch: expected ${firstID}, received ${secondID}`,
        )
        await writeFile(manifestPath, originalManifest)
      } finally {
        await Instance.disposeAll()
      }
    } finally {
      for (const item of installed) {
        await SkillManager.remove({ source: item.id, kind: "market" }).catch(() => undefined)
        await rm(item.path, { recursive: true, force: true })
      }
      await Config.writeGlobal(before)
      await SkillManager.refreshDiscoveryState()
    }
  })

  test("maps unsafe upstream bundle paths and offline search to the public upstream error contract", async () => {
    expect(
      ["owner/repo/skill.", "owner/nul/skill", "con/repo/skill"].map(
        (identity) => SkillMarket.Identity.safeParse(identity).error?.issues[0]?.message,
      ),
    ).toEqual([
      "Skill Market identity segments must be portable directory names",
      "Skill Market identity segments must be portable directory names",
      "Skill Market identity segments must be portable directory names",
    ])

    const id = `opencorvus-tests/market-fixtures/unsafe-${crypto.randomUUID()}`
    for (const unsafePath of ["/SKILL.md", "\\\\server\\share\\SKILL.md", "NUL/SKILL.md", "SKILL.md."]) {
      marketFixture({
        id,
        name: `market-unsafe-${crypto.randomUUID()}`,
        downloadFiles: (_download, skill) => [{ path: unsafePath, contents: skill }],
      })
      await expect(SkillManager.inspectMarket({ id })).rejects.toMatchObject({
        name: "SkillMarketUpstreamError",
        data: {
          operation: "download",
          endpoint: expect.stringContaining("/api/download/"),
          message: "Skill Market download returned an invalid response.",
        },
      })
    }

    const malformedID = `opencorvus-tests/market-fixtures/malformed-${crypto.randomUUID()}`
    marketFixture({
      id: malformedID,
      name: `market-malformed-${crypto.randomUUID()}`,
      downloadFiles: () => [
        {
          path: "SKILL.md",
          contents: "---\ndescription: Missing required name\n---\n\n# Invalid external Skill\n",
        },
      ],
    })
    const app = new Hono().route("/skill", SkillRoutes()).route("/global", GlobalRoutes()).onError(serverErrorResponse)
    const malformedPath = `market/detail?id=${encodeURIComponent(malformedID)}`
    const [projectMalformed, globalMalformed] = await Promise.all([
      app.request(`/skill/${malformedPath}`),
      app.request(`/global/skill/${malformedPath}`),
    ])
    const malformedBody = {
      name: "SkillMarketUpstreamError",
      data: {
        operation: "download",
        endpoint: expect.stringContaining("/api/download/"),
        message: "Skill Market download returned an invalid Skill bundle.",
      },
    }
    expect({
      project: { status: projectMalformed.status, body: await projectMalformed.json() },
      global: { status: globalMalformed.status, body: await globalMalformed.json() },
    }).toEqual({
      project: { status: 502, body: malformedBody },
      global: { status: 502, body: malformedBody },
    })

    globalThis.fetch = (async () => {
      throw new Error("offline fixture")
    }) as typeof fetch
    const [projectResponse, globalResponse] = await Promise.all([
      app.request("/skill/market/search?query=offline"),
      app.request("/global/skill/market/search?query=offline"),
    ])
    expect({
      project: { status: projectResponse.status, body: await projectResponse.json() },
      global: { status: globalResponse.status, body: await globalResponse.json() },
    }).toEqual({
      project: {
        status: 502,
        body: {
          name: "SkillMarketUpstreamError",
          data: {
            operation: "search",
            endpoint: "https://skills.sh/api/search",
            message: "Skill Market search request failed.",
          },
        },
      },
      global: {
        status: 502,
        body: {
          name: "SkillMarketUpstreamError",
          data: {
            operation: "search",
            endpoint: "https://skills.sh/api/search",
            message: "Skill Market search request failed.",
          },
        },
      },
    })
  })
})
