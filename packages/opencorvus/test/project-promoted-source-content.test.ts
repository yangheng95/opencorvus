import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { ImplicitProject } from "../src/project/implicit-project"
import { PromotionJournal } from "../src/project/promotion-journal"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("committed project promotion reads historical sources at the published location after reopening", async () => {
  await using parent = await memoryProject("promoted-source-parent")
  const anonymous = await ImplicitProject.create()
  const relative = path.join("资料", "说明.txt")
  const historicalPath = path.join(anonymous.directory, relative)
  const content = "项目整理\r\n记录编号：824\n"
  await fs.mkdir(path.dirname(historicalPath), { recursive: true })
  await fs.writeFile(historicalPath, content)
  const promoted = await Instance.provide({
    directory: anonymous.directory,
    fn: () => ImplicitProject.promote({
      project: anonymous.project,
      name: "named sources",
      destinationParent: parent.path,
      beforeMove: () => Instance.dispose(),
    }),
  })
  const publishedPath = path.join(promoted.directory, relative)
  expect(await fs.readFile(publishedPath, "utf8")).toBe(content)
  // A new resource at the old address must not determine the cited project's bytes.
  await fs.mkdir(path.dirname(historicalPath), { recursive: true })
  await fs.writeFile(historicalPath, "a different file at the old address\n")
  await Instance.provide({ directory: promoted.directory, fn: async () => {
    expect(await File.readSource(historicalPath)).toEqual({ type: "text", content })
    const authority = {
      projectID: Instance.project.id,
      projectGeneration: Instance.projectGeneration,
      worktree: Instance.worktree,
      file: historicalPath,
    }
    expect(await PromotionJournal.resolveSourcePath(authority)).toBe(publishedPath)
    for (const current of [
      { ...authority, projectID: "another-project" },
      { ...authority, projectGeneration: randomUUID() },
      { ...authority, worktree: parent.path },
      { ...authority, file: anonymous.directory + "-sibling/说明.txt" },
    ]) expect(await PromotionJournal.resolveSourcePath(current)).toBe(current.file)
  } })
  await Instance.disposeAll()
  await Instance.provide({ directory: promoted.directory, fn: async () => {
    expect(await File.readSource(historicalPath)).toEqual({ type: "text", content })
    expect(await File.readSource(publishedPath)).toEqual({ type: "text", content })
  } })
}, 60_000)

test("a rolled back publication reads its restored source and retains the rollback receipt", async () => {
  await using parent = await memoryProject("rolled-back-source-parent")
  const anonymous = await ImplicitProject.create()
  const source = path.join(anonymous.directory, "source.txt")
  const content = "restored source bytes\n"
  await fs.writeFile(source, content)
  const failure = new Error("source publication interrupted after preparation")
  {
    using hook = ImplicitProject.PromotionTestHooks.installAfterPrepared(() => { throw failure })
    await expect(Instance.provide({
      directory: anonymous.directory,
      fn: () => ImplicitProject.promote({
        project: anonymous.project,
        name: "rolled-back sources",
        destinationParent: parent.path,
        beforeMove: () => Instance.dispose(),
      }),
    })).rejects.toBe(failure)
  }
  const receipt = (await PromotionJournal.all()).find((entry) => entry.projectID === anonymous.project.id)!
  expect(receipt.terminal).toBe("rolled_back")
  await Instance.provide({ directory: anonymous.directory, fn: async () => {
    expect(await File.readSource(source)).toEqual({ type: "text", content })
    expect(await PromotionJournal.resolveSourcePath({
      projectID: Instance.project.id,
      projectGeneration: Instance.projectGeneration,
      worktree: receipt.destination,
      file: source,
    })).toBe(source)
  } })
}, 60_000)
