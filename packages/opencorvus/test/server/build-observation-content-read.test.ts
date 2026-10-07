import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance, runOutsideInstanceContext } from "@/project/instance"
import { Session } from "@/session"
import { Server } from "@/server/server"
import { Identifier } from "@/id/id"
import { ConfigPaths } from "@/config/paths"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { buildObservationRefName } from "@/engine/build-observation-ref"
import { beginBuildObservationCleanup, resolveBuildObservationGitDir } from "@/engine/build-observation-cleanup"
import { recordTaskLevelBuildHostObservation } from "@/engine/persist"
import { collectBuildContributionDiffs, pinBuildObservationTree } from "@/build/agent"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { persistEstablishedTask } from "../fixture/engine-task"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

test("cold Build observation reads preserve immutable Git bytes and Project ownership without an execution model", async () => {
  await using project = await memoryProject("build-content-owner64")
  await using other = await memoryProject("build-content-other64")
  const hello = "hello immutable resource!\n"
  const notes = Array.from(
    { length: 20 },
    (_, index) => `line ${String(index + 1).padStart(2, "0")} ${"x".repeat(17)}\n`,
  ).join("")
  const fixture = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Immutable Build reader" })
      const now = Date.now()
      const packageRevision = {
        scope: "built_in" as const,
        projectID: null,
        namespace: "builtin",
        id: "base",
        version: "2026.08.31.1",
        packageDigest: "c".repeat(64),
      }
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Immutable Build reader",
        request: "Read immutable Build content",
        source: "test",
        productPillar: "code",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const artifactID = Identifier.ascending("artifact")
      beginBuildObservationCleanup({
        observationID: artifactID,
        taskID,
        gitDir: await resolveBuildObservationGitDir(project.path),
        activate: false,
      })
      const base = await pinBuildObservationTree({
        worktreeDir: project.path,
        refName: buildObservationRefName(artifactID, "base"),
      })
      await fs.writeFile(path.join(project.path, "hello.txt"), hello)
      await fs.writeFile(path.join(project.path, "notes.txt"), notes)
      const head = await pinBuildObservationTree({
        worktreeDir: project.path,
        refName: buildObservationRefName(artifactID, "head"),
      })
      const diffs = await collectBuildContributionDiffs(project.path, base)
      recordTaskLevelBuildHostObservation({
        id: artifactID,
        taskID,
        executionMode: "current_project",
        diffBaseRef: base,
        diffHeadRef: head,
        diffs,
        observedArtifactLocators: [],
        sourceArtifactLocators: [],
        now: Date.now(),
      })
      return { taskID, sessionID: root.id, artifactID, diffs }
    },
  })
  const config = ConfigPaths.projectFile(project.path)
  await fs.mkdir(path.dirname(config), { recursive: true })
  await fs.writeFile(
    config,
    JSON.stringify({ model: "build-reader-unavailable/model", small_model: "build-reader-unavailable/model" }),
  )
  const endpoint = `/task/${fixture.taskID}/build-observation/${fixture.artifactID}/content`
  await runOutsideInstanceContext(async () => {
    const read = async (directory: string, file: string, offset: number, length: number) =>
      Server.App().request(
        `${endpoint}?${new URLSearchParams({ file, side: "after", offset: String(offset), length: String(length) })}`,
        { headers: { "x-opencorvus-directory": directory } },
      )
    for (const [file, text, bytes] of [
      ["hello.txt", hello, 26],
      ["notes.txt", notes, 520],
    ] as const) {
      const object = fixture.diffs.find((diff) => diff.file === file)?.after
      if (!object) throw new Error(`Production observation has no after object for ${file}`)
      expect(object.bytes).toBe(bytes)
      const response = await read(project.path, file, 0, bytes)
      if (response.status !== 200)
        console.log("cold Build content original response", response.status, await response.clone().json())
      expect({
        status: response.status,
        text: await response.text(),
        range: response.headers.get("content-range"),
        object: response.headers.get("x-opencorvus-git-object"),
        bytes: response.headers.get("x-opencorvus-object-bytes"),
        complete: response.headers.get("x-opencorvus-content-complete"),
        binary: response.headers.get("x-opencorvus-content-binary"),
      }).toEqual({
        status: 200,
        text,
        range: `bytes 0-${bytes - 1}/${bytes}`,
        object: object.oid,
        bytes: String(bytes),
        complete: "1",
        binary: "0",
      })
      const partial = await read(project.path, file, 3, 7)
      expect({
        status: partial.status,
        text: await partial.text(),
        range: partial.headers.get("content-range"),
        object: partial.headers.get("x-opencorvus-git-object"),
        complete: partial.headers.get("x-opencorvus-content-complete"),
      }).toEqual({
        status: 200,
        text: text.slice(3, 10),
        range: `bytes 3-9/${bytes}`,
        object: object.oid,
        complete: "0",
      })
      await fs.writeFile(path.join(project.path, file), "Current working text differs.\n")
      const again = await read(project.path, file, 0, bytes)
      expect({
        status: again.status,
        text: await again.text(),
        object: again.headers.get("x-opencorvus-git-object"),
      }).toEqual({ status: 200, text, object: object.oid })
    }
    const crossProject = await read(other.path, "hello.txt", 0, 26)
    expect({ status: crossProject.status, body: await crossProject.json() }).toEqual({
      status: 404,
      body: { name: "NotFoundError", data: { message: `Task not found: ${fixture.taskID}` } },
    })
    const executionConfig = await Server.App().request(`/session/${fixture.sessionID}/config`, {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: executionConfig.status, body: await executionConfig.json() }).toMatchObject({
      status: 400,
      body: {
        name: "ProviderModelNotFoundError",
        data: { providerID: "build-reader-unavailable", modelID: "model", suggestions: [] },
      },
    })
  })
})
