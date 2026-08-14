import { describe, expect, spyOn, test } from "bun:test"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { memoryProject } from "../fixture/memory"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import path from "node:path"
import { Filesystem } from "../../src/util/filesystem"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { mkdir, realpath, rm, writeFile } from "node:fs/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Hono } from "hono"
import { ExpertSquadRoutes } from "../../src/server/routes/expert-squad"
import { ensureMissionSession } from "../../src/mission/session"
import { CapabilitySearchTool } from "../../src/tool/capability-search"
import { Tool } from "../../src/tool/tool"
import { payloadPackageSources } from "../../generated/expert-squad-payload"

function scalePackageDefinition(id: string): ExpertSquadPackageDefinition {
  const emptyResources = {
    inherit_base_tools: false,
    built_in_tool_ids: [] as string[],
    default_skill_refs: [] as string[],
    package_skill_refs: [] as string[],
    default_tool_refs: [] as string[],
    package_tool_refs: [] as string[],
    default_mcp_server_refs: [] as string[],
    package_mcp_server_refs: [] as string[],
    default_mcp_tool_refs: [] as string[],
    package_mcp_tool_refs: [] as string[],
    default_mcp_prompt_refs: [] as string[],
    package_mcp_prompt_refs: [] as string[],
    default_mcp_resource_refs: [] as string[],
    package_mcp_resource_refs: [] as string[],
  }
  return {
    manifest: {
      schema_version: 1,
      namespace: "scale",
      id,
      label: `Scale ${id}`,
      description: `Bounded catalog fixture ${id}.`,
      version: "2026.08.10.1",
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: `Select ${id} for bounded catalog verification.`,
        selection_guidance: `Use ${id} only for bounded catalog verification.`,
        instructions: "selector.md",
      },
      capability_projection: {
        scheduler: { ...emptyResources, base_role: "orchestrator" },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${id}\n`, "selector.md": `# ${id} selector\n` },
  }
}

async function catalogProject() {
  const testRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!testRoot) throw new Error("Catalog tests require the repository test preload")
  const directory = await createManagedTemporaryDirectory(path.join(testRoot, "fixtures"), "catalog-")
  return {
    path: await realpath(directory),
    async [Symbol.asyncDispose]() {
      await ExpertSquadRegistry.invalidateAvailable()
      await removeManagedDirectoryTree(directory)
    },
  }
}

