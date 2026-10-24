import fs from "node:fs/promises"
import path from "node:path"
import { setDurablePublicationTestCutHook } from "@opencorvus-ai/util/durable-publication"
import { Instance } from "../../src/project/instance"
import { Global } from "../../src/global"
import { GlobalBus } from "../../src/bus/global"
import { Worktree } from "../../src/worktree"
import { WorktreeReadiness } from "../../src/worktree/readiness"
import { Project } from "../../src/project/project"
import { Database } from "../../src/storage/db"
import { ProjectDirectoryAdmission } from "../../src/project/directory-admission"

const [action, directory, name] = process.argv.slice(2)
if (!action || !directory || !name) throw new Error("usage: worktree-readiness-child <action> <directory> <name>")
const target = path.join(Worktree.worktreesRoot(directory), name)
let phase = 0
function installEntryRetarget() {
  let retargeted = false
  setDurablePublicationTestCutHook(async (cut, kind) => {
    if (cut !== "subject-queued" || kind !== "worktree-readiness-resource" || retargeted) return
    retargeted = true
    if (process.platform === "win32") await fs.rmdir(target)
    else await fs.unlink(target)
    await fs.symlink(
      path.join(Worktree.worktreesRoot(directory), "reset-entry-other"),
      target,
      process.platform === "win32" ? "junction" : "dir",
    )
  })
}
setDurablePublicationTestCutHook(async (cut, kind) => {
  if (!kind.startsWith("worktree-readiness-")) return
  if (action === "contend" && cut === "subject-queued")
    await fs.writeFile(path.join(Global.Path.root, "contender"), "queued")
  if (cut === "phase-published") phase++
  if (
    (action === "populated-cut" && cut === "terminal-temp-synced") ||
    (action === "startup-cut" && cut === "phase-published" && phase === 3)
  ) {
    await fs.writeFile(path.join(target, "tracked.txt"), "retained operator bytes\n")
    process.exit(23)
  }
  if (action === "hold" && cut === "phase-published" && phase === 4) {
    await fs.writeFile(path.join(Global.Path.root, "holder"), "populated")
    while (true) {
      try {
        await fs.stat(path.join(Global.Path.root, "release"))
        break
      } catch {}
      await Bun.sleep(10)
    }
  }
})
const events: string[] = []
const sourceDirectoryKey = action.startsWith("reset-")
  ? (
      Database.allFinalized("SELECT directory, directory_key FROM project_directory_admission") as {
        directory: string
        directory_key: string
      }[]
    ).find((row) => path.resolve(row.directory).toLowerCase() === path.resolve(target).toLowerCase())?.directory_key
  : undefined
