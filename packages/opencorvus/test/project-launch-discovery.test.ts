import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { tmpdir } from "./fixture/fixture"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function discover(root: string) {
  const previous = process.env.OPENCORVUS_PROJECT_DIR
  process.env.OPENCORVUS_PROJECT_DIR = root
  try {
    const response = await Server.App().request("/global/projects/discover")
    return { status: response.status, body: await response.json() }
  } finally {
    if (previous === undefined) delete process.env.OPENCORVUS_PROJECT_DIR
    else process.env.OPENCORVUS_PROJECT_DIR = previous
  }
}

function registeredEntry(project: Project.Info) {
  return {
    id: project.id,
    directory: project.worktree,
    name: project.name ?? path.basename(project.worktree),
    marker: path.join(project.worktree, ".opencorvus"),
  }
}

test("launch discovery returns registered projects together with the launch project and its direct child", async () => {
  await using registered = await tmpdir()
  await using launch = await tmpdir()
  const { project } = await Project.fromDirectory(registered.path)
  const child = path.join(launch.path, "child")
  await fs.mkdir(path.join(launch.path, ".opencorvus"))
  await fs.mkdir(path.join(child, ".opencorvus"), { recursive: true })
  expect(await discover(launch.path)).toEqual({
    status: 200,
    body: {
      root: launch.path,
      defaultDirectory: launch.path,
      projects: [
        registeredEntry(project),
        { directory: launch.path, name: path.basename(launch.path), marker: path.join(launch.path, ".opencorvus") },
        { directory: child, name: "child", marker: path.join(child, ".opencorvus") },
      ],
    },
  })
})

test.each(["missing", "file"] as const)("%s launch root returns the registered inventory and a directory-free default", async (kind) => {
  await using registered = await tmpdir()
  await using launch = await tmpdir()
  const { project } = await Project.fromDirectory(registered.path)
  const root = path.join(launch.path, kind)
  if (kind === "file") await fs.writeFile(root, "The authored launch path is now a regular file.")
  expect(await discover(root)).toEqual({
    status: 200,
    body: { root, defaultDirectory: "", projects: [registeredEntry(project)] },
  })
})
