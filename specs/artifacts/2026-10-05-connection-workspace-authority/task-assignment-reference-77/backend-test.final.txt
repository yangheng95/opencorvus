import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import { Server } from "../../src/server/server"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { requireTaskPackageRevisionBinding } from "../../src/engine/task-package-revision-binding"
import type { ExpertSquadCatalog } from "../../src/expert-squad/catalog"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

function definition(name: string, version: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 2,
      namespace: "assignment",
      id: "pinned-name",
      label: "Declared assignment label",
      name,
      version,
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Inspect assignment metadata.",
        selection_guidance: "Use for assignment metadata inspection.",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# ${name}\n`, "selector.md": "# Assignment metadata inspection\n" },
  }
}

test("public Task catalog retains actual immutable name/version while an ordinary Session sees current installed metadata", async () => {
  await using project = await memoryProject("task-assignment-name")
  const saved = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const packageDirectory = path.join(
        ExpertSquadPackageLocations.project(project.path).packagesRoot,
        "assignment",
        "pinned-name",
      )
      await writeExpertSquadPackage({
        directory: packageDirectory,
        definition: definition("Original pinned name", "2026.10.07.1"),
      })
      await ExpertSquadRegistry.invalidateAvailable()
      const config = Config.mergeOverlay(await Config.get(), { prompt_profile: { active: "pinned-name" } })
      const revision = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: project.path,
        config,
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: project.path,
        title: "Assignment metadata contract",
        metadata: { configOverlay: { prompt_profile: { active: "pinned-name" } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Assignment metadata contract",
        request: "Inspect the actual assigned package metadata",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision: revision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: revision.packageDigest,
          timeCreated: now,
        }),
      })
      const binding = requireTaskPackageRevisionBinding(taskID)
      if (!path.resolve(packageDirectory).startsWith(path.resolve(project.path) + path.sep)) {
        throw new Error("Assignment fixture package replacement must remain within its owned Project")
      }
      await fs.rm(packageDirectory, { recursive: true, force: true })
      await writeExpertSquadPackage({
        directory: packageDirectory,
        definition: definition("Updated installed name", "2026.10.07.2"),
      })
      await ExpertSquadRegistry.invalidateAvailable()
      const ordinary = await Session.create({
        kind: "assistant",
        title: "Current effective assignment",
        metadata: { configOverlay: { prompt_profile: { active: "pinned-name" } } },
      })
      return { rootSessionID: root.id, ordinarySessionID: ordinary.id, binding }
    },
  })
  await Instance.disposeAll()
  for (const [sessionID, name, version] of [
    [saved.rootSessionID, "Original pinned name", "2026.10.07.1"],
    [saved.ordinarySessionID, "Updated installed name", "2026.10.07.2"],
  ]) {
    const response = await runOutsideInstanceContext(() =>
      Server.App().request(`/expert-squad/catalog?sessionID=${sessionID}`, {
        headers: { "x-opencorvus-directory": project.path },
      }),
    )
    expect(response.status).toBe(200)
    const catalog = (await response.json()) as ExpertSquadCatalog
    expect({
      name: catalog.active.name,
      version: catalog.active.package_revision.version,
      id: catalog.active.package_revision.id,
      scope: catalog.scope,
    }).toEqual({ name, version, id: "pinned-name", scope: { kind: "session", directory: project.path, sessionID } })
    if (sessionID === saved.rootSessionID) expect(catalog.active.package_revision).toEqual(saved.binding)
  }
}, 60_000)
