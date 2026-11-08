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
import { SkillMarketTool } from "@/tool/skill-market"
import { Tool } from "@/tool/tool"

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

function marketToolContext(): Tool.Context {
  return {
    sessionID: "market-tool-contract-session",
    messageID: "market-tool-contract-message",
    agent: "market-tool-contract",
    abort: new AbortController().signal,
    messages: [],
    executionSurface: Tool.executionSurface([SkillMarketTool.id], []),
    extra: { projectID: "market-tool-contract-project" },
    metadata() {},
  }
}

function marketFixture(input: {
  id: string
  name: string
  downloadFiles?: (download: number, skill: string) => Array<{ path: string; contents: string }>
  extraSearchSkills?: Array<{ id: string; skillId: string; name: string; installs: number; source: string }>
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
          ...(input.extraSearchSkills ?? []),
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
  test.each([
    ["identity", { source: "owner/repository", skillId: "skill", name: "Skill", installs: 7 }],
    ["install count", { id: "owner/repository/skill", source: "owner/repository", skillId: "skill", name: "Skill" }],
  ] as const)("source-aware search reports an upstream %s contract error for a malformed record", async (_field, record) => {
    globalThis.fetch = (async () => Response.json({ skills: [record] })) as typeof fetch
    await expect(SkillMarket.search({ query: "identity", limit: 5 })).rejects.toMatchObject({
      name: "SkillMarketUpstreamError",
      data: {
        operation: "search",
        endpoint: "https://skills.sh/api/search",
        message: "Skill Market search returned an invalid response.",
      },
    })
  })

  test("source-aware identity preserves website slugs and canonical repository identities", () => {
    expect(SkillMarket.identity("Owner/Repo/Skill")).toEqual({
      source_type: "github", id: "owner/repo/skill", source: "owner/repo", owner: "owner", repository: "repo", skillID: "skill",
    })
    for (const [host, skillID] of [["Docs.Example", "Portal"], ["con.example", "NUL"]]) {
      expect(SkillMarket.identity(`${host}/${skillID}`)).toEqual({
        source_type: "well-known", id: `${host}/${skillID}`, source: host, skillID,
      })
    }
  })

  test.each(["service", "project", "global", "tool"] as const)("source-aware search preserves mixed candidates through %s", async (surface) => {
    const id = "opencorvus-tests/market-fixtures/mixed-source"
    marketFixture({
      id, name: "mixed-source",
      extraSearchSkills: [
        { id: "docs.example/Portal", source: "docs.example", skillId: "Portal", name: "Portal", installs: 12345 },
        { id: "other-owner/catalog/zero", source: "other-owner/catalog", skillId: "zero", name: "Zero", installs: 0 },
      ],
    })
    let results: unknown
    if (surface === "service") results = await SkillManager.searchMarket({ query: "mixed", limit: 5 })
    else if (surface === "tool") {
      const tool = await SkillMarketTool.init()
      const result = await tool.execute({ action: "search", query: "mixed", limit: 5 }, marketToolContext())
      expect(result.metadata).toMatchObject({ action: "search", query: "mixed", count: 3 })
      results = JSON.parse(result.output).results
    } else {
      const app = new Hono().route("/skill", SkillRoutes()).route("/global", GlobalRoutes()).onError(serverErrorResponse)
      const prefix = surface === "project" ? "/skill" : "/global/skill"
      const response = await app.request(`${prefix}/market/search?query=mixed&limit=5`)
      expect(response.status).toBe(200)
      results = await response.json()
    }
    expect(results).toEqual([
      { id, source_type: "github", skill_id: "mixed-source", name: "mixed-source", source: "opencorvus-tests/market-fixtures", installs: 42, homepage: `https://skills.sh/${id}`, repository: "https://github.com/opencorvus-tests/market-fixtures", installed: false },
      { id: "docs.example/Portal", source_type: "well-known", skill_id: "Portal", name: "Portal", source: "docs.example", installs: 12345, homepage: "https://skills.sh/docs.example/Portal", installed: false },
      { id: "other-owner/catalog/zero", source_type: "github", skill_id: "zero", name: "Zero", source: "other-owner/catalog", installs: 0, homepage: "https://skills.sh/other-owner/catalog/zero", repository: "https://github.com/other-owner/catalog", installed: false },
    ])
  })

  for (const action of ["inspect", "install"] as const) {
    test.each(["service", "project", "global", "tool"] as const)(`source-aware ${action} publishes the website source contract through %s`, async (surface) => {
      const id = "opencorvus-tests/market-fixtures/source-input"
      const webID = "docs.example/Portal"
      marketFixture({ id, name: "source-input" })
      const inspected = await SkillManager.inspectMarket({ id })
      const input = action === "inspect"
        ? { action, id: webID }
        : { action, id: webID, expected_hash: inspected.hash, policy: "deny" as const }
      const expected = {
        name: "SkillMarketSourceUnavailableError",
        data: { id: webID, source: "docs.example", source_type: "well-known", message: "This Skill Market source supports catalog listings only." },
      }
      if (surface === "service") {
        const operation = action === "inspect"
          ? SkillManager.inspectMarket({ id: webID })
          : SkillManager.installMarket({ id: webID, expected_hash: inspected.hash, policy: "deny" })
        await expect(operation).rejects.toMatchObject(expected)
      } else if (surface === "tool") {
        const tool = await SkillMarketTool.init()
        await expect(tool.execute(input, marketToolContext())).rejects.toMatchObject(expected)
      } else {
        const app = new Hono().route("/skill", SkillRoutes()).route("/global", GlobalRoutes()).onError(serverErrorResponse)
        const prefix = surface === "project" ? "/skill" : "/global/skill"
        const response = action === "inspect"
          ? await app.request(`${prefix}/market/detail?id=${encodeURIComponent(webID)}`)
          : await app.request(`${prefix}/market/install`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: webID, expected_hash: inspected.hash, policy: "deny" }) })
        expect({ status: response.status, body: await response.json() }).toEqual({ status: 400, body: expected })
      }
    })
  }

  test.each(["service", "project"] as const)("source-aware removal publishes the catalog-only source contract through %s", async (surface) => {
    const input = { source: "docs.example/Portal", kind: "market" as const }
    const expected = {
      name: "SkillMarketSourceUnavailableError",
      data: { id: input.source, source: "docs.example", source_type: "well-known", message: "This Skill Market source supports catalog listings only." },
    }
    if (surface === "service") {
      await expect(SkillManager.remove(input)).rejects.toMatchObject(expected)
      return
    }
    const app = new Hono().route("/skill", SkillRoutes()).onError(serverErrorResponse)
    const response = await app.request("/skill/remove", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 400, body: expected })
  })

  test.each(["search", "inspect", "install"] as const)("executes the runtime market %s action through its strict service contract", async (action) => {
    const id = `opencorvus-tests/market-fixtures/tool-${action}-${crypto.randomUUID()}`
    const name = `market-tool-${action}-${crypto.randomUUID()}`
    marketFixture({ id, name })
    const before = await Config.getGlobal()
    let installedPath = ""
    try {
      const tool = await SkillMarketTool.init()
      const context = marketToolContext()
      if (action === "search") {
        const result = await tool.execute({ action, query: "  exact  ", limit: 5 }, context)
        expect(result.metadata).toMatchObject({ action, query: "exact", count: 1 })
        expect(JSON.parse(result.output).results).toEqual([
          {
            id,
            source_type: "github",
            skill_id: id.split("/")[2],
            name,
            source: "opencorvus-tests/market-fixtures",
            installs: 42,
            homepage: `https://skills.sh/${id}`,
            repository: "https://github.com/opencorvus-tests/market-fixtures",
            installed: false,
          },
        ])
        return
      }
      const inspected = await SkillManager.inspectMarket({ id })
      if (action === "inspect") {
        const result = await tool.execute({ action, id }, context)
        expect(result.metadata).toMatchObject({ action, id, hash: inspected.hash, risk: "medium", count: 1 })
        expect(JSON.parse(result.output)).toEqual(inspected)
        return
      }
      const result = await tool.execute({ action, id, expected_hash: inspected.hash, policy: "deny" }, context)
      const installed = JSON.parse(result.output) as { path: string }
      installedPath = installed.path
      expect(result.metadata).toMatchObject({ action, id, hash: inspected.hash, available: "next_turn", count: 1 })
      expect(installed).toMatchObject({ id, name, hash: inspected.hash, policy: "deny", available: "next_turn" })
      expect(JSON.parse(await readFile(path.join(installedPath, ".opencorvus-skill-source.json"), "utf8"))).toMatchObject({
        kind: "market",
        market_id: id,
        hash: inspected.hash,
        source: "https://github.com/opencorvus-tests/market-fixtures",
      })
      expect(await readFile(path.join(installedPath, "references/guide.md"), "utf8")).toBe(
        "# Reviewed guide\n\nUse exact evidence.\n",
      )
    } finally {
      if (installedPath) {
        const relative = path.relative(SkillManager.managedRoot(), path.resolve(installedPath))
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
          throw new Error(`Market fixture target escaped the isolated managed root: ${installedPath}`)
        }
        await SkillManager.remove({ source: id, kind: "market" })
      }
      await Config.writeGlobal(before)
      await SkillManager.refreshDiscoveryState()
      await Instance.disposeAll()
    }
  })

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
          source_type: "github",
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
