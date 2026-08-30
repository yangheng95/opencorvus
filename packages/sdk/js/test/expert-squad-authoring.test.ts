import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  EXPERT_SQUAD_MANIFEST_PATH,
  EXPERT_SQUAD_PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS,
  EXPERT_SQUAD_PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS,
  EXPERT_SQUAD_PLATFORM_ARTIFACT_TOOL_IDS,
  ExpertSquadValidationError,
  expertSquadAssetPath,
  renderExpertSquadPackageFiles,
  validateExpertSquadCollaboration,
  validateExpertSquadManifestDispatchTopology,
  validateExpertSquadPackageDefinition,
  writeExpertSquadPackage,
  type ExpertSquadCollaborationDefinition,
  type ExpertSquadManifestV2,
  type ExpertSquadPackageDefinition,
  type ExpertSquadPackageFile,
} from "../src/expert-squad-authoring"
import { createOpenCorvusClient } from "../src/client"
import { ExpertSquadManifestV2Schema } from "../src/expert-squad-manifest-v2"

function emptyResources() {
  return { capability_refs: [] }
}

function manifest(): ExpertSquadManifestV2 {
  return {
    product_pillars: ["code", "work"],
    schema_version: 2,
    namespace: "example",
    id: "example-squad",
    name: "Example squad",
    label: "Example squad",
    version: "2026.07.22.1",
    readme: "README.md",
    selector: {
      summary: "Example selection summary",
      selection_guidance: "Select for the concrete example only.",
      instructions: "selector.md",
    },
    capability_sets: {},
    capability_projection: {
      scheduler: { ...emptyResources(), base_role: "orchestrator" },
      agents: {
        "example-builder": {
          ...emptyResources(),
          label: "Example builder",
          base_role: "build",
          prompt: "agents/example-builder/system.md",
        },
      },
      virtual_workflows: {
        delivery: {
          label: "Delivery",
          description: "Deliver the concrete example.",
          nodes: {
            build: {
              agent_id: "example-builder",
              description: "Build the concrete example.",
              depends_on: [],
            },
          },
        },
      },
    },
  }
}

function definition(files: ExpertSquadPackageDefinition["files"] = {}): ExpertSquadPackageDefinition {
  return {
    manifest: manifest(),
    files: {
      "README.md": "# Runtime prompt\n",
      "selector.md": "# Selector\n",
      "agents/example-builder/system.md": "# Builder\n",
      ...files,
    },
  }
}