if (action === "reset-delete") {
  const owner = await Instance.provide({
    directory,
    fn: async () => ({ project: Instance.project, generation: Instance.projectGeneration }),
  })
  const { deleteProject } = await import("../../src/project/delete")
  const deletion = await deleteProject(owner.project, {
    actor: "user",
    source: "project.delete",
    surface: "api",
    requestID: `delete-${name}`,
    reason: "Isolated reset original occurrence deletion",
  })
  console.log(JSON.stringify({ deletion, generation: owner.generation, projectID: owner.project.id }))
  await Instance.disposeAll()
  process.exit(0)
}
GlobalBus.on("event", (event) => {
  if (event.payload.type.startsWith("worktree.")) events.push(event.payload.type)
})
try {
  const result = await Instance.provide({
    directory,
    fn: async () => {
      let error: unknown
      let info: Worktree.Info | undefined
      if (action === "initial-project") return { projectID: Instance.project.id, generation: Instance.projectGeneration }
      if (action.startsWith("reset-")) {
        let http: { status: number; body: unknown } | undefined
        if (action === "reset-setup") {
          await Project.update({
            projectID: Instance.project.id,
            commands: {
              start:
                process.platform === "win32"
                  ? "echo reset >> ..\\..\\..\\..\\..\\reset-effects.txt"
                  : "echo reset >> ../../../../../reset-effects.txt",
            },
          })
          await Worktree.create({ name })
        } else {
          if (action === "reset-populated-cut" || action === "reset-hold")
            Worktree.TestHooks.installAfterResetStartup(async () => {
              await fs.writeFile(path.join(target, "tracked.txt"), "retained reset operator bytes\n")
              if (action === "reset-populated-cut") process.exit(23)
              await fs.writeFile(path.join(Global.Path.root, "holder"), "reset populated")
              while (!(await fs.stat(path.join(Global.Path.root, "release")).catch(() => undefined)))
                await Bun.sleep(10)
            })
          if (action === "reset-hard-cut")
            Worktree.TestHooks.installAfterResetHard(async () => {
              await fs.writeFile(path.join(target, "tracked.txt"), "retained reset operator bytes\n")
              process.exit(23)
            })
          if (action === "reset-startup-cut")
            setDurablePublicationTestCutHook(async (cut, kind) => {
              if (!kind.startsWith("worktree-readiness-") || cut !== "phase-published") return
              phase++
              if (phase !== 3) return
              await fs.writeFile(path.join(target, "tracked.txt"), "retained reset operator bytes\n")
              process.exit(23)
            })
          if (action === "reset-contend") {
            await fs.writeFile(path.join(Global.Path.root, "warmed"), "ready")
            while (!(await fs.stat(path.join(Global.Path.root, "start")).catch(() => undefined))) await Bun.sleep(10)
            setDurablePublicationTestCutHook(async (cut, kind) => {
              if (kind.startsWith("worktree-readiness-") && cut === "subject-queued")
                await fs.writeFile(path.join(Global.Path.root, "contender"), "queued")
            })
          }
          if (action === "reset-entry-retarget") {
            installEntryRetarget()
          }
          if (action === "reset-late-retarget" || action === "reset-late-cut") {
            const original = ProjectDirectoryAdmission.ownsCurrentOccurrence
            let checks = 0
            ProjectDirectoryAdmission.ownsCurrentOccurrence = async (...args) => {
              const owned = await original(...args)
              if (owned && ++checks === 2) {
                if (process.platform === "win32") await fs.rmdir(target)
                else await fs.unlink(target)
                await fs.symlink(
                  path.join(Worktree.worktreesRoot(directory), "reset-entry-other"),
                  target,
                  process.platform === "win32" ? "junction" : "dir",
                )
              }
              return owned
            }
            Worktree.TestHooks.installAfterResetHard(async ({ directory }) => {
              await fs.writeFile(path.join(Global.Path.root, "effect-directory"), directory)
            })
            if (action === "reset-late-cut") Worktree.TestHooks.installAfterResetStartup(async ({ directory }) => {
              await fs.writeFile(path.join(directory, "tracked.txt"), "late physical retained bytes\n")
              process.exit(23)
            })
          }
          if (action === "reset-http") {
            const { ExperimentalRoutes } = await import("../../src/server/routes/experimental")
            const response = await ExperimentalRoutes().request("http://localhost/worktree/reset", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ directory: target, operationID: `reset-${name}` }),
            })
            http = { status: response.status, body: await response.json() }
          } else if (action !== "reset-read") {
            try {
              await Worktree.resetProjectWorktree({
                directory: target,
                operationID: `${action === "reset-new" ? "new" : "reset"}-${name}`,
              })
            } catch (caught) {
              error = caught
            }
          }
        }
        return {
          projectID: Instance.project.id,
          generation: Instance.projectGeneration,
          directory: target,
          tracked: await fs.readFile(path.join(target, "tracked.txt"), "utf8"),
          effects: (await fs.readFile(path.join(directory, "reset-effects.txt"), "utf8")).trim().split(/\r?\n/).length,
          readiness: await WorktreeReadiness.inspect({
            directory: target,
            projectID: Instance.project.id,
            projectGeneration: Instance.projectGeneration,
          }),
          error: error instanceof Error ? { name: error.name, data: (error as any).data } : null,
          admissions: Database.allFinalized("SELECT * FROM project_directory_admission"),
          occurrences: await WorktreeReadiness.history(target),
          sourceHistory: await WorktreeReadiness.history(
            target,
            { projectID: Instance.project.id, projectGeneration: Instance.projectGeneration },
            sourceDirectoryKey,
          ),
          http,
          effectDirectory: await fs.readFile(path.join(Global.Path.root, "effect-directory"), "utf8").catch(() => null),
        }
      }
      if (action === "recover-recorded") {
        return {
          recorded: await Worktree.recoverRecorded({ directory: target, branch: `opencorvus/${name}` }),
          tracked: await fs.readFile(path.join(target, "tracked.txt"), "utf8"),
        }
      }
      try {
        if (action === "create-entry-retarget") installEntryRetarget()
        if (action === "create-parent-retarget") {
          let switched = false
          setDurablePublicationTestCutHook(async (cut, kind) => {
            if (switched || cut !== "occurrence-published" || !kind.startsWith("worktree-readiness-v3-")) return
            switched = true
            const logicalRoot = Worktree.worktreesRoot(directory)
            if (process.platform === "win32") await fs.rmdir(logicalRoot)
            else await fs.unlink(logicalRoot)
            await fs.symlink(path.join(path.dirname(directory), "physical-parent-b"), logicalRoot,
              process.platform === "win32" ? "junction" : "dir")
          })
        }
        info = await Worktree.create({
          name,
          reuseIfValid: action === "reuse" || action === "contend" || action === "create-entry-retarget",
          startCommand:
            action === "fail"
              ? process.platform === "win32"
                ? "exit /b 17"
                : "exit 17"
              : "echo effect >> effects.txt",
        })
      } catch (caught) {
        error = caught
      }
      const occurrences = await WorktreeReadiness.history(target)
      let admission: string | undefined
      if (info) {
        try {
          Worktree.assertReady(info)
          admission = "ready"
        } catch (caught) {
          admission = (caught as Error).name
        }
      }
      return {
        info,
        error:
          error instanceof Error ? { name: error.name, message: (error as any).data?.message ?? error.message } : null,
        admission,
        tracked: await fs.readFile(path.join(info?.directory ?? target, "tracked.txt"), "utf8").catch(() => null),
        effects: (await fs.readFile(path.join(info?.directory ?? target, "effects.txt"), "utf8").catch(() => ""))
          .trim()
          .split(/\r?\n/)
          .filter(Boolean).length,
        occurrences,
        events,
      }
    },
  })
  console.log(JSON.stringify(result))
} finally {
  await Instance.disposeAll()
}
