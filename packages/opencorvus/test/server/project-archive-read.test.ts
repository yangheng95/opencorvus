import { afterEach, expect, test } from "bun:test"
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { createEngineGitCheckpointTask } from "../fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

function request(directory: string, route: string, body?: Record<string, unknown>) {
  return runOutsideInstanceContext(() => Server.App().request(route, {
    method: body ? "POST" : "GET",
    headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  }))
}

for (const kind of ["task", "mission"] as const) {
  test(`${kind} archives export exact current files and identity from a protected Git project`, async () => {
    await using project = await memoryProject(`archive-${kind}`)
    await using other = await memoryProject(`archive-other-${kind}`)
    await fs.mkdir(path.join(project.path, ".gitignore"))
    const source = `Source material for the ${kind} archive.\n`
    await fs.writeFile(path.join(project.path, "project-source.txt"), source)
    await fs.writeFile(path.join(other.path, "project-source.txt"), "Same path in a different project.\n")

    const projectResponse = await request(project.path, "/project/current")
    expect(projectResponse.status).toBe(200)
    const owner = (await projectResponse.json()) as { id: string; worktree: string }
    let subject: { id: string; manifest: Record<string, string> }
    if (kind === "task") {
      const taskID = await Instance.provideProjectIdentity({
        directory: project.path,
        fn: () => createEngineGitCheckpointTask({ projectPath: project.path, title: "Archive source for Task" }),
      })
      subject = { id: taskID, manifest: { taskID } }
    } else {
      const draft = await request(project.path, "/mission/draft", {
        title: "Archive source for Mission",
        request: "Keep the exact original archive request.",
        requestID: "archive-protected-mission",
        productPillar: "work",
        expertSquadIDs: ["base"],
      })
      expect(draft.status).toBe(200)
      const { missionID, sessionID } = (await draft.json()) as { missionID: string; sessionID: string }
      subject = { id: missionID, manifest: { missionID, sessionID } }
    }

    const route = `/${kind}/${subject.id}/project-archive`
    const response = await request(project.path, route)
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe("application/zip")
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="${subject.id}-project.zip"`)
    expect(response.headers.get("x-opencorvus-archive-file-count")).toBe("2")

    const reader = new ZipReader(new BlobReader(new Blob([await response.arrayBuffer()])))
    try {
      const entries = await reader.getEntries()
      const archiveSource = entries.filter((entry) => entry.filename.startsWith("project/"))
      expect(archiveSource.map((entry) => entry.filename)).toEqual([
        "project/.opencorvus-test-project-identity",
        "project/project-source.txt",
      ])
      expect(await archiveSource[1]!.getData!(new TextWriter())).toBe(source)
      const manifest = entries.find((entry) => entry.filename === `opencorvus-${kind}-execution-flow/manifest.json`)!
      expect(JSON.parse(await manifest.getData!(new TextWriter()))).toMatchObject({
        schema: `opencorvus.${kind}-project-archive.v1`,
        project: { id: owner.id, worktree: owner.worktree },
        projectFileCount: 2,
        ...subject.manifest,
      })
    } finally {
      await reader.close()
    }

    const foreign = await request(other.path, route)
    expect(foreign.status).toBe(404)
    expect(JSON.stringify(await foreign.json())).toContain(
      `${kind === "task" ? "Task" : "Mission"} not found: ${subject.id}`,
    )
  }, 60_000)
}