describe("expert squad authoring SDK", () => {
  test("projects discovery to schedulers and workers while reserving publication to workers", () => {
    expect(EXPERT_SQUAD_PLATFORM_ARTIFACT_DISCOVERY_TOOL_IDS).toEqual([
      "artifact_search",
      "artifact_read",
      "artifact_select",
    ])
    expect(EXPERT_SQUAD_PLATFORM_ARTIFACT_PUBLISH_TOOL_IDS).toEqual(["artifact_snapshot", "artifact_publish"])
    expect(EXPERT_SQUAD_PLATFORM_ARTIFACT_TOOL_IDS).toEqual([
      "artifact_search",
      "artifact_read",
      "artifact_select",
      "artifact_snapshot",
      "artifact_publish",
    ])
    const packageDefinition = definition()
    expect(packageDefinition.manifest.capability_projection.scheduler.capability_refs).toEqual([])
    expect(packageDefinition.manifest.capability_projection.agents["example-builder"]!.capability_refs).toEqual([])
    expect(validateExpertSquadPackageDefinition(packageDefinition)).toBe(packageDefinition)
  })

  test("accepts one Mission-owned Task and rejects an empty collaboration", () => {
    const source = manifest()
    source.id = "source-squad"
    const definition: ExpertSquadCollaborationDefinition = {
      schema_version: 1,
      stage_execution: "mission_task",
      id: "single-delivery",
      label: "Single delivery",
      inputs: ["source-brief"],
      outputs: ["accepted-delivery"],
      stages: [
        {
          id: "delivery",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [],
          consumes: ["source-brief"],
          produces: ["accepted-delivery"],
        },
      ],
    }

    expect(validateExpertSquadCollaboration({ definition, manifests: [source] })).toBe(definition)
    definition.stages = []
    expect(() => validateExpertSquadCollaboration({ definition, manifests: [source] })).toThrow(/at least one stage/)
  })

  test("validates connected fixed-profile Mission stage Tasks without creating runtime state", () => {
    const source = manifest()
    source.id = "source-squad"
    const delivery = manifest()
    delivery.id = "delivery-squad"
    const definition: ExpertSquadCollaborationDefinition = {
      schema_version: 1,
      stage_execution: "mission_task",
      id: "source-to-delivery",
      label: "Source to delivery",
      inputs: ["source-brief"],
      outputs: ["accepted-delivery"],
      stages: [
        {
          id: "source-observation",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [],
          consumes: ["source-brief"],
          produces: ["source-evidence"],
        },
        {
          id: "delivery",
          squad_id: "delivery-squad",
          workflow_id: "delivery",
          depends_on: ["source-observation"],
          consumes: ["source-evidence"],
          produces: ["accepted-delivery"],
        },
      ],
    }

    expect(validateExpertSquadCollaboration({ definition, manifests: [source, delivery] })).toBe(definition)
    expect(Object.keys(source)).not.toContain("active_stage")
  })

  test("accepts structurally valid Task collaboration without prescribing planning roles", () => {
    const source = manifest()
    source.id = "source-squad"
    const delivery = manifest()
    delivery.id = "delivery-squad"
    const collaboration: ExpertSquadCollaborationDefinition = {
      schema_version: 1,
      stage_execution: "mission_task",
      id: "source-to-delivery",
      label: "Source to delivery",
      inputs: ["source-brief"],
      outputs: ["accepted-delivery"],
      stages: [
        {
          id: "source-observation",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [],
          consumes: ["source-brief"],
          produces: ["source-evidence"],
        },
        {
          id: "delivery",
          squad_id: "delivery-squad",
          workflow_id: "delivery",
          depends_on: ["source-observation"],
          consumes: ["source-evidence"],
          produces: ["accepted-delivery"],
        },
      ],
    }

    expect(validateExpertSquadCollaboration({ definition: collaboration, manifests: [source, delivery] })).toBe(
      collaboration,
    )
  })

  test("accepts a once-per-Task package-owned planner topology with Delivery Slice subjects", () => {
    const packageOwnedTopology = manifest()
    packageOwnedTopology.capability_projection.agents["example-requirements"] = {
      ...emptyResources(),
      label: "Example requirements",
      base_role: "requirements",
    }
    packageOwnedTopology.capability_projection.agents["example-architect"] = {
      ...emptyResources(),
      label: "Example architect",
      base_role: "architect",
    }
    packageOwnedTopology.capability_projection.virtual_workflows.delivery!.nodes.requirements = {
      agent_id: "example-requirements",
      description: "Resolve requirements for the Task and its exact Delivery Slice revision subjects.",
      depends_on: [],
    }
    packageOwnedTopology.capability_projection.virtual_workflows.delivery!.nodes.architect = {
      agent_id: "example-architect",
      description: "Coordinate package-owned architecture.",
      depends_on: [],
    }
    const validated = validateExpertSquadManifestDispatchTopology(packageOwnedTopology)
    expect(validated).toBe(packageOwnedTopology)
    expect(Object.keys(validated.capability_projection.virtual_workflows.delivery!.nodes)).toEqual([
      "build",
      "requirements",
      "architect",
    ])
  })

  test("accepts Task-scoped Integrity with its explicit platform review execution contract", () => {
    const taskOnlyIntegrity = manifest()
    taskOnlyIntegrity.capability_projection.agents["example-builder"]!.base_role = "integrity"
    taskOnlyIntegrity.capability_projection.agents["example-builder"]!.execution_contract =
      "platform_integrity_review"

    expect(validateExpertSquadManifestDispatchTopology(taskOnlyIntegrity)).toBe(taskOnlyIntegrity)
  })

  test("reports the exact execution-contract mapping required by the Integrity runtime", () => {
    const ambiguousIntegrity = manifest()
    ambiguousIntegrity.capability_projection.agents["example-builder"]!.base_role = "integrity"
    expect(() => ExpertSquadManifestV2Schema.parse(ambiguousIntegrity)).toThrow(
      /integrity base_role requires the explicit platform_integrity_review execution contract/,
    )

    const misplacedContract = manifest()
    misplacedContract.capability_projection.agents["example-builder"]!.execution_contract =
      "platform_integrity_review"
    expect(() => ExpertSquadManifestV2Schema.parse(misplacedContract)).toThrow(
      /platform_integrity_review execution contract requires integrity base_role/,
    )
  })

  test("rejects invalid workflow references, dependency cycles, and reserved agents", () => {
    const unknownAgent = manifest()
    unknownAgent.capability_projection.virtual_workflows.delivery!.nodes.build!.agent_id = "missing-agent"
    expect(() => validateExpertSquadManifestDispatchTopology(unknownAgent)).toThrow(/unknown projected agent/)

    const unknownDependency = manifest()
    unknownDependency.capability_projection.virtual_workflows.delivery!.nodes.build!.depends_on = ["missing-node"]
    expect(() => validateExpertSquadManifestDispatchTopology(unknownDependency)).toThrow(/unknown dependency/)

    const cycle = manifest()
    cycle.capability_projection.virtual_workflows.delivery!.nodes.review = {
      agent_id: "example-builder",
      description: "Review the delivery.",
      depends_on: ["build"],
    }
    cycle.capability_projection.virtual_workflows.delivery!.nodes.build!.depends_on = ["review"]
    expect(() => validateExpertSquadManifestDispatchTopology(cycle)).toThrow(/dependency cycle/)

    const reservedAgent = manifest()
    reservedAgent.capability_projection.agents["universal-build"] =
      reservedAgent.capability_projection.agents["example-builder"]!
    expect(() => validateExpertSquadManifestDispatchTopology(reservedAgent)).toThrow(/Invalid key in record/)
  })

  test("rejects non-canonical dependency ordering in the shared dispatch topology", () => {
    const unsortedDependencies = manifest()
    unsortedDependencies.capability_projection.virtual_workflows.delivery!.nodes.prepare = {
      agent_id: "example-builder",
      description: "Prepare the delivery.",
      depends_on: [],
    }
    unsortedDependencies.capability_projection.virtual_workflows.delivery!.nodes.verify = {
      agent_id: "example-builder",
      description: "Verify the delivery.",
      depends_on: ["prepare", "build"],
    }
    expect(() => validateExpertSquadManifestDispatchTopology(unsortedDependencies)).toThrow(/canonically sorted/)
  })

  test("validates complete package entrypoint ownership before render or write", () => {
    const valid = definition()
    expect(validateExpertSquadPackageDefinition(valid)).toBe(valid)

    const missingReadme = definition()
    delete (missingReadme.files as Record<string, ExpertSquadPackageFile>)["README.md"]
    expect(() => validateExpertSquadPackageDefinition(missingReadme)).toThrow(/missing required package file README/)

    const blankSelector = definition({ "selector.md": " \n" })
    expect(() => validateExpertSquadPackageDefinition(blankSelector)).toThrow(/must not be blank: selector.md/)

    const wrongPromptOwner = definition()
    wrongPromptOwner.manifest.capability_projection.agents["example-builder"]!.prompt = "agents/other/system.md"
    expect(() => validateExpertSquadPackageDefinition(wrongPromptOwner)).toThrow(/canonical owner path/)

    const nonUtf8Prompt = definition({
      "agents/example-builder/system.md": Uint8Array.from([0xff, 0xfe]),
    })
    expect(() => validateExpertSquadPackageDefinition(nonUtf8Prompt)).toThrow(/must be UTF-8 text/)
  })

  test("reports malformed untyped manifest fields together in canonical path order", () => {
    let failure: unknown
    try {
      validateExpertSquadPackageDefinition({
        manifest: {
          schema_version: 1,
          id: "Invalid ID",
          selector: null,
          capability_projection: null,
        },
        files: null,
      })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(ExpertSquadValidationError)
    const diagnostics = (failure as ExpertSquadValidationError).diagnostics
    expect(diagnostics.length).toBeGreaterThan(4)
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual(
      [...diagnostics.map((diagnostic) => diagnostic.path)].sort(),
    )
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toContain("manifest.schema_version")
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toContain("manifest.capability_projection")
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toContain("files")
  })

  test.each([
    ["unknown squad", (definition: ExpertSquadCollaborationDefinition) => (definition.stages[1]!.squad_id = "missing")],
    [
      "unknown workflow",
      (definition: ExpertSquadCollaborationDefinition) => (definition.stages[1]!.workflow_id = "missing"),
    ],
    [
      "later stage dependency",
      (definition: ExpertSquadCollaborationDefinition) => (definition.stages[0]!.depends_on = ["delivery"]),
    ],
    [
      "disconnected evidence",
      (definition: ExpertSquadCollaborationDefinition) => (definition.stages[1]!.consumes = ["missing-evidence"]),
    ],
    [
      "duplicate output",
      (definition: ExpertSquadCollaborationDefinition) => (definition.stages[1]!.produces = ["source-evidence"]),
    ],
    [
      "non-canonical stage id",
      (definition: ExpertSquadCollaborationDefinition) => (definition.stages[1]!.id = "Delivery Stage"),
    ],
  ])("rejects collaboration %s", (_label, mutate) => {
    const source = manifest()
    source.id = "source-squad"
    const delivery = manifest()
    delivery.id = "delivery-squad"
    const definition = {
      schema_version: 1 as const,
      stage_execution: "mission_task" as const,
      id: "source-to-delivery",
      label: "Source to delivery",
      inputs: ["source-brief"],
      outputs: ["accepted-delivery"],
      stages: [
        {
          id: "source-observation",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [] as string[],
          consumes: ["source-brief"],
          produces: ["source-evidence"],
        },
        {
          id: "delivery",
          squad_id: "delivery-squad",
          workflow_id: "delivery",
          depends_on: ["source-observation"],
          consumes: ["source-evidence"],
          produces: ["accepted-delivery"],
        },
      ],
    } satisfies ExpertSquadCollaborationDefinition
    mutate(definition)
    expect(() => validateExpertSquadCollaboration({ definition, manifests: [source, delivery] })).toThrow()
  })

  test("keeps collaboration stages owned by the complete selected workflow", () => {
    const source = manifest()
    source.id = "source-squad"
    const definition: ExpertSquadCollaborationDefinition = {
      schema_version: 1,
      stage_execution: "mission_task",
      id: "source-to-review",
      label: "Source to review",
      inputs: ["source-brief"],
      outputs: ["source-evidence"],
      stages: [
        {
          id: "source",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [],
          consumes: ["source-brief"],
          produces: ["intermediate-evidence"],
        },
        {
          id: "review",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: ["source"],
          consumes: ["intermediate-evidence"],
          produces: ["source-evidence"],
        },
      ],
    }
    expect(validateExpertSquadCollaboration({ definition, manifests: [source] })).toBe(definition)
    expect(definition.stages.every((stage) => !Object.hasOwn(stage, "repair_agent_id"))).toBe(true)
  })

  test("rejects collaboration without Mission stage Task execution", () => {
    const source = manifest()
    source.id = "source-squad"
    const definition: ExpertSquadCollaborationDefinition = {
      schema_version: 1,
      stage_execution: "mission_task",
      id: "source-to-review",
      label: "Source to review",
      inputs: ["source-brief"],
      outputs: ["source-evidence"],
      stages: [
        {
          id: "source",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: [],
          consumes: ["source-brief"],
          produces: ["intermediate-evidence"],
        },
        {
          id: "review",
          squad_id: "source-squad",
          workflow_id: "delivery",
          depends_on: ["source"],
          consumes: ["intermediate-evidence"],
          produces: ["source-evidence"],
        },
      ],
    }
    ;(definition as { stage_execution: string }).stage_execution = "shared_task"
    expect(() => validateExpertSquadCollaboration({ definition, manifests: [source] })).toThrow(/mission_task/)
  })

  test("authors tool-only assets beneath the canonical self-contained package root", () => {
    expect(expertSquadAssetPath("report/template.html")).toBe("assets/report/template.html")
    expect(() => expertSquadAssetPath("../outside.json")).toThrow(/canonical/i)
  })

  test("renders the generated manifest type and caller-owned package files", () => {
    const binary = Uint8Array.from([0, 1, 2, 255])
    const files = renderExpertSquadPackageFiles(
      definition({
        "README.md": "# Runtime prompt\n",
        "selector.md": "# Selector\n",
        "agents/example-builder/system.md": "# Builder\n",
        [expertSquadAssetPath("report.template.html")]: "<!doctype html><title>Report</title>\n",
        "lib/evidence.bin": binary,
      }),
    )

    expect(JSON.parse(String(files[EXPERT_SQUAD_MANIFEST_PATH]))).toEqual(manifest())
    expect(files["lib/evidence.bin"]).toEqual(binary)
    expect(Object.keys(files)).toEqual([
      "agents/example-builder/system.md",
      "assets/report.template.html",
      EXPERT_SQUAD_MANIFEST_PATH,
      "lib/evidence.bin",
      "README.md",
      "selector.md",
    ])
  })

  test("writes one new package directory and never overwrites it", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-authoring-"))
    const directory = path.join(parent, "source")
    const packageDefinition = definition()

    const result = await writeExpertSquadPackage({ directory, definition: packageDefinition })
    expect(result.directory).toBe(path.resolve(directory))
    expect(JSON.parse(await readFile(path.join(directory, EXPERT_SQUAD_MANIFEST_PATH), "utf8"))).toEqual(manifest())
    expect(await readFile(path.join(directory, "README.md"), "utf8")).toBe("# Runtime prompt\n")

    await expect(writeExpertSquadPackage({ directory, definition: packageDefinition })).rejects.toMatchObject({
      code: "EEXIST",
    })
    expect(await readFile(path.join(directory, "README.md"), "utf8")).toBe("# Runtime prompt\n")
  })

  test("rejects an illegal definition before creating its destination directory", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-legality-"))
    const directory = path.join(parent, "source")
    const invalid = definition()
    delete (invalid.files as Record<string, ExpertSquadPackageFile>)["selector.md"]

    await expect(writeExpertSquadPackage({ directory, definition: invalid })).rejects.toThrow(
      /missing required package file selector.md/,
    )
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" })
  })

  test.each([
    "../escape",
    "/absolute",
    "C:/absolute",
    "nested\\windows",
    "nested//empty",
    "nested/./dot",
    "nested/NUL.txt",
    "nested/trailing.",
    "nested/trailing ",
    "nested/e\u0301.txt",
  ])(
    "rejects unsafe package path %s",
    (relativePath) => {
      expect(() => renderExpertSquadPackageFiles(definition({ [relativePath]: "unsafe" }))).toThrow(
        /expert squad package path/i,
      )
    },
  )

  test("rejects manifest ownership, normalized duplicates, and file-directory collisions", () => {
    expect(() => renderExpertSquadPackageFiles(definition({ "expert-squad.jsonc": "{}" }))).toThrow(
      "is owned by the expert squad package manifest",
    )
    expect(() => renderExpertSquadPackageFiles(definition({ "Tool.ts": "A", "tool.ts": "B" }))).toThrow(
      "case-collides with package file",
    )
    expect(() => renderExpertSquadPackageFiles(definition({ agents: "file", "agents/worker.md": "child" }))).toThrow(
      "parent directory collides with package file",
    )
  })

  test("keeps the final directory absent and removes staging when a filesystem write fails", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-authoring-failure-"))
    const directory = path.join(parent, "source")
    const tooLongName = `${"z".repeat(300)}.md`

    await expect(
      writeExpertSquadPackage({
        directory,
        definition: definition({ "00-first.md": "written first", [tooLongName]: "cannot be written" }),
      }),
    ).rejects.toBeDefined()
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" })
    expect((await readdir(parent)).filter((entry) => entry.startsWith(".source.staging-"))).toEqual([])
  })

  test("publishes one complete package under concurrent writers without overwriting it", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-authoring-concurrent-"))
    const directory = path.join(parent, "source")
    const results = await Promise.allSettled([
      writeExpertSquadPackage({ directory, definition: definition() }),
      writeExpertSquadPackage({ directory, definition: definition() }),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect(JSON.parse(await readFile(path.join(directory, EXPERT_SQUAD_MANIFEST_PATH), "utf8"))).toEqual(manifest())
    expect((await readdir(parent)).filter((entry) => entry.startsWith(".source.staging-"))).toEqual([])
  })

  test("generated client validates the authored folder through the project-scoped route", async () => {
    let request: Request | undefined
    const client = createOpenCorvusClient({
      baseUrl: "http://127.0.0.1:7878",
      directory: "C:/projects/sdk-validation",
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        request = input instanceof Request ? input : new Request(input, init)
        return Response.json(manifest())
      }) as typeof fetch,
    })

    const result = await client.expertSquad.validateFolder({ sourceDirectory: "C:/authoring/example-squad" })
    expect(result.error).toBeUndefined()
    expect(result.data).toEqual(manifest())
    expect(request).toBeDefined()
    const url = new URL(request!.url)
    expect(url.pathname).toBe("/expert-squad/validate-folder")
    expect(url.searchParams.get("directory")).toBe("C:/projects/sdk-validation")
    expect(await request!.json()).toEqual({ sourceDirectory: "C:/authoring/example-squad" })
  })
})