describe("Expert Squad catalog index", () => {
  test("uses a bounded declaration index plus exact Mission inspection", async () => {
    await using project = await catalogProject()
    const settings = await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, limit: 20 })
    const recommendations = await PromptProfileResolver.recommendationCatalog({
      projectDirectory: project.path,
      productPillar: "code",
    })
    const emptyRecommendations = await PromptProfileResolver.recommendationCatalog({
      projectDirectory: project.path,
      productPillar: "code",
      restrictToExpertSquadIDs: [],
    })

    expect(settings.entries.filter((squad) => squad.built_in).map((squad) => squad.id)).toEqual([
      "advanced",
      "base",
      "research-studio",
      "squad-sdk",
    ])
    expect(emptyRecommendations).toEqual([])
    expect(settings.entries.find((squad) => squad.id === "base")).toMatchObject({
      id: "base",
      name: "Base",
      display_label: "Base",
      built_in: true,
      product_pillars: ["code", "work"],
      source: { kind: "built_in" },
    })
    expect(recommendations.find((squad) => squad.id === "base")).toMatchObject({
      id: "base",
      name: "Base",
      source: { kind: "built_in" },
    })
    const inspection = await PromptProfileResolver.catalogInspection({ projectDirectory: project.path, id: "base" })
    expect(inspection).toMatchObject({
      id: "base",
      version: "2026.08.13.1",
      selector: {
        summary: expect.any(String),
        selection_guidance: expect.any(String),
      },
      workflows: [{ id: "planner-parallel-delivery", node_count: 4 }],
      workflow_count: 1,
      next_workflow_cursor: null,
    })
  }, 0)

  test("loads one exact full detail for a selected index identity", async () => {
    await using project = await catalogProject()
    const detail = await PromptProfileResolver.settingsDetail({
      projectDirectory: project.path,
      id: "base",
      installationScope: "built_in",
    })

    expect(detail?.id).toBe("base")
    expect(detail?.name).toBe("Base")
    expect(detail?.source).toEqual({ kind: "built_in" })
    expect(detail?.readme.content).toContain("# Base")
    expect(detail?.selector.instructions).toContain("# Base Expert Squad")
    expect(detail?.capability_projection.scheduler.base_role).toBe("orchestrator")
    expect(
      Object.fromEntries(
        Object.entries(detail?.capability_projection.agents ?? {}).map(([id, projection]) => [
          id,
          projection.base_role,
        ]),
      ),
    ).toEqual({
      "base-developer": "build",
      "base-planner": "delegated-worker",
      "base-researcher": "explore",
      "base-tester": "delegated-worker",
    })
  }, 0)

  test("preserves the integrity review execution contract in selected catalog detail", async () => {
    await using project = await catalogProject()
    const detail = await PromptProfileResolver.settingsDetail({
      projectDirectory: project.path,
      id: "advanced",
      installationScope: "built_in",
    })

    expect(detail?.capability_projection.agents["system-integrity-reviewer"]).toMatchObject({
      base_role: "integrity",
      execution_contract: "platform_integrity_review",
    })
  }, 0)

  test("reads full package bodies only for the exact selected installed identity", async () => {
    await using project = await catalogProject()
    const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
    for (const id of ["selected-detail", "unselected-detail"]) {
      await writeExpertSquadPackage({
        directory: path.join(root, "scale", id),
        definition: scalePackageDefinition(id),
      })
    }
    const exactLoad = spyOn(ExpertSquadRegistry, "loadInstalledCatalogPackage")
    try {
      const detail = await PromptProfileResolver.settingsDetail({
        projectDirectory: project.path,
        id: "selected-detail",
        installationScope: "project",
        namespace: "scale",
      })
      expect(detail).toMatchObject({
        id: "selected-detail",
        source: { kind: "installed_package", installation_scope: "project", namespace: "scale" },
      })
      expect(exactLoad.mock.calls.map(([input]) => input)).toEqual([
        {
          projectDirectory: project.path,
          id: "selected-detail",
          installationScope: "project",
          namespace: "scale",
        },
      ])
    } finally {
      exactLoad.mockRestore()
    }
  }, 0)

  test("pages a hundred installed declarations through one bounded cursor contract", async () => {
    await using project = await catalogProject()
    const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
    const expected = Array.from({ length: 100 }, (_, index) => `scale-${String(index).padStart(3, "0")}`)
    await Promise.all(
      expected.map((id) =>
        writeExpertSquadPackage({
          directory: path.join(root, "scale", id),
          definition: scalePackageDefinition(id),
        }),
      ),
    )
    const readText = spyOn(Filesystem, "readText")
    try {
      const observed: string[] = []
      let cursor: string | undefined
      do {
        const page = await PromptProfileResolver.searchCatalog({
          projectDirectory: project.path,
          view: "installations",
          cursor,
          limit: 20,
        })
        expect(page.entries.length).toBeLessThanOrEqual(20)
        observed.push(
          ...page.entries
            .filter((entry) => entry.source.kind === "installed_package" && entry.source.namespace === "scale")
            .map((entry) => entry.id),
        )
        cursor = page.next_cursor ?? undefined
      } while (cursor)
      expect(observed).toEqual(expected)
      const fixtureManifestReads = readText.mock.calls
        .map(([file]) => path.resolve(String(file)))
        .filter((file) => file.startsWith(path.resolve(root)) && path.basename(file) === "expert-squad.jsonc")
      expect(fixtureManifestReads).toHaveLength(100)
    } finally {
      readText.mockRestore()
    }
  }, 0)

  test("returns one bounded Mission capability_search result for a hundred held Squads", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
        const heldExpertSquadIDs = Array.from({ length: 100 }, (_, index) =>
          `mission-scale-${String(index).padStart(3, "0")}`,
        )
        await Promise.all(
          heldExpertSquadIDs.map((id) =>
            writeExpertSquadPackage({
              directory: path.join(root, "scale", id),
              definition: scalePackageDefinition(id),
            }),
          ),
        )
        // Direct fixture materialization bypasses Manager mutation receipts, so
        // publish the same inventory-generation change that a formal install emits.
        await ExpertSquadRegistry.invalidateAvailable()
        const mission = await ensureMissionSession({
          missionID: "hundred-held-capability-search",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: heldExpertSquadIDs as [string, ...string[]],
        })
        const search = await CapabilitySearchTool.init({ agentID: "mission" })
        const result = await search.execute(
          { query: "", kinds: ["expert_squad"], limit: 20 },
          {
            sessionID: mission.id,
            messageID: "msg_hundred_held_capability_search",
            callID: "call_hundred_held_capability_search",
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface(["capability_search"], []),
            metadata() {},
            async ask() {},
          },
        )
        const output = JSON.parse(result.output) as {
          catalog_revision: string
          caller: string
          visible_expert_squad_count: number
          held_expert_squad_count: number
          product_pillar: string
          results: Array<Record<string, unknown>>
        }
        const mismatchedPillarResult = await search.execute(
          { query: "", kinds: ["expert_squad"], product_pillar: "work", limit: 1 },
          {
            sessionID: mission.id,
            messageID: "msg_mismatched_pillar_capability_search",
            callID: "call_mismatched_pillar_capability_search",
            agent: "mission",
            abort: new AbortController().signal,
            messages: [],
            executionSurface: Tool.executionSurface(["capability_search"], []),
            metadata() {},
            async ask() {},
          },
        )
        const mismatchedPillarOutput = JSON.parse(mismatchedPillarResult.output) as {
          product_pillar: string
          requested_product_pillar: string
          results: Array<Record<string, unknown>>
        }
        expect({
          metadata: result.metadata,
          caller: output.caller,
          visibleCount: output.visible_expert_squad_count,
          heldCount: output.held_expert_squad_count,
          productPillar: output.product_pillar,
          resultCount: output.results.length,
          resultKeys: [...new Set(output.results.flatMap((entry) => Object.keys(entry)))].sort(),
          outputBytes: Buffer.byteLength(result.output, "utf8") < 50_000,
          mismatchedPillar: {
            effective: mismatchedPillarOutput.product_pillar,
            requested: mismatchedPillarOutput.requested_product_pillar,
            resultCount: mismatchedPillarOutput.results.length,
          },
        }).toEqual({
          metadata: {
            catalog_revision: expect.stringMatching(/^[a-f0-9]{64}$/),
            caller: "mission",
            result_count: 20,
            visible_expert_squad_count: 100,
            held_expert_squad_count: 100,
            product_pillar: "code",
            truncated: false,
          },
          caller: "mission",
          visibleCount: 100,
          heldCount: 100,
          productPillar: "code",
          resultCount: 20,
          resultKeys: [
            "aliases",
            "availability",
            "catalog_revision",
            "description",
            "discoverable_by",
            "name",
            "next_owner",
            "product_pillars",
            "ref",
            "score",
          ],
          outputBytes: true,
          mismatchedPillar: { effective: "code", requested: "work", resultCount: 1 },
        })
      },
    })
  }, 0)

  test("keeps independent bounded cursor sequences stable for different queries", async () => {
    await using project = await catalogProject()
    const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
    for (const id of ["alpha-one", "alpha-two", "beta-one", "beta-two"]) {
      await writeExpertSquadPackage({
        directory: path.join(root, "scale", id),
        definition: scalePackageDefinition(id),
      })
    }
    const alpha = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: "alpha",
      limit: 1,
    })
    const beta = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: "beta",
      limit: 1,
    })
    const alphaTail = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: "alpha",
      cursor: alpha.next_cursor ?? undefined,
      limit: 1,
    })
    const betaTail = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: "beta",
      cursor: beta.next_cursor ?? undefined,
      limit: 1,
    })
    expect([...alpha.entries, ...alphaTail.entries].map((entry) => entry.id)).toEqual(["alpha-one", "alpha-two"])
    expect([...beta.entries, ...betaTail.entries].map((entry) => entry.id)).toEqual(["beta-one", "beta-two"])
  }, 0)

  test("pages one exact Squad workflow catalog without unbounded inspection output", async () => {
    await using project = await catalogProject()
    const id = "workflow-scale"
    const definition = scalePackageDefinition(id)
    const scheduler = definition.manifest.capability_projection.scheduler
    definition.manifest.capability_projection.agents = {
      "scale-worker": {
        ...scheduler,
        label: "Scale Worker",
        base_role: "delegated-worker",
      },
    }
    definition.manifest.capability_projection.virtual_workflows = Object.fromEntries(
      Array.from({ length: 100 }, (_, index) => {
        const workflowID = `workflow-${String(index).padStart(3, "0")}`
        return [
          workflowID,
          {
            label: `Workflow ${index}`,
            description: `${workflowID} ${"x".repeat(1_800)}`,
            nodes: {
              "scale-worker": {
                agent_id: "scale-worker",
                description: `Produce ${workflowID}.`,
                depends_on: [],
              },
            },
          },
        ]
      }),
    )
    await writeExpertSquadPackage({
      directory: path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "scale", id),
      definition,
    })
    const beforeUpdate = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: id,
    })

    const observed: string[] = []
    let workflowCursor: string | undefined
    do {
      const page = await PromptProfileResolver.catalogInspection({
        projectDirectory: project.path,
        id,
        installationScope: "project",
        namespace: "scale",
        workflowCursor,
      })
      expect(page?.workflows.length).toBeLessThanOrEqual(20)
      expect(JSON.stringify(page).length).toBeLessThan(50_000)
      observed.push(...(page?.workflows.map((workflow) => workflow.id) ?? []))
      workflowCursor = page?.next_workflow_cursor ?? undefined
    } while (workflowCursor)
    expect(observed).toEqual(Array.from({ length: 100 }, (_, index) => `workflow-${String(index).padStart(3, "0")}`))

    const replacement = scalePackageDefinition(id)
    replacement.manifest.version = "2026.08.10.2"
    replacement.manifest.capability_projection.agents = definition.manifest.capability_projection.agents
    replacement.manifest.capability_projection.virtual_workflows = {
      "replacement-workflow": {
        label: "Replacement Workflow",
        description: "The exact updated declaration workflow.",
        nodes: {
          "scale-worker": {
            agent_id: "scale-worker",
            description: "Produce the updated workflow evidence.",
            depends_on: [],
          },
        },
      },
    }
    const packageRoot = path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "scale", id)
    await rm(packageRoot, { recursive: true, force: true })
    await writeExpertSquadPackage({ directory: packageRoot, definition: replacement })
    await ExpertSquadRegistry.invalidateAvailable()
    const afterUpdate = await PromptProfileResolver.searchCatalog({
      projectDirectory: project.path,
      view: "installations",
      query: id,
    })
    const updatedInspection = await PromptProfileResolver.catalogInspection({
      projectDirectory: project.path,
      id,
      installationScope: "project",
      namespace: "scale",
    })
    expect({
      revisionCount: new Set([beforeUpdate.catalog_revision, afterUpdate.catalog_revision]).size,
      version: updatedInspection?.version,
      workflowIDs: updatedInspection?.workflows.map((workflow) => workflow.id),
    }).toEqual({ revisionCount: 2, version: "2026.08.10.2", workflowIDs: ["replacement-workflow"] })
  }, 0)

  test("pages discovery diagnostics while inventory status stays count-only", async () => {
    await using project = await catalogProject()
    const root = ExpertSquadPackageLocations.project(project.path).packagesRoot
    for (let index = 0; index < 45; index++) {
      const packageRoot = path.join(root, "broken", `broken-${String(index).padStart(3, "0")}`)
      await mkdir(packageRoot, { recursive: true })
      await writeFile(path.join(packageRoot, "expert-squad.jsonc"), "{}\n", "utf8")
    }
    const status = await PromptProfileResolver.settingsInventory(project.path)
    expect(status).toMatchObject({ issue_count: 45, warning_count: 0 })
    const observed: string[] = []
    let cursor: string | undefined
    do {
      const page = await PromptProfileResolver.catalogDiagnostics({
        projectDirectory: project.path,
        cursor,
        limit: 20,
      })
      expect(page.entries.length).toBeLessThanOrEqual(20)
      observed.push(...page.entries.map((entry) => entry.kind))
      cursor = page.next_cursor ?? undefined
    } while (cursor)
    expect(observed).toEqual(Array.from({ length: 45 }, () => "issue"))
  }, 0)

  test("filters Market installation state before pagination and loads exact selected detail", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: () =>
        ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id: "evolution-lab",
          installationScope: "project",
        }),
    })
    const firstPage = await ExpertSquadPackageManager.payloadMarketPage({
      projectDirectory: project.path,
      limit: 5,
    })
    const secondPage = await ExpertSquadPackageManager.payloadMarketPage({
      projectDirectory: project.path,
      cursor: firstPage.nextCursor ?? undefined,
      limit: 5,
    })
    expect({
      totalCount: firstPage.totalCount,
      firstCount: firstPage.entries.length,
      secondCount: secondPage.entries.length,
      uniqueCount: new Set([...firstPage.entries, ...secondPage.entries].map((entry) => entry.id)).size,
    }).toEqual({
      totalCount: payloadPackageSources.length,
      firstCount: 5,
      secondCount: 5,
      uniqueCount: 10,
    })
    const installed = await ExpertSquadPackageManager.payloadMarketPage({
      projectDirectory: project.path,
      availability: "installed",
      query: "evolution-lab",
      limit: 1,
    })
    const detail = await ExpertSquadPackageManager.payloadMarketDetail({
      projectDirectory: project.path,
      id: "evolution-lab",
    })
    expect(installed).toMatchObject({
      totalCount: 1,
      nextCursor: null,
      entries: [{ id: "evolution-lab", installationScopes: ["project"] }],
    })
    expect(detail).toMatchObject({
      id: "evolution-lab",
      installations: [{ installationScope: "project", installedVersion: "2026.08.13.1" }],
    })
  }, 0)

  test("ranks Market packages from package-owned Skill and prompt evidence", async () => {
    await using project = await memoryProject()
    const skillMatch = await ExpertSquadPackageManager.payloadMarketPage({
      projectDirectory: project.path,
      availability: "available",
      query: "allocated loss adjustment expense",
      limit: 3,
    })
    const promptMatch = await ExpertSquadPackageManager.payloadMarketPage({
      projectDirectory: project.path,
      availability: "available",
      query: "apparent backtest success on changed scope",
      limit: 3,
    })
    expect({
      skillMatch: skillMatch.entries[0]?.id,
      promptMatch: promptMatch.entries[0]?.id,
    }).toEqual({
      skillMatch: "actuarial-reserving",
      promptMatch: "actuarial-reserving",
    })
  }, 0)

  test("keeps Market scope ordering and revision deterministic across Resolver call order", async () => {
    await using project = await catalogProject()
    const id = "review-debug"
    const globalRoot = path.join(ExpertSquadPackageLocations.global().packagesRoot, "scale", id)
    const projectRoot = path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "scale", id)
    try {
      await writeExpertSquadPackage({ directory: globalRoot, definition: scalePackageDefinition(id) })
      await writeExpertSquadPackage({ directory: projectRoot, definition: scalePackageDefinition(id) })
      await ExpertSquadRegistry.invalidateAvailable()
      const marketFirst = await ExpertSquadPackageManager.payloadMarketPage({
        projectDirectory: project.path,
        query: id,
      })
      await ExpertSquadRegistry.invalidateAvailable()
      await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, query: id })
      const resolverFirst = await ExpertSquadPackageManager.payloadMarketPage({
        projectDirectory: project.path,
        query: id,
      })
      const projection = (page: typeof marketFirst) => ({
        revision: page.catalogRevision,
        scopes: page.entries[0]?.installationScopes,
      })
      expect([projection(marketFirst), projection(resolverFirst)]).toEqual([
        { revision: marketFirst.catalogRevision, scopes: ["project", "global"] },
        { revision: marketFirst.catalogRevision, scopes: ["project", "global"] },
      ])
    } finally {
      await rm(globalRoot, { recursive: true, force: true })
      await ExpertSquadRegistry.invalidateAvailable()
    }
  }, 0)

  test("serves active, index, inspection, status, diagnostics, and selected detail route contracts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const app = new Hono().route("/expert-squad", ExpertSquadRoutes())
        const request = async (path: string) => {
          const response = await app.fetch(new Request(`http://opencorvus.test/expert-squad/${path}`))
          expect(response.status, path).toBe(200)
          return response.json() as Promise<Record<string, unknown>>
        }
        const active = await request("catalog")
        const page = await request("search?view=installations&limit=2")
        const directory = encodeURIComponent(project.path)
        const inspection = await request(`inspect?directory=${directory}&id=base&installationScope=built_in`)
        const status = await request("inventory-status")
        const diagnostics = await request("diagnostics?limit=20")
        const detail = await request(`settings/detail?directory=${directory}&id=base&installationScope=built_in`)
        const market = await request("market?limit=5")
        const marketDetail = await request("market/detail?id=deep-research")
        expect(active).toMatchObject({ active: { effective: "base" }, default: "base" })
        expect(page).toMatchObject({ entries: expect.any(Array) })
        expect(inspection).toMatchObject({ id: "base", workflow_count: 1, next_workflow_cursor: null })
        expect(status).toMatchObject({
          effective_count: (page as { total_count: number }).total_count,
          issue_count: 0,
          warning_count: 0,
        })
        expect(diagnostics).toMatchObject({ entries: [], total_count: 0, next_cursor: null })
        expect(detail).toMatchObject({ selected: { id: "base", source: { kind: "built_in" } } })
        expect(market).toMatchObject({ entries: expect.any(Array), total_count: payloadPackageSources.length })
        expect(marketDetail).toMatchObject({ id: "deep-research" })
      },
    })
  }, 0)

  test("projects one project-over-global identity and keeps a damaged project reservation authoritative", async () => {
    await using project = await catalogProject()
    const id = "override-scale-contract"
    const globalRoot = path.join(ExpertSquadPackageLocations.global().packagesRoot, "scale", id)
    const projectRoot = path.join(ExpertSquadPackageLocations.project(project.path).packagesRoot, "scale", id)
    try {
      const beforeIDs = (
        await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, limit: 20 })
      ).entries.map((entry) => entry.id)
      const globalDefinition = scalePackageDefinition(id)
      globalDefinition.manifest.label = "Global Scale Contract"
      const projectDefinition = scalePackageDefinition(id)
      projectDefinition.manifest.label = "Project Scale Contract"
      await writeExpertSquadPackage({ directory: globalRoot, definition: globalDefinition })
      await writeExpertSquadPackage({ directory: projectRoot, definition: projectDefinition })
      await ExpertSquadRegistry.invalidateAvailable()
      const effective = await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, limit: 20 })
      const installations = await PromptProfileResolver.searchCatalog({
        projectDirectory: project.path,
        view: "installations",
        query: id,
        limit: 20,
      })
      const status = await PromptProfileResolver.settingsInventory(project.path)
      expect(effective.entries.find((entry) => entry.id === id)).toMatchObject({
        display_label: "scale/Project Scale Contract",
        source: { kind: "installed_package", installation_scope: "project", namespace: "scale" },
      })
      expect(installations.entries.filter((entry) => entry.id === id).map((entry) => entry.source)).toEqual([
        { kind: "installed_package", installation_scope: "global", namespace: "scale" },
        { kind: "installed_package", installation_scope: "project", namespace: "scale" },
      ])
      expect(status.warning_count).toBe(1)

      await writeFile(path.join(projectRoot, "expert-squad.jsonc"), "{}\n", "utf8")
      await ExpertSquadRegistry.invalidateAvailable()
      const reserved = await PromptProfileResolver.searchCatalog({ projectDirectory: project.path, limit: 20 })
      expect(reserved.entries.map((entry) => entry.id)).toEqual(beforeIDs)
      expect((await PromptProfileResolver.settingsInventory(project.path)).issue_count).toBe(1)
    } finally {
      await rm(globalRoot, { recursive: true, force: true })
      await ExpertSquadRegistry.invalidateAvailable()
    }
  }, 0)
})
